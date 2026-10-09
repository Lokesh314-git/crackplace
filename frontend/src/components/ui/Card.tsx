import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  interactive?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  interactive = false,
  header,
  footer,
  children,
  className = '',
  ...props
}) => {
  const isInteractive = hoverable || interactive;
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl overflow-hidden transition-all duration-150 shadow-xs ${
        isInteractive ? 'hover:border-slate-300 hover:shadow-sm cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {header && <div className="px-5 py-4 border-b border-slate-100">{header}</div>}
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100">{footer}</div>}
    </div>
  );
};

export default Card;
