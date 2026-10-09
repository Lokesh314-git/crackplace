import React, { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, 
  Search, 
  Filter, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Ban
} from 'lucide-react';
import { getUsers, blockUser, deleteUser, getUserDetails } from '../services/userApiService';
import { Modal } from '../components/ui/Modal';

export const Users: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, blocked: 0, recent: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [detailedData, setDetailedData] = useState<any | null>(null);

  const [actionModal, setActionModal] = useState<{
    open: boolean;
    type: 'block' | 'unblock' | 'delete';
    user: any | null;
  }>({ open: false, type: 'block', user: null });
  
  const [actionReason, setActionReason] = useState('');
  const [actionInternalNote, setActionInternalNote] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const limit = 20;

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter]);

  const fetchUsers = async (searchOverride?: string) => {
    setLoading(true);
    try {
      const qSearch = searchOverride !== undefined ? searchOverride : search;
      const data = await getUsers(page, limit, qSearch, statusFilter);
      setUsers(data.users || []);
      setTotalUsers(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error(error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search);
  };

  const openDetails = async (user: any) => {
    setDetailsModalOpen(true);
    setUserDetailsLoading(true);
    setDetailedData(null);
    try {
      const data = await getUserDetails(user.uid);
      setDetailedData(data);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch detailed user data');
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.user) return;
    
    setActionLoading(true);
    try {
      if (actionModal.type === 'block') {
        await blockUser(actionModal.user.uid, true, actionReason, actionInternalNote);
        alert('User blocked successfully');
      } else if (actionModal.type === 'unblock') {
        await blockUser(actionModal.user.uid, false, actionReason, actionInternalNote);
        alert('User unblocked successfully');
      } else if (actionModal.type === 'delete') {
        if (deleteConfirmation !== 'DELETE') {
          alert('Type DELETE to confirm');
          setActionLoading(false);
          return;
        }
        await deleteUser(actionModal.user.uid, actionReason, deleteConfirmation);
        alert('User deleted successfully');
      }
      
      setActionModal({ open: false, type: 'block', user: null });
      setActionReason('');
      setActionInternalNote('');
      setDeleteConfirmation('');
      fetchUsers();
      if (detailsModalOpen) {
        setDetailsModalOpen(false);
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(totalUsers / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-indigo-500" /> User Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage user accounts, monitor activity, and enforce moderation.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Users</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Active</div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Blocked</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.blocked}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">New (7 days)</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.recent}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, email, or UID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </form>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Email / UID</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4">Level & Stats</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} 
                          alt="" 
                          className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{user.displayName || 'Anonymous'}</div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">{user.role || 'student'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700 dark:text-slate-300">{user.email || 'N/A'}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{user.uid}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded text-xs font-bold">Lvl {user.level || 1}</span>
                        <span className="text-xs text-slate-500">{user.xp || 0} XP</span>
                      </div>
                      <div className="text-xs text-amber-600 dark:text-amber-500 mt-1 font-semibold">{user.coins || 0} Coins</div>
                    </td>
                    <td className="px-6 py-4">
                      {(user.accountStatus === 'blocked') ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <Ban className="w-3 h-3" /> Blocked
                        </span>
                      ) : (user.accountStatus === 'deleted') ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          <Trash2 className="w-3 h-3" /> Deleted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openDetails(user)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {user.accountStatus !== 'deleted' && (
                          <>
                            {(user.accountStatus === 'blocked') ? (
                              <button 
                                onClick={() => setActionModal({ open: true, type: 'unblock', user })}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                title="Unblock User"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => setActionModal({ open: true, type: 'block', user })}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Block User"
                              >
                                <ShieldAlert className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => setActionModal({ open: true, type: 'delete', user })}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalUsers)} of {totalUsers}
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 border border-slate-300 dark:border-slate-700 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 border border-slate-300 dark:border-slate-700 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="User Details">
        {userDetailsLoading || !detailedData ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
            <p>Loading complete profile...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
              <img src={detailedData.user.photoURL} alt="" className="w-16 h-16 rounded-full bg-slate-100 object-cover" />
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{detailedData.user.displayName}</h2>
                <div className="text-sm text-slate-500 mb-1">{detailedData.user.email} • {detailedData.user.uid}</div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-semibold">{detailedData.user.role}</span>
                  <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded text-xs font-bold">Lvl {detailedData.user.level || 1}</span>
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded text-xs font-bold">{detailedData.user.coins || 0} Coins</span>
                </div>
              </div>
            </div>

            {/* Profile Data */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">College</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{detailedData.user.college || '-'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Dream Company</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{detailedData.user.dreamCompany || '-'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Joined</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{new Date(detailedData.user.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">{detailedData.user.accountStatus || 'Active'}</span>
              </div>
            </div>

            {/* Moderation History */}
            {detailedData.moderationHistory?.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" /> Moderation History
                </h3>
                <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                  {detailedData.moderationHistory.map((log: any) => (
                    <div key={log.id} className="p-3 text-sm">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-800 dark:text-slate-200">{log.action}</span>
                        <span className="text-slate-500 text-xs">{new Date(log.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 mt-1">Reason: {log.reason || 'None provided'}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Admin: {log.adminId}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Quick Actions inside modal */}
            {detailedData.user.accountStatus !== 'deleted' && (
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                {(detailedData.user.accountStatus === 'blocked') ? (
                  <button 
                    onClick={() => setActionModal({ open: true, type: 'unblock', user: detailedData.user })}
                    className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-lg transition-colors text-sm"
                  >
                    Unblock User
                  </button>
                ) : (
                  <button 
                    onClick={() => setActionModal({ open: true, type: 'block', user: detailedData.user })}
                    className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg transition-colors text-sm"
                  >
                    Block User
                  </button>
                )}
                <button 
                  onClick={() => setActionModal({ open: true, type: 'delete', user: detailedData.user })}
                  className="flex-1 py-2 border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg transition-colors text-sm"
                >
                  Delete User
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Action Modal (Block/Unblock/Delete) */}
      <Modal isOpen={actionModal.open} onClose={() => setActionModal({ open: false, type: 'block', user: null })} title={
        actionModal.type === 'block' ? 'Block User' : actionModal.type === 'unblock' ? 'Unblock User' : 'Delete User'
      }>
        <form onSubmit={handleActionSubmit} className="space-y-4">
          <div className={`p-4 rounded-lg border ${
            actionModal.type === 'delete' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/50' : 
            'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50'
          }`}>
            <h4 className={`font-bold flex items-center gap-2 ${
              actionModal.type === 'delete' ? 'text-red-800 dark:text-red-400' : 'text-amber-800 dark:text-amber-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
              {actionModal.type === 'delete' ? 'Destructive Action Warning' : 'Account Access Modification'}
            </h4>
            <p className={`text-sm mt-2 ${
              actionModal.type === 'delete' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
            }`}>
              {actionModal.type === 'delete' 
                ? `You are about to soft-delete ${actionModal.user?.email}. This will invalidate their sessions, mask their personal data, and permanently lock the account. This action cannot be easily reversed.`
                : actionModal.type === 'block' 
                  ? `Blocking ${actionModal.user?.email} will immediately invalidate their active sessions and prevent them from accessing any authenticated features.`
                  : `Unblocking ${actionModal.user?.email} will restore their access to CrackPlace.`
              }
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Reason for Action (Visible in Audit Logs)</label>
            <input 
              type="text" 
              required
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Violation of terms, spam behavior..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
            />
          </div>

          {actionModal.type !== 'delete' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Internal Admin Note (Optional)</label>
              <textarea 
                value={actionInternalNote}
                onChange={(e) => setActionInternalNote(e.target.value)}
                placeholder="Additional context for other admins..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm h-20"
              />
            </div>
          )}

          {actionModal.type === 'delete' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Type DELETE to confirm</label>
              <input 
                type="text" 
                required
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono uppercase"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setActionModal({ open: false, type: 'block', user: null })}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={actionLoading}
              className={`px-4 py-2 text-sm font-bold rounded-lg text-white flex items-center gap-2 ${
                actionModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                actionModal.type === 'block' ? 'bg-amber-600 hover:bg-amber-700' :
                'bg-emerald-600 hover:bg-emerald-700'
              } disabled:opacity-50`}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm {actionModal.type.charAt(0).toUpperCase() + actionModal.type.slice(1)}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
