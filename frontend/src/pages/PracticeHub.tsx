import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaCode,
  FaComments,
  FaCalculator,
  FaDatabase,
  FaServer,
  FaNetworkWired,
  FaBrain,
  FaFont,
  FaCirclePlay
} from 'react-icons/fa6';
import { Badge } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { SUBJECT_LIST } from '../constants/subjects';
import type { SubjectConfig } from '../constants/subjects';
import { questionService } from '../services/questionService';

const ICON_MAP: Record<string, React.ReactNode> = {
  FaCalculator: <FaCalculator className="w-5 h-5 text-blue-600" />,
  FaCode: <FaCode className="w-5 h-5 text-purple-600" />,
  FaDatabase: <FaDatabase className="w-5 h-5 text-emerald-600" />,
  FaServer: <FaServer className="w-5 h-5 text-amber-600" />,
  FaNetworkWired: <FaNetworkWired className="w-5 h-5 text-rose-600" />,
  FaBrain: <FaBrain className="w-5 h-5 text-blue-600" />,
  FaFont: <FaFont className="w-5 h-5 text-emerald-600" />,
  FaComments: <FaComments className="w-5 h-5 text-purple-600" />
};

export const PracticeHub: React.FC = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const { token } = useAuthStore();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Dynamically load live counts from Supabase Question Bank
    SUBJECT_LIST.forEach(async (sub: SubjectConfig) => {
      try {
        const count = await questionService.getQuestionCount({ subject: sub.slug });
        setCounts(prev => ({ ...prev, [sub.slug]: count }));
      } catch (err) {
        // silent fallback
      }
    });

    if (token) {
      fetch('/api/quiz/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setHistory(data);
        })
        .catch(err => console.error('Failed to fetch quiz history:', err));
    }
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm">
            Supabase Question Bank
          </Badge>
          <span className="text-xs text-slate-400">Comprehensive Placement Modules</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          Topic-wise Practice Hub
        </h1>
        <p className="text-xs md:text-sm text-slate-600 max-w-2xl">
          Choose a subject domain to practice curated placement questions directly from the centralized Supabase repository.
        </p>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUBJECT_LIST.map((item: SubjectConfig) => {
          const count = counts[item.slug];
          const displayCount = count !== undefined && count > 0
            ? `${count} Active Questions`
            : 'Supabase Question Bank';
          const targetUrl = `/practice/${encodeURIComponent(item.slug)}`;

          return (
            <div
              key={item.slug}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all duration-150 shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                    {ICON_MAP[item.iconName] || <FaCode className="w-5 h-5 text-blue-600" />}
                  </div>
                  <Badge variant="neutral" size="sm">
                    {item.badge}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700">{displayCount}</span>
                  <span className="truncate max-w-[150px]">{item.targetCompanies}</span>
                </div>

                <Link
                  to={targetUrl}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
                >
                  <FaCirclePlay className="w-3.5 h-3.5" />
                  <span>Start Practice</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {/* Recent Assessments */ }
  {
    history.length > 0 && (
      <div className="mt-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Assessments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((h, i) => (
            <div key={h.id || i} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-900 truncate">{h.category}</span>
                <Badge variant={h.difficulty === 'hard' ? 'error' : h.difficulty === 'medium' ? 'warning' : 'primary'} size="sm">
                  {h.difficulty}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                {h.results ? (
                  <span className="font-bold text-emerald-600">{h.results.score}% Score</span>
                ) : (
                  <span className="text-slate-400 italic">Incomplete</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
    </div >
  );
};

export default PracticeHub;
