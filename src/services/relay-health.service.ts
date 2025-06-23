
interface RelayHealth {
  url: string;
  latency: number[];
  errors: number;
  lastSeen: number;
  successRate: number;
}

export class RelayHealthMonitor {
  private relayHealth: Map<string, RelayHealth> = new Map();
  private static readonly MAX_LATENCY_SAMPLES = 10;
  private static readonly HEALTH_THRESHOLD = 0.7; // 70% success rate

  constructor() {
    this.initializeHealthMetrics();
  }

  private initializeHealthMetrics() {
    // Clear existing metrics
    this.relayHealth.clear();
  }

  public initializeMetrics(relay: string, metrics: { successRate: number; avgLatency: number }) {
    this.relayHealth.set(relay, {
      url: relay,
      latency: [metrics.avgLatency], // Initialize with the average latency as the only sample
      errors: metrics.successRate < 1 ? 1 : 0, // Approximate error count based on success rate
      lastSeen: Date.now(),
      successRate: metrics.successRate
    });
  }

  public recordSuccess(relay: string, latency: number) {
    const health = this.getOrCreateHealth(relay);
    health.latency.push(latency);
    if (health.latency.length > RelayHealthMonitor.MAX_LATENCY_SAMPLES) {
      health.latency.shift();
    }
    health.lastSeen = Date.now();
    this.updateSuccessRate(relay);
  }

  public recordError(relay: string) {
    const health = this.getOrCreateHealth(relay);
    health.errors++;
    this.updateSuccessRate(relay);
  }

  private getOrCreateHealth(relay: string): RelayHealth {
    if (!this.relayHealth.has(relay)) {
      this.relayHealth.set(relay, {
        url: relay,
        latency: [],
        errors: 0,
        lastSeen: Date.now(),
        successRate: 1.0
      });
    }
    return this.relayHealth.get(relay)!;
  }

  private updateSuccessRate(relay: string) {
    const health = this.relayHealth.get(relay)!;
    const totalAttempts = health.latency.length + health.errors;
    health.successRate = totalAttempts > 0 ? health.latency.length / totalAttempts : 1;
  }

  public getHealthyRelays(): string[] {
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    return Array.from(this.relayHealth.values())
      .filter(health => {
        const isHealthy = health.successRate >= RelayHealthMonitor.HEALTH_THRESHOLD;
        const isRecent = (now - health.lastSeen) < STALE_THRESHOLD;
        return isHealthy && isRecent;
      })
      .sort((a, b) => {
        // Sort by success rate and average latency
        const avgLatencyA = a.latency.reduce((sum, l) => sum + l, 0) / a.latency.length;
        const avgLatencyB = b.latency.reduce((sum, l) => sum + l, 0) / b.latency.length;
        return b.successRate - a.successRate || avgLatencyA - avgLatencyB;
      })
      .map(health => health.url);
  }

  public getRelayMetrics(): Record<string, { successRate: number; avgLatency: number }> {
    const metrics: Record<string, { successRate: number; avgLatency: number }> = {};
    
    this.relayHealth.forEach((health, relay) => {
      const avgLatency = health.latency.length > 0
        ? health.latency.reduce((sum, l) => sum + l, 0) / health.latency.length
        : 0;
      
      metrics[relay] = {
        successRate: health.successRate,
        avgLatency
      };
    });

    return metrics;
  }
}
