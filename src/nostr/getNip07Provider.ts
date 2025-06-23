// Utility to detect any NIP-07 compatible extension
export function getNip07Provider(): any {
  if (typeof window === 'undefined') return null;
  // Standard NIP-07
  if (window.nostr && typeof window.nostr.getPublicKey === 'function') return window.nostr;
  // Some extensions use a different property
  if ((window as any).nostr_ && typeof (window as any).nostr_.getPublicKey === 'function') return (window as any).nostr_;
  // Some extensions might use webln for Lightning + Nostr
  if ((window as any).webln && typeof (window as any).webln.getPublicKey === 'function') return (window as any).webln;
  // Add more checks here for other known providers if needed
  return null;
}
