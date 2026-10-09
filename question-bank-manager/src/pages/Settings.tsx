import React, { useState } from 'react';
import {
  Server,
  Copy,
  Check,
  Code2,
  FileCode,
  Lock
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export const Settings: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sampleSnippet = `// CrackPlace AI Student Frontend / Backend Integration:
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Retrieve 10 random DSA questions for a Battle (WITHOUT exposing correct_answer):
export async function getBattleQuestions(subject = 'dsa', limit = 10) {
  const { data, error } = await supabase.rpc('get_random_questions', {
    p_subject: subject,
    p_limit: limit
  });

  if (error) throw error;

  // Student-Safe Projection (Anti-Cheat)
  return data.map(q => ({
    id: q.id,
    question_id: q.question_id,
    subject: q.subject,
    topic: q.topic,
    difficulty: q.difficulty,
    question: q.question,
    options: {
      A: q.option_a,
      B: q.option_b,
      C: q.option_c,
      D: q.option_d
    }
    // Note: correct_answer & explanation are NOT sent to the student client
  }));
}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Database & System Configuration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Supabase PostgreSQL connection credentials, RLS security policies, and student API integration
        </p>
      </div>

      {/* Supabase Connection Status Card */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Supabase Connection Status
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isSupabaseConfigured
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {isSupabaseConfigured ? 'Connected to PostgreSQL' : 'Local Sandbox Active'}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                VITE_SUPABASE_URL
              </span>
              <span className="font-mono text-slate-500">
                {import.meta.env.VITE_SUPABASE_URL || 'Not set in .env (Using sandbox)'}
              </span>
            </div>
            <button
              onClick={() =>
                copyText(
                  import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
                  'url'
                )
              }
              className="p-1.5 text-slate-400 hover:text-slate-600"
            >
              {copiedKey === 'url' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                VITE_SUPABASE_ANON_KEY (Public Only)
              </span>
              <span className="font-mono text-slate-500">
                {import.meta.env.VITE_SUPABASE_ANON_KEY
                  ? `${import.meta.env.VITE_SUPABASE_ANON_KEY.slice(0, 16)}...`
                  : 'Not set in .env'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px]">
              <Lock className="w-3.5 h-3.5" /> Safe Public Key
            </div>
          </div>
        </div>
      </div>

      {/* SQL Migration Setup Steps */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <FileCode className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Supabase Database Schema Migrations
          </h2>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          To initialize your Supabase PostgreSQL project, execute the SQL migration files included in <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-indigo-600">supabase/migrations/</code> in your Supabase SQL Editor:
        </p>

        <div className="space-y-2 text-xs">
          {[
            {
              file: '001_create_questions.sql',
              desc: 'Creates questions table, UUID primary keys, human question_id unique constraint, and updated_at trigger.'
            },
            {
              file: '002_create_subjects.sql',
              desc: 'Creates subjects table and seeds the 8 placement domains.'
            },
            {
              file: '003_create_rls.sql',
              desc: 'Configures Row Level Security (RLS) policies for authenticated admin writes and public quiz reads.'
            },
            {
              file: '004_create_indexes_and_functions.sql',
              desc: 'Creates B-tree indexes for fast querying and the get_random_questions RPC function.'
            }
          ].map((m, idx) => (
            <div
              key={m.file}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start gap-3"
            >
              <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {m.file}
                </span>
                <p className="text-slate-500 mt-0.5">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Code Snippet */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Code2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              CrackPlace AI Application Integration Snippet
            </h2>
          </div>
          <button
            onClick={() => copyText(sampleSnippet, 'snippet')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition-colors"
          >
            {copiedKey === 'snippet' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedKey === 'snippet' ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          How the main CrackPlace AI student application or backend battle engine retrieves questions dynamically from Supabase:
        </p>

        <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
          {sampleSnippet}
        </pre>
      </div>
    </div>
  );
};
