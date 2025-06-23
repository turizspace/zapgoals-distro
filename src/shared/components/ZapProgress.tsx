import React from 'react';
import '../../styles/components/ZapProgress.css';

interface ZapProgressProps {
  goal: number;
  received: number;
}

export const ZapProgress: React.FC<ZapProgressProps> = ({ goal, received }) => {
  const percent = goal ? Math.min(100, (received / goal) * 100) : 0;
  const percentDisplay = percent.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div className="zap-progress">
      <div className="progress-bar">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${percent}%` }} 
        />
      </div>
      <div className="progress-stats">
        <span>{percentDisplay}% Complete</span>
      </div>
    </div>
  );
};
