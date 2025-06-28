import { useNostrLogin, setLoginMethod } from './nostr';
import { useState, useEffect, useMemo } from 'react';
import type { View } from './types/navigation';
import { DEFAULT_RELAYS } from './constants';
import { loadRelays, saveRelays, loadNwc, saveNwc } from './utils/storage-utils';
import { Navigation } from './shared/components/Navigation';
import { Landing } from './features/landing';
import { GlobalFeed } from './features/feed';
import { ProfileViewer } from './features/profile';
import { CreateZapGoal, ZapGoalDetails } from './features/goals';
import { SettingsPage } from './features/settings';
import { ZapNotificationsPage } from './features/notifications';
import { useNostrData } from './hooks/useNostr';
import { Leaderboard } from './shared/components/Leaderboard';
import { ZapSubscriptionService } from './services/zap-subscription.service';

function App() {
  const [loginVersion, setLoginVersion] = useState(0);
  const { pubkey, npub, profile } = useNostrLogin(loginVersion);
  const [view, setView] = useState<View>('feed');
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [clickedProfileData, setClickedProfileData] = useState<{
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud06?: string;
    lud16?: string;
    banner?: string;
    website?: string;
  } | null>(null);
  const [relays, setRelays] = useState<string[]>(() => {
    const savedRelays = loadRelays();
    if (!savedRelays) {
      // If no saved relays, initialize with defaults and save
      const initialRelays = [...DEFAULT_RELAYS];
      saveRelays(initialRelays);
      return initialRelays;
    }
    return savedRelays
  });
  const [keys, setKeys] = useState<{ pubkey: string; privkey: string } | null>(null);
  const [nwc, setNwcState] = useState<string>(() => loadNwc() || '');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const nostrService = useNostrData(relays);

  // ZapSubscriptionService instance
  const [zapSubService, setZapSubService] = useState<ZapSubscriptionService | null>(null);

  // Add relay health check effect
  useEffect(() => {
    if (!nostrService) return;
    
    const checkRelayHealth = () => {
      const metrics = nostrService.getRelayHealth();
      const healthyRelays = Object.entries(metrics)
        .filter(([_, health]) => health.successRate >= 0.7)
        .map(([url]) => url);

      // Only add default relays if we have no healthy relays at all
      if (healthyRelays.length === 0) {
        const missingDefaults = DEFAULT_RELAYS.filter(
          relay => !relays.includes(relay)
        ).slice(0, 2); // Only add up to 2 default relays at a time
        
        if (missingDefaults.length > 0) {
          const updatedRelays = [...new Set([...relays, ...missingDefaults])];
          setRelays(updatedRelays);
          saveRelays(updatedRelays); // Save to localStorage
        }
      }
    };

    const interval = setInterval(checkRelayHealth, 60000); // Check every minute
    checkRelayHealth(); // Initial check

    return () => clearInterval(interval);
  }, [nostrService, relays]);

  // Memoize the healthy relays for components that need them
  const healthyRelays = useMemo(() => {
    if (!nostrService) return relays;
    return Object.entries(nostrService.getRelayHealth())
      .filter(([_, health]) => health.successRate >= 0.7)
      .map(([url]) => url);
  }, [nostrService, relays]);

  // Add: clear all user state and go to landing
  const handleSignOut = () => {
    localStorage.clear();
    setKeys(null);
    setNwc('');
    setSelectedProfile(null);
    setSelectedGoal(null);
    setView('landing');
    setLoginMethod('nip07'); // Reset login method to nip07
    setLoginVersion(v => v + 1); // force useNostrLogin to re-run
  };

  const handleNavigate = (newView: View) => {
    setView(newView);
    if (newView === 'profile' && pubkey) {
      setSelectedProfile(pubkey);
    }
  };

  // Set rounded icon for browser tab (favicon)
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (link) {
      link.href = '/icon.jpeg';
      link.type = 'image/jpeg';
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.type = 'image/jpeg';
      newLink.href = '/icon.jpeg';
      document.head.appendChild(newLink);
    }
    // Add rounded style to favicon (works in Chromium browsers)
    const meta = document.querySelector("meta[name='theme-color']");
    if (!meta) {
      const style = document.createElement('style');
      style.innerHTML = `
        link[rel~="icon"] {
          border-radius: 50%;
          overflow: hidden;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // If not logged in, show landing page or BunkerConnectPrompt
  useEffect(() => {
    if (pubkey && view === 'landing') {
      setView('feed');
    }
  }, [pubkey, view]);

  // Persist NWC to localStorage whenever it changes
  useEffect(() => {
    saveNwc(nwc);
  }, [nwc]);

  // Wrap setNwc to ensure all consumers use the persistent setter
  const setNwc = (value: string) => {
    setNwcState(value);
    // saveNwc is already called by the effect above
  };

  // Start/stop subscription service when nostrService, nwc, or login state changes
  useEffect(() => {
    if (pubkey && nostrService && nwc) {
      if (!zapSubService) {
        const service = new ZapSubscriptionService(nostrService);
        service.start();
        setZapSubService(service);
      } else {
        zapSubService.start();
      }
    } else if (zapSubService) {
      zapSubService.stop();
    }
    // Clean up on unmount
    return () => { zapSubService?.stop(); };
    // eslint-disable-next-line
  }, [pubkey, nostrService, nwc]);

  // Listen for insufficient balance events from subscription service
  useEffect(() => {
    function handleInsufficientBalance(e: any) {
      const { sub, balance } = e.detail || {};
      alert(`⚠️ subscription for goal "${sub.goalName || sub.goalId}" could not be sent: Insufficient NWC balance (${balance} sats). Please top up your wallet.`);
    }
    window.addEventListener('zap-subscription-insufficient-balance', handleInsufficientBalance);
    return () => window.removeEventListener('zap-subscription-insufficient-balance', handleInsufficientBalance);
  }, []);

  if (!pubkey) {
    if (view !== 'landing') setView('landing');
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(120deg, #232946 0%, #b8c1ec 100%)' }}>
        <Landing onLogin={() => { setLoginMethod('nip07'); setLoginVersion(v => v + 1); }} />
      </div>
    );
  }

  // If logged in, never show landing page
  if (view === 'landing') {
    setView('feed');
    return null;
  }

  return (
    <div className="app-shell theme-vibrant" style={{ display: 'flex', minHeight: '100vh', alignItems: 'flex-start' }}>
      <Navigation 
        current={view} 
        onNavigate={handleNavigate} 
        profile={profile ? { ...profile, npub: npub ?? undefined } : undefined}
        onShowNotifications={() => setView('notifications')} 
        onSignOut={handleSignOut} 
        nwc={nwc} // <-- pass nwc prop for reactivity
      />
      <div className="app-main-content" style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <header style={{ display: 'none' }} />
        <main>
          {view === 'feed' && (
            <GlobalFeed 
              relays={healthyRelays} 
              nwc={nwc} 
              onProfileClick={(pk, profileData) => { 
                setSelectedProfile(pk);
                setClickedProfileData(profileData || null);
                setView('profile'); 
              }} 
              onGoalClick={(goalId) => { setSelectedGoal(goalId); setView('goal'); }} 
            />
          )}
          {view === 'goal' && selectedGoal && (
            <ZapGoalDetails 
              goalId={selectedGoal} 
              relays={relays} // Use all available relays instead of just healthy ones
              onBack={() => setView('feed')} 
              nwc={nwc}
            />
          )}
          {view === 'profile' && selectedProfile && (
            <ProfileViewer 
              pubkey={selectedProfile} 
              relays={healthyRelays}
              initialProfile={
                selectedProfile === pubkey && profile ? {
                  name: profile.name,
                  display_name: profile.display_name,
                  about: profile.about,
                  picture: profile.picture,
                  nip05: profile.nip05,
                  lud06: profile.lud06,
                  lud16: profile.lud16,
                  banner: profile.banner,
                  website: profile.website
                } : clickedProfileData || undefined
              }
              onGoalClick={(goal) => { setSelectedGoal(goal.id); setView('goal'); }}
            />
          )}
          {view === 'create' && (
            <CreateZapGoal 
              onBack={() => setView('feed')} 
            />
          )}
          {view === 'settings' && (
            <SettingsPage 
              relays={relays} 
              setRelays={setRelays} 
              keys={keys} 
              setKeys={setKeys} 
              nwc={nwc} 
              setNwc={setNwc} 
            />
          )}
          {view === 'notifications' && (
            <ZapNotificationsPage 
              profile={profile ? { ...profile, npub: npub ?? undefined } : undefined}

            />
          )}
          {view === 'leaderboard' && (
            <Leaderboard relays={relays} />
          )}
        </main>
      </div>
      {!['create', 'landing'].includes(view) && (
        <div 
          className="floating-action-button"
          onClick={() => setView('create')}
          title="Create New Zap Goal"
        >
          +
        </div>
      )}
    </div>
  );
}

// NOTE: getBunkerProvider().getPublicKey() should only be called after user initiates login,
// not automatically on provider startup. See /nostr/bunkerProvider.ts for details.

export default App;
