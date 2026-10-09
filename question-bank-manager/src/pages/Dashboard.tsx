import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  Layers,
  Sparkles,
  FileUp,
  PlusCircle,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  BookOpen,
  PieChart,
  Eye,
  BarChart3
} from 'lucide-react';
import { questionService } from '../services/questionService';
import { DashboardStats, Question, Subject } from '../types';
import { Badge } from '../components/ui/Badge';
import { QuestionDetailModal } from '../components/modals/QuestionDetailModal';
import { getSubjectDetails } from '../constants/subjects';
import { isSupabaseConfigured } from '../lib/supabase';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [fetchedStats, fetchedSubjects] = await Promise.all([
        questionService.getDashboardStats(),
        questionService.getSubjects()
      ]);
      setStats(fetchedStats);
      setSubjects(fetchedSubjects);
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.message || 'Failed to load dashboard metrics from Supabase');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'bg-emerald-500';
      case 'Medium':
        return 'bg-amber-500';
      case 'Hard':
        return 'bg-rose-500';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Question Bank Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time question metrics and placement subject distribution from Supabase PostgreSQL
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Metrics</span>
          </button>

          <Link
            to="/import-csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </Link>

          <Link
            to="/add-question"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs shadow-indigo-600/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Question</span>
          </Link>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Sandbox Mode Active:</span> Your Supabase environment variables are not yet configured. The dashboard is currently utilizing safe local sandbox storage. Add your <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900 font-mono">VITE_SUPABASE_URL</code> & <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900 font-mono">VITE_SUPABASE_ANON_KEY</code> to connect directly to PostgreSQL.
            </div>
          </div>
          <Link
            to="/settings"
            className="px-3 py-1 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 rounded-md font-semibold text-amber-900 dark:text-amber-100 whitespace-nowrap transition-colors"
          >
            Configure
          </Link>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Questions Card */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Questions
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {loading ? '...' : (stats?.totalQuestions || 0).toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-400">in repository</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Dynamic source of truth for student practice & battles
          </p>
        </div>

        {/* Total Placement Subjects Card */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Subjects
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {loading ? '...' : subjects.length}
            </span>
            <span className="text-xs font-medium text-slate-400">placement domains</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Aptitude, DSA, DBMS, OS, CN, LR, VA, HR
          </p>
        </div>

        {/* MCQ Ratio Card */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              MCQ Questions
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {loading ? '...' : (stats?.byType.MCQ || 0).toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-400">
              {stats?.totalQuestions
                ? `${Math.round(((stats.byType.MCQ || 0) / stats.totalQuestions) * 100)}%`
                : '0%'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            4-option automated evaluation ready
          </p>
        </div>

        {/* Interview Questions Card */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Interview / HR
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {loading ? '...' : (stats?.byType.INTERVIEW || 0).toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-400">open-ended</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Behavioral and subjective interview rubrics
          </p>
        </div>
      </div>

      {/* Breakdown Section: Subjects & Difficulty */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions by Subject Cards (Span 2) */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                Questions by Subject
              </h2>
              <p className="text-xs text-slate-500">Live counts query straight from Supabase</p>
            </div>
            <Link
              to="/subjects"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              Manage Subjects <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {subjects.map((sub) => {
              const count = stats?.bySubject[sub.slug] || 0;
              const percent = stats?.totalQuestions
                ? Math.round((count / stats.totalQuestions) * 100)
                : 0;

              return (
                <div
                  key={sub.slug}
                  className="p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                        {sub.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {sub.slug}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {count.toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>Prefix: {sub.code_prefix}</span>
                      <span>{percent}% of total</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty Distribution Breakdown */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              Difficulty Distribution
            </h2>
            <p className="text-xs text-slate-500">Tier distribution across all subjects</p>
          </div>

          <div className="space-y-4">
            {(['Easy', 'Medium', 'Hard'] as const).map((diff) => {
              const count = stats?.byDifficulty[diff] || 0;
              const total = stats?.totalQuestions || 1;
              const percent = Math.round((count / total) * 100);

              return (
                <div key={diff} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${getDifficultyColor(diff)}`} />
                      {diff}
                    </span>
                    <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                      {count.toLocaleString()} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${getDifficultyColor(diff)} rounded-full transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-2">
            <div className="flex items-center justify-between">
              <span>MCQ Questions:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {(stats?.byType.MCQ || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Interview Questions:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {(stats?.byType.INTERVIEW || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Added Questions Table */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Recently Added Questions
            </h2>
            <p className="text-xs text-slate-500">Latest entries synchronized in the database</p>
          </div>
          <Link
            to="/questions"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            View All Questions <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {stats?.recentQuestions && stats.recentQuestions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Difficulty</th>
                  <th className="py-2.5 px-3">Question Preview</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {stats.recentQuestions.map((q) => (
                  <tr
                    key={q.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {q.question_id}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {getSubjectDetails(q.subject).name}
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          q.difficulty === 'Easy'
                            ? 'success'
                            : q.difficulty === 'Medium'
                            ? 'warning'
                            : 'danger'
                        }
                        size="sm"
                      >
                        {q.difficulty}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 max-w-xs sm:max-w-md truncate text-slate-800 dark:text-slate-200 font-medium">
                      {q.question}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {q.question_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedQuestion(q)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            No questions found. Click "Add Question" or "Import CSV" to begin populating Supabase.
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <QuestionDetailModal
        question={selectedQuestion}
        isOpen={Boolean(selectedQuestion)}
        onClose={() => setSelectedQuestion(null)}
      />
    </div>
  );
};
