import React, { useState, useRef } from 'react';
import { nip19 } from 'nostr-tools';

interface GoalCardProps {
  eventId: string;
  name: string;
}

export const GoalCard: React.FC<GoalCardProps> = ({ eventId, name }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  let noteId = '';
  let nevent = '';
  try {
    noteId = nip19.noteEncode(eventId);
    nevent = nip19.neventEncode({ id: eventId });
  } catch {
    noteId = eventId;
    nevent = eventId;
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setMenuOpen(false);
  };

  // Close menu on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="goal-card" style={{ background: 'none', borderRadius: 8, padding: 10, marginBottom: 0, color: '#eebbc3', position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}
      onClick={e => e.stopPropagation()} // Prevent click from bubbling to parent
    >
      <div style={{ fontWeight: 600, color: '#ffd803', marginRight: 8, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      <button
        className="goal-card-menu-btn"
        style={{ background: 'none', border: 'none', color: 'black', fontSize: 20, cursor: 'pointer', padding: 0, marginLeft: 'auto' }}
        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
        title="More actions"
      >
        &#8942;
      </button>
      {menuOpen && (
        <div ref={menuRef} className="goal-card-menu" style={{ position: 'absolute', top: 32, right: 0, background: '#232946', borderRadius: 8, boxShadow: '0 2px 8pxrgba(189, 245, 221, 0.2)', zIndex: 10, minWidth: 180, padding: '0.5em 0' }}>
          <div style={{ padding: '0.5em 1em', cursor: 'pointer', color: '#ffd803' }} onClick={() => handleCopy(noteId)}>Copy noteId</div>
          <div style={{ padding: '0.5em 1em', cursor: 'pointer', color: '#ffd803' }} onClick={() => handleCopy(nevent)}>Copy nevent</div>
        </div>
      )}
    </div>
  );
};
