import React from 'react';

interface AdminCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const AdminCard: React.FC<AdminCardProps> = ({ title, children, className = '', headerAction }) => {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col ${className}`}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
};
