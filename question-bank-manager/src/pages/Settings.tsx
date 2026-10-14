import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Copy,
  Check,
  Code2,
  FileCode,
  Lock,
  Clock,
  TrendingDown,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Play,
  Save,
  History,
  Loader2,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  getSeasonAdminData,
  updateSeasonSettings,
  triggerSeasonReset,
  type ActiveSeasonInfo,
  type SeasonHistoryItem
} from '../services/seasonApiService';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'seasonal' | 'database'>('seasonal');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Seasonal Elo settings state
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form controls
  const [decayEnabled, setDecayEnabled] = useState<boolean>(true);
  const [reductionPercentage, setReductionPercentage] = useState<number>(20);
  const [minFloor, setMinFloor] = useState<number>(100);

  // Read-only active season metadata
  const [activeSeason, setActiveSeason] = useState<ActiveSeasonInfo | null>(null);
  const [history, setHistory] = useState<SeasonHistoryItem[]>([]);
  const [configuredMeta, setConfiguredMeta] = useState<{ by?: string; at?: string } | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadSeasonData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSeasonAdminData();
      if (data?.settings) {
        setDecayEnabled(data.settings.decayEnabled ?? true);
        setReductionPercentage(data.settings.reductionPercentage ?? 20);
        setMinFloor(data.settings.minFloor ?? 100);
        setConfiguredMeta({
          by: data.settings.configuredBy,
          at: data.settings.configuredAt,
        });
      }
      if (data?.activeSeason) {
        setActiveSeason(data.activeSeason);
      }
      if (Array.isArray(data?.history)) {
        setHistory(data.history);
      }
    } catch (err: any) {
      console.warn('Failed to load season admin data:', err);
      setError(err.message || 'Unable to connect to deployed backend for Seasonal Elo settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSeasonData();
  }, [loadSeasonData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const pct = Number(reductionPercentage);
    if (isNaN(pct) || pct < 10 || pct > 30 || !Number.isInteger(pct)) {
      setError('Seasonal Elo reduction must be a whole number between 10% and 30%.');
      return;
    }

    const floor = Number(minFloor);
    if (isNaN(floor) || floor < 100) {
      setError('Minimum Elo floor must be at least 100.');
      return;
    }

    setSaving(true);
    try {
      const res = await updateSeasonSettings({
        decayEnabled,
        reductionPercentage: pct,
        minFloor: floor,
      });
      setSuccessMsg(res.message || 'Seasonal settings saved successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      loadSeasonData();
    } catch (err: any) {
      setError(err.message || 'Failed to update seasonal settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualReset = async () => {
    if (!window.confirm('Are you sure you want to trigger the seasonal reset now? This will apply Elo reduction to all eligible candidates if enabled.')) {
      return;
    }

    setTriggering(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await triggerSeasonReset();
      setSuccessMsg(`Season reset completed successfully! ${res.result?.playersProcessed ?? 0} candidates processed.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      loadSeasonData();
    } catch (err: any) {
      setError(err.message || 'Failed to trigger season reset.');
    } finally {
      setTriggering(false);
    }
  };

  const formatIST = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      }) + ' IST';
    } catch {
      return isoString;
    }
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
  }));
}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header and Tab Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Settings & System Configuration
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Administer weekly seasonal Elo decay, PostgreSQL database credentials, and RLS policies
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('seasonal')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'seasonal'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Seasonal Elo Settings
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'database'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Database & API
          </button>
        </div>
      </div>

      {/* Notification Banners */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: SEASONAL ELO SETTINGS */}
      {activeTab === 'seasonal' && (
        <div className="space-y-6">
          {/* Active Season & Operational Status Banner */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Active Season & Operational Status
                </h2>
              </div>
              <button
                onClick={loadSeasonData}
                disabled={loading}
                title="Refresh Season Data"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-500 block font-medium">Currently Active Season</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white block font-mono">
                  {activeSeason ? `Season ${activeSeason.seasonNumber}` : 'Loading...'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {activeSeason?.seasonId || 'season_id'}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-500 block font-medium">Authoritative Timezone</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 block">
                  Asia/Kolkata (IST)
                </span>
                <span className="text-[10px] text-slate-400 block">
                  UTC +05:30 (Resets Mon 00:00)
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-500 block font-medium">Next Scheduled Reset</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {formatIST(activeSeason?.nextResetTimestamp)}
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  Every Monday 00:00:00 IST
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-500 block font-medium">Decay Reduction Status</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    decayEnabled
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {decayEnabled ? 'Active (Auto-Decay)' : 'Paused (Ratings Kept)'}
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  {reductionPercentage}% reduction
                </span>
              </div>
            </div>
          </div>

          {/* Form: Admin Elo Configuration */}
          <form
            onSubmit={handleSaveSettings}
            className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <TrendingDown className="w-5 h-5 text-indigo-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Seasonal Elo Reduction Controls
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Formula: <code className="font-mono text-indigo-600 dark:text-indigo-400">newElo = round(currentElo * (1 - reductionPercentage / 100))</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualReset}
                  disabled={triggering || loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Trigger Reset Now</span>
                </button>

                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Settings</span>
                </button>
              </div>
            </div>

            {/* Toggle: Automatic Weekly Decay */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="space-y-0.5">
                <label htmlFor="decayEnabledToggle" className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 cursor-pointer">
                  <span>Enable Automatic Weekly Elo Decay</span>
                  {decayEnabled ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                  )}
                </label>
                <p className="text-[11px] text-slate-500 max-w-lg">
                  When enabled, ratings are safely decayed each Monday at 00:00:00 IST. When disabled, weekly season boundaries and countdowns continue normally without reducing player Elo.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="decayEnabledToggle"
                  type="checkbox"
                  checked={decayEnabled}
                  onChange={(e) => setDecayEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Slider & Input: Reduction Percentage */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-white block">
                    Seasonal Elo Reduction Percentage
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Permitted range: <span className="font-semibold text-indigo-600 dark:text-indigo-400">10% to 30%</span> (Default: 20%)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="30"
                    step="1"
                    value={reductionPercentage}
                    onChange={(e) => setReductionPercentage(parseInt(e.target.value) || 20)}
                    className="w-20 px-3 py-1.5 text-center font-mono font-bold text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500"
                  />
                  <span className="text-sm font-bold text-slate-500">%</span>
                </div>
              </div>

              <input
                type="range"
                min="10"
                max="30"
                step="1"
                value={reductionPercentage}
                onChange={(e) => setReductionPercentage(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>10% (Gentle)</span>
                <span>20% (Standard)</span>
                <span>30% (Aggressive)</span>
              </div>
            </div>

            {/* Input: Minimum Elo Floor */}
            <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-white block">
                    Minimum Allowed Rating (Elo Floor)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Guarantees a player&apos;s Elo rating will never drop below this safeguard limit during seasonal decay.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="100"
                    max="800"
                    step="50"
                    value={minFloor}
                    onChange={(e) => setMinFloor(parseInt(e.target.value) || 100)}
                    className="w-24 px-3 py-1.5 text-center font-mono font-bold text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-500">Elo</span>
                </div>
              </div>
            </div>

            {configuredMeta?.at && (
              <p className="text-[10px] text-slate-400">
                Last updated {formatIST(configuredMeta.at)} {configuredMeta.by ? `by ${configuredMeta.by}` : ''}
              </p>
            )}
          </form>

          {/* Reset History Table */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <History className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Season Reset History & Audit Logs
              </h2>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No past season resets recorded yet. The first reset will log here automatically upon execution.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Season</th>
                      <th className="p-3">Execution Timestamp</th>
                      <th className="p-3">Reduction</th>
                      <th className="p-3">Players Processed</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {history.map((item) => (
                      <tr key={item.seasonId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                          #{item.seasonNumber ?? '-'}
                          <span className="text-[10px] text-slate-400 block font-normal">{item.seasonId}</span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {formatIST(item.resetCompletedAt || item.updatedAt)}
                        </td>
                        <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                          {item.reductionPercentage}%
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-200">
                          {item.playersProcessed}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : item.status === 'skipped'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-400 max-w-xs truncate">
                          {item.error || 'Clean completion'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DATABASE & API CREDENTIALS */}
      {activeTab === 'database' && (
        <div className="space-y-6">
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition-colors cursor-pointer"
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
      )}
    </div>
  );
};

export default Settings;
