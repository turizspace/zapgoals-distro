import { bech32 } from '@scure/base';

/**
 * Encode a hex public key as npub (bech32, NIP-19)
 * @param pubkey 32-byte hex string
 * @returns npub1... string
 */
export function npubEncode(pubkey: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) throw new Error('Invalid hex pubkey');
  const data = Buffer.from(pubkey, 'hex');
  return bech32.encode('npub', bech32.toWords(data));
}
