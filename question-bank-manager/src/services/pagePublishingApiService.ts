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
    let errText = '';
    try {
      const errData = await response.json();
      errText = errData.error || errData.message || JSON.stringify(errData);
    } catch {
      errText = await response.text();
    }
    throw new Error(errText || `API error (${response.status})`);
  }
  
  return response.json();
}

export type PagePublishingStatus = 'coming_soon' | 'published';

export interface PageAdminMetadata {
  pageKey: string;
  name: string;
  route: string;
  status: PagePublishingStatus;
  updatedAt: string;
  updatedBy: string;
}

export async function getAdminPagePublishingList(): Promise<PageAdminMetadata[]> {
  const data = await fetchWithAuth('/api/admin/page-publishing');
  return data.pages || [];
}

export async function updateAdminPagePublishingStatus(
  pageKey: string,
  status: PagePublishingStatus
): Promise<{ success: boolean; message: string; page: PageAdminMetadata }> {
  return fetchWithAuth(`/api/admin/page-publishing/${pageKey}`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });
}
