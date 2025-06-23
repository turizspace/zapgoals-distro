import React, { useEffect, useState, useCallback } from 'react';
import { type Event as NostrEvent, SimplePool, getPublicKey, utils } from 'nostr-tools';
import { NostrService } from '../../services/nostr.service';
import { NWCClient } from '../../services/nwc.service';
import { DEFAULT_RELAYS } from '../../constants';
import '../../styles/components/ZapButton.css';
import { nostrSign } from '../../nostr';
import { getNip07Provider } from '../../nostr/getNip07Provider';

interface ZapButtonProps {
  event: NostrEvent;
  nwc: string;
  onZapComplete?: () => void;
}

export const ZapButton: React.FC<ZapButtonProps> = ({ event, nwc, onZapComplete }) => {
  const [amount, setAmount] = useState(1000);
  const [status, setStatus] = useState<string | null>(null);
  const [lnurl, setLnurl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nostrService = new NostrService(DEFAULT_RELAYS);

  // Extract Lightning Address from profile only
  useEffect(() => {
    const fetchLightningAddress = async () => {
      try {
        const profile = await nostrService.fetchProfile(event.pubkey);
        if (profile?.lud16) {
          setLnurl(profile.lud16);
        } else if (profile?.lud06) {
          setLnurl(profile.lud06);
        } else {
        }
      } catch (e) {
      }
    };

    fetchLightningAddress();
  }, [event.pubkey, nostrService]);

  const handleNWCZap = async (amountSats: number): Promise<void> => {
    if (!nwc) throw new Error('No NWC URL provided');
    if (!lnurl) throw new Error('No Lightning address available');

    const client = new NWCClient({ nostrWalletConnectUrl: nwc });
    try {
      // Create zap request
      const zapRequest = await nostrService.createZapRequest(
        event.pubkey,
        amountSats * 1000, // Convert to msats
        event.id
      );


      // Get LNURL invoice first
      const lnurlOrAddress = lnurl.toLowerCase();
      let callbackUrl: string;

      if (lnurlOrAddress.startsWith('lnurl')) {
        callbackUrl = Buffer.from(lnurlOrAddress.substring(6), 'base64').toString();
      } else if (lnurlOrAddress.includes('@')) {
        const [name, domain] = lnurlOrAddress.split('@');
        callbackUrl = `https://${domain}/.well-known/lnurlp/${name}`;
      } else {
        throw new Error('Invalid Lightning address format');
      }

      const paramsRes = await fetch(callbackUrl);
      const params = await paramsRes.json();

      if (!params.callback || !params.allowsNostr) {
        throw new Error('Invalid or non-Nostr LNURL-pay endpoint');
      }

      // Get invoice with zap request
      const callbackWithParams = new URL(params.callback);
      callbackWithParams.searchParams.set('amount', (amountSats * 1000).toString());
      callbackWithParams.searchParams.set('nostr', JSON.stringify(zapRequest));

      const invoiceRes = await fetch(callbackWithParams.toString());
      const invoiceData = await invoiceRes.json();

      if (!invoiceData.pr) {
        throw new Error('No invoice received');
      }

      // Use NWC client to pay invoice according to NIP-47
      const response = await client.payInvoice({
        invoice: invoiceData.pr,
        amount: amountSats * 1000 // msats
      });

      if (response.error) {
        throw new Error(`NWC Error: ${response.error.message}`);
      }

      // Use the payment response directly
      if (response.result?.preimage) {
        setStatus(`Zap sent! ⚡ ${amountSats} sats`);
        setLoading(false);
        onZapComplete?.();
        // Dispatch event for navigation to refresh balance
        window.dispatchEvent(new Event('nwc-zap-complete'));
        // Publish zap receipt with all required tags
        await publishZapReceipt({
          goalEvent: event,
          invoice: invoiceData.pr,
          zapRequest,
        });
      }
    } catch (error: any) {
      throw error;
    } finally {
      client.close();
    }
  };

  const handleLNURLZap = async (amountSats: number): Promise<void> => {
    if (!lnurl) throw new Error('No Lightning address available');

    // Create zap request
    const zapRequest = await nostrService.createZapRequest(
      event.pubkey,
      amountSats * 1000,
      event.id
    );

    // Get LNURL-pay params and invoice
    const lnurlOrAddress = lnurl.toLowerCase();
    let callbackUrl: string;

    if (lnurlOrAddress.startsWith('lnurl')) {
      callbackUrl = Buffer.from(lnurlOrAddress.substring(6), 'base64').toString();
    } else if (lnurlOrAddress.includes('@')) {
      const [name, domain] = lnurlOrAddress.split('@');
      callbackUrl = `https://${domain}/.well-known/lnurlp/${name}`;
    } else {
      throw new Error('Invalid Lightning address format');
    }

    const paramsRes = await fetch(callbackUrl);
    const params = await paramsRes.json();

    if (!params.callback || !params.allowsNostr) {
      throw new Error('Invalid or non-Nostr LNURL-pay endpoint');
    }

    // Get invoice with zap request
    const callbackWithParams = new URL(params.callback);
    callbackWithParams.searchParams.set('amount', (amountSats * 1000).toString());
    callbackWithParams.searchParams.set('nostr', JSON.stringify(zapRequest));

    const invoiceRes = await fetch(callbackWithParams.toString());
    const invoiceData = await invoiceRes.json();

    if (!invoiceData.pr) {
      throw new Error('No invoice received');
    }

    // Open system Lightning handler
    window.open(`lightning:${invoiceData.pr}`, '_blank');
    setStatus('Opened wallet for payment');
  };

  const handleZap = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setStatus('Preparing zap...');

    try {
      if (!lnurl) {
        throw new Error('No Lightning address available for recipient');
      }

      if (nwc) {
        await handleNWCZap(amount);
      } else {
        await handleLNURLZap(amount);
      }
    } catch (error: any) {
      console.error('💥 Zap error:', error);
      setStatus(`Error: ${error?.message || 'Failed to send zap'}`);
      setLoading(false);
    }
  }, [event, nwc, lnurl, amount, loading]);

  // Helper to get signing pubkey (the one that will actually sign via nostrSign)
  async function getSigningPubkey(): Promise<string | null> {
    const provider = getNip07Provider();
    // Check for getPublicKey and that it is a function
    if (provider && typeof provider.getPublicKey === 'function') {
      try {
        const pubkey = await provider.getPublicKey();
        // Validate pubkey: should be a 64-character hex string (32 bytes = 256 bits)
        if (typeof pubkey === 'string' && /^[0-9a-f]{64}$/i.test(pubkey)) {
          return pubkey;
        }
      } catch {}
    }
    const storedPriv = localStorage.getItem('nostr_privkey');
    if (storedPriv) {
      // Validate privkey: should be a 64-character hex string
      if (typeof storedPriv === 'string' && /^[0-9a-f]{64}$/i.test(storedPriv)) {
        const pk = getPublicKey(utils.hexToBytes(storedPriv));
        // Validate derived pubkey
        if (typeof pk === 'string' && /^[0-9a-f]{64}$/i.test(pk)) {
          return pk;
        }
      }
    }
    return null;
  }

  // Helper: extract 'a' tag for a goal event (if kind 30311 or similar)
  function getGoalATag(goalEvent: NostrEvent): string | null {
    const dTag = goalEvent.tags.find(t => t[0] === 'd')?.[1] || '';
    // Use your actual goal kind here (e.g., 30311 or 9041)
    return `${goalEvent.kind}:${goalEvent.pubkey}:${dTag}`;
  }



  // Helper: publish zap receipt with all required tags
  async function publishZapReceipt({ goalEvent, invoice, zapRequest }: { goalEvent: NostrEvent, invoice: string, zapRequest: any }) {
    const senderPubkey = await getSigningPubkey();
    if (!senderPubkey) {
      console.warn('⚠️ No signing key available for zap receipt');
      return;
    }
    const aTag = getGoalATag(goalEvent);
    const event = {
      kind: 9735,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [
        ...(aTag ? [['a', aTag]] : []),
        ['e', goalEvent.id],
        ['p', goalEvent.pubkey],
        ['bolt11', invoice],
        ['description', JSON.stringify(zapRequest)],
      ],
      pubkey: senderPubkey,
    };
    try {
      const signed = await nostrSign(event);
      if (!signed) throw new Error('Failed to sign zap receipt');
      const pool = new SimplePool();
      await Promise.all(DEFAULT_RELAYS.map(relay => pool.publish([relay], signed)));
    } catch (e) {
      console.warn('⚠️ Failed to publish zap receipt', e);
    }
  }

  return (
    <div className="zap-action">
      <input 
        type="number" 
        min={1} 
        value={amount} 
        onChange={e => setAmount(Number(e.target.value))} 
        className="form-input"
        placeholder="Amount (sats)"
        disabled={loading}
      />
      <button 
        onClick={handleZap} 
        disabled={loading || (!nwc && !lnurl)}
        className={`zap-button ${loading ? 'loading' : ''}`}
      >
        {loading ? 'Sending...' : 'Zap'}
      </button>
      {status && <div className="status-message">{status}</div>}
    </div>
  );
};
