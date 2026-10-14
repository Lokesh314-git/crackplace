import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://crackplace-backend-lfs5.onrender.com';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token found. Please sign in as an admin.');
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
    throw new Error(`Network error: Failed to connect to backend (${API_URL}). Details: ${error.message}`);
  }
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Admin session expired or token missing. Please re-authenticate.');
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Your account does not have administrator privileges to manage season settings.');
    }
    if (response.status === 404) {
      throw new Error('Endpoint not found (404). Render backend deployment may still be building or updating.');
    }
    if (response.status === 502 || response.status === 503) {
      throw new Error(`Backend unavailable (${response.status}). Render instance may be waking up from cold sleep. Please wait a few seconds and retry.`);
    }

    let errText = '';
    const rawText = await response.text().catch(() => '');
    if (rawText) {
      try {
        const errData = JSON.parse(rawText);
        errText = errData.error || errData.message || JSON.stringify(errData);
      } catch {
        errText = rawText;
      }
    }
    throw new Error(errText || `API error (${response.status})`);
  }
  
  return response.json();
}

export interface SeasonSettings {
  decayEnabled: boolean;
  reductionPercentage: number;
  minFloor: number;
  timezone: string;
  configuredAt?: string;
  configuredBy?: string;
}

export interface ActiveSeasonInfo {
  seasonId: string;
  seasonNumber: number;
  startDate: string;
  endDate: string;
  nextResetTimestamp: string;
  timeRemainingMs: number;
  reductionPercentage: number;
  decayEnabled: boolean;
  timezone: string;
}

export interface SeasonHistoryItem {
  seasonId: string;
  seasonNumber?: number;
  status: string;
  reductionPercentage: number;
  playersProcessed: number;
  resetCompletedAt?: string;
  updatedAt?: string;
  error?: string;
}

export interface SeasonAdminData {
  settings: SeasonSettings;
  activeSeason: ActiveSeasonInfo;
  history: SeasonHistoryItem[];
}

export async function getSeasonAdminData(): Promise<SeasonAdminData> {
  return fetchWithAuth('/api/admin/seasons/settings');
}

export async function updateSeasonSettings(payload: {
  decayEnabled: boolean;
  reductionPercentage: number;
  minFloor: number;
}): Promise<{ message: string; settings: SeasonSettings }> {
  return fetchWithAuth('/api/admin/seasons/settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function triggerSeasonReset(): Promise<{ message: string; result: any }> {
  return fetchWithAuth('/api/admin/seasons/trigger-reset', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
