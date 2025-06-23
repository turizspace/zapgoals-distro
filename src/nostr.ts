// Polyfill Buffer for browser environments
import { Buffer } from 'buffer';
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

import { useEffect, useState } from 'react';
import { nip19, getPublicKey, utils, SimplePool } from 'nostr-tools';
import { getNip07Provider } from './nostr/getNip07Provider';
import type { NostrProfile } from './types';

// Store the current login method
let currentLoginMethod: 'nip07' | null = null;

// Helper: validate a 64-char hex string
function isValidHexKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && /^[0-9a-fA-F]{64}$/.test(key);
}

export function useNostrLogin(version?: number): {
  pubkey: string | null;
  npub: string | null;
  profile: NostrProfile | null;
} {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [npub, setNpub] = useState<string | null>(null);
  const [profile, setProfile] = useState<NostrProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    let extensionTimeout: NodeJS.Timeout | null = null;

    async function login() {
      let pk: string | null = null;

      // Only support nip07 login method if explicitly set
      const storedMethod = localStorage.getItem('nostr_login_method');
      if (storedMethod === 'nip07') {
        let provider = getNip07Provider();
        if (!provider && typeof window !== 'undefined') {
          await new Promise(resolve => {
            extensionTimeout = setTimeout(resolve, 500);
          });
          provider = getNip07Provider();
        }
        if (provider) {
          try {
            pk = await provider.getPublicKey();
            currentLoginMethod = 'nip07';
            localStorage.setItem('nostr_login_method', 'nip07');
          } catch {
            pk = null;
          }
        }
      }

      // If no login method worked, try private key
      if (!pk) {
        const storedPriv = localStorage.getItem('nostr_privkey');
        if (storedPriv && isValidHexKey(storedPriv)) {
          const privkeyBytes = utils.hexToBytes(storedPriv);
          pk = getPublicKey(privkeyBytes);
        }
      }

      if (cancelled) return;

      // Validate pubkey before proceeding
      if (isValidHexKey(pk)) {
        setPubkey(pk);
        setNpub(nip19.npubEncode(pk as string));
        try {
          const pool = new SimplePool();
          const relays = [
            'wss://nos.lol',
            'wss://relay.nostr.band',
            'wss://relay.damus.io',
            'wss://nostr.mom',
            'wss://no.str.cr',
          ];
          const profileEvent = await pool.get(relays, {
            kinds: [0],
            authors: [pk as string],
            limit: 1,
          });
          if (profileEvent) {
            const parsed = JSON.parse(profileEvent.content);
            setProfile(parsed);
          } else {
            setProfile(null);
          }
        } catch {
          setProfile(null);
        }
      } else {
        setPubkey(null);
        setNpub(null);
        setProfile(null);
        currentLoginMethod = null;
        localStorage.removeItem('nostr_login_method');
      }
    }

    login();
    return () => {
      cancelled = true;
      if (extensionTimeout) clearTimeout(extensionTimeout);
    };
  }, [version]);

  return { pubkey, npub, profile };
}

export function setLoginMethod(method: 'nip07' | null): void {
  currentLoginMethod = method;
  if (method) {
    localStorage.setItem('nostr_login_method', method);
  } else {
    localStorage.removeItem('nostr_login_method');
  }
}

export async function nostrSign(event: any): Promise<any> {
  const provider = getNip07Provider();
  if (provider && typeof provider.signEvent === 'function') {
    return provider.signEvent(event);
  }
  throw new Error('No signing provider available');
}
