// js/auth-guard.js
// أدوات بسيطة للتحقق من جلسة المشرف على الواجهة الأمامية عبر Supabase Auth.

import { getCurrentUser, signOut } from './auth.js';

export const checkAuth = async () => {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
};

// يوجّه غير المسجّلين إلى صفحة تسجيل الدخول ويعيد بيانات المستخدم إن كان مسجّلاً.
export const requireAdmin = async () => {
  const user = await checkAuth();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
};

export const logout = async () => {
  try {
    await signOut();
  } catch { /* تجاهل أخطاء الشبكة */ }
  window.location.href = 'login.html';
};
