// public/services/aiService.js
//
// طبقة خدمات الذكاء الاصطناعي (OpenRouter) + إعداداته المخزّنة في Supabase.
//
// بما أنه لا يوجد خادم وسيط، يُقرأ مفتاح OpenRouter من جدول `settings` في Supabase
// (محمي بـ RLS: كل مستخدم يرى إعداداته فقط) ثم يُرسَل الطلب مباشرة إلى OpenRouter
// من المتصفح. المفتاح يظهر فقط للمشرف المسجّل.

import { supabase } from '../js/supabase.js';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const AI_TIMEOUT = 50000;

/**
 * قائمة النماذج المقترحة للاختيار داخل لوحة الإدارة.
 */
export const AI_MODELS = [
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
  { id: 'qwen/qwen3-235b-a22b', label: 'Qwen 3' }
];

/* ===================== إعدادات OpenRouter (Supabase) ===================== */

const currentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
};

export const getSettings = async () => {
  const userId = await currentUserId();
  if (!userId) return { apiKey: '', model: '' };
  const { data, error } = await supabase
    .from('settings')
    .select('openrouter_key, openrouter_model')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message || 'تعذر تحميل الإعدادات.');
  return { apiKey: data?.openrouter_key || '', model: data?.openrouter_model || '' };
};

export const saveSettings = async ({ apiKey, model }) => {
  const userId = await currentUserId();
  if (!userId) throw new Error('غير مصرّح. سجّل الدخول أولًا.');
  const { error } = await supabase
    .from('settings')
    .upsert(
      { user_id: userId, openrouter_key: apiKey || '', openrouter_model: model || '' },
      { onConflict: 'user_id' }
    );
  if (error) throw new Error(error.message || 'فشل حفظ الإعدادات.');
  return { ok: true };
};

export const fetchOpenRouterModels = async (apiKey) => {
  if (!apiKey) throw new Error('مفتاح OpenRouter مطلوب لجلب النماذج.');
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`فشل جلب النماذج: ${response.status} ${text}`);
  }
  return response.json();
};

export const testOpenRouterConnection = async () => {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new Error('مفتاح OpenRouter غير مُهيأ.');
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1
    })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message || 'فشل الاتصال بـ OpenRouter.');
  }
  return { ok: true };
};

/* ===================== الذكاء الاصطناعي ===================== */

const resolveConfig = async (options = {}) => {
  const { apiKey, model } = await getSettings();
  return { apiKey, model: options.model || model || '' };
};

const buildMetaBlock = (content) => {
  const lines = [];
  if (content.title) lines.push(`العنوان الحالي/المقترح: ${content.title}`);
  if (content.subject) lines.push(`المادة أو التصنيف: ${content.subject}`);
  if (content.pdfName) lines.push(`اسم ملف PDF المرفق: ${content.pdfName}`);
  if (content.text) lines.push(`نص مستخرج من الملخص:\n${content.text}`);
  if (!lines.length) return '';
  return `\n\nمعلومات متوفرة عن الملخص:\n${lines.join('\n')}`;
};

const extractJson = (raw) => {
  let text = String(raw).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text);
};

const callOpenRouter = async (prompt, { images = [], model = '', apiKey = '' } = {}) => {
  if (!prompt || !prompt.trim()) throw new Error('تعذّر إرسال طلب فارغ إلى الذكاء الاصطناعي.');
  if (!apiKey) throw new Error('مفتاح OpenRouter غير مُهيأ. أضفه من صفحة إعدادات AI.');
  if (!model) throw new Error('لم يتم تحديد نموذج. اختر نموذجًا في إعدادات AI.');

  const imageList = Array.isArray(images)
    ? images.filter((img) => typeof img === 'string' && img.trim()).map((img) => img.trim())
    : [];

  const userContent = imageList.length
    ? [{ type: 'text', text: prompt.trim() }, ...imageList.map((url) => ({ type: 'image_url', image_url: { url } }))]
    : prompt.trim();

  let response;
  try {
    response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.trim(),
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 1200
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT)
    });
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي.');
    }
    throw new Error('تعذّر الاتصال بخدمة الذكاء الاصطناعي. تأكد من إعدادات OpenRouter.');
  }

  if (!response.ok) {
    let message = 'تعذّر الحصول على نتيجة من الذكاء الاصطناعي.';
    try {
      const data = await response.json();
      if (data?.error?.message) message = data.error.message;
    } catch { /* تجاهل */ }
    throw new Error(message);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const text = typeof content === 'string' ? content.trim() : String(content).trim();
  if (!text) throw new Error('لم يُرجع الذكاء الاصطناعي أي نتيجة.');
  return text;
};

export const generateTitle = async (content = {}, options = {}) => {
  const cfg = await resolveConfig(options);
  const meta = buildMetaBlock(content);
  const prompt = `أنت مساعد لتوليد محتوى تعليمي عربي. بناءً على محتوى الملخص التالي (صور الصفحات أو ملف PDF أو العنوان/المادة المتوفرة)، اقترح عنوانًا احترافيًا قصيرًا وجذابًا.
الشروط:
- بين 4 و8 كلمات.
- باللغة العربية.
- واضح ومختصر وخالٍ من المبالغة.
- بدون علامات اقتباس أو رموز أو شرح إضافي.
أعد العنوان فقط.${meta}${content.images?.length ? '\n\nالصور المرفقة تمثل صفحات الملخص.' : ''}`;
  const result = await callOpenRouter(prompt, { images: content.images, model: cfg.model, apiKey: cfg.apiKey });
  return result.replace(/^["'«]|["'»]$/g, '').trim();
};

export const generateDescription = async (content = {}, options = {}) => {
  const cfg = await resolveConfig(options);
  const meta = buildMetaBlock(content);
  const prompt = `أنت كاتب محتوى SEO عربي محترف. اكتب وصفًا احترافيًا للملخص التعليمي بناءً على محتواه.
الشروط:
- بين 60 و120 كلمة.
- يركّز على محتوى الملخص فعليًا.
- مناسب لمحركات البحث (SEO) ويحتوي على كلمات مفتاحية ذات صلة.
- خالٍ من المبالغة والمعلومات غير الموجودة في المحتوى.
- باللغة العربية.
أعد الوصف فقط دون عنوان أو تعليق.${meta}${content.images?.length ? '\n\nالصور المرفقة تمثل صفحات الملخص.' : ''}`;
  return callOpenRouter(prompt, { images: content.images, model: cfg.model, apiKey: cfg.apiKey });
};

export const generateCoverPrompt = async (content = {}, options = {}) => {
  const cfg = await resolveConfig(options);
  const meta = buildMetaBlock(content);
  const prompt = `You are a professional cover image designer. Analyze the following educational summary content and write a professional image-generation prompt (in English) for a cover image.
Requirements:
- Modern, professional, and suitable for an educational website.
- NO text, letters, numbers, or words inside the image.
- Relies on topic-related icons, illustrations, and graphics.
- Aspect ratio 16:9.
- Return ONLY the prompt in English, without explanation or quotes.${meta}${content.images?.length ? '\n\nThe attached images represent the summary pages.' : ''}`;
  const result = await callOpenRouter(prompt, { images: content.images, model: cfg.model, apiKey: cfg.apiKey });
  return result.replace(/^["']|["']$/g, '').trim();
};

export const suggestCategory = async (content = {}, options = {}) => {
  const cfg = await resolveConfig(options);
  const meta = buildMetaBlock(content);
  const prompt = `أنت مصنّف محتوى تعليمي. حلل محتوى الملخص واقترح التصنيف المناسب.
أعد النتيجة حصرًا بصيغة JSON بهذا الشكل بالضبط (بدون علامات \`\`\`):
{"subject":"المادة","section":"القسم أو الشعبة","level":"المستوى الدراسي","year":"السنة الدراسية إن وُجدت وإلا سلسلة فارغة","tags":["وسم1","وسم2"]}
استخدم العربية للقيم النصية، واجعل الوسوم قصيرة وذات صلة.${meta}${content.images?.length ? '\n\nالصور المرفقة تمثل صفحات الملخص.' : ''}`;
  const raw = await callOpenRouter(prompt, { images: content.images, model: cfg.model, apiKey: cfg.apiKey });
  const parsed = extractJson(raw);
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  return {
    subject: String(parsed.subject || '').trim(),
    section: String(parsed.section || '').trim(),
    level: String(parsed.level || '').trim(),
    year: String(parsed.year || '').trim(),
    tags
  };
};
