import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaGraduationCap,
  FaBuilding,
  FaCircleExclamation,
  FaChevronDown
} from 'react-icons/fa6';

const registerSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  college: z.string().min(2, 'College name is required'),
  department: z.string().min(2, 'Department is required'),
  year: z.number().min(1).max(5),
  dreamCompany: z.string().min(1, 'Target dream company is required')
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { register: registerUser } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      year: 1
    }
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoadingLocal(true);
    setErrorMsg(null);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const referrerId = urlParams.get('ref');

      await registerUser(data.email, data.password, data.displayName, {
        college: data.college,
        department: data.department,
        year: Number(data.year),
        dreamCompany: data.dreamCompany,
        referredBy: referrerId || undefined
      });

      if (referrerId) {
        const { token } = useAuthStore.getState();
        if (token) {
          try {
            await fetch('/api/invite-promote/referral/track', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ referrerId })
            });
          } catch (e) {
            console.error('Failed to track referral:', e);
          }
        }
      }

      const pendingInvite = sessionStorage.getItem('pending_invite');
      if (pendingInvite) {
        sessionStorage.removeItem('pending_invite');
        navigate(`/invite/${pendingInvite}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Registration failed. Email might already be in use.');
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-800 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full max-w-3xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-xs mb-3.5 text-[#1D5BFF]">
            <FaGraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            CrackPlace AI
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-normal">
            Create your candidate profile
          </p>
        </div>

        {/* Registration Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.05)] p-6 sm:p-10">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">
              Create Candidate Account
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Fill in your academic details to personalize your placement curriculum
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-6 flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <FaCircleExclamation className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* Left Column — ACCOUNT CREDENTIALS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#1D5BFF]" />
                  <h3 className="text-xs font-bold text-[#1D5BFF] tracking-wider uppercase">
                    Account Credentials
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <FaUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Alex Mercer"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs"
                      {...registerField('displayName')}
                    />
                  </div>
                  {errors.displayName && (
                    <p className="text-rose-500 text-xs mt-1 font-medium">{errors.displayName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="alex@college.edu"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs"
                      {...registerField('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-rose-500 text-xs mt-1 font-medium">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                    Password
                  </label>
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
              </div>

              {/* Right Column — ACADEMIC PROFILE */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                  <h3 className="text-xs font-bold text-[#8B5CF6] tracking-wider uppercase">
                    Academic Profile
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                    College / Institution
                  </label>
                  <div className="relative">
                    <FaGraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. IIT Madras, BITS Pilani"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs"
                      {...registerField('college')}
                    />
                  </div>
                  {errors.college && (
                    <p className="text-rose-500 text-xs mt-1 font-medium">{errors.college.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      placeholder="CSE, ECE, IT"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs"
                      {...registerField('department')}
                    />
                    {errors.department && (
                      <p className="text-rose-500 text-xs mt-1 font-medium">{errors.department.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Academic Year
                    </label>
                    <div className="relative">
                      <select
                        className="w-full pl-3.5 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs appearance-none cursor-pointer"
                        {...registerField('year', { valueAsNumber: true })}
                      >
                        <option value={1}>1st Year</option>
                        <option value={2}>2nd Year</option>
                        <option value={3}>3rd Year</option>
                        <option value={4}>4th Year</option>
                        <option value={5}>5th Year</option>
                      </select>
                      <FaChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
                    </div>
                    {errors.year && (
                      <p className="text-rose-500 text-xs mt-1 font-medium">{errors.year.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                    Target Dream Company
                  </label>
                  <div className="relative">
                    <FaBuilding className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. Google, Microsoft, Amazon"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs"
                      {...registerField('dreamCompany')}
                    />
                  </div>
                  {errors.dreamCompany && (
                    <p className="text-rose-500 text-xs mt-1 font-medium">{errors.dreamCompany.message}</p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingLocal}
              className="w-full bg-[#1D5BFF] hover:bg-[#1648DB] active:bg-[#1138B0] text-white font-semibold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-8"
            >
              {loadingLocal ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Creating Profile...</span>
                </div>
              ) : (
                'Complete Registration'
              )}
            </button>
          </form>

          {/* Footer Link */}
          <p className="text-center text-xs sm:text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-[#1D5BFF] hover:underline hover:text-[#1648DB] transition-colors"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;


