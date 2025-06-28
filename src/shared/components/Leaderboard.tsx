import React, { useEffect, useState } from 'react';
import { SimplePool } from 'nostr-tools';
import '../../styles/components/Navigation.css';
import { GoalCard } from './GoalCard';

interface LeaderboardProps {
  relays: string[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ relays }) => {
  const [topGoals, setTopGoals] = useState<any[]>([]);
  const [goalNames, setGoalNames] = useState<Record<string, string>>({});
  const [topZappers, setTopZappers] = useState<any[]>([]);
  useEffect(() => {
    async function fetchLeaderboard() {
      const pool = new SimplePool();
      // Fetch all zap goals (kind 9041)
      const events = await pool.get(relays, { kinds: [9041], limit: 100 });
      const goalCounts: Record<string, number> = {};
      const zapperCounts: Record<string, number> = {};
      const names: Record<string, string> = {};
      for (const goal of Array.isArray(events) ? events : [events]) {
        if (!goal || !goal.id) continue;
        goalCounts[goal.id] = 0;
        // Try to extract a name from the event content or tags
        let name = '';
        try {
          const content = JSON.parse(goal.content);
          name = content.name || content.title || '';
        } catch {
          // fallback: try tags
          const nameTag = goal.tags?.find((t: any) => t[0] === 'name' || t[0] === 'title');
          name = nameTag?.[1] || '';
        }
        names[goal.id] = name || goal.id.slice(0, 8) + '...';
        // Fetch zaps for this goal (kind 9735, tag #e = goal.id)
        const zaps = await pool.get(relays, { kinds: [9735], '#e': [goal.id], limit: 100 });
        const zapList = Array.isArray(zaps) ? zaps : [zaps];
        goalCounts[goal.id] += zapList.filter(Boolean).length;
        for (const zap of zapList) {
          if (zap && zap.pubkey) zapperCounts[zap.pubkey] = (zapperCounts[zap.pubkey] || 0) + 1;
        }
      }
      setGoalNames(names);
      setTopGoals(Object.entries(goalCounts).sort((a, b) => b[1] - a[1]).slice(0, 5));
      setTopZappers(Object.entries(zapperCounts).sort((a, b) => b[1] - a[1]).slice(0, 5));
      pool.close(relays);
    }
    fetchLeaderboard();
  }, [relays]);

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-columns">
        <div className="leaderboard-section">
          <div className="leaderboard-section-title">Most Zapped Goals</div>
          <ol className="leaderboard-list">
            {topGoals.map(([goal, count]) => (
              <li key={goal} style={{ listStyle: 'none', marginBottom: 8 }}>
                <GoalCard eventId={goal} name={goalNames[goal] || goal} />
                <span className="leaderboard-count">({count})</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="leaderboard-section">
          <div className="leaderboard-section-title">Top Zappers</div>
          <ol className="leaderboard-list">
            {topZappers.map(([zapper, count]) => (
              <li key={zapper}><span className="leaderboard-zapper">{zapper}</span> <span className="leaderboard-count">({count})</span></li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};
