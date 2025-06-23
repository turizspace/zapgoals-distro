import { SimplePool, type Event as NostrEvent } from 'nostr-tools';

export async function fetchProfile(pubkey: string, relays: string[]) {
  
  const pool = new SimplePool();
  
  try {
    // Try each relay until we find a profile
    for (const relay of relays) {
      try {
        const event = await Promise.race([
          pool.get([relay], {
            kinds: [0],
            authors: [pubkey]
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]) as NostrEvent;
        
        if (event) {
          try {
            const content = JSON.parse(event.content);
            return content;
          } catch (e) {
            console.error('Failed to parse profile content:', e);
          }
        }
      } catch (e) {
        console.error(`Failed to fetch from relay ${relay}:`, e);
      }
    }
  } finally {
    pool.close(relays);
  }
  
  return null;
}