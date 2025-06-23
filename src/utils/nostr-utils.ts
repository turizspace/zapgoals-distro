import { SimplePool, type Event as NostrEvent } from 'nostr-tools';

export const fetchProfileAndGoals = async (pubkey: string, relays: string[]) => {
  const pool = new SimplePool();

  try {
    // Fetch kind 0 profile event
    const profileEvent = await pool.get(relays, { kinds: [0], authors: [pubkey], limit: 1 });
    let profileObj = { 
      name: pubkey.slice(0, 8) + '...', 
      about: '', 
      picture: '', 
      display_name: pubkey.slice(0, 8) 
    };

    if (profileEvent) {
      try {
        const content = JSON.parse(profileEvent.content);
        profileObj = {
          name: content.name || profileObj.name,
          about: content.about || '',
          picture: content.picture || '',
          display_name: content.display_name || content.name || profileObj.name,
        };
      } catch {}
    }

    // Fetch kind 9041 zap goals
    const eventsArrays = await Promise.all(
      relays.map(relay => pool.get([relay], { kinds: [9041], authors: [pubkey], limit: 50 }))
    );
    const goalEvents = eventsArrays.filter((ev): ev is NostrEvent => !!ev);

    // Fetch kind 9735 zap events for all notes
    const noteIds = goalEvents.map(ev => ev.id);
    const zapEventsArr = await Promise.all(
      noteIds.map(id => pool.get(relays, { kinds: [9735], '#e': [id], limit: 100 }))
    );

    // Sum zap amounts for each note
    const zaps: Record<string, number> = {};
    let totalZapped = 0;
    zapEventsArr.forEach((zap, i) => {
      if (zap && zap.tags) {
        const amountTag = zap.tags.find((t: any) => t[0] === 'amount');
        if (amountTag) {
          const amount = parseInt(amountTag[1], 10);
          if (!isNaN(amount)) {
            zaps[noteIds[i]] = amount;
            totalZapped += amount;
          }
        }
      }
    });

    pool.close(relays);
    return { profile: profileObj, goals: goalEvents, zaps, totalZapped };
  } catch (e) {
    pool.close(relays);
    throw e;
  }
};
