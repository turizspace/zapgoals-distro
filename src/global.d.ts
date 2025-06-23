interface NostrWindow {
  getPublicKey: () => Promise<string>;
  signEvent: (event: {
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    [key: string]: any;
  }) => Promise<any>;
  nip04?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
  };
  nip44?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
  };
  // Allow any additional methods or properties
  [key: string]: any;
}

interface Window {
  nostr?: NostrWindow;
  nostr_?: NostrWindow;
  webln?: NostrWindow;
  [key: string]: any;
}