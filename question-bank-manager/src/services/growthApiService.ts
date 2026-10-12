import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://crackplace-backend-lfs5.onrender.com';

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
  
  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error: any) {
    throw new Error(`Network error: Failed to connect to backend (${API_URL}). Make sure the backend is running. Details: ${error.message}`);
  }
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Your session may have expired. Please sign in again.');
    } else if (response.status === 403) {
      throw new Error('Forbidden: You do not have permission to perform this action.');
    } else if (response.status === 404) {
      throw new Error(`Not Found: The requested endpoint (${endpoint}) does not exist on the backend.`);
    }

    let errText = '';
    try {
      const errData = await response.json();
      errText = errData.error || errData.message || JSON.stringify(errData);
    } catch {
      errText = await response.text();
    }
    throw new Error(`API error (${response.status}): ${errText}`);
  }
  
  return response.json();
}

// -------------------------------------------------------------
// Referrals API
// -------------------------------------------------------------

export async function getReferrals() {
  try {
    const data = await fetchWithAuth('/api/invite-promote/admin/referrals');
    return data.referrals || [];
  } catch (err: any) {
    console.warn(`Referrals fetch unavailable (${err.message}). Returning empty fallback.`);
    return [];
  }
}

// -------------------------------------------------------------
// Promotions (Influencer Submissions) API
// -------------------------------------------------------------

export async function getPromotions() {
  try {
    const data = await fetchWithAuth('/api/invite-promote/admin/promotions');
    return data.promotions || [];
  } catch (err: any) {
    console.warn(`Promotions fetch unavailable (${err.message}). Returning empty fallback.`);
    return [];
  }
}

export async function reviewPromotion(promotionId: string, payload: {
  status: 'approved' | 'rejected',
  message: string,
  rewardDetails?: {
    coins?: number;
    cosmeticIds?: string[];
    cashAmount?: number;
    currency?: string;
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
  try {
    const data = await fetchWithAuth('/api/invite-promote/admin/cash-rewards');
    return data.cashRewards || [];
  } catch (err: any) {
    console.warn(`Cash rewards fetch unavailable (${err.message}). Returning empty fallback.`);
    return [];
  }
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
  try {
    const data = await fetchWithAuth('/api/invite-promote/admin/dashboard');
    return data;
  } catch (err: any) {
    console.warn(`Growth dashboard stats unavailable (${err.message}). Returning fallback stats.`);
    return {
      totalReferrals: 0,
      completedReferrals: 0,
      pendingReferrals: 0,
      totalPromotions: 0,
      pendingPromotions: 0,
      approvedPromotions: 0,
      pendingCashPayments: 0,
      completedCashPayments: 0,
      totalCoinsIssued: 0,
      recentActivity: [],
      warning: err.message
    };
  }
}

export async function getAuditLogs() {
  try {
    const data = await fetchWithAuth('/api/invite-promote/admin/audit-logs');
    return data.logs || [];
  } catch (err: any) {
    console.warn(`Audit logs fetch unavailable (${err.message}). Returning empty fallback.`);
    return [];
  }
}

