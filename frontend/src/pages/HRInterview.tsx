import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  FaUserTie, 
  FaPaperPlane, 
  FaRobot, 
  FaChevronRight, 
  FaArrowRotateLeft, 
  FaChartLine 
} from 'react-icons/fa6';

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

interface InlineEvaluation {
  score: number;
  feedback: string;
  improvedAnswer: string;
}

interface FinalScorecard {
  overallScore: number;
  grammarRating: number;
  completenessRating: number;
  clarityRating: number;
  professionalismRating: number;
  starMethodScore: number;
  overallFeedback: string;
}

export const HRInterview: React.FC = () => {
  const { token, userProfile, updateProfile } = useAuthStore();

  // Setup state
  const [dreamCompany, setDreamCompany] = useState(userProfile?.dreamCompany || 'Google');
  const [targetRole, setTargetRole] = useState('Software Engineer');

  // Session state
  const [status, setStatus] = useState<'idle' | 'loading' | 'active' | 'finished'>('idle');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  
  // Evaluation state
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [lastEvaluation, setLastEvaluation] = useState<InlineEvaluation | null>(null);
  const [finalScorecard, setFinalScorecard] = useState<FinalScorecard | null>(null);
  
  // API loader statuses
  const [processing, setProcessing] = useState(false);
  const [rewards, setRewards] = useState({ xp: 0, coins: 0 });

  const handleStartInterview = async () => {
    setStatus('loading');
    setChatHistory([]);
    setLastEvaluation(null);
    setFinalScorecard(null);
    setUserAnswer('');
    try {
      const response = await fetch('/api/interview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dreamCompany, role: targetRole })
      });

      if (!response.ok) {
        throw new Error('Failed to interface with AI HR system.');
      }

      const data = await response.json();
      setCurrentQuestion(data.question);
      setChatHistory(data.chatHistory);
      setStatus('active');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to start interview.');
      setStatus('idle');
    }
  };

  const handleSendResponse = async () => {
    if (!userAnswer.trim() || processing) return;
    setProcessing(true);
    setLastEvaluation(null);

    // Optimistically update chat history
    const updatedHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: userAnswer }
    ];
    setChatHistory(updatedHistory);
    const candidateAnswer = userAnswer;
    setUserAnswer('');

    try {
      const response = await fetch('/api/interview/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dreamCompany,
          chatHistory: chatHistory,
          userAnswer: candidateAnswer
        })
      });

      if (!response.ok) {
        throw new Error('AI response evaluation failed.');
      }

      const data = await response.json();
      setLastEvaluation(data.evaluation);

      if (data.finished) {
        setFinalScorecard(data.finalScorecard);
        setRewards(data.rewards);
        setStatus('finished');
        
        // Sync user stats
        fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(verified => {
            if (verified.profile) updateProfile(verified.profile);
          });
      } else {
        // Keep question in state to present next after user clicks "Continue"
        setCurrentQuestion(data.nextQuestion);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error communicating with AI HR.');
    } finally {
      setProcessing(false);
    }
  };

  const handleNextQuestion = () => {
    setChatHistory(prev => [...prev, { role: 'assistant', content: currentQuestion }]);
    setLastEvaluation(null);
  };

  // State 1: Setup View
  if (status === 'idle') {
    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
        <div className="pb-4 border-b border-border-dark">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Behavioral Assessment</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight mt-1">HR Mock Interview Studio</h1>
          <p className="text-text-secondary text-sm mt-0.5">Practice behavioral and situational interview questions with structured AI evaluation using the STAR framework.</p>
        </div>

        <div className="bg-surface-dark border border-border-dark p-6 sm:p-8 rounded-2xl space-y-6 shadow-xs">
          <div>
            <h3 className="font-semibold text-base text-text-primary">
              Target Role & Company Profile
            </h3>
            <p className="text-xs text-text-muted mt-1">Specify your target placement organization and designation to calibrate question patterns.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Target Company</label>
              <input
                type="text"
                value={dreamCompany}
                onChange={(e) => setDreamCompany(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-dark text-text-primary text-sm focus:outline-hidden focus:border-brand-500"
                placeholder="e.g. Google, TCS, Microsoft, Amazon"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Job Position</label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-dark text-text-primary text-sm focus:outline-hidden focus:border-brand-500"
                placeholder="e.g. Software Development Engineer, Analyst"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border-dark space-y-2 text-xs">
            <p className="font-semibold text-text-primary">STAR Interview Methodology</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-text-muted">
              <div className="p-2 rounded-lg bg-surface-dark border border-border-dark">
                <span className="font-bold text-brand-400 block">S — Situation</span>
                Context & background
              </div>
              <div className="p-2 rounded-lg bg-surface-dark border border-border-dark">
                <span className="font-bold text-brand-400 block">T — Task</span>
                Problem or challenge
              </div>
              <div className="p-2 rounded-lg bg-surface-dark border border-border-dark">
                <span className="font-bold text-brand-400 block">A — Action</span>
                Your specific steps
              </div>
              <div className="p-2 rounded-lg bg-surface-dark border border-border-dark">
                <span className="font-bold text-brand-400 block">R — Result</span>
                Measurable outcome
              </div>
            </div>
          </div>

          <button
            onClick={handleStartInterview}
            className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold text-sm tracking-wide text-white shadow-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            <FaUserTie className="w-3.5 h-3.5" />
            <span>Begin Mock Interview</span>
          </button>
        </div>
      </div>
    );
  }

  // State 2: Setup Loading View
  if (status === 'loading') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 animate-fade-in max-w-md mx-auto text-center px-4">
        <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
        <div className="space-y-1">
          <h2 className="font-bold text-lg text-text-primary">Preparing Interview Room</h2>
          <p className="text-xs text-text-muted">
            Formulating behavioral question sequences for {dreamCompany} — {targetRole}...
          </p>
        </div>
      </div>
    );
  }

  // State 3: Active Dialogue Workspace
  return (
    <div className="h-[calc(100vh-160px)] flex flex-col md:flex-row gap-4 min-h-0 animate-fade-in">
      {/* Left panel: Interviewer status */}
      {status === 'active' && (
        <div className="w-full md:w-64 bg-surface-dark border border-border-dark p-4 md:p-5 rounded-2xl flex flex-row md:flex-col items-center justify-start md:justify-between text-left md:text-center gap-4 shrink-0 shadow-xs">
          <div className="flex flex-row md:flex-col items-center gap-3 w-full">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
              <FaUserTie className="w-6 h-6" />
            </div>
            <div className="flex-1 md:flex-none">
              <h4 className="font-bold text-text-primary text-sm">{dreamCompany} Panel</h4>
              <p className="text-xs text-text-muted">{targetRole} Interview</p>
            </div>
          </div>
          
          <div className="hidden md:block w-full pt-4 border-t border-border-dark space-y-2 text-left text-[11px] text-text-muted">
            <p className="font-semibold text-text-secondary uppercase text-[10px] tracking-wider">Evaluation Tips</p>
            <p>Structure your answers clearly. Focus on personal contribution and measurable impacts.</p>
          </div>
        </div>
      )}

      {/* Right panel: Chat log and inputs */}
      {status === 'active' && (
        <div className="flex-1 bg-surface-dark border border-border-dark rounded-2xl flex flex-col overflow-hidden min-h-0 shadow-xs">
          {/* Messages log */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            {chatHistory.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div key={idx} className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-brand-600/10 border border-brand-500/20 flex items-center justify-center shrink-0 text-brand-400 text-xs">
                      <FaRobot className="w-4 h-4" />
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl max-w-lg text-xs sm:text-sm leading-relaxed ${
                    isUser 
                      ? 'bg-brand-600 text-white rounded-tr-xs shadow-xs' 
                      : 'bg-surface-elevated border border-border-dark text-text-secondary rounded-tl-xs'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Inline critique review */}
            {lastEvaluation && (
              <div className="p-4 sm:p-5 rounded-xl border border-brand-500/30 bg-brand-500/5 text-xs space-y-3 animate-fade-in">
                <div className="flex justify-between items-center border-b border-border-dark pb-2">
                  <h5 className="font-semibold text-brand-400 uppercase text-[11px] tracking-wider">Response Evaluation</h5>
                  <span className="font-bold text-xs text-emerald-400">Score: {lastEvaluation.score}%</span>
                </div>
                <p className="text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">Critique: </strong> 
                  {lastEvaluation.feedback}
                </p>
                <div className="p-3 rounded-lg bg-surface-dark border border-border-dark text-text-muted leading-relaxed">
                  <strong className="text-text-primary block mb-1">Suggested Model Answer:</strong>
                  {lastEvaluation.improvedAnswer}
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleNextQuestion}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <span>Next Question</span>
                    <FaChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {processing && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-600/10 border border-brand-500/20 flex items-center justify-center shrink-0 text-brand-400">
                  <FaRobot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="p-3 rounded-xl bg-surface-elevated border border-border-dark text-xs text-text-muted animate-pulse">
                  Analyzing response structure, communication clarity, and STAR method alignment...
                </div>
              </div>
            )}
          </div>

          {/* User Input bar */}
          {!lastEvaluation && (
            <div className="p-3.5 border-t border-border-dark bg-surface-elevated/30 flex gap-2.5 items-center">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your response... (Use Situation, Task, Action, Result framework)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendResponse();
                  }
                }}
                disabled={processing}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-dark border border-border-dark text-text-primary text-xs sm:text-sm focus:outline-hidden focus:border-brand-500 resize-none h-12 leading-relaxed"
              />
              <button
                onClick={handleSendResponse}
                disabled={processing || !userAnswer.trim()}
                className="w-11 h-11 rounded-xl bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <FaPaperPlane className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* State 4: Scorecard view */}
      {status === 'finished' && finalScorecard && (
        <div className="max-w-2xl mx-auto space-y-6 overflow-y-auto pb-6 w-full animate-fade-in">
          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Interview Concluded</span>
            <h1 className="text-2xl font-bold text-text-primary">Behavioral Performance Scorecard</h1>
            <p className="text-xs text-text-muted">Comprehensive evaluation for {dreamCompany} — {targetRole}</p>
          </div>

          {/* Overall Rating and Rewards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-surface-dark border border-border-dark p-4 rounded-xl text-center">
              <span className="text-[10px] font-semibold uppercase text-text-muted">Overall Score</span>
              <p className="font-bold text-2xl text-emerald-400 mt-0.5">{finalScorecard.overallScore}%</p>
            </div>

            <div className="bg-surface-dark border border-border-dark p-4 rounded-xl text-center">
              <span className="text-[10px] font-semibold uppercase text-text-muted">XP Gained</span>
              <p className="font-bold text-2xl text-purple-400 mt-0.5">+{rewards.xp}</p>
            </div>

            <div className="bg-surface-dark border border-border-dark p-4 rounded-xl text-center">
              <span className="text-[10px] font-semibold uppercase text-text-muted">Coins Gained</span>
              <p className="font-bold text-2xl text-amber-400 mt-0.5">+{rewards.coins}</p>
            </div>
          </div>

          {/* Metric Details grid */}
          <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl space-y-3 shadow-xs">
            <h3 className="font-semibold text-xs text-text-primary border-b border-border-dark pb-2 uppercase tracking-wider">
              Competency Breakdown
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="text-center p-3 rounded-lg bg-surface-elevated/40 border border-border-dark">
                <span className="text-[10px] font-semibold text-text-muted block">Grammar</span>
                <p className="font-bold text-base text-brand-400 mt-0.5">{finalScorecard.grammarRating}%</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-surface-elevated/40 border border-border-dark">
                <span className="text-[10px] font-semibold text-text-muted block">Completeness</span>
                <p className="font-bold text-base text-purple-400 mt-0.5">{finalScorecard.completenessRating}%</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-surface-elevated/40 border border-border-dark">
                <span className="text-[10px] font-semibold text-text-muted block">Clarity</span>
                <p className="font-bold text-base text-brand-400 mt-0.5">{finalScorecard.clarityRating}%</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-surface-elevated/40 border border-border-dark">
                <span className="text-[10px] font-semibold text-text-muted block">Tone</span>
                <p className="font-bold text-base text-emerald-400 mt-0.5">{finalScorecard.professionalismRating}%</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-surface-elevated/40 border border-border-dark col-span-2 sm:col-span-1">
                <span className="text-[10px] font-semibold text-text-muted block">STAR Alignment</span>
                <p className="font-bold text-base text-amber-400 mt-0.5">{finalScorecard.starMethodScore}%</p>
              </div>
            </div>
          </div>

          {/* Qualitative overall feedback text */}
          <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl space-y-2 shadow-xs">
            <h4 className="font-semibold text-xs text-brand-400 flex items-center gap-1.5 uppercase tracking-wider">
              <FaChartLine className="w-3.5 h-3.5" /> Examiner Feedback Summary
            </h4>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {finalScorecard.overallFeedback}
            </p>
          </div>

          {/* Actions */}
          <button
            onClick={() => setStatus('idle')}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold text-sm text-white transition-colors cursor-pointer"
          >
            <FaArrowRotateLeft className="w-4 h-4" />
            <span>Start Another Interview Session</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default HRInterview;
