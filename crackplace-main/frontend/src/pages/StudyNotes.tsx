import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { 
  FaStar, 
  FaTrash, 
  FaMagnifyingGlass, 
  FaPrint, 
  FaCopy, 
  FaArrowRight, 
  FaRegClock, 
  FaChevronLeft, 
  FaCheck,
  FaXmark,
  FaArrowLeft,
  FaDownload,
  FaFilePdf,
  FaBookOpen,
  FaWandMagicSparkles,
  FaGraduationCap
} from 'react-icons/fa6';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

import { Card, Button, Badge, EmptyState } from '../components/ui';

interface MCQQuestion {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

interface StudyNote {
  noteId: string;
  uid: string;
  category: string;
  topic: string;
  subtopic: string;
  title: string;
  content: string;
  questions: MCQQuestion[];
  isFavorite: boolean;
  createdTime: string;
}

const PRE_CURATED_TOPICS: { [key: string]: string[] } = {
  'DSA': [
    'Binary Search',
    'Dynamic Programming',
    'Graphs (BFS & DFS)',
    'Sorting Algorithms',
    'Linked Lists',
    'Binary Trees'
  ],
  'DBMS': [
    'SQL Joins',
    'Database Normalization',
    'Indexes & B-Trees',
    'ACID Transactions',
    'NoSQL databases'
  ],
  'Operating Systems': [
    'Deadlocks',
    'Process Scheduling',
    'Virtual Memory & Paging',
    'Multithreading & Semaphores',
    'File Systems'
  ],
  'Aptitude': [
    'Permutations & Combinations',
    'Time, Speed & Distance',
    'Probability',
    'Percentages & Simple Interest',
    'Work & Time'
  ],
  'Custom': []
};

const cleanMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\r\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const sanitized = useMemo(() => cleanMarkdown(content), [content]);

  return (
    <div className="prose max-w-none text-left print:text-black leading-relaxed text-slate-600 dark:text-slate-300 select-text smooth-scroll">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 dark:text-white mt-8 mb-4 border-b border-slate-200 dark:border-slate-800 pb-3" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="font-display font-semibold text-xl md:text-2xl text-primary-600 dark:text-primary-400 mt-7 mb-3.5" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="font-display font-semibold text-base md:text-lg text-slate-200 mt-6 mb-3" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="font-display font-medium text-sm md:text-base text-accent-400 mt-5 mb-2" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed my-4 font-normal" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-6 my-4 text-sm md:text-base text-slate-600 dark:text-slate-300 space-y-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-6 my-4 text-sm md:text-base text-slate-600 dark:text-slate-300 space-y-2" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-sm md:text-base text-slate-600 dark:text-slate-300" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-primary-500 bg-primary-500/10 pl-4 pr-3 py-3 rounded-r-lg my-4 text-sm text-slate-600 dark:text-slate-300 italic" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="border-slate-200 dark:border-slate-800 my-8" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-slate-800/60" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-800" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-3 text-xs md:text-sm text-slate-600 dark:text-slate-300" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !className || !String(children).includes('\n');
            
            if (isInline) {
              return (
                <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-primary-300 font-mono text-xs font-medium" {...props}>
                  {children}
                </code>
              );
            }

            const codeText = String(children).replace(/\n$/, '');
            return (
              <div className="relative my-6 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 group">
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400 font-mono">
                  <span className="font-semibold uppercase">{match ? match[1] : 'code'}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(codeText);
                    }}
                    className="flex items-center gap-1.5 hover:text-slate-900 dark:text-white transition-colors cursor-pointer text-slate-500 dark:text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs hover:bg-slate-700"
                  >
                    <FaCopy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs text-slate-200 overflow-x-auto">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          }
        }}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
};

export const StudyNotes: React.FC = () => {
  const { token, updateProfile } = useAuthStore();
  const navigate = useNavigate();

  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);
  const [selectedNote, setSelectedNote] = useState<StudyNote | null>(null);
  
  // Tab within active note study panel
  const [activeSubTab, setActiveSubTab] = useState<'content' | 'selftest'>('content');

  // Generation forms
  const [category, setCategory] = useState<string>('DSA');
  const [selectedTopic, setSelectedTopic] = useState<string>('Binary Search');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [subtopic, setSubtopic] = useState<string>('');
  const [depth, setDepth] = useState<'cheat_sheet' | 'detailed'>('cheat_sheet');
  const [generating, setGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);

  // Filters/Searches
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTabFilter, setSelectedTabFilter] = useState<string>('all');
  const [favoriteOnly, setFavoriteOnly] = useState<boolean>(false);

  // Self test simulator states
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([null, null, null]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [testConcluded, setTestConcluded] = useState<boolean>(false);
  
  // Operation alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch saved notes from backend
  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/study/notes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve study notes.');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not load your study locker.');
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotes();
    }
  }, [token]);

  // Adjust pre-curated topics when category changes
  useEffect(() => {
    const curated = PRE_CURATED_TOPICS[category] || [];
    if (curated.length > 0) {
      setSelectedTopic(curated[0]);
    } else {
      setSelectedTopic('Custom');
    }
  }, [category]);

  const handleGenerateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = selectedTopic === 'Custom' ? customTopic : selectedTopic;
    if (!topic.trim()) {
      setErrorMessage('Topic description is required.');
      return;
    }

    setGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setGenerationProgress(15);

    const progressTimer = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 5;
      });
    }, 1500);

    try {
      const res = await fetch('/api/study/notes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category, topic, subtopic, depth })
      });
      clearInterval(progressTimer);
      setGenerationProgress(100);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compile study notes.');

      setNotes(prev => [data.note, ...prev]);
      setSelectedNote(data.note);
      setActiveSubTab('content');
      setSuccessMessage(`Study guide "${data.note.title}" created successfully.`);
      
      // Reset form fields
      setCustomTopic('');
      setSubtopic('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Notes generation failed.');
    } finally {
      clearInterval(progressTimer);
      setGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    
    setNotes(prev => prev.map(note => {
      if (note.noteId === noteId) {
        return { ...note, isFavorite: !note.isFavorite };
      }
      return note;
    }));

    if (selectedNote && selectedNote.noteId === noteId) {
      setSelectedNote(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }

    try {
      const res = await fetch(`/api/study/notes/${noteId}/favorite`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      setNotes(prev => prev.map(note => {
        if (note.noteId === noteId) {
          return { ...note, isFavorite: !note.isFavorite };
        }
        return note;
      }));
      if (selectedNote && selectedNote.noteId === noteId) {
        setSelectedNote(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
      }
      setErrorMessage('Could not update favorite state.');
    }
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this study sheet?')) return;

    const previousNotes = [...notes];
    setNotes(prev => prev.filter(n => n.noteId !== noteId));
    if (selectedNote && selectedNote.noteId === noteId) {
      setSelectedNote(null);
    }

    try {
      const res = await fetch(`/api/study/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      setSuccessMessage('Study note removed.');
    } catch (err) {
      setNotes(previousNotes);
      setErrorMessage('Delete failed.');
    }
  };

  const handleCopyClipboard = () => {
    if (!selectedNote) return;
    navigator.clipboard.writeText(selectedNote.content);
    setSuccessMessage('Markdown copied to clipboard.');
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadMarkdown = () => {
    if (!selectedNote) return;
    const element = document.createElement("a");
    const file = new Blob([selectedNote.content], { type: 'text/markdown;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${selectedNote.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setSuccessMessage('Markdown file downloaded.');
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleDownloadPDF = () => {
    setSuccessMessage("Opening print dialog. Select 'Save as PDF' to save.");
    setTimeout(() => setSuccessMessage(null), 5000);
    window.print();
  };

  const startSelfTest = () => {
    setUserAnswers([null, null, null]);
    setCurrentQuestionIndex(0);
    setTestConcluded(false);
    setActiveSubTab('selftest');
  };

  const submitAnswer = (optionIdx: number) => {
    const answers = [...userAnswers];
    answers[currentQuestionIndex] = optionIdx;
    setUserAnswers(answers);
  };

  const nextQuestion = async () => {
    if (currentQuestionIndex < 2) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setTestConcluded(true);
      if (selectedNote) {
        try {
          const res = await fetch(`/api/study/notes/${selectedNote.noteId}/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.profile) {
              updateProfile(data.profile);
            }
          }
        } catch (err) {
          console.error('[STUDY] Completion api trigger failed:', err);
        }
      }
    }
  };

  const getTestScore = () => {
    if (!selectedNote) return 0;
    let correct = 0;
    userAnswers.forEach((ans, idx) => {
      if (ans === selectedNote.questions[idx]?.correctOptionIndex) {
        correct++;
      }
    });
    return correct;
  };

  const getCategoryVariant = (cat: string): 'primary' | 'accent' | 'success' | 'warning' | 'neutral' => {
    switch (cat) {
      case 'DSA': return 'accent';
      case 'DBMS': return 'primary';
      case 'Operating Systems': return 'warning';
      case 'Aptitude': return 'success';
      default: return 'neutral';
    }
  };

  const filteredNotes = useMemo(() => {
    let list = [...notes];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.topic.toLowerCase().includes(q));
    }
    if (selectedTabFilter !== 'all') {
      list = list.filter(n => n.category === selectedTabFilter);
    }
    if (favoriteOnly) {
      list = list.filter(n => n.isFavorite);
    }
    return list;
  }, [notes, searchQuery, selectedTabFilter, favoriteOnly]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 print:bg-white print:text-black print:pb-0">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl print:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white cursor-pointer"
          >
            <FaArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Study Notes & Knowledge Bank</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400 mt-0.5">Generate AI-curated revision notes, quick cheat sheets, and MCQ self-tests.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="accent">
            <FaWandMagicSparkles className="w-3 h-3 mr-1" />
            AI Generator
          </Badge>
          <Badge variant="neutral">
            {notes.length} Guides Saved
          </Badge>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400 font-medium flex items-center justify-between print:hidden">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-slate-900 dark:text-white">
            <FaXmark className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-medium flex items-center justify-between print:hidden">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-slate-900 dark:text-white">
            <FaXmark className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (4/12 width): AI generation console */}
        <div className="lg:col-span-4 space-y-4 print:hidden">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FaWandMagicSparkles className="w-3.5 h-3.5 text-accent-400" />
                Generate Revision Note
              </h2>
            </div>
            
            <form onSubmit={handleGenerateNotes} className="space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Subject Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-primary-500"
                >
                  <option value="DSA">Data Structures & Algorithms</option>
                  <option value="DBMS">Database Management System</option>
                  <option value="Operating Systems">Operating Systems</option>
                  <option value="Aptitude">Quantitative Aptitude</option>
                  <option value="Custom">Custom Topic</option>
                </select>
              </div>

              {/* Topic selector / Custom input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Topic</label>
                {category !== 'Custom' ? (
                  <select
                    value={selectedTopic}
                    onChange={e => setSelectedTopic(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-primary-500 mb-2"
                  >
                    {(PRE_CURATED_TOPICS[category] || []).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="Custom">Custom topic...</option>
                  </select>
                ) : null}

                {(category === 'Custom' || selectedTopic === 'Custom') && (
                  <input
                    type="text"
                    placeholder="e.g. Garbage Collection, Deadlock Prevention"
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-primary-500"
                    required
                  />
                )}
              </div>

              {/* Subtopic description */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Specific Focus (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. B+ Tree indexing, Thread safety"
                  value={subtopic}
                  onChange={e => setSubtopic(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-primary-500"
                />
              </div>

              {/* Depth Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepth('cheat_sheet')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      depth === 'cheat_sheet'
                        ? 'border-primary-500 bg-primary-600/10 text-primary-600 dark:text-primary-400'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                    }`}
                  >
                    Cheat Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepth('detailed')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      depth === 'detailed'
                        ? 'border-accent-500 bg-accent-600/10 text-accent-400'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                    }`}
                  >
                    Detailed Guide
                  </button>
                </div>
              </div>

              {/* Submit Trigger */}
              <Button
                type="submit"
                variant="primary"
                disabled={generating}
                isLoading={generating}
                className="w-full justify-center"
              >
                {generating ? 'Generating Guide...' : 'Create Study Guide'}
                {!generating && <FaArrowRight className="w-3 h-3 ml-1.5" />}
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column (8/12 width): Saved Notes Locker or Active Note Panel */}
        <div className="lg:col-span-8 space-y-6 print:col-span-12">
          
          <AnimatePresence mode="wait">
            
            {generating ? (
              <motion.div
                key="generating-skeleton"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <Card className="p-6 space-y-6">
                  <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                      <div className="w-24 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>
                    <div className="h-6 w-3/4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 animate-pulse">AI is synthesizing topics & generating self-test questions...</span>
                    </div>
                    
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary-600 transition-all duration-300"
                        style={{ width: `${generationProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{generationProgress}% Completed</span>

                    <div className="space-y-2.5 pt-2">
                      <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                      <div className="h-4 w-11/12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                      <div className="h-4 w-10/12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : selectedNote ? (
              <motion.div
                key="open-note"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4"
              >
                <div className="p-6 space-y-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  
                  {/* Note Details Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 print:hidden">
                    <div className="space-y-1">
                      <button
                        onClick={() => setSelectedNote(null)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors cursor-pointer mb-2"
                      >
                        <FaChevronLeft className="w-3 h-3" />
                        <span>Back to Notes Library</span>
                      </button>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant={getCategoryVariant(selectedNote.category)}>
                          {selectedNote.category}
                        </Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(selectedNote.createdTime).toLocaleDateString()}
                        </span>
                      </div>

                      <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{selectedNote.title}</h2>
                    </div>

                    <div className="flex flex-wrap gap-2 print:hidden">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => handleToggleFavorite(e, selectedNote.noteId)}
                        title="Toggle Favorite"
                      >
                        <FaStar className={`w-3.5 h-3.5 ${selectedNote.isFavorite ? 'text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
                      </Button>
                      
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyClipboard}
                        title="Copy Markdown"
                      >
                        <FaCopy className="w-3.5 h-3.5 mr-1" />
                        <span className="hidden sm:inline">Copy</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDownloadMarkdown}
                        title="Download Markdown"
                      >
                        <FaDownload className="w-3.5 h-3.5 mr-1" />
                        <span className="hidden sm:inline">MD</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDownloadPDF}
                        title="Download PDF"
                      >
                        <FaFilePdf className="w-3.5 h-3.5 mr-1" />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handlePrint}
                        title="Print"
                      >
                        <FaPrint className="w-3.5 h-3.5 mr-1" />
                        <span className="hidden sm:inline">Print</span>
                      </Button>
                    </div>
                  </div>

                  {/* Sub tabs: Study markdown vs Self test MCQs */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 print:hidden">
                    <button
                      onClick={() => setActiveSubTab('content')}
                      className={`px-4 py-2.5 font-medium text-xs transition-colors border-b-2 cursor-pointer ${
                        activeSubTab === 'content'
                          ? 'border-primary-500 text-slate-900 dark:text-white'
                          : 'border-transparent text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <FaBookOpen className="w-3.5 h-3.5" />
                        Guide Content
                      </span>
                    </button>
                    <button
                      onClick={startSelfTest}
                      className={`px-4 py-2.5 font-medium text-xs transition-colors border-b-2 cursor-pointer ${
                        activeSubTab === 'selftest'
                          ? 'border-primary-500 text-slate-900 dark:text-white'
                          : 'border-transparent text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <FaGraduationCap className="w-3.5 h-3.5" />
                        Self-Test ({selectedNote.questions?.length || 3} MCQs)
                      </span>
                    </button>
                  </div>

                  {/* Sub Tab contents */}
                  {activeSubTab === 'content' ? (
                    <div className="print-container">
                      <MarkdownRenderer content={selectedNote.content} />
                    </div>
                  ) : (
                    <div className="space-y-6 text-left">
                      {!testConcluded ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="font-semibold">Revision Self-Test</span>
                            <span>Question {currentQuestionIndex + 1} of 3</span>
                          </div>

                          {/* Question Text */}
                          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {selectedNote.questions[currentQuestionIndex]?.questionText}
                            </p>
                          </div>

                          {/* Answer Choices Grid */}
                          <div className="grid grid-cols-1 gap-2.5">
                            {selectedNote.questions[currentQuestionIndex]?.options.map((option, idx) => {
                              const selected = userAnswers[currentQuestionIndex] === idx;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => submitAnswer(idx)}
                                  className={`w-full p-3.5 rounded-lg border text-left text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                                    selected 
                                      ? 'border-primary-500 bg-primary-600/10 text-slate-900 dark:text-white'
                                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                                  }`}
                                >
                                  <span>{option}</span>
                                  {selected && <span className="w-2 h-2 rounded-full bg-primary-500"></span>}
                                </button>
                              );
                            })}
                          </div>

                          {/* Control buttons */}
                          <div className="flex justify-between items-center pt-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                              disabled={currentQuestionIndex === 0}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={nextQuestion}
                              disabled={userAnswers[currentQuestionIndex] === null}
                            >
                              <span>{currentQuestionIndex === 2 ? 'Submit Test' : 'Next'}</span>
                              <FaArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Test Scorecard Review panel
                        <div className="space-y-6">
                          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
                              <FaGraduationCap className="w-6 h-6" />
                            </div>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">Self-Test Completed</h4>
                            <p className="text-2xl font-bold text-emerald-400">{getTestScore()} / 3 Correct</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400">
                              {getTestScore() === 3 ? 'Outstanding! Topic comprehension verified.' : 'Review question explanations below to address knowledge gaps.'}
                            </p>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={startSelfTest}
                              className="mt-2"
                            >
                              Retake Test
                            </Button>
                          </div>

                          <div className="space-y-4">
                            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-400 uppercase tracking-wider">Detailed Analysis</h5>
                            
                            {selectedNote.questions.map((q, idx) => {
                              const correct = q.correctOptionIndex === userAnswers[idx];
                              return (
                                <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-400">Question {idx + 1}</span>
                                    {correct ? (
                                      <span className="flex items-center gap-1 text-emerald-400 font-medium"><FaCheck className="w-3 h-3"/> Correct</span>
                                    ) : (
                                      <span className="flex items-center gap-1 text-rose-400 font-medium"><FaXmark className="w-3 h-3"/> Incorrect</span>
                                    )}
                                  </div>
                                  <p className="font-medium text-slate-900 dark:text-white">{q.questionText}</p>
                                  <div className="space-y-1 mt-1 text-slate-500 dark:text-slate-400 dark:text-slate-400">
                                    <p>Your answer: <span className={correct ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>{q.options[userAnswers[idx] || 0]}</span></p>
                                    {!correct && <p className="text-emerald-400 font-medium">Correct answer: {q.options[q.correctOptionIndex]}</p>}
                                  </div>
                                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                                    <span className="font-semibold text-primary-600 dark:text-primary-400">Explanation:</span> {q.explanation}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              // Case B: Grid Library inventory list
              <motion.div
                key="locker-library"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4"
              >
                {/* Search query + filter tabs row */}
                <Card className="p-4 space-y-3">
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
                    {[
                      { id: 'all', label: 'All Subjects' },
                      { id: 'DSA', label: 'DSA' },
                      { id: 'DBMS', label: 'DBMS' },
                      { id: 'Operating Systems', label: 'Operating Systems' },
                      { id: 'Aptitude', label: 'Aptitude' },
                      { id: 'Custom', label: 'Custom' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedTabFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                          selectedTabFilter === tab.id
                            ? 'bg-primary-600 text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 relative">
                      <FaMagnifyingGlass className="absolute left-3 top-3 text-slate-500 dark:text-slate-400 w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="Search saved notes..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-primary-500"
                      />
                    </div>

                    <button
                      onClick={() => setFavoriteOnly(!favoriteOnly)}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        favoriteOnly
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                      }`}
                    >
                      <FaStar className={`w-3.5 h-3.5 ${favoriteOnly ? 'text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
                      <span>Favorites Only</span>
                    </button>
                  </div>
                </Card>

                {/* Saved Sheets inventory grid list */}
                {loadingNotes ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                      <Card key={i} className="p-4 space-y-3">
                        <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                        <div className="h-5 w-3/4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                        <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredNotes.map(note => {
                      return (
                        <Card
                          key={note.noteId}
                          interactive
                          onClick={() => {
                            setSelectedNote(note);
                            setActiveSubTab('content');
                          }}
                          className="p-5 flex flex-col justify-between gap-4 group"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <Badge variant={getCategoryVariant(note.category)}>
                                {note.category}
                              </Badge>
                              
                              <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => handleToggleFavorite(e, note.noteId)}
                                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                                  title="Favorite"
                                >
                                  <FaStar className={`w-3.5 h-3.5 ${note.isFavorite ? 'text-amber-400' : 'text-slate-600'}`} />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteNote(e, note.noteId)}
                                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <FaTrash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 dark:text-primary-400 transition-colors leading-snug line-clamp-2">
                                {note.title}
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400 mt-1">{note.topic} {note.subtopic ? `• ${note.subtopic}` : ''}</p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <FaRegClock className="w-3 h-3" />
                              <span>{new Date(note.createdTime).toLocaleDateString()}</span>
                            </span>
                            <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium group-hover:translate-x-0.5 transition-transform">
                              <span>Read guide</span>
                              <FaArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </Card>
                      );
                    })}

                    {filteredNotes.length === 0 && (
                      <div className="col-span-full">
                        <EmptyState
                          title="No study notes found"
                          description="Use the generator on the left to create tailored AI revision notes and self-test guides."
                        />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default StudyNotes;
