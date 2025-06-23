import React, { useEffect, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import type { ZapNotification } from '../../../types';

interface ZapNotificationsPageProps {
  profile?: { 
    name?: string; 
    display_name?: string; 
    picture?: string; 
    npub?: string 
  } | null;
}

export const ZapNotificationsPage: React.FC<ZapNotificationsPageProps> = ({ profile }) => {
  const relays = [
    'wss://relay.nostr.band',
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.primal.net'
  ];
  const [zapFeed, setZapFeed] = useState<ZapNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function fetchZaps() {
      setLoading(true);
      if (!profile?.npub && !profile?.name && !profile?.display_name) return;

      try {
        const pool = new SimplePool();
        let pubkey = profile?.npub;
        if (!pubkey && profile?.name) pubkey = profile.name;

        // Fetch all kind 9041 zapgoals posted by this user
        const zapGoalEvents = await Promise.all(
          relays.map((relay: string) => pool.get([relay], { kinds: [9041], authors: pubkey ? [pubkey] : [], limit: 50 }))
        );
        const zapGoals = zapGoalEvents.filter((ev: any): ev is NostrEvent => !!ev);
        const zapGoalIds = zapGoals.map((ev: NostrEvent) => ev.id);

        // Fetch all kind 9735 zaps for these zapgoals
        let zapEvents: (NostrEvent | null)[] = [];
        if (zapGoalIds.length > 0) {
          zapEvents = await Promise.all(
            zapGoalIds.map(id => pool.get(relays, { kinds: [9735], '#e': [id], limit: 100 }))
          );
        }
        const zaps = zapEvents.filter((z): z is NostrEvent => !!z);

        // Build zap feed: who zapped, which goal, how much
        const zapFeedList = await Promise.all(zaps.map(async (zap: NostrEvent) => {
          const amountTag = zap.tags.find((t: any) => t[0] === 'amount');
          const amount = amountTag ? parseInt(amountTag[1], 10) : 0;
          
          // Find zapper pubkey
          const zapper = zap.pubkey;
          
          // Find which goal
          const goalIdTag = zap.tags.find((t: any) => t[0] === 'e');
          const goalId = goalIdTag ? goalIdTag[1] : '';
          
          // Find goal event
          const goalEvent = zapGoals.find((g: NostrEvent) => g.id === goalId);
          let goalTitle = 'Zap Goal';
          try {
            if (goalEvent) {
              const content = JSON.parse(goalEvent.content);
              goalTitle = content.title || 'Zap Goal';
            }
          } catch {}

          // Fetch zapper profile
          let zapperProfile: any = null;
          try {
            const profileEv = await (new SimplePool()).get(relays, { kinds: [0], authors: [zapper], limit: 1 });
            if (profileEv) {
              zapperProfile = JSON.parse(profileEv.content);
            }
          } catch {}

          return {
            zapper,
            zapperName: zapperProfile?.display_name || zapperProfile?.name || (zapper ? zapper.slice(0, 8) + '...' : 'Unknown'),
            zapperAvatar: zapperProfile?.picture || '/icon.jpeg',
            goalTitle,
            amount,
          };
        }));

        if (!ignore) setZapFeed(zapFeedList);
        setLoading(false);
        pool.close(relays);
      } catch {
        if (!ignore) setZapFeed([]);
        setLoading(false);
      }
    }
    fetchZaps();
    return () => { ignore = true; };
  }, [profile]);

  return (
    <div className="zap-notifications-page modern-card">
      <h2>Zap Notifications</h2>
      {loading && <div className="loading-theme">Loading...</div>}
      {!loading && zapFeed.length === 0 && <div className="notif-empty">No zaps yet.</div>}
      <div className="notif-feed-list">
        {zapFeed.map((zap, i) => (
          <div className="notif-feed-item" key={i}>
            <img src={zap.zapperAvatar} alt="zapper" className="notif-zapper-avatar" />
            <div className="notif-feed-info">
              <div><b>{zap.zapperName}</b> zapped <b>{zap.goalTitle}</b></div>
              <div className="notif-amount">{zap.amount} sats</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
