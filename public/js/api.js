const JSON_PATH = './data/summaries.json';
const API_BASE = '/api/summaries';

let summariesCache = null;

const normalizeSummary = (item) => ({
  id: String(item.id),
  title: item.title || '',
  description: item.description || '',
  subject: item.subject || '',
  coverPrompt: item.coverPrompt || '',
  section: item.section || '',
  level: item.level || '',
  year: item.year || '',
  pages: Number(item.pages) || 0,
  size: item.size || '',
  author: item.author || '',
  coverImage: item.coverImage || '',
  pageImages: Array.isArray(item.pageImages) ? item.pageImages : [],
  tags: Array.isArray(item.tags) ? item.tags : [],
  pdfUrl: item.pdfUrl || '',
  pdfName: item.pdfName || '',
  createdAt: item.createdAt || '',
  status: item.status || 'منشور'
});

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body instanceof FormData || options.body == null ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = 'تعذر تحميل البيانات.';
    try {
      const error = await response.json();
      message = error.message || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  return response.json();
};

/**
 * تحديد ما إذا كنا نعمل عبر خادم HTTP (وليس فتح الملف مباشرة)
 */
const isServerMode = () => window.location.protocol !== 'file:';

/**
 * تحميل البيانات: من API إن كنا على الخادم، أو من JSON مباشرة إن كنا في وضع الملف
 */
export const initializeSummaries = async ({ force = false } = {}) => {
  if (summariesCache && !force) return summariesCache;

  let data;
  if (isServerMode()) {
    // وضع الخادم: جرّب API endpoint، ومع عدم توفّره ارتك إلى ملف JSON المحلي
    try {
      data = await requestJson(`${API_BASE}?v=${Date.now()}`);
    } catch {
      data = await requestJson(`${JSON_PATH}?v=${Date.now()}`);
    }
  } else {
    // وضع الملف المباشر: اقرأ من JSON
    data = await requestJson(`${JSON_PATH}?v=${Date.now()}`);
  }

  if (!Array.isArray(data)) throw new Error('ملف summaries.json غير صالح.');
  summariesCache = data.map(normalizeSummary);
  return summariesCache;
};

export const getAllSummaries = async ({ force = false } = {}) => {
  const summaries = await initializeSummaries({ force });
  return summaries.slice();
};

export const getSummaryById = async (id) => {
  if (!id) return null;
  const summaries = await getAllSummaries();
  return summaries.find((item) => String(item.id) === String(id)) || null;
};

export const getSummaryOptions = async () => {
  const summaries = await getAllSummaries();
  const subjects = Array.from(new Set(summaries.map((item) => item.subject).filter(Boolean))).sort();
  const levels = Array.from(new Set(summaries.map((item) => item.level).filter(Boolean))).sort();
  const years = Array.from(new Set(summaries.map((item) => item.year).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
  return { subjects, levels, years, summaries };
};

export const getSimilarSummaries = async (summary, limit = 3) => {
  const summaries = await getAllSummaries();
  return summaries
    .filter((item) => String(item.id) !== String(summary.id))
    .sort((a, b) => {
      const sameSubject = Number(b.subject === summary.subject) - Number(a.subject === summary.subject);
      const sameLevel = Number(b.level === summary.level) - Number(a.level === summary.level);
      return sameSubject || sameLevel;
    })
    .slice(0, limit);
};

export const addSummary = async (formData) => {
  if (!isServerMode()) throw new Error('يجب تشغيل المشروع عبر الخادم لإضافة ملخصات.');
  const created = await requestJson(API_BASE, { method: 'POST', body: formData });
  summariesCache = null;
  return normalizeSummary(created);
};

export const updateSummary = async (id, formData) => {
  if (!isServerMode()) throw new Error('يجب تشغيل المشروع عبر الخادم لتعديل الملخصات.');
  const updated = await requestJson(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: formData });
  summariesCache = null;
  return normalizeSummary(updated);
};

export const deleteSummary = async (id) => {
  if (!isServerMode()) throw new Error('يجب تشغيل المشروع عبر الخادم لحذف الملخصات.');
  const result = await requestJson(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  summariesCache = null;
  return result;
};

const FEATURED_PATH = './data/featured.json';
const FEATURED_BASE = '/api/featured';

const FEATURED_COLORS = ['primary', 'secondary', 'tertiary', 'neutral'];

const normalizeFeatured = (item) => ({
  id: String(item.id),
  title: item.title || '',
  description: item.description || '',
  coverImage: item.coverImage || '',
  icon: item.icon || 'auto_stories',
  badge: item.badge || '',
  color: FEATURED_COLORS.includes(item.color) ? item.color : 'primary',
  subject: item.subject || ''
});

export const getFeaturedCards = async () => {
  let data;
  if (isServerMode()) {
    try {
      data = await requestJson(`${FEATURED_BASE}?v=${Date.now()}`);
    } catch {
      data = await requestJson(`${FEATURED_PATH}?v=${Date.now()}`);
    }
  } else {
    data = await requestJson(`${FEATURED_PATH}?v=${Date.now()}`);
  }
  if (!Array.isArray(data)) return [];
  return data.map(normalizeFeatured);
};

export const addFeaturedCard = async (payload) => {
  if (!isServerMode()) throw new Error('يجب تشغيل المشروع عبر الخادم لإضافة الكروت.');
  const created = await requestJson(FEATURED_BASE, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return normalizeFeatured(created);
};

export const updateFeaturedCard = async (id, payload) => {
  if (!isServerMode()) throw new Error('يجب تشغيل المشروع عبر الخادم لتعديل الكروت.');
  const updated = await requestJson(`${FEATURED_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  return normalizeFeatured(updated);
};

export const deleteFeaturedCard = async (id) => {
  if (!isServerMode()) throw new Error('يجب تشغيل المشروع عبر الخادم لحذف الكروت.');
  return requestJson(`${FEATURED_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
};
