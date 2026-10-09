import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  change?: string | number;
  isPositive?: boolean;
  icon?: React.ReactNode;
  accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  change,
  isPositive,
  icon,
  accentColor = 'blue',
  className = '',
}) => {
  const accentBorders = {
    blue: 'border-l-blue-600',
    purple: 'border-l-purple-600',
    emerald: 'border-l-emerald-600',
    amber: 'border-l-amber-500',
    rose: 'border-l-rose-500',
  };

  const accentIcons = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl p-5 border-l-4 ${accentBorders[accentColor]} flex items-start justify-between gap-4 transition-all duration-150 shadow-xs hover:border-slate-300 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {change !== undefined && (
            <span
              className={`text-xs font-semibold ${
                isPositive !== undefined
                  ? isPositive
                    ? 'text-emerald-600'
                    : 'text-red-600'
                  : 'text-slate-500'
              }`}
            >
              {typeof change === 'number' && change > 0 ? `+${change}` : change}
            </span>
          )}
        </div>
        {subtext && <p className="text-xs text-slate-500 mt-1 truncate">{subtext}</p>}
      </div>
      {icon && <div className={`p-2.5 rounded-lg shrink-0 ${accentIcons[accentColor]}`}>{icon}</div>}
    </div>
  );
};

export default StatCard;
