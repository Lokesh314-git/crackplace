import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token found. Please sign in again.');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error (${response.status}): ${errText}`);
  }
  
  return response.json();
}

// -------------------------------------------------------------
// Referrals API
// -------------------------------------------------------------

export async function getReferrals() {
  const data = await fetchWithAuth('/api/invite-promote/admin/referrals');
  return data.referrals;
}

// -------------------------------------------------------------
// Promotions (Influencer Submissions) API
// -------------------------------------------------------------

export async function getPromotions() {
  const data = await fetchWithAuth('/api/invite-promote/admin/promotions');
  return data.promotions;
}

export async function reviewPromotion(promotionId: string, payload: {
  status: 'approved' | 'rejected',
  message: string,
  rewardDetails?: {
    coins?: number;
    cosmetics?: string[];
  }
}) {
  const data = await fetchWithAuth(`/api/invite-promote/admin/promotions/${promotionId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data;
}

// -------------------------------------------------------------
// Cash Rewards API
// -------------------------------------------------------------

export async function getCashRewards() {
  const data = await fetchWithAuth('/api/invite-promote/admin/cash-rewards');
  return data.cashRewards;
}

export async function updateCashRewardStatus(rewardId: string, status: string, paymentReference?: string) {
  const data = await fetchWithAuth(`/api/invite-promote/admin/cash-rewards/${rewardId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, paymentReference }),
  });
  return data;
}

// -------------------------------------------------------------
// Additional Admin APIs (Campaign Settings, Audit Logs, Dashboard stats)
// -------------------------------------------------------------

export async function getGrowthDashboardStats() {
  const data = await fetchWithAuth('/api/invite-promote/admin/dashboard');
  return data;
}

export async function getAuditLogs() {
  const data = await fetchWithAuth('/api/invite-promote/admin/audit-logs');
  return data.logs;
}
