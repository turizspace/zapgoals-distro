import 'websocket-polyfill';
import type { Event } from 'nostr-tools';
import { 
  getPublicKey,
  nip04,
  finalizeEvent,
} from 'nostr-tools';
import type { NWCEventResponse } from '../types/nwc/index';
import { 
  NWCDecryptionError, 
  NWCResponseError,
  NWCTimeoutError
} from '../types/nwc/index';

// No need for global crypto declarations as we're using nostr-tools

export interface NWCClientConfig {
  nostrWalletConnectUrl: string;
}

export interface PayInvoiceParams {
  invoice: string;
  amount?: number;  // Optional amount in msats
}

export interface PayZapParams {
  zapRequest: Event;
  amount: number;
  recipientAddress: string;
}

interface NWCInfo {
  pubkey: string;
  secret: string;
  relay: string;
  lud16?: string;
}

export class NWCClient {
  private ws: WebSocket | null = null;
  private requestId = 1;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private connectionPromise: Promise<void> | null = null;
  private info: NWCInfo;
  private capabilities: string[] = [];

  constructor(config: NWCClientConfig) {
    this.info = this.parseNWCUrl(config.nostrWalletConnectUrl);
    this.connect();
  }

  private parseNWCUrl(nwcUrl: string): NWCInfo {
    if (!nwcUrl) {
      throw new Error('NWC URL is required');
    }

    try {
      // Remove protocol and parse components
      const withoutProtocol = nwcUrl.replace(/^nostr\+walletconnect:\/?\/?/, '');
      const [pubkey, queryString] = withoutProtocol.split('?');
      
      if (!pubkey || !queryString) {
        throw new Error('Invalid NWC URL format');
      }

      const params = new URLSearchParams(queryString);
      const secret = params.get('secret');
      const relay = params.get('relay');
      const lud16: string | undefined = params.get('lud16') || undefined;

      if (!pubkey || !secret || !relay) {
        throw new Error('Invalid NWC URL: missing required parameters');
      }

      return { pubkey, secret, relay, lud16 };
    } catch (error) {
      console.error('NWC URL parsing error:', error);
      throw new Error('Invalid NWC URL format');
    }
  }

  // Convert hex string to bytes for compatibility with nostr-tools
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private async encrypt(content: any): Promise<string> {
    const startTime = performance.now();
    try {
      const msg = JSON.stringify(content);
      const secretBytes = this.hexToBytes(this.info.secret);
      const encrypted = await nip04.encrypt(secretBytes, this.info.pubkey, msg);
      const endTime = performance.now();
      console.log('✅ Encryption completed:', {
        durationMs: `${(endTime - startTime).toFixed(2)}ms`,
        inputLength: msg.length,
        outputLength: encrypted.length
      });
      return encrypted;
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new NWCResponseError('Failed to encrypt NWC request', 'ENCRYPTION_ERROR');
    }
  }

  private async decrypt(ciphertext: string): Promise<NWCEventResponse> {
    const startTime = performance.now();
    try {
      const secretBytes = this.hexToBytes(this.info.secret);
      const decrypted = await nip04.decrypt(secretBytes, this.info.pubkey, ciphertext);
      const parsed = JSON.parse(decrypted) as NWCEventResponse;
      const endTime = performance.now();
      
      console.log('✅ Decryption successful:', {
        durationMs: `${(endTime - startTime).toFixed(2)}ms`,
        resultType: typeof parsed,
        hasResult: !!parsed?.result,
        hasError: !!parsed?.error
      });

      if (parsed.error) {
        const { code = 'UNKNOWN_ERROR', message = 'Unknown error occurred' } = parsed.error;
        throw new NWCResponseError(message, code);
      }

      return parsed;
    } catch (error) {
      console.error('❌ Decryption failed:', {
        error,
        inputLength: ciphertext.length,
        pubkeyLength: this.info.pubkey.length
      });
      if (error instanceof NWCResponseError) {
        throw error;
      }
      throw new NWCDecryptionError(error instanceof Error ? error.message : 'Failed to decrypt NWC response');
    }
  }

  private async authenticate(): Promise<void> {
    const id = `info_${this.requestId++}`;

    await new Promise((resolve, reject) => {
      let hasProcessedEvent = false;

      const processCapabilities = (event: any) => {
        if (!hasProcessedEvent && event?.content) {
          hasProcessedEvent = true;
          this.capabilities = event.content.split(' ').map((c: string) => c.trim()).filter(Boolean);
          resolve(undefined);
          return true;
        }
        return false;
      };

      this.pendingRequests.set(id, { 
        resolve: (event: any) => {
          if (processCapabilities(event)) {
            this.pendingRequests.delete(id);
          }
        }, 
        reject 
      });

      // Request info event
      this.ws!.send(JSON.stringify(['REQ', id, { 
        kinds: [13194], 
        authors: [this.info.pubkey],
        limit: 1
      }]));

      setTimeout(() => {
        if (!hasProcessedEvent) {
          this.pendingRequests.delete(id);
          reject(new Error('Authentication timed out'));
        }
      }, 10000);
    });

    if (!this.capabilities.length) {
      throw new Error('No capabilities received from NWC wallet');
    }
  }

  private connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = this.info.relay.startsWith('wss://') ? this.info.relay : `wss://${this.info.relay}`;
      
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        reject(new Error('Failed to connect to NWC relay'));
        this.connectionPromise = null;
        return;
      }

      this.ws.onopen = async () => {
        try {
          await this.authenticate();
          resolve();
        } catch (error) {
          console.error('❌ Authentication failed:', error);
          this.ws?.close();
          reject(error);
          this.connectionPromise = null;
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const parsedData = JSON.parse(event.data.toString());

          if (!Array.isArray(parsedData) || parsedData.length < 2) {
            console.warn('⚠️ Invalid NWC message format:', parsedData);
            return;
          }

          const [type, messageId, data] = parsedData;

          // For EVENT messages, the actual event is in data
          if (type === 'EVENT' && data?.content) {
            try {
              // If this is a response to one of our requests, find the original request
              const originalRequest = Array.from(this.pendingRequests.entries())
                .find(([reqId, _]) => reqId.startsWith(messageId.split('_')[0]));

              if (originalRequest) {
                const [requestId, { resolve }] = originalRequest;
                resolve(data);
                this.pendingRequests.delete(requestId);
              }
            } catch (error) {
              console.error('❌ Failed to process event content:', error);
            }
          } else if (type === 'EOSE') {
            // End of stored events - handled by individual request timeouts
          } else if (type === 'OK' && data === true) {
            // Successful event publish
          } else if (type === 'NOTICE') {
            console.warn('⚠️ NWC notice:', messageId);
          } else if (type === 'ERROR' || type === 'CLOSED') {
            const error = new Error(`${type}: ${data || 'Unknown error'}`);
            console.error('❌ NWC error:', {
              type,
              messageId,
              error: data
            });
            
            // Find and reject any matching pending request
            const matchingRequest = Array.from(this.pendingRequests.entries())
              .find(([reqId, _]) => reqId.includes(messageId));
              
            if (matchingRequest) {
              const [requestId, { reject: rejectRequest }] = matchingRequest;
              rejectRequest(error);
              this.pendingRequests.delete(requestId);
            }
          }
        } catch (error) {
          console.error('❌ Failed to process NWC message:', error, 'Raw message:', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ NWC WebSocket error:', error);
        this.ws?.close();
        this.cleanup(`WebSocket error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        reject(error);
      };

      this.ws.onclose = (event) => {
        
        this.cleanup(event.reason || 'Connection closed');
      };

      // Set a connection timeout
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          const error = new Error('WebSocket connection timed out');
          this.cleanup(error.message);
          reject(error);
        }
      }, 10000);
    });

    return this.connectionPromise;
  }

  private cleanup(reason: string) {
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error(`Connection closed: ${reason}`));
    });
    this.pendingRequests.clear();
    this.connectionPromise = null;
    this.capabilities = [];
  }

  // Helper to ensure we're connected and authenticated before making requests
  private async ensureConnected(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    // Ensure we have capabilities
    if (!this.capabilities.length) {
      await this.authenticate();
    }
  }

  private async createEncryptedEvent(method: string, params: any = {}): Promise<any> {
    const encryptedContent = await this.encrypt({
      method,
      params
    });

    const event: any = {
      kind: 23194,
      pubkey: getPublicKey(this.hexToBytes(this.info.secret)),
      created_at: Math.floor(Date.now() / 1000),
      content: encryptedContent,
      tags: [['p', this.info.pubkey]]
    };

    // Use finalizeEvent to both compute the event id and sign it
    return finalizeEvent(event, this.hexToBytes(this.info.secret));
  }

  private async sendRequest(method: string, params: any = {}): Promise<any> {
    await this.ensureConnected();

    if (!this.capabilities.includes(method)) {
      console.error('❌ Missing capability:', method);
      throw new Error(`Method ${method} not supported by this NWC connection. Available methods: ${this.capabilities.join(', ')}`);
    }

    const id = `${method}_${this.requestId++}`;
    const requestStartTime = performance.now();
    

    // Create and publish the event
    const event = await this.createEncryptedEvent(method, params);
    
    // Determine timeouts based on method
    const publishTimeout = 30000; // 30s for publishing
    const replyTimeout = method.includes('pay_invoice') ? 300000 // 5min for payments
                      : method === 'get_balance' ? 120000 // 2min for balance
                      : 60000; // 1min for others

    const promise = new Promise((resolve, reject) => {
      // Set up response handling
      this.pendingRequests.set(id, {
        resolve: async (response: any) => {
          try {
            if (response?.content) {
              

              const decrypted = await this.decrypt(response.content);
          
              resolve(decrypted);
            } else {
              resolve(response);
            }
          } catch (error) {
            console.error('❌ Error processing response:', {
              id,
              method,
              error,
              elapsed: `${((performance.now() - requestStartTime) / 1000).toFixed(1)}s`
            });
            reject(error);
          }
        },
        reject
      });

      // Set up the publish timeout
      const publishTimeoutId = setTimeout(() => {
        if (!this.pendingRequests.has(id)) return; // Already resolved
        
        
        this.pendingRequests.delete(id);
        reject(new NWCTimeoutError(`Failed to publish ${method} request (timeout: ${publishTimeout/1000}s)`, "publish"));
      }, publishTimeout);

      // Set up the reply timeout
      const replyTimeoutId = setTimeout(() => {
        if (!this.pendingRequests.has(id)) return; // Already resolved
        
            
        this.pendingRequests.delete(id);
        reject(new NWCTimeoutError(`No response received for ${method} request (timeout: ${replyTimeout/1000}s)`, "reply"));
      }, replyTimeout);

      // Store the original resolve function
      const originalResolve = this.pendingRequests.get(id)!.resolve;
      
      // Update with wrapped resolve function that cleans up timeouts
      this.pendingRequests.set(id, {
        resolve: async (response: any) => {
          clearTimeout(publishTimeoutId);
          clearTimeout(replyTimeoutId);
          await originalResolve(response);
        },
        reject
      });
    });

    // Send the request event
    this.ws!.send(JSON.stringify(['EVENT', event]));

    // Set up subscription for the response
    const subId = `${method}_${this.requestId++}_sub`;
    this.ws!.send(JSON.stringify(['REQ', subId, {
      kinds: [23195],
      authors: [this.info.pubkey],
      '#e': [event.id],
      limit: 1
    }]));

    return promise;
  }

  public async getBalance(): Promise<{ balance: number }> {
    const response = await this.sendRequest('get_balance');
    if (response?.result) {
      // Convert msats to sats
      return { balance: Math.floor(response.result.balance / 1000) };
    }
    throw new Error('Failed to retrieve balance');
  }

  public async payInvoice(params: PayInvoiceParams): Promise<any> {
    return this.sendRequest('pay_invoice', params);
  }

  public async payZap(params: PayZapParams): Promise<any> {
    return this.sendRequest('pay_zap', params);
  }

  public close() {
    if (this.ws) {
      this.ws.close();
      this.cleanup('Connection closed by user');
    }
  }
}

// Singleton pattern: allow lazy initialization
let nwcService: NWCClient | null = null;

export function getNwcService(): NWCClient {
  if (!nwcService) {
    throw new Error('NWCClient not initialized. Call initializeNwcService(url) first.');
  }
  return nwcService;
}

export function initializeNwcService(nostrWalletConnectUrl: string): NWCClient {
  if (!nwcService) {
    nwcService = new NWCClient({ nostrWalletConnectUrl });
  }
  return nwcService;
}
