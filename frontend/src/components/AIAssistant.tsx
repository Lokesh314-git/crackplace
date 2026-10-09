import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { FaXmark, FaPaperPlane, FaTrash, FaRobot } from 'react-icons/fa6';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

export const AIAssistant: React.FC = () => {
  const { token } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'assistant', text: 'Hello! I am your AI Placement Mentor. How can I assist with your coding questions, system concepts, or interview preparation today?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    'Explain DBMS normalization rules (1NF to BCNF)',
    'Key differences between Process and Thread',
    'How to structure a STAR response in HR round'
  ];

  // Load chat history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('mentor_chat_history');
    if (history) {
      try {
        setMessages(JSON.parse(history));
      } catch (err) {
        console.error('Failed to parse chat history:', err);
      }
    }
  }, []);

  // Sync chat history
  useEffect(() => {
    if (messages.length > 1) {
      const capped = messages.slice(-100);
      localStorage.setItem('mentor_chat_history', JSON.stringify(capped));
    }
  }, [messages]);

  const handleClearHistory = () => {
    if (window.confirm('Clear conversation history?')) {
      localStorage.removeItem('mentor_chat_history');
      setMessages([
        { sender: 'assistant', text: 'Hello! I am your AI Placement Mentor. How can I assist with your coding questions, system concepts, or interview preparation today?' }
      ]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend = inputText) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    setInputText('');
    setMessages(prev => [...prev, { sender: 'user', text: trimmed }]);
    setSending(true);

    try {
      const res = await fetch('/api/study/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: trimmed })
      });

      if (!res.ok) throw new Error('Chat request failed');

      const data = await res.json();
      setMessages(prev => [...prev, { sender: 'assistant', text: data.response }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'assistant', text: 'Sorry, I could not complete that request right now. Please try again later.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex items-center gap-2 px-3.5 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer border border-blue-500/30"
        aria-label="Open AI Mentor"
      >
        {isOpen ? <FaXmark className="w-5 h-5" /> : <FaRobot className="w-5 h-5" />}
        {!isOpen && <span className="text-xs font-semibold hidden sm:inline">Ask AI Mentor</span>}
      </button>

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between animate-slide-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                <FaRobot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-white leading-tight">AI Placement Mentor</h3>
                <span className="text-[10px] text-emerald-400 font-medium">Ready to assist</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  onClick={handleClearHistory}
                  title="Clear Conversation"
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <FaTrash className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <FaXmark className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Log */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="p-3 rounded-xl bg-slate-800 text-slate-400 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/20 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Suggested Topics:</span>
              <div className="space-y-1">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(s)}
                    className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-700/50 truncate transition-colors cursor-pointer block"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about placement topics..."
                disabled={sending}
                className="flex-1 bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                <FaPaperPlane className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
