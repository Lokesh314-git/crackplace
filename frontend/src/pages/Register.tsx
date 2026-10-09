import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { FaUser, FaEnvelope, FaLock, FaGraduationCap, FaBuilding, FaCircleExclamation } from 'react-icons/fa6';
import { Card, Button } from '../components/ui';

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
    <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 text-text-primary mb-3 shadow-md">
            <FaGraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            CrackPlace AI
          </h1>
          <p className="text-xs text-text-secondary mt-1">Create your candidate profile</p>
        </div>

        <Card className="p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-text-primary">Create Candidate Account</h2>
            <p className="text-xs text-text-secondary mt-0.5">Fill in your academic details to personalize your placement curriculum</p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-brand-error text-xs font-medium">
              <FaCircleExclamation className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Credentials Column */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-brand-primary uppercase tracking-wider">Account Credentials</h3>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">Full Name</label>
                  <div className="relative">
                    <FaUser className="absolute left-3 top-3 text-text-muted w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Alex Mercer"
                      className="pro-input pl-9 py-2.5 text-xs"
                      {...registerField('displayName')}
                    />
                  </div>
                  {errors.displayName && <p className="text-brand-error text-xs mt-1">{errors.displayName.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">Email Address</label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-3 top-3 text-text-muted w-3.5 h-3.5" />
                    <input
                      type="email"
                      placeholder="alex@college.edu"
                      className="pro-input pl-9 py-2.5 text-xs"
                      {...registerField('email')}
                    />
                  </div>
                  {errors.email && <p className="text-brand-error text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">Password</label>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-3 text-text-muted w-3.5 h-3.5" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="pro-input pl-9 py-2.5 text-xs"
                      {...registerField('password')}
                    />
                  </div>
                  {errors.password && <p className="text-brand-error text-xs mt-1">{errors.password.message}</p>}
                </div>
              </div>

              {/* Academic Stats Column */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-brand-accent uppercase tracking-wider">Academic Profile</h3>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">College / Institution</label>
                  <div className="relative">
                    <FaGraduationCap className="absolute left-3 top-3 text-text-muted w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="e.g. IIT Madras, BITS Pilani"
                      className="pro-input pl-9 py-2.5 text-xs"
                      {...registerField('college')}
                    />
                  </div>
                  {errors.college && <p className="text-brand-error text-xs mt-1">{errors.college.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-primary mb-1.5">Department</label>
                    <input
                      type="text"
                      placeholder="CSE, ECE, IT"
                      className="pro-input py-2.5 text-xs"
                      {...registerField('department')}
                    />
                    {errors.department && <p className="text-brand-error text-xs mt-1">{errors.department.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-primary mb-1.5">Academic Year</label>
                    <select
                      className="pro-input py-2.5 text-xs"
                      {...registerField('year', { valueAsNumber: true })}
                    >
                      <option value={1}>1st Year</option>
                      <option value={2}>2nd Year</option>
                      <option value={3}>3rd Year</option>
                      <option value={4}>4th Year</option>
                      <option value={5}>5th Year</option>
                    </select>
                    {errors.year && <p className="text-brand-error text-xs mt-1">{errors.year.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">Target Dream Company</label>
                  <div className="relative">
                    <FaBuilding className="absolute left-3 top-3 text-text-muted w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="e.g. Google, Microsoft, Amazon"
                      className="pro-input pl-9 py-2.5 text-xs"
                      {...registerField('dreamCompany')}
                    />
                  </div>
                  {errors.dreamCompany && <p className="text-brand-error text-xs mt-1">{errors.dreamCompany.message}</p>}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loadingLocal}
              isLoading={loadingLocal}
              className="w-full justify-center py-3 mt-4"
            >
              {loadingLocal ? 'Creating Profile...' : 'Complete Registration'}
            </Button>
          </form>

          {/* Footer Link */}
          <p className="text-center text-xs text-text-secondary mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-primary hover:text-primary-300 transition-colors">
              Sign in here
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Register;

