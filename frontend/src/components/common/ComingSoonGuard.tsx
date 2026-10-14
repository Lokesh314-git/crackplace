import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaBookOpen, 
  FaTerminal, 
  FaGraduationCap, 
  FaHouse, 
  FaArrowRotateRight, 
  FaCircleExclamation,
  FaWrench
} from 'react-icons/fa6';

export type PagePublishingKey = 'study_notes' | 'coding_workspace';

interface ComingSoonGuardProps {
  pageKey: PagePublishingKey;
  children: React.ReactNode;
}

const PAGE_CONFIG: Record<
  PagePublishingKey,
  {
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  study_notes: {
    title: 'Study Notes',
    description: "We're preparing study guides, revision notes, cheat sheets, and practice resources to help you prepare for placements.",
    icon: FaBookOpen
  },
  coding_workspace: {
    title: 'Coding Workspace',
    description: "We're building an interactive coding environment to help you practice algorithms and prepare for technical interviews.",
    icon: FaTerminal
  }
};

export const ComingSoonGuard: React.FC<ComingSoonGuardProps> = ({ pageKey, children }) => {
  const [status, setStatus] = useState<'coming_soon' | 'published' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = PAGE_CONFIG[pageKey];
  const IconComponent = config.icon;

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/page-publishing/status?pageKey=${pageKey}`);
      if (!res.ok) {
        throw new Error(`Failed to load page publishing status (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data && (data.status === 'published' || data.status === 'coming_soon')) {
        setStatus(data.status);
      } else {
        // Safe default
        setStatus('coming_soon');
      }
    } catch (err: any) {
      console.warn(`[PagePublishing] Error fetching status for ${pageKey}:`, err.message);
      // Fail safe: Default to coming_soon to prevent accidental leakage of unpublished features
      setStatus('coming_soon');
      setError('Unable to reach server to verify publishing status.');
    } finally {
      setLoading(false);
    }
  }, [pageKey]);

  useEffect(() => {
    fetchStatus();

    // Auto-refresh when tab gains focus or user returns to window
    const handleFocus = () => {
      fetchStatus();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('page-publishing-updated', handleFocus);

    // Light polling (every 30s) while staying on the page to pick up admin updates without reloading
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('page-publishing-updated', handleFocus);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  // Loading State — clean placeholder matching CrackPlace theme, avoids flash of functional tools
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4 max-w-lg mx-auto text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border-dark flex items-center justify-center text-brand-400 animate-pulse shadow-xs">
          <IconComponent className="w-7 h-7" />
        </div>
        <div className="space-y-2 w-full max-w-xs mx-auto">
          <div className="h-4 bg-surface-elevated rounded-full animate-pulse w-3/4 mx-auto" />
          <div className="h-3 bg-surface-elevated rounded-full animate-pulse w-1/2 mx-auto" />
        </div>
        <p className="text-xs text-text-muted">Loading {config.title} status...</p>
      </div>
    );
  }

  // Published State — Render functional children completely intact
  if (status === 'published') {
    return <>{children}</>;
  }

  // Coming Soon State — Professional dedicated Under Development screen
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 max-w-2xl mx-auto text-center space-y-6 animate-fade-in pb-16">
      {/* Icon Badge */}
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 text-3xl shadow-[0_0_25px_rgba(99,102,241,0.15)] mx-auto">
          <IconComponent className="w-9 h-9" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center text-amber-400 shadow-xs">
          <FaWrench className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Heading & Status Badge */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Under Development</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
          Coming Soon
        </h1>
        <p className="text-sm font-semibold text-brand-400">
          {config.title}
        </p>
      </div>

      {/* Page-Specific Description */}
      <p className="text-sm text-text-secondary max-w-lg mx-auto leading-relaxed">
        {config.description}
      </p>

      {/* Error / Retry Banner if network failed */}
      {error && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 max-w-md mx-auto shadow-xs">
          <div className="flex items-center gap-2">
            <FaCircleExclamation className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="text-left">{error}</span>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold cursor-pointer shrink-0 transition-colors"
          >
            <FaArrowRotateRight className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full sm:w-auto">
        <Link
          to="/dashboard"
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <FaHouse className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
        <Link
          to="/practice"
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-border-dark text-text-primary font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <FaGraduationCap className="w-4 h-4 text-brand-400" />
          <span>Visit Practice Hub</span>
        </Link>
      </div>
    </div>
  );
};

export default ComingSoonGuard;
