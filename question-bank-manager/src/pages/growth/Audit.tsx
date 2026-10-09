import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../../services/growthApiService';
import { Loader2, ClipboardList, AlertCircle, Search } from 'lucide-react';

export const Audit: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await getAuditLogs();
        setLogs(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = logs.filter((log: any) => 
    log.action?.includes(search) || log.adminId?.includes(search) || log.targetId?.includes(search)
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
          <ClipboardList className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Growth Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track administrative actions and reward fulfillments.</p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search logs..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Admin ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Target ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((log, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500">{log.adminId}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500">{log.targetId}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
