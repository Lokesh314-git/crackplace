import React from 'react';

export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Loading workspace...' }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-white">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-1.5 rounded-full border-2 border-b-pink-500 border-t-transparent border-r-transparent border-l-transparent animate-spin opacity-70" />
      </div>
      <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold animate-pulse">
        {message}
      </p>
    </div>
  );
};

export default PageLoader;
