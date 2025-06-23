export interface NWCEventResponse {
  result?: any;
  error?: {
    code: string;
    message: string;
  };
}

export interface NWCError extends Error {
  code: string;
}

export class NWCResponseError extends Error implements NWCError {
  code: string;
  constructor(message: string, code: string = "INTERNAL") {
    super(message);
    this.code = code;
    this.name = "NWCResponseError";
  }
}

export class NWCDecryptionError extends Error implements NWCError {
  code: string;
  constructor(message: string) {
    super(message);
    this.code = "DECRYPTION_ERROR";
    this.name = "NWCDecryptionError";
  }
}

export class NWCTimeoutError extends Error implements NWCError {
  code: string;
  constructor(message: string, type: "publish" | "reply") {
    super(message);
    this.code = `${type.toUpperCase()}_TIMEOUT`;
    this.name = "NWCTimeoutError";
  }
}

export interface NWCClientConfig {
  nostrWalletConnectUrl: string;
}
