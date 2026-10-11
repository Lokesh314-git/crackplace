import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  FaGraduationCap,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaCircleExclamation
} from 'react-icons/fa6';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long')
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login, loginWithGoogle } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoadingLocal(true);
    setErrorMsg(null);
    try {
      await login(data.email, data.password);
      const pendingInvite = sessionStorage.getItem('pending_invite');
      if (pendingInvite) {
        sessionStorage.removeItem('pending_invite');
        navigate(`/invite/${pendingInvite}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoadingLocal(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      const pendingInvite = sessionStorage.getItem('pending_invite');
      if (pendingInvite) {
        sessionStorage.removeItem('pending_invite');
        navigate(`/invite/${pendingInvite}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Google authentication failed.');
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-800 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full max-w-[440px]">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-xs mb-3.5 text-[#1D5BFF]">
            <FaGraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            CrackPlace AI
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-normal">
            Placement Preparation & Assessment Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">
              Candidate Sign In
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Enter your credentials to continue your preparation
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <FaCircleExclamation className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  type="email"
                  placeholder="student@college.edu"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs"
                  {...registerField('email')}
                />
              </div>
              {errors.email && (
                <p className="text-rose-500 text-xs mt-1 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-[#334155]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#1D5BFF] hover:underline hover:text-[#1648DB] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs"
                  {...registerField('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <FaEyeSlash className="w-4 h-4" />
                  ) : (
                    <FaEye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-rose-500 text-xs mt-1 font-medium">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loadingLocal}
              className="w-full bg-[#1D5BFF] hover:bg-[#1648DB] active:bg-[#1138B0] text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {loadingLocal ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <span className="relative inline-block bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              OR CONTINUE WITH
            </span>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingLocal}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs text-slate-700 font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2.5 text-sm active:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          {/* Footer Link */}
          <p className="text-center text-xs sm:text-sm text-slate-500 mt-6">
            New to CrackPlace?{' '}
            <Link
              to="/register"
              className="font-semibold text-[#1D5BFF] hover:underline hover:text-[#1648DB] transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

