import { useEffect, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { fetchProfile } from '../../../fetchProfile';
import '../../../styles/components/ProfileViewer.css';

type ZapGoal = {
  id: string;
  title: string;
  description: string;
  goal: number;
  received: number;
  event: NostrEvent; // Store original event for subscriptions
};

// Type guard to validate Nostr events
function isValidNostrEvent(ev: any): ev is NostrEvent {
  return ev && 
    typeof ev === 'object' && 
    'id' in ev && 
    'kind' in ev && 
    'tags' in ev && 
    'content' in ev && 
    'created_at' in ev && 
    'pubkey' in ev && 
    'sig' in ev;
}

export function ProfileViewer({ 
  pubkey, 
  relays,
  initialProfile, // Add this parameter
  onGoalClick // Add navigation handler
}: { 
  pubkey: string; 
  relays: string[];
  initialProfile?: {
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud06?: string;
    lud16?: string;
    banner?: string;
    website?: string;
  };
  onGoalClick?: (goal: NostrEvent) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud06?: string;
    lud16?: string;
    banner?: string;
    website?: string;
  } | null>(initialProfile || null);
  const [goals, setGoals] = useState<ZapGoal[]>([]);
  const [subscriptions, setSubscriptions] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    async function loadProfileAndGoals() {
      if (initialProfile) {
        setProfile(initialProfile);
        setLoading(false);
      }
      setLoading(true);
      setError(null);
      
      const pool = new SimplePool();
      const allRelays = [
        'wss://nos.lol',
        'wss://relay.nostr.band',
        'wss://relay.damus.io',
        'wss://nostr.mom',
        'wss://no.str.cr',
        ...relays
      ];
      
      try {
        // Fetch profile if not provided
        if (!initialProfile) {
          const profileContent = await fetchProfile(pubkey, allRelays);
          
          if (profileContent) {
            setProfile({
              name: profileContent.name,
              display_name: profileContent.display_name,
              about: profileContent.about,
              picture: profileContent.picture,
              nip05: profileContent.nip05,
              lud06: profileContent.lud06,
              lud16: profileContent.lud16,
              banner: profileContent.banner,
              website: profileContent.website
            });
          } else {
            setProfile({
              name: pubkey.slice(0, 8),
              display_name: pubkey.slice(0, 8)
            });
          }
        }

        // Fetch zap goals with improved reliability
        const zapGoalsByRelay = await Promise.all(
          allRelays.map(async relay => {
            try {
              const result = await Promise.race([
                pool.get([relay], { 
                  kinds: [9041], 
                  authors: [pubkey],
                  limit: 50 
                }),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 5000)
                )
              ]);
              return result || [];
            } catch (e) {
              console.error(`Failed to fetch goals from ${relay}:`, e);
              return [];
            }
          })
        );

        // Flatten and deduplicate zap goals
        const allGoalEvents = zapGoalsByRelay.flat().filter(isValidNostrEvent);
        const uniqueGoalsMap = new Map<string, NostrEvent>();
        allGoalEvents.forEach(ev => uniqueGoalsMap.set(ev.id, ev));
        const uniqueGoals = Array.from(uniqueGoalsMap.values());            // Helper function to calculate zap stats from ZapGoalDetails
            function calculateZapStats(zaps: NostrEvent[]) {
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

              return { total };
            }

            // Process goals and fetch zap amounts
            const processedGoals: ZapGoal[] = [];
            for (const goalEvent of uniqueGoals) {
              try {
                // Parse content
                let parsedContent: { goal?: number; target?: number; title?: string; description?: string } = {};
                let goalTitle: string;
                let goalDescription: string;
                
                try {
                  parsedContent = JSON.parse(goalEvent.content);
                  goalTitle = parsedContent.title || '';
                  goalDescription = parsedContent.description || '';
                } catch (e) {
                  goalTitle = goalEvent.content;
                  goalDescription = '';
                }
                
                // Get goal amount - prioritize tag over content
                const goalAmountTag = goalEvent.tags?.find((t: string[]) => t[0] === 'amount');
                const goalAmount = goalAmountTag && goalAmountTag[1] 
                  ? parseInt(goalAmountTag[1], 10) || 0
                  : parsedContent.goal || parsedContent.target || 0;

                // Fetch zaps for this goal from all relays
                const zapEvents: NostrEvent[] = [];
                for (const relay of allRelays) {
                  try {
                    const zap = await Promise.race([
                      pool.get([relay], { 
                        kinds: [9735], 
                        '#e': [goalEvent.id],
                        limit: 100 
                      }),
                      new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 5000)
                      )
                    ]);
                    if (zap && isValidNostrEvent(zap)) zapEvents.push(zap);
                  } catch (e) {
                    console.error(`Failed to fetch zaps from ${relay}:`, e);
                  }
                }

                // Calculate zaps using the same logic as ZapGoalDetails
                const uniqueZapEvents = Array.from(
                  new Map(zapEvents.map(zap => [zap.id, zap])).values()
                );
                const stats = calculateZapStats(uniqueZapEvents);
                
                // Add the goal
                processedGoals.push({
                  id: goalEvent.id,
                  title: goalTitle || 'Untitled Goal',
                  description: goalDescription,
                  goal: goalAmount,
                  received: stats.total / 1000, // Convert msats to sats
                  event: goalEvent // Store original event
                });

                // Set up subscription for this goal
                const unsubscribe = pool.subscribe(
                  allRelays,
                  {
                    kinds: [9735],
                    '#e': [goalEvent.id],
                    since: Math.floor(Date.now() / 1000)
                  },
                  {
                    onevent(event: NostrEvent) {
                      const amount = calculateZapStats([event]).total;
                      if (amount > 0) {
                        updateGoalReceived(goalEvent.id, amount);
                      }
                    }
                  }
                );

                setSubscriptions(prev => ({
                  ...prev,
                  [goalEvent.id]: unsubscribe
                }));
              } catch (e) {
                console.error('Error processing goal:', e);
              }
            }

        setGoals(processedGoals);
      } catch (e) {
        console.error('Error loading profile and goals:', e);
        setError('Failed to load profile and goals. Please try again later.');
      } finally {
        pool.close(allRelays);
        setLoading(false);
      }
    }

    loadProfileAndGoals();
  }, [pubkey, relays, initialProfile]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      Object.values(subscriptions).forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [subscriptions]);

  // Function to update a goal's received amount
  const updateGoalReceived = (goalId: string, newAmount: number) => {
    setGoals(currentGoals => 
      currentGoals.map(goal => 
        goal.id === goalId 
          ? { ...goal, received: goal.received + (newAmount / 1000) }
          : goal
      )
    );
  };

  if (loading) {
    return <div className="loading-theme">Loading profile...</div>;
  }

  if (error) {
    return <div className="error-theme">{error}</div>;
  }

  if (!profile) {
    return <div className="empty-theme">Profile not found</div>;
  }

  const display = profile.display_name || profile.name || pubkey.slice(0, 8) + '...';

  return (
    <div className="profile-viewer">
      {/* Banner Section */}
      {profile.banner && (
        <div className="profile-banner">
          {profile.banner.endsWith('.mp4') ? (
            <video 
              src={profile.banner} 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="banner-video"
            />
          ) : (
            <img 
              src={profile.banner} 
              alt="profile banner" 
              className="banner-image"
            />
          )}
        </div>
      )}

      {/* Profile Card Section */}
      <div className="profile-card">
        <img 
          src={profile.picture || '/icon.jpeg'} 
          alt="avatar" 
          className="profile-avatar"
        />
        <div className="profile-name">
          <h2>{profile.display_name || profile.name}</h2>
          {profile.name && profile.display_name && profile.name !== profile.display_name && (
            <div className="profile-username">@{profile.name}</div>
          )}
        </div>

        {profile.nip05 && (
          <div className="profile-nip05">
            <span className="verified-badge">✓</span>
            <span>{profile.nip05}</span>
          </div>
        )}

        {profile.about && (
          <div className="profile-about">
            {profile.about}
          </div>
        )}

        {profile.website && (
          <div className="profile-website">
            <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} 
               target="_blank" 
               rel="noopener noreferrer">
              🌐 {profile.website}
            </a>
          </div>
        )}

        {profile.lud16 && (
          <div className="profile-lightning">
            ⚡ {profile.lud16}
          </div>
        )}

        {profile.lud06 && !profile.lud16 && (
          <div className="profile-lightning">
            ⚡ {profile.lud06}
          </div>
        )}
      </div>

      {/* Zap Goals Section */}
      <div className="goals-section">
        <h2 className="goals-title">
          {display}'s Zap Goals
        </h2>
        
        {goals.length === 0 ? (
          <div className="goals-empty">
            No zap goals found for this profile
          </div>
        ) : (
          <div className="goals-grid">
            {goals.map(goal => {
              const percent = goal.goal ? Math.min(100, (goal.received / goal.goal) * 100) : 0;
              const percentDisplay = percent.toLocaleString(undefined, { 
                minimumFractionDigits: 1, 
                maximumFractionDigits: 1 
              });
              
              return (
                <div 
                  key={goal.id} 
                  className="goal-card modern-card"
                  onClick={() => onGoalClick?.(goal.event)}
                  style={{ cursor: 'pointer' }}
                >
                  <h4 className="goal-title">
                    {goal.title}
                  </h4>
                  {goal.description && (
                    <p className="goal-description">
                      {goal.description}
                    </p>
                  )}
                  
                  <div className="goal-progress">
                    <div className="goal-progress-bar">
                      <div 
                        className="goal-progress-fill"
                        style={{ 
                          width: `${percent}%`,
                          background: `linear-gradient(90deg, #05ce78 0%, ${
                            percent >= 100 ? '#05ce78' : '#c110d1'
                          } ${percent >= 100 ? '100%' : '85%'})`
                        }}
                      />
                    </div>
                    <div className="goal-progress-numbers">
                      <span>{percentDisplay}%</span>
                    </div>
                  </div>

                  <div className="goal-stats">
                    <div className="goal-stat">
                      <div className="goal-stat-label">Goal</div>
                      <div className="goal-stat-value">{goal.goal} sats</div>
                    </div>
                    <div className="goal-stat">
                      <div className="goal-stat-label">Total Zapped</div>
                      <div className="goal-stat-value">{goal.received} sats</div>
                    </div>
                    <div className="goal-stat">
                      <div className="goal-stat-label">Progress</div>
                      <div className="goal-stat-value">{percentDisplay}%</div>
                    </div>
                    <div className="goal-stat">
                      <div className="goal-stat-label">Balance Left</div>
                      <div className="goal-stat-value">{goal.goal - goal.received} sats</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
