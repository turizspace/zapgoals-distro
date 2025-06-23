// Based on NIP-47 spec: https://github.com/nostr-protocol/nips/blob/master/47.md

export interface Nip47GetBalanceResponse {
  balance: number;  // Balance in millisatoshis
}

export interface Nip47PayInvoiceRequest {
  invoice: string;  // BOLT11 invoice
  amount?: number;  // Optional amount in millisatoshis
}

export interface Nip47PayResponse {
  preimage: string;  // Payment preimage
}
