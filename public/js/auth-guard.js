// js/auth-guard.js
// أدوات بسيطة للتحقق من جلسة المشرف على الواجهة الأمامية.

export const checkAuth = async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user : null;
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
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch { /* تجاهل أخطاء الشبكة */ }
  window.location.href = 'login.html';
};
