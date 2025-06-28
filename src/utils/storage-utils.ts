const STORAGE_KEYS = {
  RELAYS: 'zap-goals-relays',
  RELAY_METRICS: 'zap-goals-relay-metrics',
  NWC: 'zap-goals-nwc',
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
