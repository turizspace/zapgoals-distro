// Service for handling Nostr operations
import { SimplePool, type Event, getPublicKey, utils } from 'nostr-tools';
import type { NostrProfile } from '../types';
import { RelayHealthMonitor } from './relay-health.service';
import { loadRelayMetrics, saveRelayMetrics } from '../utils/storage-utils';

export class NostrService {
  private pool: SimplePool;
  private relays: string[];
  private activeSubscriptions: Set<string>;
  private healthMonitor: RelayHealthMonitor;
  private static readonly DEFAULT_TIMEOUT = 5000;
  private static readonly METRICS_SAVE_INTERVAL = 30000; // Save metrics every 30 seconds
  private static readonly MIN_HEALTHY_RELAYS = 3;

  constructor(relays: string[]) {
    this.pool = new SimplePool();
    this.relays = relays;
    this.activeSubscriptions = new Set();
    this.healthMonitor = new RelayHealthMonitor();

    // Load saved metrics if available
    const savedMetrics = loadRelayMetrics();
    if (savedMetrics) {
      Object.entries(savedMetrics).forEach(([relay, metrics]) => {
        this.healthMonitor.initializeMetrics(relay, metrics);
      });
    }

    // Start periodic metrics saving
    setInterval(() => {
      const metrics = this.healthMonitor.getRelayMetrics();
      saveRelayMetrics(metrics);
    }, NostrService.METRICS_SAVE_INTERVAL);
  }

  async close() {
    this.pool.close(this.relays);
  }

  private async fetchWithTimeout<T>(promise: Promise<T>, relay?: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      const result = await Promise.race([
        promise,
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), NostrService.DEFAULT_TIMEOUT)
        )
      ]);
      
      if (relay) {
        this.healthMonitor.recordSuccess(relay, Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      console.error('Fetch timeout:', error);
      if (relay) {
        this.healthMonitor.recordError(relay);
      }
      return null;
    }
  }

  private get healthyRelays(): string[] {
    const healthy = this.healthMonitor.getHealthyRelays();
    return healthy.length >= NostrService.MIN_HEALTHY_RELAYS ? healthy : this.relays;
  }

  private getAmountFromTags(tags: string[][]): number {
    const amountTag = tags.find(t => t[0] === 'amount');
    if (!amountTag?.[1]) return 0;
    const amount = parseInt(amountTag[1], 10);
    return isNaN(amount) ? 0 : amount;
  }

  async fetchProfile(pubkey: string): Promise<NostrProfile | null> {
    try {
      const event = await this.fetchWithTimeout(
        this.pool.get(this.healthyRelays, { 
          kinds: [0], 
          authors: [pubkey], 
          limit: 1 
        })
      );
      
      if (!event) return null;
      
      try {
        const content = JSON.parse(event.content);
        return {
          name: content.name,
          display_name: content.display_name,
          about: content.about,
          picture: content.picture,
          nip05: content.nip05,
          lud06: content.lud06,
          lud16: content.lud16
        };
      } catch (error) {
        console.error('Failed to parse profile content:', error);
        return null;
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }  async fetchZapGoals(pubkey?: string, limit = 50): Promise<Event[]> {
    try {
      const filter = pubkey 
        ? { kinds: [9041], authors: [pubkey], limit }
        : { kinds: [9041], limit };

      const eventsArrays = await Promise.all(
        this.healthyRelays.map(relay => 
          this.fetchWithTimeout(this.pool.get([relay], filter), relay)
        )
      );
      
      const uniqueGoals = new Map<string, Event>();
      eventsArrays
        .filter((ev): ev is Event => !!ev)
        .forEach(ev => {
          uniqueGoals.set(ev.id, ev);
        });

      return Array.from(uniqueGoals.values());
    } catch (error) {
      console.error('Failed to fetch zap goals:', error);
      return [];
    }
  }

  async fetchZapTotal(eventId: string): Promise<number> {
    try {
      const zapEvents = await Promise.all(
        this.relays.map(relay => 
          this.fetchWithTimeout(
            this.pool.get([relay], { kinds: [9735], '#e': [eventId], limit: 100 })
          )
        )
      );

      const uniqueZaps = new Set(
        zapEvents
          .filter((zap): zap is Event => zap !== null)
          .map(zap => zap.id)
      );
      
      let total = 0;

      uniqueZaps.forEach(zapId => {
        const zap = zapEvents.find(z => z?.id === zapId);
        if (zap?.tags) {
          total += this.getAmountFromTags(zap.tags);
        }
      });

      return total;
    } catch (error) {
      console.error('Failed to fetch zap total:', error);
      return 0;
    }
  }

  async fetchZaps(eventIds: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    try {
      await Promise.all(
        eventIds.map(async id => {
          result[id] = await this.fetchZapTotal(id);
        })
      );
    } catch (error) {
      console.error('Failed to fetch zaps:', error);
    }
    return result;
  }

  subscribeToZaps(goalId: string, onZap: (amount: number) => void): void {
    if (this.activeSubscriptions.has(goalId)) return;

    this.activeSubscriptions.add(goalId);
    this.pool.subscribe(this.relays, {
      kinds: [9735],
      '#e': [goalId]
    }, {
      onevent: (event: Event) => {
        const amount = this.getAmountFromTags(event.tags);
        if (amount > 0) onZap(amount);
      }
    });
  }

  unsubscribeFromZaps(): void {
    this.activeSubscriptions.clear();
    this.pool.close(this.relays);
    // Recreate the pool for future use
    this.pool = new SimplePool();
  }

  async createZapRequest(recipientPubkey: string, amount: number, eventId?: string): Promise<Event> {
    const zapRequest: Partial<Event> = {
      kind: 9734,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [
        ['p', recipientPubkey],
        ['amount', amount.toString()],
        ['relays', ...this.relays]
      ]
    };

    if (eventId) {
      zapRequest.tags?.push(['e', eventId]);
    }

    zapRequest.tags?.push(['created_at', Math.floor(Date.now() / 1000).toString()]);
    return zapRequest as Event;
  }

  private parseNwcUri(nwcUri: string): { relayUrl: string; secret: string } {
    try {
      
      // Handle both nostr+walletconnect:// and nostr+walletconnect: schemes
      const cleanUri = nwcUri.replace(/^nostr\+walletconnect:\/\//, 'nostr+walletconnect:');
      const url = new URL(cleanUri);

      // Extract relay URL from query params
      const relayUrl = url.searchParams.get('relay');
      if (!relayUrl) {
        throw new Error('Missing relay parameter in NWC URI');
      }

      // Handle relay URLs that might need protocol
      const normalizedRelayUrl = relayUrl.startsWith('wss://') ? relayUrl : `wss://${relayUrl}`;

      // Extract secret key from pathname
      const secret = url.pathname.replace(/^\//, '');
      if (!secret) {
        throw new Error('Missing secret key in NWC URI');
      }

      // Validate relay URL format
      try {
        new URL(normalizedRelayUrl);
      } catch {
        throw new Error('Invalid relay URL format');
      }

      // Validate secret key format
      if (!/^[0-9a-f]{64}$/i.test(secret)) {
        throw new Error('Invalid secret key format');
      }

      return {
        relayUrl: normalizedRelayUrl,
        secret
      };
    } catch (error: any) {
      console.error('💥 NWC URI parse error:', error);
      throw new Error(`Invalid NWC URI format: ${error?.message || 'Unknown error'}`);
    }
  }

  async sendNwcZapRequest(nwcUri: string, event: Event): Promise<boolean> {
    if (typeof window === 'undefined' || !window.WebSocket) {
      throw new Error('WebSocket not available');
    }

    try {
      const { relayUrl, secret } = this.parseNwcUri(nwcUri);
      
      const ws = new window.WebSocket(relayUrl);

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          ws.close();
          clearTimeout(timeoutId);
        };

        const timeoutId = setTimeout(() => {
          cleanup();
          resolve(false);
        }, NostrService.DEFAULT_TIMEOUT);

        ws.addEventListener('open', () => {
          try {
            const secretBytes = utils.hexToBytes(secret);
            const pubkey = getPublicKey(secretBytes);
            
            ws.send(JSON.stringify([
              'REQ',
              'zapRequest',
              {
                kinds: [9734],
                authors: [pubkey]
              }
            ]));

            ws.send(JSON.stringify([
              'EVENT',
              event
            ]));
          } catch (e) {
            console.error('💥 Failed to send NWC request:', e);
            cleanup();
            reject(new Error('Failed to send NWC request'));
          }
        });

        ws.addEventListener('message', (msg: MessageEvent) => {
          try {
            const [type, , payload] = JSON.parse(msg.data.toString());
            if (type === 'OK' && payload === true) {
              cleanup();
              resolve(true);
            }
          } catch (e) {
          }
        });

        ws.addEventListener('error', (error) => {
          console.error('💥 WebSocket error:', error);
          cleanup();
          reject(new Error('WebSocket connection failed'));
        });

        ws.addEventListener('close', () => {
          cleanup();
          resolve(false);
        });
      });
    } catch (error) {
      console.error('💥 Failed to send NWC zap request:', error);
      throw error;
    }
  }

  subscribeToZapReceipts(eventId: string, onReceipt: (receipt: Event) => void): void {
    if (this.activeSubscriptions.has(`zap:${eventId}`)) return;

    this.activeSubscriptions.add(`zap:${eventId}`);
    this.pool.subscribe(this.relays, {
      kinds: [9735],
      '#e': [eventId]
    }, {
      onevent: (event: Event) => {
        onReceipt(event);
      }
    });
  }

  public getRelayHealth(): Record<string, { successRate: number; avgLatency: number }> {
    return this.healthMonitor.getRelayMetrics();
  }

  async fetchEventById(eventId: string): Promise<Event | null> {
    for (const relay of this.relays) {
      try {
        const event = await this.pool.get([relay], { ids: [eventId] });
        if (event) return event;
      } catch (e) {
        // Ignore relay errors, try next
      }
    }
    return null;
  }

  async getNwcBalance(nwcUri?: string): Promise<number | null> {
    try {
      const { NWCClient } = await import('./nwc.service');
      const nwc = nwcUri || (typeof window !== 'undefined' ? localStorage.getItem('zap-goals-nwc') : null);
      if (!nwc) return null;
      const client = new NWCClient({ nostrWalletConnectUrl: nwc });
      const { balance } = await client.getBalance();
      client.close();
      return balance;
    } catch {
      return null;
    }
  }

  async publishEvent(event: Event): Promise<void> {
    for (const relay of this.healthyRelays) {
      try {
        await this.pool.publish([relay], event);
      } catch (e) {
        // Optionally: log relay error
      }
    }
  }
}
