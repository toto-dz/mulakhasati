// js/api.js
//
// طبقة الوصول إلى البيانات عبر Supabase مباشرة من المتصفح.
// المتصفح (GitHub Pages) ←→ قاعدة بيانات Supabase (Postgres + Storage).
// لا يوجد خادم وسيط (server.js). الحماية عبر سياسات RLS.

import { supabase } from './supabase.js';

const FEATURED_COLORS = ['primary', 'secondary', 'tertiary', 'neutral'];

let summariesCache = null;

/* ===================== تحويل الصفوف (snake_case ↔ camelCase) ===================== */

const rowToSummary = (row) => ({
  id: String(row.id),
  title: row.title || '',
  description: row.description || '',
  subject: row.subject || '',
  coverPrompt: row.cover_prompt || '',
  section: row.section || '',
  level: row.level || '',
  year: row.year || '',
  pages: Number(row.pages) || 0,
  size: row.size || '',
  author: row.author || '',
  coverImage: row.cover_image || '',
  pageImages: Array.isArray(row.page_images) ? row.page_images : [],
  tags: Array.isArray(row.tags) ? row.tags : [],
  pdfUrl: row.pdf_url || '',
  pdfName: row.pdf_name || '',
  createdAt: row.created_at || '',
  status: row.status || 'منشور'
});

const summaryToRow = (s) => ({
  title: s.title,
  description: s.description || '',
  subject: s.subject,
  cover_prompt: s.coverPrompt || '',
  section: s.section || '',
  level: s.level || '',
  year: s.year || '',
  pages: Number(s.pages) || 0,
  size: s.size || '',
  author: s.author || '',
  cover_image: s.coverImage || '',
  page_images: s.pageImages || [],
  tags: s.tags || [],
  pdf_url: s.pdfUrl || '',
  pdf_name: s.pdfName || '',
  status: s.status || 'منشور'
});

const rowToFeatured = (row) => ({
  id: String(row.id),
  title: row.title || '',
  description: row.description || '',
  coverImage: row.cover_image || '',
  icon: row.icon || 'auto_stories',
  badge: row.badge || '',
  color: FEATURED_COLORS.includes(row.color) ? row.color : 'primary',
  subject: row.subject || ''
});

const featuredToRow = (f) => ({
  title: f.title,
  description: f.description || '',
  cover_image: f.coverImage || '',
  icon: f.icon || 'auto_stories',
  badge: f.badge || '',
  color: f.color || 'primary',
  subject: f.subject || ''
});

/* ===================== رفع الملفات إلى Storage ===================== */

const dataUrlToBlob = (dataUrl) => {
  const match = String(dataUrl).match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('صيغة الملف غير مدعومة.');
  const mime = match[1] || 'application/octet-stream';
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const safeFileName = (name) => String(name || 'file')
  .replace(/[^\w.\-\u0600-\u06FF]+/g, '-')
  .toLowerCase();

const uploadDataUrl = async (bucket, path, dataUrl) => {
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: blob.type, upsert: true, cacheControl: '3600' });
  if (error) throw new Error(error.message || 'فشل رفع الملف.');
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

const newId = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

/* ===================== الملخصات (Summaries) ===================== */

export const initializeSummaries = async ({ force = false } = {}) => {
  if (summariesCache && !force) return summariesCache;
  const { data, error } = await supabase
    .from('summaries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'تعذر تحميل البيانات.');
  summariesCache = (data || []).map(rowToSummary);
  return summariesCache;
};

export const getAllSummaries = async ({ force = false } = {}) => {
  const summaries = await initializeSummaries({ force });
  return summaries.slice();
};

export const getSummaryById = async (id) => {
  if (!id) return null;
  const { data, error } = await supabase
    .from('summaries')
    .select('*')
    .eq('id', Number(id))
    .maybeSingle();
  if (error) throw new Error(error.message || 'تعذر تحميل الملخص.');
  return data ? rowToSummary(data) : null;
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

const processPageImages = async (id, pageImages = []) => {
  const urls = await Promise.all((pageImages || []).map(async (page) => {
    if (typeof page === 'string') return page; // رابط موجود سابقًا
    if (page && page.data) {
      const path = `${id}/${Date.now()}-${safeFileName(page.name)}`;
      return uploadDataUrl('pages', path, page.data);
    }
    return '';
  }));
  return urls.filter(Boolean);
};

export const addSummary = async (payload) => {
  const id = newId();
  const pageImages = await processPageImages(id, payload.pageImages);

  let coverImage = '';
  if (payload.coverData) {
    coverImage = await uploadDataUrl('covers', `${id}/${Date.now()}-${safeFileName(payload.coverName || 'cover.webp')}`, payload.coverData);
  } else if (payload.coverFromPageUrl) {
    coverImage = payload.coverFromPageUrl;
  } else if (pageImages[0]) {
    coverImage = pageImages[0];
  }

  let pdfUrl = '';
  let pdfName = '';
  let size = '';
  if (payload.pdfData) {
    pdfUrl = await uploadDataUrl('pdfs', `${id}/${Date.now()}-${safeFileName(payload.pdfName || 'file.pdf')}`, payload.pdfData);
    pdfName = payload.pdfName || '';
    size = payload.size || '';
  }

  const row = summaryToRow({
    title: payload.title,
    subject: payload.subject,
    status: payload.status,
    description: payload.description,
    coverPrompt: payload.coverPrompt,
    section: payload.section,
    level: payload.level,
    year: payload.year,
    tags: payload.tags,
    pageImages,
    coverImage,
    pages: pageImages.length,
    pdfUrl,
    pdfName,
    size,
    author: ''
  });

  const { data, error } = await supabase.from('summaries').insert(row).select().single();
  if (error) throw new Error(error.message || 'فشل إضافة الملخص.');
  summariesCache = null;
  return rowToSummary(data);
};

export const updateSummary = async (id, payload) => {
  const numericId = Number(id);
  const pageImages = await processPageImages(id, payload.pageImages);

  const update = summaryToRow({
    title: payload.title,
    subject: payload.subject,
    status: payload.status,
    description: payload.description,
    coverPrompt: payload.coverPrompt,
    section: payload.section,
    level: payload.level,
    year: payload.year,
    tags: payload.tags,
    pageImages,
    pages: pageImages.length
  });

  if (payload.coverData) {
    update.cover_image = await uploadDataUrl('covers', `${id}/${Date.now()}-${safeFileName(payload.coverName || 'cover.webp')}`, payload.coverData);
  } else if (payload.coverFromPageUrl) {
    update.cover_image = payload.coverFromPageUrl;
  }

  if (payload.pdfData) {
    update.pdf_url = await uploadDataUrl('pdfs', `${id}/${Date.now()}-${safeFileName(payload.pdfName || 'file.pdf')}`, payload.pdfData);
    update.pdf_name = payload.pdfName || '';
    update.size = payload.size || '';
  }

  const { data, error } = await supabase
    .from('summaries')
    .update(update)
    .eq('id', numericId)
    .select()
    .single();
  if (error) throw new Error(error.message || 'فشل تعديل الملخص.');
  summariesCache = null;
  return rowToSummary(data);
};

export const deleteSummary = async (id) => {
  const { error } = await supabase.from('summaries').delete().eq('id', Number(id));
  if (error) throw new Error(error.message || 'فشل حذف الملخص.');
  summariesCache = null;
  return { ok: true };
};

/* ===================== كروت الصفحة الرئيسية (Featured) ===================== */

export const getFeaturedCards = async () => {
  const { data, error } = await supabase.from('featured').select('*').order('id');
  if (error) throw new Error(error.message || 'تعذر تحميل الكروت.');
  return (data || []).map(rowToFeatured);
};

export const addFeaturedCard = async (payload) => {
  const id = newId();
  let coverImage = payload.coverImage || '';
  if (payload.coverData) {
    coverImage = await uploadDataUrl('covers', `${id}/${Date.now()}-${safeFileName(payload.coverName || 'cover.webp')}`, payload.coverData);
  }
  const { data, error } = await supabase
    .from('featured')
    .insert(featuredToRow({ ...payload, coverImage }))
    .select()
    .single();
  if (error) throw new Error(error.message || 'فشل إضافة الكارت.');
  return rowToFeatured(data);
};

export const updateFeaturedCard = async (id, payload) => {
  const update = featuredToRow(payload);
  if (payload.coverData) {
    update.cover_image = await uploadDataUrl('covers', `${id}/${Date.now()}-${safeFileName(payload.coverName || 'cover.webp')}`, payload.coverData);
  }
  const { data, error } = await supabase
    .from('featured')
    .update(update)
    .eq('id', Number(id))
    .select()
    .single();
  if (error) throw new Error(error.message || 'فشل تعديل الكارت.');
  return rowToFeatured(data);
};

export const deleteFeaturedCard = async (id) => {
  const { error } = await supabase.from('featured').delete().eq('id', Number(id));
  if (error) throw new Error(error.message || 'فشل حذف الكارت.');
  return { ok: true };
};
