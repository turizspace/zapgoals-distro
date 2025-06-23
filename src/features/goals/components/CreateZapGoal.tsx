import React, { useState } from 'react';
import { SimplePool } from 'nostr-tools';
import { nostrSign } from '../../../nostr';

interface CreateZapGoalProps {
  onBack: () => void;
}

export const CreateZapGoal: React.FC<CreateZapGoalProps> = ({ onBack }) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState(10000);
  const [image, setImage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Optionals for advanced users
  const [rTag, setRTag] = useState('');

  const appRelays = [
    'wss://relay.nostr.band',
    'wss://relay.damus.io', 
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.primal.net'
  ];
  
  async function handleCreate() {
    if (!title || !summary || !goal) {
      setStatus('Please fill all required fields');
      return;
    }
    setIsSubmitting(true);
    setStatus('Creating goal...');
    try {
      const tags: string[][] = [
        ['relays', ...appRelays],
        ['goal', goal.toString()],
        ['summary', summary],
      ];
      if (image) tags.push(['image', image]);
      if (rTag) tags.push(['r', rTag]);
      // Optionally add description as a tag
      if (description) tags.push(['description', description]);
      // Compose event
      const event = {
        kind: 9041,
        content: summary,
        created_at: Math.floor(Date.now() / 1000),
        tags,
      };
      const signedEvent = await nostrSign(event);
      if (!signedEvent) {
        setStatus('Failed to sign event');
        setIsSubmitting(false);
        return;
      }
      const pool = new SimplePool();
      const pubs = await Promise.all(
        appRelays.map(relay => pool.publish([relay], signedEvent))
      );
      if (pubs.some(p => p)) {
        setStatus('Created!');
        setTimeout(onBack, 1000);
      } else {
        setStatus('Failed to publish');
      }
    } catch (e) {
      setStatus('Error creating goal');
    }
    setIsSubmitting(false);
  }

  return (
    <div className="create-zap-goal modern-card">
      <button onClick={onBack} className="back-button">←</button>
      <h2 style={{ color: 'var(--primary)', marginBottom: '1.5rem' }}>Create Zap Goal</h2>
      <div className="form-group">
        <label>Title</label>
        <input 
          type="text" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          placeholder="Give your goal a clear title" 
          className="modern-input" />
      </div>
      <div className="form-group">
        <label>Summary <span style={{color:'#b8c1ec', fontWeight:400}}>(short description, required)</span></label>
        <input 
          type="text" 
          value={summary} 
          onChange={e => setSummary(e.target.value)} 
          placeholder="Brief summary of your goal" 
          className="modern-input" />
      </div>
      <div className="form-group">
        <label>Description <span style={{color:'#b8c1ec', fontWeight:400}}>(optional, longer details)</span></label>
        <textarea 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          placeholder="Describe your goal..." 
          className="modern-input"
          style={{ minHeight: '120px' }} />
      </div>
      <div className="form-group">
        <label>Goal (sats)</label>
        <input 
          type="number" 
          value={goal} 
          onChange={e => setGoal(Number(e.target.value))} 
          className="modern-input" 
          min="1" />
      </div>
      <div className="form-group">
        <label>Image URL <span style={{color:'#b8c1ec', fontWeight:400}}>(optional)</span></label>
        <input 
          type="url" 
          value={image} 
          onChange={e => setImage(e.target.value)} 
          placeholder="https://... (image for your goal)" 
          className="modern-input" />
      </div>
      <div className="form-group">
        <label>Optional links <span style={{color:'#b8c1ec', fontWeight:400}}>(optional, URL)</span></label>
        <input 
          type="url" 
          value={rTag} 
          onChange={e => setRTag(e.target.value)} 
          placeholder="https://... (external link)" 
          className="modern-input" />
      </div>
      <div className="form-actions">
        <button 
          onClick={handleCreate} 
          className="primary-action"
          disabled={!title || !summary || !goal || isSubmitting}>
          Create Goal
        </button>
      </div>
      {status && <div className="status-message">{status}</div>}
    </div>
  );
};
