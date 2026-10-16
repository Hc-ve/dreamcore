// ============================================================
// js/api/supabase-client.js — Supabase 客户端（云数据库入口）
// 环境变量：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（.env）
// anon key 是公开的，安全由 RLS 行级策略保证
// ============================================================
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseEnabled = !!(url && key);
export const supabase = supabaseEnabled
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
