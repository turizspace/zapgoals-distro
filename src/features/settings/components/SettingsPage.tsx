import React, { useEffect, useState } from 'react';
import { nip19, utils, getPublicKey } from 'nostr-tools';
import { NWCClient } from '../../../services/nwc.service';
import { getNip07Provider } from '../../../nostr/getNip07Provider';
import { useNostrData } from '../../../hooks/useNostr';
import { saveRelays, loadZapSubscriptions, saveZapSubscriptions } from '../../../utils/storage-utils';
import type { ZapSubscription } from '../../../utils/storage-utils';
import '../../../styles/components/SettingsPage.css';
import { QRScanner } from '../../../shared/components/QRScanner';
import { MiniZapGoalCard } from '../../goals/components/MiniZapGoalCard';

function generateRandomBytes(): Uint8Array {
  const array = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    // Fallback for non-browser environments
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return array;
}

interface SettingsPageProps {
  relays: string[];
  setRelays: (relays: string[]) => void;
  keys: { pubkey: string; privkey: string } | null;
  setKeys: (keys: { pubkey: string; privkey: string } | null) => void;
  nwc: string;
  setNwc: (nwc: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ relays, setRelays, keys, setKeys, nwc, setNwc }) => {
  const [tab, setTab] = useState<'relays' | 'keys' | 'nwc' | 'subscriptions'>('relays');
  const [newRelay, setNewRelay] = useState('');
  const [relayError, setRelayError] = useState('');
  const [pubkey, setPubkey] = useState('');
  const [privkey, setPrivkey] = useState('');
  const [npub, setNpub] = useState('');
  const [keyError, setKeyError] = useState('');
  const [loginMethod, setLoginMethod] = useState<'extension' | 'manual'>('extension');
  const [nwcInput, setNwcInput] = useState(nwc);
  const [nwcBalance, setNwcBalance] = useState<number | null>(null);
  const [nwcError, setNwcError] = useState<string | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [nwcConnected, setNwcConnected] = useState(false);
  const [zapSubscriptions, setZapSubscriptions] = useState<ZapSubscription[]>([]);
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSub, setNewSub] = useState<{ goalId: string; goalName: string; amount: number; frequency: string }>({ goalId: '', goalName: '', amount: 100, frequency: 'daily' });
  const nostr = useNostrData(relays);

  // Add relay health state
  const [relayHealth, setRelayHealth] = useState<Record<string, { successRate: number; avgLatency: number }>>({});

  // Check login method and sync keys state
  useEffect(() => {
    const checkLoginMethod = async () => {
      const provider = getNip07Provider();
      if (provider) {
        setLoginMethod('extension');
        try {
          const pk = await provider.getPublicKey();
          setPubkey(pk);
          setNpub(nip19.npubEncode(pk));
          setPrivkey(''); // No privkey access with extension
        } catch (e) {
          setKeyError('Error accessing extension');
        }
      } else {
        setLoginMethod('manual');
        if (keys?.pubkey) {
          setPubkey(keys.pubkey);
          setPrivkey(keys.privkey);
          setNpub(nip19.npubEncode(keys.pubkey));
        }
      }
    };
    checkLoginMethod();
  }, [keys]);

  useEffect(() => {
    if (tab === 'nwc' && nwc) {
      checkNwcBalance();
    }
  }, [tab, nwc]);

  // Update relay health metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (nostr) {
        setRelayHealth(nostr.getRelayHealth());
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [nostr]);

  useEffect(() => {
    if (tab === 'subscriptions') {
      const subs = loadZapSubscriptions();
      setZapSubscriptions(subs);
    }
  }, [tab]);

  function handleAddRelay() {
    if (!newRelay) return;
    if (relays.includes(newRelay)) {
      setRelayError('Relay already added.');
      return;
    }
    const updatedRelays = [...relays, newRelay];
    setRelays(updatedRelays);
    saveRelays(updatedRelays);
    setNewRelay('');
    setRelayError('');
  }

  function handleRemoveRelay(relay: string) {
    const updatedRelays = relays.filter(r => r !== relay);
    setRelays(updatedRelays);
    saveRelays(updatedRelays);
  }

  function generateNewKeyPair() {
    try {
      const privkeyBytes = generateRandomBytes();
      const privkeyHex = utils.bytesToHex(privkeyBytes);
      const pub = getPublicKey(privkeyBytes);
      setPubkey(pub);
      setPrivkey(privkeyHex);
      setNpub(nip19.npubEncode(pub));
      setKeyError('');
    } catch (e) {
      setKeyError('Error generating key pair');
    }
  }

  function handleSaveKeys() {
    if (loginMethod === 'extension') {
      setKeyError('Keys are managed by your Nostr extension');
      return;
    }

    if (!pubkey || !privkey) {
      setKeyError('Both public and private keys are required');
      return;
    }

    try {
      // Validate the key pair
      const derivedPub = getPublicKey(utils.hexToBytes(privkey));
      if (derivedPub !== pubkey) {
        setKeyError('Invalid key pair: private key does not match public key');
        return;
      }

      setKeys({ pubkey, privkey });
      localStorage.setItem('nostr_privkey', privkey);
      setKeyError('');
    } catch (e) {
      setKeyError('Invalid key format');
    }
  }

  async function checkNwcBalance() {
    setCheckingBalance(true);
    setNwcError(null);
    setNwcConnected(false);

    try {
      const client = new NWCClient({
        nostrWalletConnectUrl: nwc
      });

      setNwcConnected(true);
      const { balance } = await client.getBalance();
      setNwcBalance(balance);
      client.close();
    } catch (error: any) {
      console.error('❌ NWC balance error:', error);
      const message = error?.message || 'Failed to get balance';
      if (message.includes('WebSocket')) {
        setNwcError('Failed to connect to NWC relay. Please check your internet connection and NWC URI.');
      } else if (message.includes('timeout')) {
        setNwcError('NWC wallet not responding. Please make sure your wallet is online and try again.');
      } else {
        setNwcError(message);
      }
      setNwcBalance(null);
    } finally {
      setCheckingBalance(false);
    }
  }

  function handleSaveNwc() {
    if (!nwcInput) {
      setNwcError('NWC URI is required');
      return;
    }

    setNwc(nwcInput);
    setNwcError(null);
    checkNwcBalance();
  }

  function decodeGoalId(input: string): string {
    if (!input) return '';
    if (/^[a-f0-9]{64}$/i.test(input)) return input; // already raw
    try {
      if (input.startsWith('note1')) {
        return nip19.decode(input).data as string;
      }
      if (input.startsWith('nevent1')) {
        const data = nip19.decode(input).data;
        if (data && typeof data === 'object' && 'id' in data && typeof data.id === 'string') {
          return data.id;
        }
      }
    } catch {}
    return input; // fallback
  }

  async function publishSubscriptionEvent(goalId: string, goalName: string) {
    if (!pubkey || !nostr) return;
    const tags = [
      ['e', goalId],
      ['client', 'zapgoals-distro'],
      ['kind', 'zap-subscription'],
      ['pubkey', pubkey],
    ];
    const content = `Subscribed to zap goal: ${goalName || goalId}`;
    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags,
      pubkey,
    };
    let signedEvent;
    if (loginMethod === 'extension') {
      const provider = getNip07Provider();
      if (!provider) return;
      signedEvent = await provider.signEvent(event);
    } else if (privkey) {
      signedEvent = { ...event, id: '', sig: '' };
      try {
        const { finalizeEvent, utils } = await import('nostr-tools');
        const privkeyBytes = utils.hexToBytes(privkey);
        signedEvent = finalizeEvent(event, privkeyBytes);
      } catch {}
    }
    if (signedEvent) {
      try {
        await nostr.publishEvent(signedEvent);
        // Optionally: show a toast/alert
        alert('Ssubscription event published!');
      } catch {
        alert('Failed to publish subscription event.');
      }
    }
  }

  function handleAddSubscription() {
    const rawGoalId = decodeGoalId(newSub.goalId);
    if (!rawGoalId || !newSub.amount || !newSub.frequency) return;
    const id = Date.now().toString();
    const nextZap = Date.now();
    const sub = { ...newSub, goalId: rawGoalId, id, nextZap };
    const updated = [...zapSubscriptions, sub];
    saveZapSubscriptions(updated);
    setZapSubscriptions(updated);
    setShowAddSub(false);
    setNewSub({ goalId: '', goalName: '', amount: 100, frequency: 'daily' });
    publishSubscriptionEvent(rawGoalId, newSub.goalName);
  }

  function handleDeleteSubscription(id: string) {
    const updated = zapSubscriptions.filter(s => s.id !== id);
    saveZapSubscriptions(updated);
    setZapSubscriptions(updated);
  }

  function handlePauseSubscription(id: string, paused: boolean) {
    const updated = zapSubscriptions.map(s => s.id === id ? { ...s, paused } : s);
    saveZapSubscriptions(updated);
    setZapSubscriptions(updated);
  }

  return (
    <div className="settings-page">
      <h2 className="settings-title">Settings</h2>
      <div className="settings-tabs">
        <button 
          className={`settings-tab ${tab === 'relays' ? 'active' : ''}`}
          onClick={() => setTab('relays')}
        >
          Relays
        </button>
        <button 
          className={`settings-tab ${tab === 'keys' ? 'active' : ''}`}
          onClick={() => setTab('keys')}
        >
          Keys
        </button>
        <button 
          className={`settings-tab ${tab === 'nwc' ? 'active' : ''}`}
          onClick={() => setTab('nwc')}
        >
          NWC
        </button>
        <button 
          className={`settings-tab ${tab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setTab('subscriptions')}
        >
          Subscriptions
        </button>
      </div>
      <div className="settings-content">
        {tab === 'relays' && (
          <div>
            <div className="form-group">
              <label>Relays</label>
              <div className="relay-list">
                {relays.map(relay => (
                  <div key={relay} className="relay-item">
                    <div className="relay-info">
                      <span className="relay-url">{relay}</span>
                      {relayHealth[relay] && (
                        <div className="relay-metrics">
                          <span className={`health-indicator ${relayHealth[relay].successRate >= 0.7 ? 'healthy' : 'unhealthy'}`}>
                            {Math.round(relayHealth[relay].successRate * 100)}%
                          </span>
                          <span className="latency">
                            {Math.round(relayHealth[relay].avgLatency)}ms
                          </span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleRemoveRelay(relay)} className="relay-remove">Remove</button>
                  </div>
                ))}
              </div>
              <div className="add-relay">
                <input 
                  type="text" 
                  value={newRelay} 
                  onChange={e => setNewRelay(e.target.value)} 
                  placeholder="Add new relay" 
                  className="form-input"
                />
                <button onClick={handleAddRelay} className="save-button">Add Relay</button>
              </div>
              {relayError && <div className="error-message">{relayError}</div>}
            </div>
          </div>
        )}
        {tab === 'keys' && (
          <div>
            <div className="login-method">
              <p>Current login method: <strong>{loginMethod === 'extension' ? 'Nostr Extension' : 'Manual Keys'}</strong></p>
            </div>
            <div className="form-group">
              <label>Public Key (npub)</label>
              <input 
                type="text" 
                value={npub} 
                readOnly 
                className="form-input" 
              />
            </div>
            {loginMethod === 'manual' && (
              <>
                <div className="form-group">
                  <label>Private Key (hex)</label>
                  <input 
                    type="password" 
                    value={privkey} 
                    onChange={e => setPrivkey(e.target.value)} 
                    placeholder="Paste your hex private key" 
                    className="form-input"
                  />
                </div>
                <div className="form-actions">
                  <button onClick={generateNewKeyPair} className="generate-button">Generate New Keys</button>
                  <button onClick={handleSaveKeys} className="save-button">Save Keys</button>
                </div>
              </>
            )}
            {keyError && <div className="error-message">{keyError}</div>}
          </div>
        )}
        {tab === 'nwc' && (
          <div>
            <div className="form-group">
              <label>NWC URI</label>
              <input 
                type="text" 
                value={nwcInput} 
                onChange={e => setNwcInput(e.target.value)} 
                placeholder="Enter NWC URI (nostr+walletconnect://...)" 
                className="form-input"
              />
              <div style={{ marginTop: 8 }}>
                <QRScanner onScan={val => setNwcInput(val)} />
              </div>
            </div>
            <div className="form-actions">
              <button 
                onClick={handleSaveNwc} 
                className="save-button"
                disabled={checkingBalance}
              >
                Save NWC
              </button>
              {nwc && (
                <button 
                  onClick={checkNwcBalance} 
                  className="check-balance-button"
                  disabled={checkingBalance}
                >
                  {checkingBalance ? 'Checking...' : 'Check Balance'}
                </button>
              )}
            </div>
            {nwc && (
              <div className="nwc-status">
                {nwcConnected ? (
                  <div className="status-connected">
                    <span className="status-dot"></span>
                    Connected to NWC wallet
                  </div>
                ) : (
                  <div className="status-disconnected">
                    <span className="status-dot"></span>
                    Not connected
                  </div>
                )}
              </div>
            )}
            {nwcBalance !== null && (
              <div className="balance-display">
                Available Balance: <strong>{nwcBalance.toLocaleString()} sats</strong>
              </div>
            )}
            {nwcError && <div className="error-message">{nwcError}</div>}
          </div>
        )}
        {tab === 'subscriptions' && (
          <div>
            <div className="subscriptions-header">
              <h3>Subscriptions</h3>
              <button onClick={() => setShowAddSub(!showAddSub)} className="save-button">
                {showAddSub ? 'Cancel' : 'Add Subscription'}
              </button>
            </div>
            {showAddSub && (
              <div className="add-subscription-form">
                <input
                  type="text"
                  placeholder="Goal noteId/nevent"
                  value={newSub.goalId}
                  onChange={e => setNewSub({ ...newSub, goalId: e.target.value })}
                  className="form-input"
                  style={{ minWidth: 180 }}
                />
                <input
                  type="text"
                  placeholder="Goal name (optional)"
                  value={newSub.goalName}
                  onChange={e => setNewSub({ ...newSub, goalName: e.target.value })}
                  className="form-input"
                  style={{ minWidth: 180 }}
                />
                <input
                  type="number"
                  placeholder="Amount (sats)"
                  value={newSub.amount}
                  min={1}
                  onChange={e => setNewSub({ ...newSub, amount: Number(e.target.value) })}
                  className="form-input"
                  style={{ minWidth: 120 }}
                />
                <select
                  value={newSub.frequency}
                  onChange={e => setNewSub({ ...newSub, frequency: e.target.value })}
                  className="form-input"
                  style={{ minWidth: 120 }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button onClick={handleAddSubscription} className="save-button">Save Subscription</button>
              </div>
            )}
            <div className="subscriptions-list">
              {zapSubscriptions.length === 0 && <div style={{ color: '#888', padding: '1.5rem 0', textAlign: 'center' }}>No subscriptions yet.</div>}
              {zapSubscriptions.map(sub => (
                <div key={sub.id} className="subscription-item">
                  <div style={{ flex: 1 }}>
                    <MiniZapGoalCard goalId={sub.goalId} relays={relays} />
                    <div style={{ color: '#3182ce', fontWeight: 500, marginTop: 4 }}>{sub.amount} sats <span style={{ color: '#666', marginLeft: 8 }}>{sub.frequency}</span>{sub.paused && <span className="paused-label">(Paused)</span>}</div>
                  </div>
                  <div className="subscription-actions">
                    <button onClick={() => handlePauseSubscription(sub.id, !sub.paused)} className="save-button">
                      {sub.paused ? 'Resume' : 'Pause'}
                    </button>
                    <button onClick={() => handleDeleteSubscription(sub.id)} className="relay-remove">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
