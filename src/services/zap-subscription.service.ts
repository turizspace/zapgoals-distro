import { NostrService } from './nostr.service';
import { loadZapSubscriptions, saveZapSubscriptions, loadNwc } from '../utils/storage-utils';

// Helper to get ms interval from frequency string
function getIntervalMs(frequency: string): number {
  switch (frequency) {
    case 'daily': return 24 * 60 * 60 * 1000;
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    case 'monthly': return 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

export class ZapSubscriptionService {
  private timer: any = null;
  private interval: number = 60 * 1000; // check every 1 min
  private nostrService: NostrService;

  constructor(nostrService: NostrService) {
    this.nostrService = nostrService;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkAndZap(), this.interval);
    this.checkAndZap(); // run immediately on start
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async checkAndZap() {
    const nwc = loadNwc();
    if (!nwc) return;
    const subs = loadZapSubscriptions();
    const now = Date.now();
    let changed = false;
    for (const sub of subs) {
      if (sub.paused) continue;
      if (now >= sub.nextZap) {
        try {
          // Check NWC balance before zapping
          const balance = await this.nostrService.getNwcBalance(nwc);
          if (typeof balance === 'number' && balance < sub.amount) {
            // Optionally: notify user of insufficient balance
            window.dispatchEvent(new CustomEvent('zap-subscription-insufficient-balance', { detail: { sub, balance } }));
            continue;
          }
          await this.zapGoal(nwc, sub.goalId, sub.amount);
          sub.nextZap = now + getIntervalMs(sub.frequency);
          changed = true;
        } catch (e) {
          // Optionally: log or notify error
        }
      }
    }
    if (changed) saveZapSubscriptions(subs);
  }

  async zapGoal(nwc: string, goalId: string, amount: number) {
    // Fetch goal event to get recipient pubkey
    const event = await this.nostrService.fetchEventById(goalId);
    if (!event) throw new Error('Goal event not found');
    const recipientPubkey = event.pubkey;
    // Create zap request event
    const zapRequest = await this.nostrService.createZapRequest(recipientPubkey, amount, goalId);
    // Send zap via NWC
    await this.nostrService.sendNwcZapRequest(nwc, zapRequest);
  }
}
