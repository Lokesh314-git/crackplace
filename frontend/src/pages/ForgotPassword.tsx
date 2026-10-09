import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom';
import { auth } from '../config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { FaEnvelope, FaCircleCheck, FaCircleExclamation, FaGraduationCap, FaArrowLeft } from 'react-icons/fa6';
import { Card, Button } from '../components/ui';

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
    <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 text-white mb-3 shadow-md">
            <FaGraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            CrackPlace AI
          </h1>
          <p className="text-xs text-text-secondary mt-1">Account Recovery</p>
        </div>

        <Card className="p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-text-primary">Reset Password</h2>
            <p className="text-xs text-text-secondary mt-0.5">Enter your email address and we'll send a password reset link</p>
          </div>

          {/* Success Alert */}
          {successMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <FaCircleCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              <FaCircleExclamation className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">Registered Email</label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-3 text-text-muted w-3.5 h-3.5" />
                <input
                  type="email"
                  placeholder="student@college.edu"
                  className="pro-input pl-9 py-2.5 text-xs"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-brand-error text-xs mt-1">{errors.email.message}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              isLoading={loading}
              className="w-full justify-center py-2.5"
            >
              {loading ? 'Sending link...' : 'Send Recovery Link'}
            </Button>
          </form>

          {/* Return to Login */}
          <p className="text-center text-xs text-text-secondary mt-6">
            <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand-primary hover:opacity-80 transition-opacity">
              <FaArrowLeft className="w-3 h-3" />
              <span>Return to Sign In</span>
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
