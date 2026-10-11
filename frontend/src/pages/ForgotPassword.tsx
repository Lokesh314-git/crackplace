import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom';
import { auth } from '../config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import {
  FaEnvelope,
  FaCircleCheck,
  FaCircleExclamation,
  FaGraduationCap,
  FaArrowLeft
} from 'react-icons/fa6';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword: React.FC = () => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await sendPasswordResetEmail(auth, data.email);
      setSuccessMsg('Password reset instructions have been sent to your email.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to send recovery email. Double check the address.');
    } finally {
      setLoading(false);
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
            Account Recovery & Access
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.05)] p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">
              Reset Password
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Enter your email address and we'll send a password recovery link
            </p>
          </div>

          {/* Success Alert */}
          {successMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <FaCircleCheck className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <FaCircleExclamation className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Registered Email Address
              </label>
              <div className="relative">
                <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  type="email"
                  placeholder="student@college.edu"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D5BFF] focus:ring-3 focus:ring-[#1D5BFF]/10 transition-all shadow-2xs"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-rose-500 text-xs mt-1 font-medium">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1D5BFF] hover:bg-[#1648DB] active:bg-[#1138B0] text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Sending recovery link...</span>
                </div>
              ) : (
                'Send Recovery Link'
              )}
            </button>
          </form>

          {/* Return to Login */}
          <p className="text-center text-xs sm:text-sm text-slate-500 mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-semibold text-[#1D5BFF] hover:underline hover:text-[#1648DB] transition-colors"
            >
              <FaArrowLeft className="w-3 h-3" />
              <span>Return to Sign In</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

