const STORAGE_KEYS = {
  RELAYS: 'zap-goals-relays',
  RELAY_METRICS: 'zap-goals-relay-metrics',
  NWC: 'zap-goals-nwc',
  KEYS: 'zap-goals-keys',
  THEME: 'zap-goals-theme',
  ZAP_ANALYTICS: 'zap-goals-analytics',
  ZAP_SUBSCRIPTIONS: 'zap-goals-zap-subscriptions',
} as const;

export function saveRelays(relays: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RELAYS, JSON.stringify(relays));
  } catch (error) {
    console.error('Failed to save relays:', error);
  }
}

export function loadRelays(): string[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RELAYS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load relays:', error);
    return null;
  }
}

export function saveRelayMetrics(metrics: Record<string, { successRate: number; avgLatency: number }>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RELAY_METRICS, JSON.stringify(metrics));
  } catch (error) {
    console.error('Failed to save relay metrics:', error);
  }
}

export function loadRelayMetrics(): Record<string, { successRate: number; avgLatency: number }> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RELAY_METRICS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load relay metrics:', error);
    return null;
  }
}

export function saveNwc(nwc: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NWC, nwc);
  } catch (error) {
    console.error('Failed to save NWC:', error);
  }
}

export function loadNwc(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.NWC);
  } catch (error) {
    console.error('Failed to load NWC:', error);
    return null;
  }
}

export function saveKeys(keys: { pubkey: string; privkey: string } | null): void {
  try {
    if (keys) {
      localStorage.setItem(STORAGE_KEYS.KEYS, JSON.stringify(keys));
    } else {
      localStorage.removeItem(STORAGE_KEYS.KEYS);
    }
  } catch (error) {
    console.error('Failed to save keys:', error);
  }
}

export function loadKeys(): { pubkey: string; privkey: string } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.KEYS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load keys:', error);
    return null;
  }
}

export function saveTheme(theme: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (error) {
    console.error('Failed to save theme:', error);
  }
}

export function loadTheme(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.THEME);
  } catch (error) {
    console.error('Failed to load theme:', error);
    return null;
  }
}

export function saveZapAnalytics(analytics: any): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ZAP_ANALYTICS, JSON.stringify(analytics));
  } catch (error) {
    console.error('Failed to save zap analytics:', error);
  }
}

export function loadZapAnalytics(): any {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ZAP_ANALYTICS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load zap analytics:', error);
    return null;
  }
}

export interface ZapSubscription {
  id: string; // unique id for the subscription
  goalId: string; // noteId or nevent of the goal
  goalName: string;
  amount: number; // in sats
  frequency: string; // e.g. 'daily', 'weekly', 'custom', or cron-like
  nextZap: number; // timestamp (ms) for next scheduled zap
  paused?: boolean;
}

export function saveZapSubscriptions(subs: ZapSubscription[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ZAP_SUBSCRIPTIONS, JSON.stringify(subs));
  } catch (error) {
    console.error('Failed to save subscriptions:', error);
  }
}

export function loadZapSubscriptions(): ZapSubscription[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ZAP_SUBSCRIPTIONS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load subscriptions:', error);
    return [];
  }
}
