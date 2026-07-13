// js/auth.js
//
// مصادقة المشرفين عبر Supabase Auth (Email/Password).
// الجلسة تُدار في المتصفح بواسطة Supabase وتُحمى الصفحات عبر التحقق من المستخدم.

import { supabase } from './supabase.js';

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message || 'فشل تسجيل الدخول.');
  if (!data.user) throw new Error('فشل تسجيل الدخول.');
  return data.user;
};

export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message || 'فشل إنشاء الحساب.');
  return data.user;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message || 'فشل تسجيل الخروج.');
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user || null;
};
