import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import Editor from '@monaco-editor/react';
import { 
  FaTerminal, 
  FaPlay, 
  FaRobot, 
  FaCircleCheck, 
  FaCircleXmark, 
  FaTriangleExclamation,
  FaArrowRotateLeft,
  FaAward
} from 'react-icons/fa6';

const CATEGORIES = ['Arrays', 'Strings', 'Linked Lists', 'Stacks & Queues', 'Trees', 'Graphs', 'Dynamic Programming', 'SQL'];
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

interface TestCase {
  input: string;
  output: string;
  explanation?: string;
}

interface CodingProblem {
  problemId: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  sampleCases: TestCase[];
  starterCode: {
    python: string;
    java: string;
    javascript: string;
    cpp: string;
  };
}

interface TestResult {
  passed: boolean;
  output: string;
  error: string | null;
  testCaseResults?: {
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
  }[];
  rewards?: {
    xp: number;
    coins: number;
  };
}

interface AIReview {
  timeComplexity: string;
  spaceComplexity: string;
  qualityScore: number;
  readabilityComments: string;
  optimizationComments: string;
  optimalSolutionExplanation: string;
  editorialCode: string;
}

export const Coding: React.FC = () => {
  const { token, updateProfile } = useAuthStore();
  
  const editorRef = useRef<any>(null);
  
  // Setup parameters
  const [selectedCategory, setSelectedCategory] = useState('Arrays');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [language, setLanguage] = useState<'python' | 'java' | 'javascript' | 'cpp'>('python');

  // Work states
  const [status, setStatus] = useState<'idle' | 'generating' | 'active'>('idle');
  const [problem, setProblem] = useState<CodingProblem | null>(null);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Run/Review Results states
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<TestResult | null>(null);
  
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<AIReview | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Panel resizing states
  const [leftWidth, setLeftWidth] = useState<number>(45); // Left side width in percentage
  const [consoleHeight, setConsoleHeight] = useState<number>(200); // Console height in pixels
  const [isResizingWidth, setIsResizingWidth] = useState<boolean>(false);
  const [isResizingHeight, setIsResizingHeight] = useState<boolean>(false);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState<boolean>(false);
  
  // Mobile layout active tab
  const [activeMobileTab, setActiveMobileTab] = useState<'problem' | 'editor' | 'testcases' | 'output' | 'console'>('problem');

  // Resizing mouse/touch drag listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingWidth) {
        const newPercentage = (e.clientX / window.innerWidth) * 100;
        if (newPercentage > 20 && newPercentage < 80) {
          setLeftWidth(newPercentage);
        }
      }
      if (isResizingHeight) {
        const container = document.getElementById('coding-workspace-grid');
        if (container) {
          const rect = container.getBoundingClientRect();
          const newHeight = rect.bottom - e.clientY;
          // Maintain at least 500px for editor container (from container height)
          const maxConsoleHeight = rect.height - 520;
          if (newHeight > 60 && newHeight < Math.max(80, maxConsoleHeight)) {
            setConsoleHeight(newHeight);
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingWidth(false);
      setIsResizingHeight(false);
    };

    if (isResizingWidth || isResizingHeight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingWidth, isResizingHeight]);

  // Sync starter code when language changes or problem loads
  useEffect(() => {
    if (problem) {
      const rawCode = problem.starterCode[language] || '';
      setCode(cleanAndFormatCode(rawCode, language, problem.title));
      setRunResult(null);
    }
  }, [language, problem]);

  // Trigger layout recalculation on viewport/device/keyboard adjustments
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };
    window.addEventListener('resize', handleResize);
    // Watch keyboard display via visualViewport if available
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleResize);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (vv) {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  // Trigger layout when switching tabs
  useEffect(() => {
    if (activeMobileTab === 'editor' && editorRef.current) {
      const timer = setTimeout(() => {
        editorRef.current.layout();
      }, 200); // delay to let tab display settle
      return () => clearTimeout(timer);
    }
  }, [activeMobileTab]);

  const handleLaunchChallenge = async () => {
    setStatus('generating');
    setErrorMessage(null);
    setProblem(null);
    setRunResult(null);
    setReviewResult(null);
    try {
      const response = await fetch('/api/coding/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          category: selectedCategory,
          difficulty: selectedDifficulty
        })
      });

      if (!response.ok) {
        throw new Error('AI failed to compile problem parameters.');
      }

      const problemData = await response.json();
      setProblem(problemData);
      setStatus('active');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to start coding challenge. Try again.');
      setStatus('idle');
    }
  };

  const handleRunCode = async (isSubmit: boolean = false) => {
    if (!problem) return;
    setRunning(true);
    setRunResult(null);
    try {
      const response = await fetch('/api/coding/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          problemId: problem.problemId,
          code,
          language,
          submit: isSubmit
        })
      });

      if (!response.ok) {
        throw new Error('Code execution simulation failed.');
      }

      const result = await response.json();
      setRunResult(result);

      // If user successfully solved the problem (submitted and passed), trigger local stats update
      if (result.passed && isSubmit) {
        fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.json())
          .then(data => {
            if (data.profile) updateProfile(data.profile);
          });
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Execution error occurred.');
    } finally {
      setRunning(false);
    }
  };

  const handleTriggerReview = async () => {
    if (!problem) return;
    setReviewing(true);
    setReviewResult(null);
    setShowReviewModal(true);
    try {
      const response = await fetch('/api/coding/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          problemId: problem.problemId,
          code,
          language
        })
      });

      if (!response.ok) {
        throw new Error('AI Code Review failed.');
      }

      const review = await response.json();
      setReviewResult(review);
    } catch (err: any) {
      console.error(err);
      setReviewResult(null);
      setShowReviewModal(false);
      alert(err.message || 'Review failed.');
    } finally {
      setReviewing(false);
    }
  };

  // State 1: Idle Setup
  if (status === 'idle') {
    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
        <div className="pb-4 border-b border-border-dark">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Technical Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight mt-1">Coding Assessment Workspace</h1>
          <p className="text-text-secondary text-sm mt-0.5">Solve algorithmic problems with real-time in-browser code execution and AI architectural review.</p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="bg-surface-dark border border-border-dark p-6 sm:p-8 rounded-2xl space-y-6 shadow-xs">
          <div>
            <h3 className="font-semibold text-base text-text-primary">
              Configure Problem Parameters
            </h3>
            <p className="text-xs text-text-muted mt-1">Select your target algorithmic subject and difficulty tier to generate a tailored interview challenge.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Topic Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-dark text-text-primary text-sm focus:outline-hidden focus:border-brand-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Difficulty Tier</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-dark text-text-primary text-sm capitalize focus:outline-hidden focus:border-brand-500"
              >
                {DIFFICULTIES.map(diff => (
                  <option key={diff} value={diff}>{diff} (Standard)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border-dark flex items-start gap-3">
            <div className="p-2 rounded-lg bg-brand-600/10 text-brand-400 mt-0.5 shrink-0">
              <FaTerminal className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-1">
              <p className="font-medium text-text-primary">Evaluation Environment</p>
              <p className="text-text-muted leading-relaxed">Runs on isolated Python, JavaScript, Java, and C++ runners with standard test cases, edge case validation, and memory/time limit enforcement.</p>
            </div>
          </div>

          <button
            onClick={handleLaunchChallenge}
            className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold text-sm tracking-wide text-white shadow-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            <FaPlay className="w-3.5 h-3.5" />
            <span>Generate Problem</span>
          </button>
        </div>
      </div>
    );
  }

  // State 2: Generating Loading View
  if (status === 'generating') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 animate-fade-in max-w-md mx-auto text-center px-4">
        <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
        <div className="space-y-1">
          <h2 className="font-bold text-lg text-text-primary">Generating Algorithmic Problem</h2>
          <p className="text-xs text-text-muted">
            Synthesizing problem constraints, starter code templates, and validation test suites...
          </p>
        </div>
      </div>
    );
  }

  // State 3: Active Workspace
  return (
    <div className="h-[calc(100vh-160px)] flex flex-col gap-4 animate-fade-in relative overflow-hidden" id="coding-workspace">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-dark border border-border-dark p-3.5 rounded-2xl shadow-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-brand-600/10 text-brand-400 border border-brand-500/20">
                {problem?.category}
              </span>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border ${
                problem?.difficulty === 'hard' 
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                  : problem?.difficulty === 'medium'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {problem?.difficulty}
              </span>
            </div>
            <h1 className="text-base font-bold text-text-primary truncate mt-0.5">{problem?.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-dark text-xs font-semibold text-text-primary cursor-pointer focus:outline-hidden"
          >
            <option value="python">Python 3</option>
            <option value="javascript">JavaScript (ES6)</option>
            <option value="java">Java 17</option>
            <option value="cpp">C++ (GCC)</option>
          </select>
          <button
            onClick={() => setStatus('idle')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-dark bg-surface-elevated hover:bg-slate-700 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <FaArrowRotateLeft className="w-3 h-3" />
            <span>New Problem</span>
          </button>
        </div>
      </div>

      {/* Mobile active tabs */}
      <div className="flex md:hidden border-b border-border-dark bg-surface-dark p-1 rounded-xl gap-1 shrink-0">
        {(['problem', 'editor', 'testcases', 'output', 'console'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveMobileTab(tab)}
            className={`flex-1 text-center py-2 px-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer capitalize ${
              activeMobileTab === tab
                ? 'bg-brand-600 text-white'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            {tab === 'testcases' ? 'Tests' : tab}
          </button>
        ))}
      </div>

      {/* Workspace content grid */}
      <div 
        id="coding-workspace-grid" 
        className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 relative select-text"
      >
        {/* LEFT COLUMN: Problem Details */}
        <div 
          style={{ width: window.innerWidth >= 1024 ? `${leftWidth}%` : undefined }}
          className={`flex-col min-h-0 shrink-0
            ${window.innerWidth >= 1024 ? 'flex' : ''}
            ${activeMobileTab === 'problem' ? 'flex md:flex' : 'hidden md:flex'}
            ${window.innerWidth < 1024 ? 'w-full lg:w-auto' : ''}
          `}
        >
          <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl overflow-y-auto space-y-5 flex-1 min-h-[250px] lg:min-h-0 shadow-xs">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-text-primary border-b border-border-dark pb-2">
                Problem Description
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary whitespace-pre-line leading-relaxed">
                {problem?.description}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-text-muted">Constraints</h3>
              <ul className="list-disc pl-5 text-xs text-text-muted space-y-1">
                {problem?.constraints.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border-dark space-y-1">
                <strong className="text-text-primary block font-medium">Input Format:</strong>
                <span className="text-text-muted">{problem?.inputFormat}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border-dark space-y-1">
                <strong className="text-text-primary block font-medium">Output Format:</strong>
                <span className="text-text-muted">{problem?.outputFormat}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-text-muted">Sample Test Cases</h3>
              <div className="space-y-3">
                {problem?.sampleCases.map((tc, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border-dark space-y-2 text-xs">
                    <span className="font-semibold text-text-primary block">Example {idx + 1}</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <strong className="text-text-muted block font-mono text-[11px] mb-1">Input:</strong>
                        <pre className="bg-surface-dark p-2 rounded-lg font-mono text-text-secondary overflow-x-auto border border-border-dark">{tc.input}</pre>
                      </div>
                      <div>
                        <strong className="text-text-muted block font-mono text-[11px] mb-1">Expected:</strong>
                        <pre className="bg-surface-dark p-2 rounded-lg font-mono text-text-secondary overflow-x-auto border border-border-dark">{tc.output}</pre>
                      </div>
                    </div>
                    {tc.explanation && (
                      <p className="text-text-muted italic text-[11px]">
                        <strong>Explanation:</strong> {tc.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop vertical resize drag bar */}
        <div 
          onMouseDown={() => setIsResizingWidth(true)} 
          className="hidden lg:block w-1 cursor-col-resize hover:bg-brand-500 bg-border-dark self-stretch transition-colors select-none z-10"
        />

        {/* RIGHT COLUMN: Code Editor, Resizer, and Console Output */}
        <div 
          className={`flex-1 flex flex-col gap-3 min-h-0 min-w-0
            ${window.innerWidth >= 1024 ? 'flex' : ''}
            ${activeMobileTab === 'editor' || activeMobileTab === 'testcases' || activeMobileTab === 'output' || activeMobileTab === 'console' ? 'flex md:flex' : 'hidden md:flex'}
          `}
        >
          {/* Editor Container */}
          <div 
            className={`bg-surface-dark border border-border-dark rounded-2xl flex flex-col relative overflow-hidden shadow-xs
              ${activeMobileTab === 'editor' ? 'flex h-full min-h-[350px]' : 'hidden md:flex md:h-full md:min-h-[350px]'}
              ${window.innerWidth >= 1024 ? 'min-h-[400px]' : 'min-h-[350px]'}
            `}
            style={{ height: window.innerWidth >= 1024 ? `calc(100% - ${consoleHeight}px - 12px)` : undefined }}
          >
            <div className="px-4 py-2.5 border-b border-border-dark bg-surface-elevated/40 flex justify-between items-center text-xs text-text-muted font-mono select-none">
              <span>solution.{language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'java' ? 'java' : 'cpp'}</span>
              <span className="text-brand-400 text-[11px] font-sans font-medium">Monaco Engine</span>
            </div>
            
            <div className="flex-1 min-h-[350px] relative w-full h-full flex flex-col">
              <Editor
                height="100%"
                language={language === 'cpp' ? 'cpp' : language === 'python' ? 'python' : language === 'java' ? 'java' : 'javascript'}
                theme="vs-dark"
                value={code}
                onChange={(value) => setCode(value || '')}
                onMount={(editor) => {
                  editorRef.current = editor;
                  setTimeout(() => {
                    editor.layout();
                  }, 100);
                }}
                loading={<div className="flex items-center justify-center h-full text-brand-400 text-xs font-mono">Loading IDE...</div>}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                  automaticLayout: true,
                  tabSize: 4,
                  insertSpaces: true,
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 },
                  cursorBlinking: 'smooth',
                  smoothScrolling: true
                } as any}
              />
            </div>

            {/* Desktop & Tablet Actions Bar */}
            <div className="hidden md:flex px-4 py-3 border-t border-border-dark bg-surface-elevated/30 justify-end gap-2.5 select-none">
              <button
                onClick={handleTriggerReview}
                disabled={running || reviewing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border-dark bg-surface-elevated hover:bg-slate-700 transition-colors text-xs font-semibold text-purple-400 disabled:opacity-50 cursor-pointer"
              >
                <FaRobot className="w-3.5 h-3.5" />
                <span>AI Review</span>
              </button>

              <button
                onClick={() => handleRunCode(false)}
                disabled={running || reviewing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border-dark bg-surface-elevated hover:bg-slate-700 text-text-primary transition-colors text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                <FaPlay className="w-3 h-3 text-text-muted" />
                <span>Run Code</span>
              </button>

              <button
                onClick={() => handleRunCode(true)}
                disabled={running || reviewing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FaAward className="w-3.5 h-3.5" />
                <span>{running ? 'Submitting...' : 'Submit'}</span>
              </button>
            </div>
          </div>

          {/* Desktop horizontal height drag bar */}
          <div 
            onMouseDown={() => setIsResizingHeight(true)} 
            className="hidden lg:block h-1 cursor-row-resize hover:bg-brand-500 bg-border-dark transition-colors select-none z-10"
          />

          {/* Console / Testcases / Output Panel */}
          <div 
            style={{ 
              height: window.innerWidth >= 1024 
                ? (isConsoleCollapsed ? '44px' : `${consoleHeight}px`) 
                : (isConsoleCollapsed ? '44px' : 'auto')
            }}
            className={`bg-surface-dark border border-border-dark p-4 rounded-2xl flex flex-col min-h-0 overflow-hidden relative shadow-xs
              ${activeMobileTab === 'testcases' || activeMobileTab === 'output' || activeMobileTab === 'console' ? 'flex' : 'hidden md:flex'}
            `}
          >
            {/* Header / Collapse Trigger */}
            <div className="flex justify-between items-center border-b border-border-dark pb-2 mb-2 select-none shrink-0">
              <h4 className="font-semibold text-xs text-text-primary flex items-center gap-2">
                <FaTerminal className="w-3 h-3 text-brand-400" />
                <span>Console & Test Suite</span>
              </h4>
              <button 
                onClick={() => setIsConsoleCollapsed(!isConsoleCollapsed)}
                className="hidden md:block text-[10px] font-semibold text-text-muted hover:text-text-primary px-2 py-0.5 rounded hover:bg-surface-elevated cursor-pointer"
              >
                {isConsoleCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
            
            {/* Panel Body */}
            {!isConsoleCollapsed && (
              <div className="flex-1 overflow-y-auto font-mono text-xs pr-1 space-y-3">
                {/* Execution outputs standard error */}
                <div className="space-y-2">
                  {!runResult && !running && (
                    <p className="text-text-muted italic text-[11px]">Run code or submit solution to execute against the test suite.</p>
                  )}
                  {running && (
                    <p className="text-brand-400 animate-pulse text-[11px]">Executing in sandboxed runtime...</p>
                  )}
                  {runResult && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {runResult.passed ? (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold text-[10px] border border-emerald-500/20">
                              <FaCircleCheck className="w-3 h-3" /> All Test Cases Passed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold text-[10px] border border-rose-500/20">
                              <FaTriangleExclamation className="w-3 h-3" /> Test Case Failed
                            </span>
                          )}
                        </div>
                        {runResult.passed && runResult.rewards && runResult.rewards.xp > 0 && (
                          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                            <span>+{runResult.rewards.xp} XP</span>
                            <span>•</span>
                            <span>+{runResult.rewards.coins} Coins</span>
                          </div>
                        )}
                      </div>

                      {runResult.error && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs whitespace-pre-wrap leading-relaxed font-mono">
                          {runResult.error}
                        </div>
                      )}
                      {runResult.output && (
                        <pre className="bg-surface-elevated/60 p-3 rounded-xl text-text-secondary max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono text-xs border border-border-dark">
                          {runResult.output}
                        </pre>
                      )}

                      {runResult.testCaseResults && (
                        <div className="space-y-1.5 pt-1">
                          {runResult.testCaseResults.map((tcr, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg border border-border-dark bg-surface-elevated/40 text-xs">
                              <span className="text-text-secondary truncate max-w-xs font-mono">Case #{idx+1} ({tcr.input})</span>
                              <div className="flex items-center gap-3 text-[11px]">
                                <span className="text-text-muted font-mono hidden sm:inline">Expected: {tcr.expected} | Actual: {tcr.actual}</span>
                                {tcr.passed ? (
                                  <FaCircleCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <FaCircleXmark className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Actions Bar */}
      <div className="md:hidden bg-surface-dark border-t border-border-dark p-3 flex gap-2 shrink-0">
        <button
          onClick={handleTriggerReview}
          disabled={running || reviewing}
          className="flex-1 py-2.5 rounded-xl border border-border-dark bg-surface-elevated text-xs font-semibold text-purple-400 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <FaRobot className="w-3.5 h-3.5" />
          <span>Review</span>
        </button>

        <button
          onClick={() => handleRunCode(false)}
          disabled={running || reviewing}
          className="flex-1 py-2.5 rounded-xl border border-border-dark bg-surface-elevated text-xs font-semibold text-text-primary disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <FaPlay className="w-3 h-3 text-text-muted" />
          <span>Run</span>
        </button>

        <button
          onClick={() => handleRunCode(true)}
          disabled={running || reviewing}
          className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <FaAward className="w-3.5 h-3.5" />
          <span>{running ? '...' : 'Submit'}</span>
        </button>
      </div>

      {/* AI Code Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dark/80 backdrop-blur-xs px-4 py-8">
          <div className="w-full max-w-2xl bg-surface-dark border border-border-dark p-6 sm:p-7 rounded-2xl max-h-[85vh] overflow-y-auto relative animate-fade-in space-y-5 shadow-lg">
            <div className="flex justify-between items-center border-b border-border-dark pb-3">
              <h3 className="font-bold text-base text-text-primary flex items-center gap-2">
                <FaRobot className="text-purple-400 w-4 h-4" />
                <span>AI Engineering Code Review</span>
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-text-muted hover:text-text-primary font-semibold text-xs px-2 py-1 rounded hover:bg-surface-elevated cursor-pointer"
              >
                Close
              </button>
            </div>

            {reviewing && (
              <div className="py-16 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
                <p className="text-xs text-text-muted">Analyzing algorithmic efficiency and code architecture...</p>
              </div>
            )}

            {reviewResult && (
              <div className="space-y-5 text-xs sm:text-sm">
                {/* Score and Complexity Badges */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-border-dark bg-surface-elevated/40 text-center">
                    <span className="text-[10px] font-semibold uppercase text-text-muted">Quality Score</span>
                    <p className="font-bold text-2xl text-emerald-400 mt-0.5">{reviewResult.qualityScore}%</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border-dark bg-surface-elevated/40 text-center">
                    <span className="text-[10px] font-semibold uppercase text-text-muted">Time Complexity</span>
                    <p className="font-mono font-bold text-sm text-brand-400 mt-1">{reviewResult.timeComplexity}</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border-dark bg-surface-elevated/40 text-center">
                    <span className="text-[10px] font-semibold uppercase text-text-muted">Space Complexity</span>
                    <p className="font-mono font-bold text-sm text-purple-400 mt-1">{reviewResult.spaceComplexity}</p>
                  </div>
                </div>

                {/* Details Comments */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-surface-elevated/30 border border-border-dark space-y-1">
                    <h5 className="font-semibold text-xs text-text-primary">Readability & Structure</h5>
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{reviewResult.readabilityComments}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-elevated/30 border border-border-dark space-y-1">
                    <h5 className="font-semibold text-xs text-text-primary">Efficiency & Optimization</h5>
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{reviewResult.optimizationComments}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-elevated/30 border border-border-dark space-y-1">
                    <h5 className="font-semibold text-xs text-text-primary">Optimal Approach</h5>
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{reviewResult.optimalSolutionExplanation}</p>
                  </div>
                </div>

                {/* Editorial code */}
                {reviewResult.editorialCode && (
                  <div className="space-y-1.5">
                    <h5 className="font-semibold text-xs text-text-primary">Editorial Solution</h5>
                    <pre className="bg-surface-elevated/60 p-3.5 rounded-xl font-mono text-xs text-text-secondary overflow-x-auto border border-border-dark leading-relaxed">
                      {reviewResult.editorialCode}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Utility to clean, deduplicate, validate, and format starter code templates.
 * Enforces strict LeetCode-style templates and eliminates syntax errors/duplicates.
 */
export function cleanAndFormatCode(code: string, lang: string, title: string = 'solve'): string {
  if (!code || typeof code !== 'string') {
    return generateFallbackTemplate(lang, title);
  }

  let lines = code.split('\n').map(line => line.trimEnd());
  
  if (lang === 'python') {
    let cleanedLines: string[] = [];
    let seenSolutionClass = false;
    let seenMethods = new Set<string>();
    
    // Auto-inject standard imports for Python
    let imports = [
      "from typing import List, Dict, Set, Tuple, Optional, Union",
      ""
    ];
    
    for (let i = 0; i < lines.length; i++) {
      let trimmed = lines[i].trim();
      
      // Filter out duplicate or conflicting typing imports
      if (trimmed.startsWith('from typing import') || trimmed.startsWith('import typing')) {
        continue;
      }
      
      if (trimmed.startsWith('class Solution')) {
        if (seenSolutionClass) continue;
        seenSolutionClass = true;
        cleanedLines.push('class Solution:');
        continue;
      }
      
      if (trimmed.startsWith('def ')) {
        let match = trimmed.match(/def\s+(\w+)/);
        if (match) {
          let methodName = match[1];
          if (seenMethods.has(methodName)) continue;
          seenMethods.add(methodName);
        }
      }
      
      // Filter out stray standalone assignment lines that are duplicates of method vars
      if (!seenSolutionClass && (trimmed.startsWith('ans =') || trimmed.startsWith('return '))) {
        continue;
      }
      
      cleanedLines.push(lines[i]);
    }
    
    // Re-verify class Solution wrap
    if (!seenSolutionClass) {
      cleanedLines = ['class Solution:', ...cleanedLines.map(l => '    ' + l)];
    }
    
    // Format indentation level-by-level
    let formattedLines: string[] = [...imports];
    let currentIndent = 0;
    
    for (let line of cleanedLines) {
      let trimmed = line.trim();
      if (!trimmed) {
        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        continue;
      }
      
      if (trimmed.startsWith('class Solution:')) {
        formattedLines.push('class Solution:');
        currentIndent = 4;
        continue;
      }
      
      if (trimmed.startsWith('def ')) {
        // Enforce exactly 4 spaces indent for method declaration inside Solution class
        formattedLines.push(' '.repeat(4) + trimmed);
        currentIndent = 8;
        continue;
      }
      
      // Inside method body: enforce standard 8-space indentation
      if (trimmed === 'pass') {
        formattedLines.push(' '.repeat(8) + 'pass');
        continue;
      }
      
      // Auto-correct statements outside loops or bad indent blocks
      formattedLines.push(' '.repeat(currentIndent) + trimmed);
      
      // Adjust indentation dynamically for nested control flows
      if (trimmed.endsWith(':')) {
        currentIndent = Math.min(16, currentIndent + 4);
      } else if (trimmed.startsWith('return ') || trimmed.startsWith('raise ')) {
        // Reset to method indent on return statement
        currentIndent = 8;
      }
    }
    
    // Fallback if no methods are generated
    if (seenMethods.size === 0) {
      return generateFallbackTemplate('python', title);
    }
    
    return formattedLines.join('\n').trim() + '\n';
  }
  
  if (lang === 'java' || lang === 'cpp') {
    let cleanedLines: string[] = [];
    let seenSolutionClass = false;
    
    for (let i = 0; i < lines.length; i++) {
      let trimmed = lines[i].trim();
      
      if (trimmed.startsWith('class Solution')) {
        if (seenSolutionClass) {
          // skip the duplicate class body
          let localBraces = 0;
          for (let j = i; j < lines.length; j++) {
            if (lines[j].includes('{')) localBraces++;
            if (lines[j].includes('}')) localBraces--;
            if (localBraces === 0 && j > i) {
              i = j;
              break;
            }
          }
          continue;
        }
        seenSolutionClass = true;
      }
      cleanedLines.push(lines[i]);
    }
    
    if (!seenSolutionClass) {
      return generateFallbackTemplate(lang, title);
    }
    
    // Formatting curly braces & indents
    let formattedLines: string[] = [];
    let indentLevel = 0;
    
    for (let line of cleanedLines) {
      let trimmed = line.trim();
      if (!trimmed) {
        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        continue;
      }
      
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      formattedLines.push(' '.repeat(indentLevel * 4) + trimmed);
      
      if (trimmed.endsWith('{') || trimmed.includes('{')) {
        indentLevel++;
      }
    }
    
    let output = formattedLines.join('\n');
    
    // Semicolon correction on C++ class
    if (lang === 'cpp' && !output.includes('};') && output.includes('class Solution')) {
      let lastBraceIdx = output.lastIndexOf('}');
      if (lastBraceIdx !== -1) {
        output = output.substring(0, lastBraceIdx) + '};' + output.substring(lastBraceIdx + 1);
      }
    }
    
    return output.trim() + '\n';
  }
  
  if (lang === 'javascript') {
    let formattedLines: string[] = [];
    let indentLevel = 0;
    let seenFunctions = new Set<string>();
    
    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed) {
        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        continue;
      }
      
      // Deduplicate function signatures
      if (trimmed.startsWith('function ')) {
        let match = trimmed.match(/function\s+(\w+)/);
        if (match) {
          let funcName = match[1];
          if (seenFunctions.has(funcName)) {
            continue;
          }
          seenFunctions.add(funcName);
        }
      }
      
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      formattedLines.push(' '.repeat(indentLevel * 4) + trimmed);
      
      if (trimmed.endsWith('{') || trimmed.includes('{')) {
        indentLevel++;
      }
    }
    
    return formattedLines.join('\n').trim() + '\n';
  }
  
  return code;
}

/**
 * Automatically creates clean standard LeetCode/HackerRank starter code
 * fallback templates if AI results are empty, invalid, or fail checks.
 */
function generateFallbackTemplate(lang: string, title: string): string {
  // Convert title to camelCase method name (e.g. "Single Number" -> "singleNumber")
  let methodName = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word, idx) => idx === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
    
  if (!methodName) methodName = 'solve';

  switch (lang) {
    case 'python':
      return `from typing import List

class Solution:
    def ${methodName}(self, nums: List[int]) -> int:
        pass
`;
    case 'java':
      return `class Solution {
    public int ${methodName}(int[] nums) {
        return 0;
    }
}
`;
    case 'cpp':
      return `class Solution {
public:
    int ${methodName}(vector<int>& nums) {
        return 0;
    }
};
`;
    case 'javascript':
    default:
      return `/**
 * @param {number[]} nums
 * @return {number}
 */
function ${methodName}(nums) {
    return 0;
}
`;
  }
}

export default Coding;
