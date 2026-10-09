import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { FaEnvelope, FaLock, FaGoogle, FaCircleExclamation, FaGraduationCap } from 'react-icons/fa6';
import { Card, Button } from '../components/ui';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long')
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login, loginWithGoogle } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4 py-12" data-theme="dark">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 text-white mb-3 shadow-md">
            <FaGraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            CrackPlace AI
          </h1>
          <p className="text-xs text-slate-400 mt-1">Placement Preparation & Assessment Platform</p>
        </div>

        <Card className="p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Candidate Sign In</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enter your credentials to continue your preparation</p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              <FaCircleExclamation className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-3 text-slate-500 w-3.5 h-3.5" />
                <input
                  type="email"
                  placeholder="student@college.edu"
                  className="pro-input pl-9 py-2.5 text-xs"
                  {...registerField('email')}
                />
              </div>
              {errors.email && <p className="text-rose-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <FaLock className="absolute left-3 top-3 text-slate-500 w-3.5 h-3.5" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="pro-input pl-9 py-2.5 text-xs"
                  {...registerField('password')}
                />
              </div>
              {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loadingLocal}
              isLoading={loadingLocal}
              className="w-full justify-center py-2.5"
            >
              {loadingLocal ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-slate-800"></div>
            <span className="px-3 text-xs text-slate-500 uppercase font-medium">Or continue with</span>
            <div className="flex-1 h-px bg-slate-800"></div>
          </div>

          {/* Google OAuth Button */}
          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogleSignIn}
            disabled={loadingLocal}
            className="w-full justify-center py-2.5"
          >
            <FaGoogle className="w-3.5 h-3.5 mr-2 text-rose-400" />
            <span>Sign in with Google</span>
          </Button>

          {/* Footer Link */}
          <p className="text-center text-xs text-slate-400 mt-6">
            New to CrackPlace?{' '}
            <Link to="/register" className="font-semibold text-primary-400 hover:text-primary-300 transition-colors">
              Create an account
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Login;
