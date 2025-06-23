import { useEffect, useState, useCallback } from 'react';
import type { Event as NostrEvent } from 'nostr-tools';
import { NostrService } from '../services/nostr.service';
import type { NostrProfile } from '../types';

export const useNostrData = (relays: string[]) => {
  const [nostr] = useState(() => new NostrService(relays));

  useEffect(() => {
    return () => {
      nostr.close();
    };
  }, [nostr]);

  return nostr;
};

export const useProfile = (pubkey: string, relays: string[]) => {
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const nostr = useNostrData(relays);

  useEffect(() => {
    if (!pubkey) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let ignore = false;

    async function fetchProfile() {
      try {
        const data = await nostr.fetchProfile(pubkey);
        if (!ignore) {
          setProfile(data);
          setLoading(false);
        }
      } catch {
        if (!ignore) {
          setProfile(null);
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      ignore = true;
    };
  }, [pubkey, nostr]);

  return { profile, loading };
};

export const useZapGoals = (pubkey: string, relays: string[]) => {
  const [goals, setGoals] = useState<NostrEvent[]>([]);
  const [zaps, setZaps] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const nostr = useNostrData(relays);

  // Update zap total for a specific goal
  const updateZapTotal = useCallback((goalId: string, amount: number) => {
    setZaps(prev => ({
      ...prev,
      [goalId]: (prev[goalId] || 0) + amount
    }));
  }, []);

  useEffect(() => {
    if (!pubkey) {
      setGoals([]);
      setZaps({});
      setLoading(false);
      return;
    }

    let ignore = false;

    async function fetchGoals() {
      try {
        const goalEvents = await nostr.fetchZapGoals(pubkey);
        if (!ignore) {
          setGoals(goalEvents);
          
          // Initial zap totals fetch
          const initialZaps: Record<string, number> = {};
          await Promise.all(
            goalEvents.map(async (goal) => {
              const zapTotal = await nostr.fetchZaps([goal.id]);
              initialZaps[goal.id] = zapTotal[goal.id] || 0;
            })
          );
          
          if (!ignore) {
            setZaps(initialZaps);
            
            // Subscribe to new zaps
            goalEvents.forEach(goal => {
              nostr.subscribeToZaps(goal.id, (amount: number) => {
                if (!ignore) {
                  updateZapTotal(goal.id, amount);
                }
              });
            });
            
            setLoading(false);
          }
        }
      } catch {
        if (!ignore) {
          setGoals([]);
          setZaps({});
          setLoading(false);
        }
      }
    }

    fetchGoals();

    return () => {
      ignore = true;
      // Cleanup subscriptions
      nostr.unsubscribeFromZaps();
    };
  }, [pubkey, nostr, updateZapTotal]);

  const getZapAmount = useCallback((goalId: string) => zaps[goalId] || 0, [zaps]);

  return { goals, zaps, getZapAmount, loading };
};
