import type { NWCClient } from '../services/nwc.service';

export type NostrProfile = {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  banner?: string;
  website?: string;
};

export type ZapStats = {
  total: number;
  percent: string;
  balance: number;
};

export type ZapGoal = {
  id: string;
  title: string;
  description: string;
  goal: number;
  received: number;
};

export type ZapNotification = {
  zapper: string;
  zapperName: string;
  zapperAvatar: string;
  goalTitle: string;
  amount: number;
};

declare global {
  interface Window {
    nwcClient?: NWCClient;
  }
}
