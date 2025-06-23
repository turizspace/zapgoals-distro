import type { 
  Nip47GetBalanceResponse, 
  Nip47PayInvoiceRequest, 
  Nip47PayResponse 
} from './nwc/nip47';

export interface NWCGetBalanceResponse extends Nip47GetBalanceResponse {}
export interface NWCPayInvoiceRequest extends Nip47PayInvoiceRequest {}
export interface NWCPayInvoiceResponse extends Nip47PayResponse {}
