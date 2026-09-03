import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div 
          role="tooltip"
          className={`absolute z-50 px-2.5 py-1.5 text-xs font-normal text-slate-100 bg-slate-900/95 backdrop-blur-md rounded-md shadow-lg border border-slate-700/50 whitespace-normal min-w-[180px] max-w-[260px] text-left pointer-events-none transition-opacity duration-150 ${positionClasses[position]}`}
        >
          {content}
          {/* Arrow */}
          <div 
            className={`absolute w-2 h-2 bg-slate-900 rotate-45 border-slate-700/50 ${
              position === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2 border-r border-b' :
              position === 'bottom' ? 'bottom-full -mb-1 left-1/2 -translate-x-1/2 border-l border-t' :
              position === 'left' ? 'left-full -ml-1 top-1/2 -translate-y-1/2 border-r border-t' :
              'right-full -mr-1 top-1/2 -translate-y-1/2 border-l border-b'
            }`} 
          />
        </div>
      )}
    </div>
  );
};

export const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip content={text}>
    <button 
      type="button" 
      className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
      aria-label="Information"
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </button>
  </Tooltip>
);
