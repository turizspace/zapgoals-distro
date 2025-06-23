import type { Event as NostrEvent } from 'nostr-tools';

export const calculateZapStats = (goal: number, received: number) => {
  const percent = goal ? Math.min(100, (received / goal) * 100) : 0;
  const percentDisplay = percent.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const balance = goal ? Math.max(0, goal - received) : 0;

  return {
    percent,
    percentDisplay,
    balance,
    received
  };
};

export const extractZapAmount = (event: NostrEvent): number => {
  if (!event || !event.tags) return 0;
  
  // Try direct amount tag
  const amountTag = event.tags.find(t => t[0] === 'amount');
  if (amountTag && amountTag[1]) {
    const amount = parseInt(amountTag[1], 10);
    if (!isNaN(amount)) return amount;
  }

  // Try description tag JSON
  const descTag = event.tags.find(t => t[0] === 'description');
  if (descTag && descTag[1]) {
    try {
      const descObj = JSON.parse(descTag[1]);
      if (descObj && descObj.tags && Array.isArray(descObj.tags)) {
        const descAmountTag = descObj.tags.find((t: any[]) => t[0] === 'amount');
        if (descAmountTag && descAmountTag[1]) {
          const amount = parseInt(descAmountTag[1], 10);
          if (!isNaN(amount)) return amount;
        }
      }
    } catch {}
  }

  return 0;
};
