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
      className={`bg-bg-surface border border-border-subtle rounded-xl overflow-hidden transition-all duration-150 shadow-xs ${
        isInteractive ? 'hover:border-border-focus hover:shadow-sm cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {header && <div className="px-5 py-4 border-b border-border-subtle">{header}</div>}
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 py-3.5 bg-bg-elevated border-t border-border-subtle">{footer}</div>}
    </div>
  );
};

export default Card;
