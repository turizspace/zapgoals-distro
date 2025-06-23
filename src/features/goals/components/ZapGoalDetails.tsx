import React, { useEffect, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { ZapButton } from '../../../shared/components/ZapButton';
import '../../../styles/components/ZapGoalDetails.css';

interface ZapGoalDetailsProps {
  goalId: string;
  relays: string[];
  onBack: () => void;
  nwc: string;
}

// Helper function to calculate zap stats with deduplication by event id
function calculateZapStats(zaps: NostrEvent[], goalAmount: number) {
  const seenIds = new Set<string>();
  let total = 0;

  zaps.forEach(zap => {
    if (seenIds.has(zap.id)) return; // skip duplicates
    seenIds.add(zap.id);

    // 1. Direct amount tag
    const amountTag = zap.tags.find(t => t[0] === 'amount');
    if (amountTag) {
      const amount = parseInt(amountTag[1], 10);
      if (!isNaN(amount)) total += amount;
    }

    // 2. Amount inside JSON description tag
    const descTag = zap.tags.find(t => t[0] === 'description');
    if (descTag && descTag[1]) {
      try {
        const descObj = JSON.parse(descTag[1]);
        const descAmountTag = descObj.tags?.find((t: any) => t[0] === 'amount');
        if (descAmountTag) {
          const descAmount = parseInt(descAmountTag[1], 10);
          if (!isNaN(descAmount)) total += descAmount;
        }
      } catch {}
    }
  });

  const percent = goalAmount ? Math.min(100, (total / goalAmount) * 100) : 0;
  const balance = goalAmount ? Math.max(0, goalAmount - total) : 0;

  return {
    total,
    percent: percent.toFixed(3),
    balance,
  };
}

export const ZapGoalDetails: React.FC<ZapGoalDetailsProps> = ({ goalId, relays, onBack }) => {
  const [goal, setGoal] = useState<NostrEvent | null>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [replies, setReplies] = useState<NostrEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [zapStats, setZapStats] = useState<{ total: number; percent: string; balance: number }>({
    total: 0,
    percent: '0.000',
    balance: 0,
  });

  useEffect(() => {
    let pool: SimplePool | null = null;
    let unsubscribeFn: any = null;

    async function fetchGoalDetails() {
      setLoading(true);
      try {
        pool = new SimplePool();

        // Fetch the zap goal event
        const goalEvent = await pool.get(relays, { ids: [goalId] });
        if (!goalEvent) {
          setGoal(null);
          setLoading(false);
          return;
        }
        setGoal(goalEvent);

        // Parse goal amount from tags or content
        const amountTag = goalEvent.tags.find(t => t[0] === 'amount');
        const content = (() => {
          try {
            return JSON.parse(goalEvent.content);
          } catch {
            return {};
          }
        })();
        const goalAmount =
          (amountTag && parseInt(amountTag[1], 10)) ||
          content.goal ||
          content.target ||
          0;

        // Fetch author profile
        const profileEv = await pool.get(relays, { kinds: [0], authors: [goalEvent.pubkey], limit: 1 });
        if (profileEv) {
          try {
            setAuthorProfile(JSON.parse(profileEv.content));
          } catch {
            setAuthorProfile(null);
          }
        }

        // Fetch replies (kind 1111 and kind 1)
        const reply1111 = await pool.get(relays, { kinds: [1111], '#e': [goalId], limit: 50 });
        const reply1 = await pool.get(relays, { kinds: [1], '#e': [goalId], limit: 50 });
        const repliesArr = [reply1111, reply1].filter((reply): reply is NostrEvent => !!reply);
        setReplies(repliesArr);

        // Fetch all zap events for this goal
        const zapEvents = await Promise.all(
          relays.map(relay =>
            pool!.get([relay], {
              kinds: [9735],
              '#e': [goalId],
              limit: 100,
            })
          )
        );
        const validZaps = zapEvents.filter((zap): zap is NostrEvent => !!zap);

        // Calculate initial zap stats with deduplication
        setZapStats(calculateZapStats(validZaps, goalAmount));

        // Subscribe to new zap events
        const subFilter = {
          kinds: [9735],
          '#e': [goalId],
          since: Math.floor(Date.now() / 1000),
        };

        try {
          unsubscribeFn = pool.subscribe(
            relays,
            subFilter,
            {
              onevent(zap: NostrEvent) {
                // Combine new zap with existing, deduplicate by id
                const combinedZaps = [...validZaps, zap];
                const uniqueZapsMap = new Map<string, NostrEvent>();
                combinedZaps.forEach(z => uniqueZapsMap.set(z.id, z));
                const uniqueZaps = Array.from(uniqueZapsMap.values());

                // Update zap stats
                setZapStats(calculateZapStats(uniqueZaps, goalAmount));
              },
            }
          );
        } catch (err) {
          console.error('Failed to subscribe:', err);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching goal details:', error);
        setGoal(null);
        setAuthorProfile(null);
        setReplies([]);
        setZapStats({ total: 0, percent: '0.000', balance: 0 });
        setLoading(false);
      }
    }

    fetchGoalDetails();

    return () => {
      if (typeof unsubscribeFn === 'function') {
        unsubscribeFn();
      }
      pool?.close(relays);
    };
  }, [goalId, relays]);

  if (loading) return <div className="loading-theme">Loading...</div>;
  if (!goal) return <div className="empty-theme">Zap Goal not found.</div>;

  let content: any = {};
  try {
    content = JSON.parse(goal.content);
  } catch {}

  const authorDisplay = authorProfile?.display_name || authorProfile?.name || goal.pubkey.slice(0, 8);

  return (
    <div className="zap-goal-details modern-card">
      <button onClick={onBack} className="back-button">
        ←
      </button>

      <div className="zap-goal-header">
        <img src={authorProfile?.picture || '/vite.svg'} alt={authorDisplay} className="zap-goal-avatar" />
        <div className="zap-goal-author">
          <div className="zap-goal-author-name">{authorDisplay}</div>
        </div>
      </div>

      <div className="zap-goal-content">
        {content.title && <h2 className="zap-goal-title" style={{ marginBottom: '1rem' }}>{content.title}</h2>}

        {goal.tags
          ?.find(t => t[0] === 'summary')
          ?.slice(1, 2)
          .map(summary => (
            <div key={summary} className="zap-goal-summary">
              {summary}
            </div>
          ))}

        <div className="zap-goal-description">{typeof goal.content === 'string' ? goal.content : content.description}</div>

        <div className="zap-goal-stats">
          <div className="zap-goal-stat">
            <div className="zap-goal-stat-label">Goal</div>
            <div className="zap-goal-stat-value">
              {(goal.tags?.find(t => t[0] === 'amount')?.[1] || content.goal || content.target || 0) + ' sats'}
            </div>
          </div>
          <div className="zap-goal-stat">
            <div className="zap-goal-stat-label">Total Zapped</div>
            <div className="zap-goal-stat-value">{zapStats.total / 1000} sats</div>
          </div>
          <div className="zap-goal-stat">
            <div className="zap-goal-stat-label">Progress</div>
            <div className="zap-goal-stat-value">{zapStats.percent}%</div>
          </div>
          <div className="zap-goal-stat">
            <div className="zap-goal-stat-label">Balance Left</div>
            <div className="zap-goal-stat-value">{zapStats.balance} sats</div>
          </div>
        </div>

        <div style={{ margin: '1.5rem 0' }}>
          <ZapButton event={goal} nwc={''} />
        </div>
      </div>

      {replies.length > 0 && (
        <div className="zap-goal-replies">
          <h3 style={{ marginBottom: '1rem' }}>Replies</h3>
          <div className="notif-feed-list">
            {replies.map((reply, i) => {
              let replyContent = '';
              try {
                replyContent = JSON.parse(reply.content).content || reply.content;
              } catch {
                replyContent = reply.content;
              }
              return (
                <div className="notif-feed-item" key={i}>
                  <div className="notif-feed-info">
                    <div style={{ fontWeight: 600 }}>{reply.pubkey.slice(0, 8)}...</div>
                    <div>{replyContent}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
