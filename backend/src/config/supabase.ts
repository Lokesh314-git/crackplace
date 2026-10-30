import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const rawKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !rawUrl.includes('your-project') &&
  !rawUrl.includes('aawftejiuvqjbqouffij') &&
  process.env.NODE_ENV !== 'test'
);

const supabaseUrl = rawUrl || 'https://aawftejiuvqjbqouffij.supabase.co';
const supabaseKey = rawKey || 'sb_publishable_BYAvIZkEinqOYqnxUUhiGg_KRpqmxhK';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    fetch: (url, options: any = {}) => {
      const timeoutMs = process.env.NODE_ENV === 'test' ? 800 : 1500;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      if (options?.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }
      return fetch(url, {
        ...options,
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));
    }
  }
});

export default supabase;
