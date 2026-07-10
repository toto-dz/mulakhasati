// services/aiService.js
//
// طبقة خدمات الذكاء الاصطناعي (OpenRouter).
// جميع الدوال هنا اختيارية: لا يتم استدعاء OpenRouter إلا عند طلبها صراحةً من الواجهة.
// الدوال تتواصل مع الخادم عبر `/api/ai/chat` الذي يحتفظ بمفتاح API بشكل آمن
// (لا يُكشف المفتاح في المتصفح).
//
// لإضافة ميزة ذكاء اصطناعي جديدة مستقبلاً: أضف دالة جديدة تبني الـ prompt المناسب
// ثم تستدعي `callOpenRouter`. هذا يكفي ليتم توسيع النظام بسهولة.

const AI_CHAT_ENDPOINT = '/api/ai/chat';
const AI_TIMEOUT = 50000;

/**
 * قائمة النماذج المتاحة للاختيار داخل لوحة الإدارة.
 * يمكن توسيعها بسهولة بإضافة عناصر جديدة (label + id الخاص بـ OpenRouter).
 */
export const AI_MODELS = [
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
  { id: 'qwen/qwen3-235b-a22b', label: 'Qwen 3' }
];

/**
 * إرسال طلب إلى OpenRouter عبر الخادم الوكيل.
 * @param {string} prompt نص التعليمة.
 * @param {object} [options]
 * @param {string[]} [options.images] روابط صور بصيغة data URL (للنماذج المتعددة الوسائط).
 * @returns {Promise<string>} محتوى الرد النصي من النموذج.
 */
const callOpenRouter = async (prompt, { images = [], model = '' } = {}) => {
  if (!prompt || !prompt.trim()) {
    throw new Error('تعذّر إرسال طلب فارغ إلى الذكاء الاصطناعي.');
  }

  let response;
  try {
    response = await fetch(AI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.trim(),
        images: Array.isArray(images) ? images : [],
        model: model || ''
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT)
    });
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي.');
    }
    throw new Error('تعذّر الاتصال بخدمة الذكاء الاصطناعي. تأكد من تشغيل الخادم وتهيئة الإعدادات.');
  }

  if (!response.ok) {
    let message = 'تعذّر الحصول على نتيجة من الذكاء الاصطناعي.';
    try {
      const data = await response.json();
      if (data && data.message) message = data.message;
    } catch { /* تجاهل قراءة الخطأ */ }
    throw new Error(message);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const text = typeof content === 'string' ? content.trim() : String(content).trim();
  if (!text) {
    throw new Error('لم يُرجع الذكاء الاصطناعي أي نتيجة.');
  }
  return text;
};

/**
 * استخراج كائن JSON من نص قد يحتوي على علامات ```json أو نص إضافي.
 */
const extractJson = (raw) => {
  let text = String(raw).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
};

/**
 * بناء وصف نصي للمحتوى المتوفر (يُضاف للـ prompt عند توفّره).
 */
const buildMetaBlock = (content) => {
  const lines = [];
  if (content.title) lines.push(`العنوان الحالي/المقترح: ${content.title}`);
  if (content.subject) lines.push(`المادة أو التصنيف: ${content.subject}`);
  if (content.pdfName) lines.push(`اسم ملف PDF المرفق: ${content.pdfName}`);
  if (content.text) lines.push(`نص مستخرج من الملخص:\n${content.text}`);
  if (!lines.length) return '';
  return `\n\nمعلومات متوفرة عن الملخص:\n${lines.join('\n')}`;
};

/**
 * 1) Generate Title
 * يولّد عنوانًا احترافيًا قصيرًا (4 إلى 8 كلمات).
 * @param {object} content المحتوى المصدر.
 * @returns {Promise<string>}
 */
export const generateTitle = async (content = {}, options = {}) => {
  const meta = buildMetaBlock(content);
  const prompt = `أنت مساعد لتوليد محتوى تعليمي عربي. بناءً على محتوى الملخص التالي (صور الصفحات أو ملف PDF أو العنوان/المادة المتوفرة)، اقترح عنوانًا احترافيًا قصيرًا وجذابًا.
الشروط:
- بين 4 و8 كلمات.
- باللغة العربية.
- واضح ومختصر وخالٍ من المبالغة.
- بدون علامات اقتباس أو رموز أو شرح إضافي.
أعد العنوان فقط.${meta}${content.images?.length ? '\n\nالصور المرفقة تمثل صفحات الملخص.' : ''}`;

  const result = await callOpenRouter(prompt, { images: content.images, model: options.model });
  return result.replace(/^["'«]|["'»]$/g, '').trim();
};

/**
 * 2) Generate Description
 * يولّد وصفًا احترافيًا مناسبًا لمحركات البحث (60 إلى 120 كلمة).
 * @param {object} content المحتوى المصدر.
 * @returns {Promise<string>}
 */
export const generateDescription = async (content = {}, options = {}) => {
  const meta = buildMetaBlock(content);
  const prompt = `أنت كاتب محتوى SEO عربي محترف. اكتب وصفًا احترافيًا للملخص التعليمي بناءً على محتواه.
الشروط:
- بين 60 و120 كلمة.
- يركّز على محتوى الملخص فعليًا.
- مناسب لمحركات البحث (SEO) ويحتوي على كلمات مفتاحية ذات صلة.
- خالٍ من المبالغة والمعلومات غير الموجودة في المحتوى.
- باللغة العربية.
أعد الوصف فقط دون عنوان أو تعليق.${meta}${content.images?.length ? '\n\nالصور المرفقة تمثل صفحات الملخص.' : ''}`;

  return callOpenRouter(prompt, { images: content.images, model: options.model });
};

/**
 * 3) Generate Cover Prompt
 * يولّد Prompt احترافي (بالإنجليزية) لإنشاء صورة غلاف فقط.
 * @param {object} content المحتوى المصدر.
 * @returns {Promise<string>}
 */
export const generateCoverPrompt = async (content = {}, options = {}) => {
  const meta = buildMetaBlock(content);
  const prompt = `You are a professional cover image designer. Analyze the following educational summary content and write a professional image-generation prompt (in English) for a cover image.
Requirements:
- Modern, professional, and suitable for an educational website.
- NO text, letters, numbers, or words inside the image.
- Relies on topic-related icons, illustrations, and graphics.
- Aspect ratio 16:9.
- Return ONLY the prompt in English, without explanation or quotes.${meta}${content.images?.length ? '\n\nThe attached images represent the summary pages.' : ''}`;

  const result = await callOpenRouter(prompt, { images: content.images, model: options.model });
  return result.replace(/^["']|["']$/g, '').trim();
};

/**
 * 4) Auto Category
 * يقترح المادة، القسم، المستوى الدراسي، السنة، والوسوم.
 * @param {object} content المحتوى المصدر.
 * @returns {Promise<{subject:string, section:string, level:string, year:string, tags:string[]}>}
 */
export const suggestCategory = async (content = {}, options = {}) => {
  const meta = buildMetaBlock(content);
  const prompt = `أنت مصنّف محتوى تعليمي. حلل محتوى الملخص واقترح التصنيف المناسب.
أعد النتيجة حصرًا بصيغة JSON بهذا الشكل بالضبط (بدون علامات \`\`\`):
{"subject":"المادة","section":"القسم أو الشعبة","level":"المستوى الدراسي","year":"السنة الدراسية إن وُجدت وإلا سلسلة فارغة","tags":["وسم1","وسم2"]}
استخدم العربية للقيم النصية، واجعل الوسوم قصيرة وذات صلة.${meta}${content.images?.length ? '\n\nالصور المرفقة تمثل صفحات الملخص.' : ''}`;

  const raw = await callOpenRouter(prompt, { images: content.images, model: options.model });
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
