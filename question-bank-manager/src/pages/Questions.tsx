import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Database,
  X
} from 'lucide-react';
import { questionService } from '../services/questionService';
import { csvService } from '../services/csvService';
import { Question, QuestionFilters, Subject } from '../types';
import { Badge } from '../components/ui/Badge';
import { QuestionDetailModal } from '../components/modals/QuestionDetailModal';
import { EditQuestionModal } from '../components/modals/EditQuestionModal';
import { DeleteConfirmModal } from '../components/modals/DeleteConfirmModal';
import { DEFAULT_SUBJECTS, getSubjectDetails } from '../constants/subjects';

export const Questions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [filters, setFilters] = useState<QuestionFilters>({
    page: 1,
    pageSize: 20,
    subject: 'all',
    difficulty: 'all',
    question_type: 'all',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  const [searchInput, setSearchInput] = useState('');

  // Modals state
  const [viewQuestion, setViewQuestion] = useState<Question | null>(null);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<Question | null>(null);
  const [exporting, setExporting] = useState(false);

  // Load Subjects on mount
  useEffect(() => {
    questionService.getSubjects().then((subs) => setSubjects(subs));
  }, []);

  // Fetch Questions from Supabase
  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await questionService.getQuestions(filters);
      setQuestions(res.data);
      setTotalCount(res.count);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  useEffect(() => {
    if (filters.subject && filters.subject !== 'all') {
      questionService.getTopics(filters.subject).then(setAvailableTopics).catch(() => setAvailableTopics([]));
    } else {
      setAvailableTopics([]);
    }
  }, [filters.subject]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: searchInput.trim(),
        page: 1
      }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleFilterChange = (key: keyof QuestionFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to page 1 on filter modification
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const totalPages = Math.ceil(totalCount / (filters.pageSize || 20)) || 1;

  const handleExport = async () => {
    try {
      setExporting(true);
      // Fetch up to 2,000 filtered questions for CSV export
      const exportRes = await questionService.getQuestions({
        ...filters,
        page: 1,
        pageSize: 2000
      });
      csvService.exportQuestionsToCSV(
        exportRes.data,
        `crackplace_questions_${filters.subject || 'all'}_${Date.now()}.csv`
      );
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const allSubjects: Subject[] = subjects.length > 0 ? subjects : (DEFAULT_SUBJECTS as Subject[]);

  return (
    <div className="space-y-5 pb-12">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Question Bank Repository
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage, filter, search, and export questions stored in Supabase PostgreSQL ({totalCount.toLocaleString()} total)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchQuestions()}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
            title="Reload from Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            disabled={exporting || totalCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting...' : 'Export Filtered CSV'}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID, question text, topic, subtopic..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={filters.subject || 'all'}
              onChange={(e) => {
                handleFilterChange('subject', e.target.value);
                handleFilterChange('topic', 'all'); // reset topic when subject changes
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Subjects</option>
              {allSubjects.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Topic Filter */}
          <div>
            <select
              value={filters.topic || 'all'}
              onChange={(e) => handleFilterChange('topic', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              disabled={!filters.subject || filters.subject === 'all'}
            >
              <option value="all">All Topics</option>
              {availableTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <select
              value={filters.difficulty || 'all'}
              onChange={(e) => handleFilterChange('difficulty', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {/* Question Type Filter */}
          <div>
            <select
              value={filters.question_type || 'all'}
              onChange={(e) => handleFilterChange('question_type', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Question Types</option>
              <option value="MCQ">MCQ</option>
              <option value="INTERVIEW">INTERVIEW / HR</option>
            </select>
          </div>
        </div>

        {/* Page size & Sort controls */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <span>Show:</span>
            {[20, 50, 100].map((size) => (
              <button
                key={size}
                onClick={() => handleFilterChange('pageSize', size)}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  filters.pageSize === size
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {size} / page
              </button>
            ))}
          </div>

          <div>
            Showing{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {totalCount > 0 ? (filters.page! - 1) * filters.pageSize! + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {Math.min(filters.page! * filters.pageSize!, totalCount)}
            </span>{' '}
            of <span className="font-semibold text-slate-800 dark:text-slate-200">{totalCount}</span> questions
          </div>
        </div>
      </div>

      {/* Main Questions Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs text-slate-500">Querying Supabase PostgreSQL...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs text-rose-600 space-y-2">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => fetchQuestions()}
              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-slate-700 dark:text-slate-300 font-medium"
            >
              Retry
            </button>
          </div>
        ) : questions.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Database className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No matching questions found
            </p>
            <p className="text-xs text-slate-500">
              Try adjusting your search criteria or add new questions using the CSV importer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Topic</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Question</th>
                  <th className="py-3 px-4 text-center">Correct Ans</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {questions.map((q) => {
                  const subjectInfo = getSubjectDetails(q.subject);
                  return (
                    <tr
                      key={q.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {q.question_id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {subjectInfo.name}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[140px] truncate">
                        {q.topic || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
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
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[11px] font-semibold text-slate-500">
                          {q.question_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs sm:max-w-md truncate text-slate-900 dark:text-slate-100 font-medium">
                        {q.question}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {q.question_type === 'MCQ' ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold font-mono text-[11px]">
                            {q.correct_answer || '—'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Rubric</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(q.updated_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewQuestion(q)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="View Question Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditQuestion(q)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Question"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteQuestion(q)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Delete Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <span className="text-xs text-slate-500">
              Page <span className="font-semibold">{filters.page}</span> of{' '}
              <span className="font-semibold">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(Math.max(1, (filters.page || 1) - 1))}
                disabled={filters.page === 1 || loading}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, (filters.page || 1) + 1))}
                disabled={filters.page === totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <QuestionDetailModal
        question={viewQuestion}
        isOpen={Boolean(viewQuestion)}
        onClose={() => setViewQuestion(null)}
        onEdit={(q) => setEditQuestion(q)}
      />

      <EditQuestionModal
        question={editQuestion}
        isOpen={Boolean(editQuestion)}
        subjects={allSubjects}
        onClose={() => setEditQuestion(null)}
        onSave={() => fetchQuestions()}
      />

      <DeleteConfirmModal
        question={deleteQuestion}
        isOpen={Boolean(deleteQuestion)}
        onClose={() => setDeleteQuestion(null)}
        onDeleted={() => fetchQuestions()}
      />
    </div>
  );
};
