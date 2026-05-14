import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export default function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3 select-none group", className)}>
      <motion.div 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative w-10 h-10"
      >
        {/* Background Hexagon Glow */}
        <div className="absolute inset-0 bg-blue-500 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
        
        {/* Main Logo Container */}
        <div className="relative w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center border border-white/20 shadow-xl overflow-hidden">
          {/* Abstract SVG Icon */}
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-white"
          >
            <path 
              d="M12 3L4 7.5V16.5L12 21L20 16.5V7.5L12 3Z" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M12 12L20 7.5M12 12V21M12 12L4 7.5" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <circle cx="12" cy="12" r="2" fill="white" className="animate-pulse" />
          </svg>

          {/* Decorative Pattern Overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_100%)] pointer-events-none" />
        </div>
      </motion.div>

      {!iconOnly && (
        <div className="flex flex-col">
          <span className="text-xl font-black text-white tracking-tighter leading-none">
            Siaga<span className="text-blue-500">Bantu</span>
          </span>
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
            Emergency Response Ledger
          </span>
        </div>
      )}
    </div>
  );
}
