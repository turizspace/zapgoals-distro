import React, { useEffect, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';

interface MiniZapGoalCardProps {
  goalId: string;
  relays: string[];
}

export const MiniZapGoalCard: React.FC<MiniZapGoalCardProps> = ({ goalId, relays }) => {
  const [goal, setGoal] = useState<NostrEvent | null>(null);
  const [author, setAuthor] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let pool: SimplePool | null = null;
    async function fetchGoal() {
      setLoading(true);
      pool = new SimplePool();
      const event = await pool.get(relays, { ids: [goalId] });
      setGoal(event || null);
      if (event) {
        const profileEv = await pool.get(relays, { kinds: [0], authors: [event.pubkey], limit: 1 });
        if (profileEv) {
          try {
            const profile = JSON.parse(profileEv.content);
            setAuthor(profile.display_name || profile.name || event.pubkey.slice(0, 8));
          } catch {
            setAuthor(event.pubkey.slice(0, 8));
          }
        } else {
          setAuthor(event.pubkey.slice(0, 8));
        }
      }
      setLoading(false);
      pool?.close(relays);
    }
    fetchGoal();
    // eslint-disable-next-line
  }, [goalId, relays]);

  if (loading) return <div className="mini-zap-goal-card loading">Loading...</div>;
  if (!goal) return <div className="mini-zap-goal-card empty">Goal not found</div>;

  let content: any = {};
  try { content = JSON.parse(goal.content); } catch {}

  return (
    <div className="mini-zap-goal-card">
      <div className="mini-zap-goal-summary">{content.summary || goal.content.slice(0, 80)}</div>
      <div className="mini-zap-goal-meta">by {author}</div>
    </div>
  );
};
