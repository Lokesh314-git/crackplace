import React from 'react';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  sublabel?: string;
  color?: 'blue' | 'purple' | 'emerald' | 'amber' | 'primary' | 'accent';
  variant?: 'blue' | 'purple' | 'emerald' | 'amber' | 'primary' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  sublabel,
  color,
  variant,
  size = 'md',
  showPercentage = false,
  className = '',
}) => {
  const activeColor = variant || color || 'blue';
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-600',
    primary: 'bg-blue-600',
    purple: 'bg-purple-600',
    accent: 'bg-purple-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || sublabel || showPercentage) && (
        <div className="flex justify-between items-center text-xs font-medium mb-1.5">
          {label && <span className="text-slate-300">{label}</span>}
          <div className="flex items-center gap-2 ml-auto">
            {sublabel && <span className="text-slate-400">{sublabel}</span>}
            {showPercentage && <span className="text-slate-300 font-semibold">{percentage}%</span>}
          </div>
        </div>
      )}
      <div className={`w-full bg-slate-800 rounded-full overflow-hidden ${sizeStyles[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorStyles[activeColor] || colorStyles.blue}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
