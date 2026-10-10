import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { questionService } from '../services/questionService';

export const TopicsList: React.FC = () => {
  const { subjectSlug } = useParams<{ subjectSlug: string }>();
  const [topics, setTopics] = useState<{ name: string; question_count: number }[]>([]);
  const [subjectName, setSubjectName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = async () => {
    if (!subjectSlug) return;
    try {
      setLoading(true);
      setError(null);
      const res = await questionService.getTopicStats(subjectSlug);
      setTopics(res);
      
      const subjects = await questionService.getSubjects();
      const sub = subjects.find(s => s.slug === subjectSlug);
      if (sub) setSubjectName(sub.name);
      else setSubjectName(subjectSlug);

    } catch (err: any) {
      setError(err.message || 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, [subjectSlug]);

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumbs & Title */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link to="/subjects" className="hover:text-indigo-600 transition-colors">Subjects</Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-slate-200">{subjectName}</span>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {subjectName} Subtopics
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select a subtopic to view and manage its questions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTopics}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title="Refresh Topics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Topics Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4">Subtopic Name</th>
                <th className="py-3 px-4 text-right">Questions</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {topics.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    No subtopics found for this subject.
                  </td>
                </tr>
              )}
              {topics.map((topic) => (
                <tr
                  key={topic.name}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {topic.name}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {topic.question_count.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <Link
                      to={`/subjects/${subjectSlug}/topics/${encodeURIComponent(topic.name)}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition-colors"
                    >
                      <span>View Questions</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
