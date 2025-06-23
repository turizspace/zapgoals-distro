import React from 'react';
import '../../../styles/components/Landing.css';

export const Landing: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
  <div className="landing-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(120deg, #232946 0%, #b8c1ec 100%)', padding: '0 1em' }}>
    <img src="/icon.jpeg" alt="ZapGoals Logo" style={{ width: 110, height: 110, marginBottom: 32, borderRadius: 24, boxShadow: '0 4px 32px #05ce7833' }} />
    <h1 style={{ color: '#05ce78', fontSize: '3.2em', marginBottom: 8, letterSpacing: '-2px', fontWeight: 900 }}>ZapGoals</h1>
    <h2 style={{ color: '#eebbc3', fontWeight: 400, marginBottom: 24, fontSize: '1.5em' }}>Kickstarter for Nostr Zaps</h2>
    <p style={{ color: '#b8c1ec', maxWidth: 480, textAlign: 'center', marginBottom: 32, fontSize: '1.15em', lineHeight: 1.6 }}>
      <b>ZapGoals</b> lets you create, fund, and track zap goals on Nostr. Launch your project, set a goal, and let the Nostr community support you with zaps!<br /><br />
      <span style={{ color: '#ffd803' }}>•</span> <b>Connect</b> with NIP-07 extension<br />
      <span style={{ color: '#ffd803' }}>•</span> <b>Create</b> a zap goal for your project, cause, or idea<br />
      <span style={{ color: '#ffd803' }}>•</span> <b>Fund</b> and <b>track</b> progress in real time<br />
      <span style={{ color: '#ffd803' }}>•</span> <b>Reply</b>, <b>react</b>, and <b>celebrate</b> with the community
    </p>
    <div style={{ display: 'flex', gap: '1em', marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
      <button
        className="primary-action"
        style={{ background: '#05ce78', color: '#fff', fontWeight: 700, fontSize: '1.2em', border: 'none', borderRadius: 12, padding: '0.9em 2.5em', cursor: 'pointer', boxShadow: '0 4px 24px #05ce7833' }}
        onClick={onLogin}
      >
        Login with Extension
      </button>
    </div>
    <div style={{ color: '#b8c1ec', fontSize: '0.95em', marginTop: 8 }}>
      <span role="img" aria-label="bolt">⚡</span> 100% open source & community powered
    </div>
  </div>
);

export default Landing;
