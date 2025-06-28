import React, { useEffect, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { npubEncode } from '../../../npub';
import { ZapButton } from '../../../shared/components/ZapButton';
import { ZapProgress } from '../../../shared/components/ZapProgress';
import { GoalCard } from '../../../shared/components/GoalCard';
import '../../../styles/components/GlobalFeed.css';

interface GlobalFeedProps {
  relays: string[];
  onProfileClick: (pk: string, profileData?: {
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud06?: string;
    lud16?: string;
    banner?: string;
    website?: string;
  } | null) => void;
  nwc: string;
  onGoalClick: (goalId: string) => void;
}

export const GlobalFeed: React.FC<GlobalFeedProps> = ({ relays, onProfileClick, nwc, onGoalClick }) => {
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [zaps, setZaps] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async function fetchEventsAndProfiles() {
      setLoading(true);
      try {
        const pool = new SimplePool();
        const allRelays = [
          'wss://nos.lol',
          'wss://relay.nostr.band',
          'wss://relay.damus.io',
          'wss://nostr.mom',
          'wss://no.str.cr',
          ...relays
        ];
        
        // Fetch all kind 9041 zap goals from all relays
        const eventsArr = await Promise.all(
          allRelays.map(relay => pool.get([relay], { kinds: [9041], limit: 50 }))
        );
        const allEvents = eventsArr.filter((ev): ev is NostrEvent => !!ev);
        // Deduplicate by id
        const uniqueEvents = Array.from(new Map(allEvents.map(ev => [ev.id, ev])).values());
        setEvents(uniqueEvents);

        // Fetch unique pubkeys
        const pubkeys = Array.from(new Set(uniqueEvents.map(ev => ev.pubkey)));
        // Fetch kind 0 profiles for all pubkeys
        const profileEventsArr = await Promise.all(
          pubkeys.map(pk => pool.get(allRelays, { kinds: [0], authors: [pk], limit: 1 }))
        );
        const newProfiles: Record<string, any> = {};
        profileEventsArr.forEach((ev, i) => {
          if (ev) {
            try {
              const content = JSON.parse(ev.content);
              newProfiles[pubkeys[i]] = content;
            } catch {}
          }
        });
        setProfiles(newProfiles);

        // Fetch all zap events for all notes
        const noteIds = uniqueEvents.map(ev => ev.id);
        const zapMap: Record<string, number> = {};
        for (const id of noteIds) {
          let total = 0;
          // Fetch all zap events for this note from all relays
          const zapEvents: NostrEvent[] = [];
          for (const relay of allRelays) {
            const zap = await pool.get([relay], { kinds: [9735], '#e': [id], limit: 100 });
            if (zap && zap.tags) {
              zapEvents.push(zap);
            }
          }
          // Deduplicate zap events by id
          const uniqueZapEvents = Array.from(new Map(zapEvents.map(zap => [zap.id, zap])).values());
          // Sum all zap amounts for this note
          uniqueZapEvents.forEach(zap => {
            // 1. Direct amount tag
            const amountTag = zap.tags.find((t: any) => t[0] === 'amount');
            if (amountTag) {
              const amount = parseInt(amountTag[1], 10);
              if (!isNaN(amount)) total += amount;
            }
            // 2. Amount in description tag JSON
            const descTag = zap.tags.find((t: any) => t[0] === 'description');
            if (descTag && descTag[1]) {
              try {
                const descObj = JSON.parse(descTag[1]);
                if (descObj && descObj.tags && Array.isArray(descObj.tags)) {
                  const descAmountTag = descObj.tags.find((t: any) => t[0] === 'amount');
                  if (descAmountTag && descAmountTag[1]) {
                    const descAmount = parseInt(descAmountTag[1], 10);
                    if (!isNaN(descAmount)) total += descAmount;
                  }
                }
              } catch {}
            }
          });
          zapMap[id] = total;
        }
        setZaps(zapMap);
        setLoading(false);
        pool.close(allRelays);
      } catch (e) {
        setEvents([]);
        setProfiles({});
        setZaps({});
        setLoading(false);
      }
    })();
  }, [relays]);

  if (loading) return <div className="loading-theme">Loading Zap Goals...</div>;
  if (!events.length) return <div className="empty-theme">No Zap Goals found.</div>;

  // Deduplicate events by id to ensure unique keys
  const uniqueEvents = Array.from(new Map(events.map(ev => [ev.id, ev])).values());



  return (
    <div className="global-feed">
      <div className="feed-grid">
        {uniqueEvents.map(ev => {
     
          // Parse event content and tags for display
          let content: any = {};
          try { content = JSON.parse(ev.content); } catch { content = {}; }

          // Title: use content.title, or first 32 chars of content string, or fallback
          let title = content.title;
          if (!title) {
            if (typeof ev.content === 'string' && ev.content.length > 0) {
              title = ev.content.length > 48 ? ev.content.slice(0, 32) + '…' : ev.content;
            } else {
              title = 'Zap Goal';
            }
          }

          // Description: use content.description if present, else empty
          let summary = content.summary || '';

          // Goal/target: prefer tag 'amount', then content.goal/target, else 0
          let goal = 0;
          const amountTag = ev.tags && ev.tags.find((t: any) => t[0] === 'amount');
          if (amountTag && amountTag[1]) {
            goal = parseInt(amountTag[1], 10);
          } else if (content.goal) {
            goal = content.goal;
          } else if (content.target) {
            goal = content.target;
          }

          // Get profile info and calculate stats
          const received = zaps[ev.id] || 0;
          const authorProfile = profiles[ev.pubkey] || {};
          const npubStr = npubEncode(ev.pubkey);
          let authorDisplay = authorProfile.display_name || authorProfile.name || npubStr.slice(0, 8) + '...' + npubStr.slice(-4);

          // Convert received from msats to sats for all calculations
          const receivedSats = received / 1000;
          // Calculate percent funded and balance left
          const percent = goal ? Math.min(100, (receivedSats / goal) * 100) : 0;
          const percentDisplay = percent.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
          const balance = goal ? Math.max(0, goal - receivedSats) : 0;

          return (
            <div key={ev.id} className="feed-goal-card" onClick={() => onGoalClick(ev.id)}>
              <div className="feed-goal-header">
                <img 
                  src={authorProfile.picture || `https://robohash.org/${ev.pubkey}?set=set4`}
                  alt={`${authorDisplay}'s avatar`}
                  className="feed-goal-avatar"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProfileClick(ev.pubkey, authorProfile);
                  }}
                />
                <div className="feed-goal-author">
                  <div 
                    className="feed-goal-author-name"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProfileClick(ev.pubkey, authorProfile);
                    }}
                    role="button"
                    title="View profile"
                  >
                    {authorDisplay}
                  </div>
                </div>
              </div>
              <GoalCard eventId={ev.id} name={title} />
              {summary && (
                <p className="feed-goal-description"
                onClick={() => onGoalClick(ev.id)}
                role="button"
                title="View goal details">{summary}</p>
              )}
              <ZapProgress goal={goal} received={receivedSats} />
              <div className="feed-goal-stats">
                <div className="feed-goal-stat">
                  <span>Total Zapped:</span>
                  <b>{received / 1000} sats</b>
                </div>
                <div className="feed-goal-stat">
                  <span>Progress:</span>
                  <b>{percentDisplay}%</b>
                </div>
                <div className="feed-goal-stat">
                  <span>Balance Left:</span>
                  <b>{balance} sats</b>
                </div>
              </div>
              <div className="zap-button-wrapper" onClick={e => e.stopPropagation()}>
                <ZapButton event={ev} nwc={nwc} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
