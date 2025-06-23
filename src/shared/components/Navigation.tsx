// Navigation bar component for app-wide navigation
import React, { useEffect, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import type { View, Kind0Profile } from '../../types/navigation';
import '../../styles/components/Navigation.css';

const relays = [
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',];

interface NavigationProps {
  current: View;
  onNavigate: (view: View) => void;
  profile?: Kind0Profile | null;
  onShowNotifications?: () => void;
  onSignOut: () => void;
  nwc?: string; // <-- add nwc prop
}

export const Navigation: React.FC<NavigationProps> = ({ current, onNavigate, profile, onShowNotifications, onSignOut, nwc }) => {
  // Fallback logic for display name and avatar, similar to global feed
  const avatar = profile?.picture || '/icon.jpeg';
  let display = profile?.display_name || profile?.name || profile?.npub;
  if (!display && profile?.npub) {
    display = profile.npub.slice(0, 8) + '...';
  } else if (!display) {
    display = 'Anonymous';
  }

  // Notifications state
  const [zapCount, setZapCount] = useState(0);
  useEffect(() => {
    let ignore = false;
    async function fetchZaps() {
      if (!profile?.npub && !profile?.name && !profile?.display_name) return;
      try {
        const pool = new SimplePool();
        // Get pubkey from npub if available
        let pubkey = profile?.npub;
        if (!pubkey && profile?.name) pubkey = profile.name;
        // Fetch all kind 9041 zapgoals posted by this user
        const zapGoalEvents = await Promise.all(
          relays.map(relay => pool.get([relay], { kinds: [9041], authors: pubkey ? [pubkey] : [], limit: 50 }))
        );
        const zapGoals = zapGoalEvents.filter((ev): ev is NostrEvent => !!ev);
        const zapGoalIds = zapGoals.map(ev => ev.id);
        // Fetch all kind 9735 zaps for these zapgoals
        let zapEvents: (NostrEvent | null)[] = [];
        if (zapGoalIds.length > 0) {
          zapEvents = await Promise.all(
            zapGoalIds.map(id => pool.get(relays, { kinds: [9735], '#e': [id], limit: 100 }))
          );
        }
        const zaps = zapEvents.filter((z): z is NostrEvent => !!z);
        setZapCount(zaps.length);
        pool.close(relays);
      } catch {
        if (!ignore) setZapCount(0);
      }
    }
    if (profile) fetchZaps();
    return () => { ignore = true; };
  }, [profile]);

  // NWC balance state
  const [nwcBalance, setNwcBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [nwcError, setNwcError] = useState<string | null>(null);

  // Helper to refresh NWC balance (can be called from outside)
  const refreshNwcBalance = async () => {
    setCheckingBalance(true);
    setNwcError(null);
    if (!nwc) {
      setNwcError('Wallet not connected');
      setNwcBalance(null);
      setCheckingBalance(false);
      return;
    }
    try {
      const { NWCClient } = await import('../../services/nwc.service');
      const client = new NWCClient({ nostrWalletConnectUrl: nwc });
      const { balance } = await client.getBalance();
      setNwcBalance(balance);
      setNwcError(null);
      client.close();
    } catch (err: any) {
      setNwcError('Failed to get NWC balance');
      setNwcBalance(null);
    } finally {
      setCheckingBalance(false);
    }
  };

  // Fetch NWC balance on mount or when nwc changes
  useEffect(() => {
    refreshNwcBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nwc]);

  // Listen for a custom event to refresh balance after zap
  useEffect(() => {
    function handleZapComplete() {
      refreshNwcBalance();
    }
    window.addEventListener('nwc-zap-complete', handleZapComplete);
    return () => window.removeEventListener('nwc-zap-complete', handleZapComplete);
  }, [nwc]);

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on navigation
  const handleNav = (view: View) => {
    setMobileOpen(false);
    onNavigate(view);
  };

  // Responsive: detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Overlay for mobile drawer
  const overlay = isMobile && mobileOpen ? (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1999,
      }}
      onClick={() => setMobileOpen(false)}
      aria-label="Close navigation menu"
      tabIndex={-1}
    />
  ) : null;

  // Hamburger button for mobile
  const hamburger = isMobile ? (
    <button
      className="nav-hamburger"
      aria-label="Open navigation menu"
      style={{
        position: 'fixed',
        top: 18,
        left: 18,
        zIndex: 2002,
        background: 'rgba(10,15,11,0.85)',
        border: 'none',
        borderRadius: 8,
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px #05ce7833',
        color: '#ffd803',
        fontSize: 28,
        cursor: 'pointer',
      }}
      onClick={() => setMobileOpen(true)}
    >
      <span aria-hidden="true">☰</span>
    </button>
  ) : null;

  // Navigation content (sidebar or drawer)
  const navContent = (
    <aside
      className="navigation-vertical-bar"
      style={{
        position: isMobile ? 'fixed' : 'fixed',
        top: 0,
        left: isMobile ? (mobileOpen ? 0 : '-260px') : 0,
        height: '100vh',
        minHeight: '100vh',
        width: 240,
        zIndex: 2000,
        boxShadow: '2px 0 24px 0 #05ce7833',
        borderRadius: '0 18px 18px 0',
        background: 'rgba(10, 15, 11, 0.69)', // 89% transparent black
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        margin: 0,
        padding: '2em 0 1em 0',
        gap: '2em',
        transition: isMobile ? 'left 0.25s cubic-bezier(.4,0,.2,1)' : undefined,
      }}
      aria-label="Main navigation"
      aria-modal={isMobile && mobileOpen ? 'true' : undefined}
      tabIndex={isMobile && mobileOpen ? 0 : undefined}
      role="navigation"
    >
      <div
        className="nav-profile"
        style={{
          marginBottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          gap: '0.7em',
        }}
      >
        <img
          src={avatar}
          alt="avatar"
          className="nav-profile-avatar"
          style={{
            borderRadius: '50%',
            cursor: 'pointer',
            marginBottom: 0,
            width: 72,
            height: 72,
            objectFit: 'cover', // Ensures aspect ratio is preserved and image is not stretched
            aspectRatio: '1/1', // Modern browsers support this for perfect circles
          }}
          onClick={() => handleNav('profile')}
        />
        <span
          className="nav-profile-name"
          style={{ fontWeight: 600, fontSize: '1.1em', cursor: 'pointer', margin: 0, color: '#ffd803', textAlign: 'center' }}
          onClick={() => handleNav('profile')}
        >
          {display}
        </span>
        {/* NWC Balance Section */}
        <div style={{ width: '90%', margin: '0.2em 0', textAlign: 'center', background: '#181f1b', borderRadius: 8, padding: '0.5em 0.7em', color: '#05ce78', fontWeight: 600, fontSize: '1.05em', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: '0.98em', color: '#ffd803', marginBottom: 2 }}>Balance</span>
          {checkingBalance ? (
            <span style={{ color: '#b8c1ec', fontSize: '0.98em' }}>Checking...</span>
          ) : nwcError ? (
            <span style={{ color: '#eebbc3', fontSize: '0.98em' }}>{nwcError}</span>
          ) : nwcBalance !== null ? (
            <span style={{ color: '#05ce78', fontWeight: 700, fontSize: '1.1em' }}>{nwcBalance.toLocaleString()} sats</span>
          ) : (
            <span style={{ color: '#b8c1ec', fontSize: '0.98em' }}>-</span>
          )}
        </div>
        {/* End NWC Balance Section */}
        {profile && (
          <div style={{ marginTop: 0, textAlign: 'center', color: '#ffd803', fontSize: '0.98em', width: '90%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {profile.nip05 && (
              <div style={{ color: '#b8c1ec', fontSize: '0.92em' }}>NIP-05: <span style={{ color: '#ffd803' }}>{profile.nip05}</span></div>
            )}
            {profile.about && (
              <div style={{ color: '#eebbc3' }}>{profile.about}</div>
            )}
            {profile.lud16 && (
              <div style={{ color: '#05ce78', fontSize: '0.95em' }}>⚡ {profile.lud16}</div>
            )}
            {profile.lud06 && !profile.lud16 && (
              <div style={{ color: '#05ce78', fontSize: '0.95em' }}>⚡ {profile.lud06}</div>
            )}
          </div>
        )}
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5em' }}>
        <nav className="navigation-bar" style={{ width: '100%', marginBottom: 0, gap: '0.7em', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button className={current === 'feed' ? 'active' : ''} onClick={() => handleNav('feed')}>Feed</button>
          <button className={current === 'settings' ? 'active' : ''} onClick={() => handleNav('settings')}>Settings</button>
          
        </nav>
        <div className="nav-notifications" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button className="notification-bell" title="Zap Notifications" style={{ background: 'none', border: 'none', position: 'relative', cursor: 'pointer' }} onClick={onShowNotifications}>
            <span role="img" aria-label="bell" style={{ fontSize: 28 }}>🔔</span>
            {zapCount > 0 && (
              <span className="notification-badge">{zapCount}</span>
            )}
          </button>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <button className="signout-btn" style={{ marginBottom: '1.5em', background: '#ffd803', color: '#232946', border: 'none', borderRadius: 8, padding: '0.7em 2em', fontWeight: 700, fontSize: '1.1em', cursor: 'pointer', width: '90%' }}
        onClick={() => { onSignOut && onSignOut(); }}>
        Sign Out
      </button>
    </aside>
  );

  return (
    <>
      {hamburger}
      {overlay}
      {(!isMobile || mobileOpen) && navContent}
    </>
  );
};

export default Navigation;
