import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="glass-card rounded-xl p-5 animate-pulse">
    <div className="flex items-center justify-between mb-3">
      <div className="h-4 bg-slate-200 rounded w-1/3"></div>
      <div className="h-6 w-12 bg-slate-200 rounded-full"></div>
    </div>
    <div className="h-8 bg-slate-200 rounded w-2/3 mb-2"></div>
    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
  </div>
);

export const SkeletonChart: React.FC<{ height?: string }> = ({ height = 'h-72' }) => (
  <div className={`glass-card rounded-xl p-6 animate-pulse ${height} flex flex-col justify-between`}>
    <div className="flex items-center justify-between">
      <div className="h-5 bg-slate-200 rounded w-1/4"></div>
      <div className="h-7 bg-slate-200 rounded w-28"></div>
    </div>
    <div className="flex items-end gap-2 h-44 pt-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div 
          key={i} 
          className="bg-slate-200 rounded-t flex-1" 
          style={{ height: `${30 + (i * 7) % 65}%` }} 
        />
      ))}
    </div>
  </div>
);
