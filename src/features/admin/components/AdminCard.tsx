import React from 'react';

interface AdminCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const AdminCard: React.FC<AdminCardProps> = ({ title, children, className = '', headerAction }) => {
  return (
    <div className={`bg-white rounded-xl p-3.5 sm:p-5 shadow-xs border border-slate-200/80 flex flex-col ${className}`}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
          {title && <h3 className="font-bold text-slate-800 text-base tracking-tight">{title}</h3>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
};
