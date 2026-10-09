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
    throw new Error(`Network error: Failed to connect to backend (${API_URL}). Details: ${error.message}`);
  }
  
  if (!response.ok) {
    let errText = '';
    try {
      const errData = await response.json();
      errText = errData.error || errData.message || JSON.stringify(errData);
    } catch {
      errText = await response.text();
    }
    throw new Error(errText);
  }
  
  return response.json();
}

export async function getUsers(page = 1, limit = 20, search = '', status = '') {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
    status
  });
  return fetchWithAuth(`/api/admin/users?${query.toString()}`);
}

export async function getUserDetails(uid: string) {
  return fetchWithAuth(`/api/admin/users/${uid}`);
}

export async function blockUser(uid: string, blocked: boolean, reason: string, internalNote: string) {
  return fetchWithAuth(`/api/admin/users/${uid}/block`, {
    method: 'POST',
    body: JSON.stringify({ blocked, reason, internalNote })
  });
}

export async function deleteUser(uid: string, reason: string, confirmationPhrase: string) {
  return fetchWithAuth(`/api/admin/users/${uid}/delete`, {
    method: 'POST',
    body: JSON.stringify({ reason, confirmationPhrase })
  });
}
