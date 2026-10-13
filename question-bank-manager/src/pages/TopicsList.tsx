import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  RefreshCw,
  ArrowRight,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Plus,
  Database,
  FolderOpen
} from 'lucide-react';
import { questionService } from '../services/questionService';
import { TopicStat, SubtopicStat } from '../types';

export const TopicsList: React.FC = () => {
  const { subjectSlug } = useParams<{ subjectSlug: string }>();
  const [topics, setTopics] = useState<TopicStat[]>([]);
  const [subjectName, setSubjectName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Subtopic drilldown state
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [subtopicData, setSubtopicData] = useState<Record<string, SubtopicStat[]>>({});
  const [loadingSubtopics, setLoadingSubtopics] = useState<Set<string>>(new Set());

  const formatSlugName = (slug: string) => {
    return slug
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const fetchTopics = async (forceRefresh = false) => {
    if (!subjectSlug) return;
    try {
      setLoading(true);
      setError(null);
      setSubjectName(formatSlugName(subjectSlug));

      const [res, subjects] = await Promise.all([
        questionService.getTopicStats(subjectSlug, forceRefresh),
        questionService.getSubjects().catch(() => [])
      ]);
      setTopics(res);
      
      const sub = subjects.find(s => s.slug === subjectSlug);
      if (sub) {
        setSubjectName(sub.name);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load topics and subtopics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics(false);
  }, [subjectSlug]);

  const toggleExpandTopic = async (topicName: string) => {
    if (expandedTopics.has(topicName)) {
      setExpandedTopics(prev => {
        const next = new Set(prev);
        next.delete(topicName);
        return next;
      });
      return;
    }

    setExpandedTopics(prev => new Set(prev).add(topicName));

    if (!subtopicData[topicName]) {
      try {
        setLoadingSubtopics(prev => new Set(prev).add(topicName));
        const subStats = await questionService.getSubtopicStats(subjectSlug!, topicName);
        setSubtopicData(prev => ({ ...prev, [topicName]: subStats }));
      } catch (e) {
        console.error('Failed to load subtopic breakdown:', e);
      } finally {
        setLoadingSubtopics(prev => {
          const next = new Set(prev);
          next.delete(topicName);
          return next;
        });
      }
    }
  };

  const totalQuestions = topics.reduce((acc, t) => acc + t.question_count, 0);

  const filteredTopics = topics.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {subjectName} Subtopics & Areas
              </h1>
              {topics.length > 0 && !loading && (
                <span className="px-2.5 py-0.5 text-xs font-bold font-mono rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                  {totalQuestions.toLocaleString()} questions
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live database counts across {topics.length} verified topics & subtopics. Expand any topic to view subtopic breakdown.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTopics(true)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title="Recalculate live counts from database"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              to={`/add-question?subject=${subjectSlug}&returnTo=/subjects/${subjectSlug}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </Link>

            <Link
              to={`/import-csv?subject=${subjectSlug}&returnTo=/subjects/${subjectSlug}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
            >
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>Import CSV</span>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search subtopic name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
          Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredTopics.length}</span> of {topics.length} topics
        </div>
      </div>

      {/* Topics Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4">Subtopic / Topic Name</th>
                <th className="py-3 px-4 text-right">Questions</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && topics.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                      <span>Calculating live database question counts...</span>
                    </div>
                  </td>
                </tr>
              )}

              {filteredTopics.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    {searchTerm ? 'No subtopics matching your search.' : 'No subtopics found for this subject.'}
                  </td>
                </tr>
              )}

              {filteredTopics.map((topic) => {
                const isExpanded = expandedTopics.has(topic.name);
                const isLoadingSub = loadingSubtopics.has(topic.name);
                const subtopics = subtopicData[topic.name] || [];

                return (
                  <React.Fragment key={topic.name}>
                    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleExpandTopic(topic.name)}
                            className="p-1 -ml-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Expand subtopics breakdown"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span>{topic.name}</span>
                        </div>
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

                    {/* Expandable Subtopics Breakdown */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                        <td colSpan={3} className="py-3 px-4 pl-12 border-t border-dashed border-slate-200 dark:border-slate-800">
                          {isLoadingSub ? (
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 py-1">
                              <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                              <span>Loading subtopics breakdown...</span>
                            </div>
                          ) : subtopics.length === 0 ? (
                            <div className="text-[11px] text-slate-400 italic py-1">
                              No distinct granular subtopics configured under {topic.name}.
                            </div>
                          ) : (
                            <div className="space-y-1.5 py-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Granular Subtopics under {topic.name} ({subtopics.length})
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {subtopics.map((sub) => (
                                  <Link
                                    key={sub.name}
                                    to={`/subjects/${subjectSlug}/topics/${encodeURIComponent(topic.name)}?subtopic=${encodeURIComponent(sub.name)}`}
                                    className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 flex items-center justify-between gap-2 text-xs transition-colors group/sub"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <FolderOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate group-hover/sub:text-indigo-600">
                                        {sub.name}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-500 dark:text-slate-400 text-[11px] shrink-0">
                                      {sub.question_count.toLocaleString()}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
