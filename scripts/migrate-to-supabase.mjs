// scripts/migrate-to-supabase.mjs
//
// ينقل البيانات المحلية (data/*.json + images/ + pdf/) إلى Supabase.
// يستخدم مفتاح service_role (يقرأ من .env) ويُنشئ الـ buckets إن لم تكن موجودة.
//
// التشغيل:
//   1) شغّل sql/schema.sql في Supabase SQL Editor.
//   2) ضع SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في ملف .env
//   3) npm install
//   4) npm run migrate
//
// ملاحظة: المفاتيح (id) تُولَّد من جديد في Supabase؛ روابط الصور/PDF تُحوَّل
// إلى روابط عامة في Storage. إن أردت الحفاظ على نفس المعرّفات عدّل جدول
// summaries ليستخدم text primary key بدل identity.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبان في ملف .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const readJson = (file) => {
  const path = join(root, 'data', file);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8'));
};

const ensureBucket = async (id) => {
  const { data } = await supabase.storage.getBucket(id).catch(() => ({ data: null }));
  if (data) return;
  await supabase.storage.createBucket(id, { public: true });
  console.log(`✔ تم إنشاء الـ bucket: ${id}`);
};

const uploadLocal = async (bucket, id, relPath) => {
  // relPath مثل "./images/abc.webp"
  const clean = String(relPath).replace(/^\.?\//, '');
  const filePath = join(root, clean);
  if (!existsSync(filePath)) return relPath;
  const ext = clean.split('.').pop();
  const base = clean.split('/').pop();
  const storagePath = `${id}/${Date.now()}-${base}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, readFileSync(filePath), { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });
  if (error) throw new Error(`فشل رفع ${clean}: ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
};

const isLocalImage = (v) => /^\.\/images\/[\w.\-\u0600-\u06FF]+$/u.test(String(v || ''));
const isLocalPdf = (v) => /^\.\/pdf\/[\w.\-\u0600-\u06FF]+$/u.test(String(v || ''));

const migrateSummaries = async () => {
  const summaries = readJson('summaries.json');
  console.log(`\n📚 نقل ${summaries.length} ملخص...`);
  let ok = 0;
  for (const s of summaries) {
    const id = String(s.id);
    const pageImages = [];
    for (const p of (s.pageImages || [])) {
      if (isLocalImage(p)) pageImages.push(await uploadLocal('pages', id, p));
      else pageImages.push(p);
    }
    const coverImage = isLocalImage(s.coverImage)
      ? await uploadLocal('covers', id, s.coverImage)
      : (s.coverImage || '');
    const pdfUrl = isLocalPdf(s.pdfUrl) ? await uploadLocal('pdfs', id, s.pdfUrl) : (s.pdfUrl || '');

    const { error } = await supabase.from('summaries').insert({
      title: s.title || '',
      description: s.description || '',
      subject: s.subject || '',
      cover_prompt: s.coverPrompt || '',
      section: s.section || '',
      level: s.level || '',
      year: s.year || '',
      pages: Number(s.pages) || pageImages.length,
      size: s.size || '',
      author: s.author || '',
      cover_image: coverImage,
      page_images: pageImages,
      tags: s.tags || [],
      pdf_url: pdfUrl,
      pdf_name: s.pdfName || '',
      status: s.status || 'منشور',
      created_at: s.createdAt || new Date().toISOString()
    });
    if (error) console.error(`  ✗ ${id}: ${error.message}`);
    else { ok += 1; console.log(`  ✔ ${id} - ${s.title}`); }
  }
  console.log(`✅ تم نقل ${ok}/${summaries.length} ملخص.`);
};

const migrateFeatured = async () => {
  const cards = readJson('featured.json');
  console.log(`\n🃏 نقل ${cards.length} كارت...`);
  let ok = 0;
  for (const c of cards) {
    const id = String(c.id);
    const coverImage = isLocalImage(c.coverImage)
      ? await uploadLocal('covers', id, c.coverImage)
      : (c.coverImage || '');
    const { error } = await supabase.from('featured').insert({
      title: c.title || '',
      description: c.description || '',
      cover_image: coverImage,
      icon: c.icon || 'auto_stories',
      badge: c.badge || '',
      color: c.color || 'primary',
      subject: c.subject || ''
    });
    if (error) console.error(`  ✗ ${id}: ${error.message}`);
    else { ok += 1; console.log(`  ✔ ${id} - ${c.title}`); }
  }
  console.log(`✅ تم نقل ${ok}/${cards.length} كارت.`);
};

const migrateSettings = async () => {
  const settings = readJson('settings.json');
  const key = settings?.openrouter?.apiKey || '';
  const model = settings?.openrouter?.model || '';
  if (!key) {
    console.log('\n⏭️ لا يوجد مفتاح OpenRouter في settings.json (تم التجاوز).');
    return;
  }
  // يحتاج المستخدم إلى وجود مشرف في auth.users؛ استبدله بمعرّف المستخدم المناسب.
  const adminId = process.env.SUPABASE_ADMIN_USER_ID;
  if (!adminId) {
    console.log('\n⏭️ لتفعيل OpenRouter عبر الواجهة، أنشئ مستخدمًا في Supabase Auth ثم\n   شغّل السكربت مع SUPABASE_ADMIN_USER_ID=<uuid> في .env (أو أضف المفتاح يدويًا من صفحة الإعدادات).');
    return;
  }
  const { error } = await supabase.from('settings').upsert(
    { user_id: adminId, openrouter_key: key, openrouter_model: model },
    { onConflict: 'user_id' }
  );
  if (error) console.error(`✗ إعدادات: ${error.message}`);
  else console.log('✔ تم نقل إعدادات OpenRouter.');
};

const main = async () => {
  await ensureBucket('covers');
  await ensureBucket('pages');
  await ensureBucket('pdfs');
  await migrateSummaries();
  await migrateFeatured();
  await migrateSettings();
  console.log('\n🎉 اكتمل النقل. عدّل public/js/supabase-config.js ثم انشر الموقع.');
};

main().catch((err) => {
  console.error('❌ فشل النقل:', err);
  process.exit(1);
});
