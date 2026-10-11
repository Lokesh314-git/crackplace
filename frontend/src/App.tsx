import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import { PageLoader } from './components/ui/PageLoader';

// Lazy-loaded Authenticated and Flow pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PracticeFlow = lazy(() => import('./pages/PracticeFlow'));
const Coding = lazy(() => import('./pages/Coding'));
const HRInterview = lazy(() => import('./pages/HRInterview'));
const Battle = lazy(() => import('./pages/Battle'));
const PracticeHub = lazy(() => import('./pages/PracticeHub'));
const Leaderboards = lazy(() => import('./pages/Leaderboards'));
const Profile = lazy(() => import('./pages/Profile'));
const Store = lazy(() => import('./pages/Store'));
const Invite = lazy(() => import('./pages/Invite'));
const Personalization = lazy(() => import('./pages/Personalization'));
const InvitePromote = lazy(() => import('./pages/InvitePromote'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const StudyNotes = lazy(() => import('./pages/StudyNotes'));

// Public SEO and Marketing components
const LandingSelector = lazy(() => import('./components/LandingSelector'));
const About = lazy(() => import('./pages/public/About'));
const Contact = lazy(() => import('./pages/public/Contact'));
const FAQPage = lazy(() => import('./pages/public/FAQPage'));
const Privacy = lazy(() => import('./pages/public/Privacy'));
const Terms = lazy(() => import('./pages/public/Terms'));
const BlogHub = lazy(() => import('./pages/public/BlogHub'));
const BlogPost = lazy(() => import('./pages/public/BlogPost'));
const CompanyHub = lazy(() => import('./pages/public/CompanyHub'));
const CompanyDetail = lazy(() => import('./pages/public/CompanyDetail'));
const PublicNotesHub = lazy(() => import('./pages/public/PublicNotesHub'));
const PublicNotesDetail = lazy(() => import('./pages/public/PublicNotesDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

export const App: React.FC = () => {
  const { initializeAuth, userProfile } = useAuthStore();

  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => unsubscribe();
  }, [initializeAuth]);

  useEffect(() => {
    if (userProfile?.equippedTheme) {
      document.documentElement.setAttribute('data-theme', userProfile.equippedTheme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [userProfile?.equippedTheme]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Marketing & SEO Resource Pages */}
          <Route path="/" element={<LandingSelector />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/blog" element={<BlogHub />} />
          <Route path="/blog/:postSlug" element={<BlogPost />} />
          <Route path="/company" element={<CompanyHub />} />
          <Route path="/company/:companyName" element={<CompanyDetail />} />
          <Route path="/notes" element={<PublicNotesHub />} />
          <Route path="/notes/:category" element={<PublicNotesDetail />} />

          {/* Public auth pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/invite/:roomId" element={<Invite />} />

          {/* Authenticated Dashboard layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/practice" element={<PracticeHub />} />
              <Route path="/practice/:subject" element={<PracticeFlow />} />
              <Route path="/coding" element={<Coding />} />
              <Route path="/hr-interview" element={<HRInterview />} />
              <Route path="/battle" element={<Battle />} />
              <Route path="/leaderboard" element={<Leaderboards />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/personalization" element={<Personalization />} />
              <Route path="/store" element={<Store />} />
              <Route path="/study-notes" element={<StudyNotes />} />
              <Route path="/invite-promote" element={<InvitePromote />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;

