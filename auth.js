// auth.js
//
// نظام مصادقة بسيط للمشرفين (جلسات مبنية على ملف تعريف ارتباط + رمز عشوائي).
// - كلمة المرور تُحفظ مُجزّأة (scrypt) في data/admin.json.
// - الجلسات محفوظة في الذاكرة (تُمسح عند إعادة تشغيل الخادم).
// - لوحة التحكم وصفحة الإعدادات وواجهات التعديل محميّة؛ صفحات العرض مفتوحة.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = __dirname;
const adminFile = path.join(rootDir, 'data', 'admin.json');
const ADMIN_COOKIE = 'admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 ساعة

// جلسات نشطة: token -> { username, createdAt }
const sessions = new Map();

const hashPassword = (password, salt) => crypto.scryptSync(String(password), salt, 64).toString('hex');

const ensureAdminFile = () => {
  if (fs.existsSync(adminFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
      if (data && data.username && data.salt && data.passwordHash) return data;
    } catch { /* أعد الإنشاء */ }
  }

  const username = 'admin';
  const password = 'admin123';
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const payload = { username, salt, passwordHash };
  fs.mkdirSync(path.dirname(adminFile), { recursive: true });
  fs.writeFileSync(adminFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log('\n🔐 تم إنشاء حساب مشرف افتراضي:');
  console.log(`   اسم المستخدم: ${username}`);
  console.log(`   كلمة المرور:  ${password}`);
  console.log('   (يمكنك تغييرها لاحقًا من صفحة إعدادات AI أو بحذف data/admin.json)\n');
  return payload;
};

let admin = ensureAdminFile();

const verifyCredentials = (username, password) => {
  if (!username || !password) return false;
  if (username.trim() !== admin.username) return false;
  const hash = hashPassword(password, admin.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(admin.passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const changePassword = (newPassword) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword, salt);
  admin = { username: admin.username, salt, passwordHash };
  fs.writeFileSync(adminFile, `${JSON.stringify(admin, null, 2)}\n`, 'utf8');
};

const createSession = (username) => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, createdAt: Date.now() });
  return token;
};

const getSession = (token) => {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return session;
};

const destroySession = (token) => {
  if (token) sessions.delete(token);
};

const parseCookies = (req) => {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
};

const getRequestToken = (req) => parseCookies(req)[ADMIN_COOKIE] || '';

const sessionCookie = (token) => {
  if (token) {
    return `${ADMIN_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  }
  return `${ADMIN_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
};

const sessionFromRequest = (req) => getSession(getRequestToken(req));

const PROTECTED_PAGES = ['/admin.html', '/ai-settings.html'];

const isProtectedPage = (pathname) => PROTECTED_PAGES.includes(pathname);

module.exports = {
  ADMIN_COOKIE,
  verifyCredentials,
  changePassword,
  createSession,
  getSession,
  destroySession,
  getRequestToken,
  sessionFromRequest,
  sessionCookie,
  isProtectedPage
};
