/** Navigation view types for the application */
export type View = 'landing' | 'feed' | 'profile' | 'create' | 'settings' | 'notifications' | 'goal' | 'leaderboard';

// Import shared NostrProfile type
import type { NostrProfile } from './index';

/** Profile data interface shared across components */
export interface Kind0Profile extends NostrProfile {
  npub?: string;
}
