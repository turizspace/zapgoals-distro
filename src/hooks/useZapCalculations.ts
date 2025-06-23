import { useCallback } from 'react';
import type { NostrEvent } from 'nostr-tools';
import type { ZapStats } from '../types';

export const useZapCalculations = () => {
  const calculateZapStats = useCallback((goalEvent: NostrEvent, zapEvents: NostrEvent[]): ZapStats => {
    let content: any = {};
    try { content = JSON.parse(goalEvent.content); } catch {}
    
    // Get goal amount from tags first, then content
    const tagAmount = goalEvent.tags?.find(t => t[0] === 'amount')?.[1];
    const goalAmount = tagAmount ? parseInt(tagAmount, 10) : (content.goal || content.target || 0);
    
    // Calculate total zapped
    const total = zapEvents.reduce((sum, zap) => {
      const amountTag = zap.tags.find(t => t[0] === 'amount');
      if (amountTag?.[1]) {
        const amount = parseInt(amountTag[1], 10);
        if (!isNaN(amount)) return sum + amount;
      }
      return sum;
    }, 0);

    // Calculate balance and percentage
    const balance = goalAmount ? Math.max(0, goalAmount - total) : 0;
    const percent = goalAmount ? Math.min(100, (total / goalAmount) * 100) : 0;
    const percentDisplay = percent.toLocaleString(undefined, { 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 3 
    });

    return { total, percent: percentDisplay, balance };
  }, []);

  return { calculateZapStats };
};
