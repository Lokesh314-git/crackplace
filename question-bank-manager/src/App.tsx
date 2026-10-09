import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Questions } from './pages/Questions';
import { AddQuestion } from './pages/AddQuestion';
import { ImportCSV } from './pages/ImportCSV';
import { Subjects } from './pages/Subjects';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

// Growth & Rewards Pages
import { GrowthDashboard } from './pages/growth/Dashboard';
import { ReferralManagement } from './pages/growth/Referrals';
import { Influencers } from './pages/growth/Influencers';
import { Rewards } from './pages/growth/Rewards';
import { Cash } from './pages/growth/Cash';
import { Settings as CampaignSettings } from './pages/growth/Settings';
import { Audit } from './pages/growth/Audit';
import { Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold text-slate-500">Authenticating admin access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="questions" element={<Questions />} />
          <Route path="add-question" element={<AddQuestion />} />
          <Route path="import-csv" element={<ImportCSV />} />
          <Route path="subjects" element={<Subjects />} />
          <Route path="settings" element={<Settings />} />
          
          {/* Growth & Rewards Routes */}
          <Route path="growth/dashboard" element={<GrowthDashboard />} />
          <Route path="growth/referrals" element={<ReferralManagement />} />
          <Route path="growth/influencers" element={<Influencers />} />
          <Route path="growth/rewards" element={<Rewards />} />
          <Route path="growth/cash" element={<Cash />} />
          <Route path="growth/settings" element={<CampaignSettings />} />
          <Route path="growth/audit" element={<Audit />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};
