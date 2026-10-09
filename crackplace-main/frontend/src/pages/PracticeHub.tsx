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
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
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
          const targetUrl = item.slug === 'hr_behavioral'
            ? '/hr-interview'
            : `/quiz?category=${encodeURIComponent(item.slug)}`;

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
    </div>
  );
};

export default PracticeHub;
