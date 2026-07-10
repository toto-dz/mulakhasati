const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const settingsManager = require('./settingsManager');
const auth = require('./auth');
const logger = require('./services/logger');
const { chat, fetchModels } = require('./services/openrouter');

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const dataFile = path.join(rootDir, 'data', 'summaries.json');
const featuredFile = path.join(rootDir, 'data', 'featured.json');
const pdfDir = path.join(rootDir, 'pdf');
const imageDir = path.join(rootDir, 'images');
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const send = (res, status, body, type = 'application/json; charset=utf-8', extraHeaders = {}) => {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders
  });
  res.end(body);
};

const requireAuth = (req, res) => {
  const session = auth.sessionFromRequest(req);
  if (!session) {
    send(res, 401, JSON.stringify({ message: 'غير مصرّح. سجّل الدخول أولًا.' }));
    return null;
  }
  return session;
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const readSummaries = async () => {
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('ملف summaries.json غير صالح.');
  return parsed;
};

const writeSummaries = async (summaries) => {
  await fs.writeFile(dataFile, `${JSON.stringify(summaries, null, 2)}\n`, 'utf8');
};

const normalizePayload = (payload) => ({
  title: String(payload.title || '').trim(),
  subject: String(payload.subject || '').trim(),
  status: String(payload.status || 'منشور').trim(),
  description: String(payload.description || '').trim(),
  coverPrompt: String(payload.coverPrompt || '').trim(),
  section: String(payload.section || '').trim(),
  level: String(payload.level || '').trim(),
  year: String(payload.year || '').trim(),
  tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
  coverName: String(payload.coverName || '').trim(),
  coverData: String(payload.coverData || ''),
  coverFromPageUrl: String(payload.coverFromPageUrl || '').trim(),
  pageImages: Array.isArray(payload.pageImages) ? payload.pageImages : [],
  pdfName: String(payload.pdfName || '').trim(),
  pdfData: String(payload.pdfData || ''),
  size: String(payload.size || '').trim()
});

const safePdfName = (id, fileName) => {
  const base = path.basename(fileName || `summary-${id}.pdf`).replace(/[^\w.\-\u0600-\u06FF]+/g, '-');
  const normalized = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
  return `${id}-${normalized}`;
};

const imageExtensionFromMime = (mime) => ({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}[mime] || '.jpg');

const safeImageName = (id, fileName, mime) => {
  const ext = imageExtensionFromMime(mime);
  const base = path.basename(fileName || `summary-${id}${ext}`, path.extname(fileName || '')).replace(/[^\w.\-\u0600-\u06FF]+/g, '-');
  const cleanBase = base || `summary-${id}`;
  return `${id}-${Date.now()}-${cleanBase}${ext}`;
};

const savePdf = async (id, payload) => {
  if (!payload.pdfData) return null;
  const match = payload.pdfData.match(/^data:application\/pdf;base64,(.+)$/);
  if (!match) throw new Error('ملف PDF غير صالح.');
  await fs.mkdir(pdfDir, { recursive: true });
  const fileName = safePdfName(id, payload.pdfName);
  const filePath = path.join(pdfDir, fileName);
  await fs.writeFile(filePath, Buffer.from(match[1], 'base64'));
  return {
    pdfUrl: `./pdf/${fileName}`,
    pdfName: payload.pdfName || fileName,
    size: payload.size
  };
};

const saveCover = async (id, payload) => {
  if (!payload.coverData) return null;
  const match = payload.coverData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('صورة الغلاف غير صالحة.');
  await fs.mkdir(imageDir, { recursive: true });
  const fileName = safeImageName(id, payload.coverName, match[1]);
  const filePath = path.join(imageDir, fileName);
  await fs.writeFile(filePath, Buffer.from(match[2], 'base64'));
  return `./images/${fileName}`;
};

const saveFeaturedCover = async (id, payload) => {
  if (!payload.coverData) return null;
  const match = payload.coverData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('صورة غلاف الكارت غير صالحة.');
  await fs.mkdir(imageDir, { recursive: true });
  const fileName = safeImageName(id, payload.coverName || `featured-${id}`, match[1]);
  const filePath = path.join(imageDir, fileName);
  await fs.writeFile(filePath, Buffer.from(match[2], 'base64'));
  return `./images/${fileName}`;
};

const isLocalImageUrl = (value) => /^\.\/images\/[\w.\-\u0600-\u06FF]+$/u.test(String(value || ''));

const savePageImages = async (id, payload) => {
  const pages = [];
  if (!payload.pageImages.length) return pages;
  await fs.mkdir(imageDir, { recursive: true });

  for (let index = 0; index < payload.pageImages.length; index += 1) {
    const page = payload.pageImages[index];
    if (typeof page === 'string' && isLocalImageUrl(page)) {
      pages.push(page);
      continue;
    }
    if (!page || typeof page !== 'object') continue;

    const data = String(page.data || '');
    const match = data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) throw new Error(`صورة الصفحة رقم ${index + 1} غير صالحة.`);

    const fileName = safeImageName(id, page.name || `page-${index + 1}`, match[1]);
    const filePath = path.join(imageDir, fileName);
    await fs.writeFile(filePath, Buffer.from(match[2], 'base64'));
    pages.push(`./images/${fileName}`);
  }

  return pages;
};

const nextId = (summaries) => {
  const numericIds = summaries.map((item) => Number(item.id)).filter(Number.isFinite);
  return String((numericIds.length ? Math.max(...numericIds) : 0) + 1);
};

const readFeatured = async () => {
  try {
    const raw = await fs.readFile(featuredFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeFeatured = async (items) => {
  await fs.writeFile(featuredFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
};

const normalizeFeatured = (payload) => ({
  title: String(payload.title || '').trim(),
  description: String(payload.description || '').trim(),
  coverImage: String(payload.coverImage || '').trim(),
  coverName: String(payload.coverName || '').trim(),
  coverData: String(payload.coverData || ''),
  icon: String(payload.icon || '').trim(),
  badge: String(payload.badge || '').trim(),
  color: ['primary', 'secondary', 'tertiary', 'neutral'].includes(payload.color) ? payload.color : 'primary',
  subject: String(payload.subject || '').trim()
});

const nextFeaturedId = (items) => {
  const numericIds = items.map((item) => Number(item.id)).filter(Number.isFinite);
  return String((numericIds.length ? Math.max(...numericIds) : 0) + 1);
};

const handleApi = async (req, res, url) => {
  const startTime = Date.now();
  let endpoint = url.pathname;
  let method = req.method;

  try {
    const idMatch = url.pathname.match(/^\/api\/summaries\/([^/]+)$/);

    // GET /api/settings - إرجاع إعدادات OpenRouter بدون apiKey
    if (method === 'GET' && url.pathname === '/api/settings') {
      const settings = settingsManager.readSettings();
      logger.info('GET /api/settings', { duration: Date.now() - startTime });
      send(res, 200, JSON.stringify(settings.openrouter));
      return true;
    }

    // PUT /api/settings - حفظ إعدادات OpenRouter (محمي)
    if (method === 'PUT' && url.pathname === '/api/settings') {
      if (!requireAuth(req, res)) return true;
      const payload = JSON.parse(await readBody(req) || '{}');
      const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';
      const model = typeof payload.model === 'string' ? payload.model.trim() : '';

      if (!apiKey) {
        throw new Error('مفتاح API مطلوب.');
      }

      const current = settingsManager.readSettings();
      const newSettings = {
        openrouter: {
          apiKey,
          model: model || (current.openrouter?.model || '')
        }
      };
      
      const success = settingsManager.saveSettings(newSettings);
      if (!success) throw new Error('فشل حفظ الإعدادات.');

      logger.info('PUT /api/settings', { model: newSettings.openrouter.model, duration: Date.now() - startTime });
      send(res, 200, JSON.stringify(newSettings.openrouter));
      return true;
    }

    // GET /api/openrouter/test - اختبار الاتصال بـ OpenRouter (محمي)
    if (method === 'GET' && url.pathname === '/api/openrouter/test') {
      if (!requireAuth(req, res)) return true;
      const settings = settingsManager.readSettings();
      const apiKey = settings.openrouter.apiKey;
      if (!apiKey) {
        throw new Error('مفتاح API غير موجود في الإعدادات.');
      }

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: settings.openrouter.model || 'openai/gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.error?.message || 'فشل الاتصال بـ OpenRouter.');
        }

        logger.info('GET /api/openrouter/test', { status: 'success', duration: Date.now() - startTime });
        send(res, 200, JSON.stringify({ ok: true }));
        return true;
      } catch (error) {
        logger.error('GET /api/openrouter/test', { duration: Date.now() - startTime, error: error.message });
        throw error;
      }
    }

    // GET /api/openrouter/models - جلب قائمة النماذج (محمي)
    if (method === 'GET' && url.pathname === '/api/openrouter/models') {
      if (!requireAuth(req, res)) return true;
      try {
        const models = await fetchModels(settingsManager.readSettings().openrouter.apiKey);
        logger.info('GET /api/openrouter/models', { duration: Date.now() - startTime });
        send(res, 200, JSON.stringify(models));
        return true;
      } catch (error) {
        logger.error('GET /api/openrouter/models', { duration: Date.now() - startTime, error: error.message });
        throw error;
      }
    }

    // POST /api/ai/chat - إرسال رسالة إلى OpenRouter
    if (method === 'POST' && url.pathname === '/api/ai/chat') {
      const settings = settingsManager.readSettings();

      try {
        const body = JSON.parse(await readBody(req) || '{}');
        const model = (typeof body.model === 'string' && body.model.trim())
          ? body.model.trim()
          : settings.openrouter.model;
        const result = await chat(
          settings.openrouter.apiKey,
          model,
          body.prompt,
          body.images
        );

        logger.info('POST /api/ai/chat', { duration: Date.now() - startTime });
        send(res, 200, JSON.stringify(result));
        return true;
      } catch (error) {
        logger.error('POST /api/ai/chat', { duration: Date.now() - startTime, error: error.message });
        throw error;
      }
    }

    // GET /api/summaries - جلب جميع الملخصات
    if (method === 'GET' && url.pathname === '/api/summaries') {
      logger.info('GET /api/summaries', { duration: Date.now() - startTime });
      send(res, 200, JSON.stringify(await readSummaries()));
      return true;
    }

    // POST /api/summaries - إنشاء ملخص جديد (محمي)
    if (method === 'POST' && url.pathname === '/api/summaries') {
      if (!requireAuth(req, res)) return true;
      const summaries = await readSummaries();
      const payload = normalizePayload(JSON.parse(await readBody(req) || '{}'));
      if (!payload.title || !payload.subject) throw new Error('العنوان والتصنيف مطلوبان.');

      const id = nextId(summaries);
      const pdf = await savePdf(id, payload);
      const pageImages = await savePageImages(id, payload);
      const coverImage = await saveCover(id, payload);
      const created = {
        id,
        title: payload.title,
        description: payload.description,
        coverPrompt: payload.coverPrompt,
        subject: payload.subject,
        section: payload.section,
        level: payload.level,
        year: payload.year,
        pages: pageImages.length,
        size: pdf?.size || '',
        author: '',
        coverImage: coverImage || (isLocalImageUrl(payload.coverFromPageUrl) ? payload.coverFromPageUrl : pageImages[0] || ''),
        pageImages,
        tags: payload.tags,
        pdfUrl: pdf?.pdfUrl || '',
        pdfName: pdf?.pdfName || '',
        createdAt: new Date().toISOString(),
        status: payload.status || 'منشور'
      };
      summaries.unshift(created);
      await writeSummaries(summaries);
      
      logger.info('POST /api/summaries', { id, title: payload.title, duration: Date.now() - startTime });
      send(res, 201, JSON.stringify(created));
      return true;
    }

    // PUT /api/summaries/:id - تعديل ملخص (محمي)
    if (idMatch && method === 'PUT') {
      if (!requireAuth(req, res)) return true;
      const summaries = await readSummaries();
      const id = decodeURIComponent(idMatch[1]);
      const index = summaries.findIndex((item) => String(item.id) === String(id));
      if (index === -1) {
        send(res, 404, JSON.stringify({ message: 'الملخص غير موجود.' }));
        return true;
      }

      const payload = normalizePayload(JSON.parse(await readBody(req) || '{}'));
      if (!payload.title || !payload.subject) throw new Error('العنوان والتصنيف مطلوبان.');
      const pdf = await savePdf(id, payload);
      const pageImages = await savePageImages(id, payload);
      const coverImage = await saveCover(id, payload);
      const updated = {
        ...summaries[index],
        title: payload.title,
        description: payload.description || summaries[index].description || '',
        coverPrompt: payload.coverPrompt || summaries[index].coverPrompt || '',
        subject: payload.subject,
        section: payload.section || summaries[index].section || '',
        level: payload.level || summaries[index].level || '',
        year: payload.year || summaries[index].year || '',
        status: payload.status || summaries[index].status || 'منشور',
        pageImages,
        pages: pageImages.length || summaries[index].pages || 0,
        tags: payload.tags.length ? payload.tags : (summaries[index].tags || []),
        updatedAt: new Date().toISOString()
      };
      if (pdf) {
        updated.pdfUrl = pdf.pdfUrl;
        updated.pdfName = pdf.pdfName;
        updated.size = pdf.size;
      }
      if (coverImage) {
        updated.coverImage = coverImage;
      } else if (isLocalImageUrl(payload.coverFromPageUrl)) {
        updated.coverImage = payload.coverFromPageUrl;
      } else if (!updated.coverImage && pageImages[0]) {
        updated.coverImage = pageImages[0];
      }
      summaries[index] = updated;
      await writeSummaries(summaries);
      
      logger.info('PUT /api/summaries/:id', { id, duration: Date.now() - startTime });
      send(res, 200, JSON.stringify(updated));
      return true;
    }

    // DELETE /api/summaries/:id - حذف ملخص (محمي)
    if (idMatch && method === 'DELETE') {
      if (!requireAuth(req, res)) return true;
      const summaries = await readSummaries();
      const id = decodeURIComponent(idMatch[1]);
      const filtered = summaries.filter((item) => String(item.id) !== String(id));
      if (filtered.length === summaries.length) {
        send(res, 404, JSON.stringify({ message: 'الملخص غير موجود.' }));
        return true;
      }
      await writeSummaries(filtered);
      
      logger.info('DELETE /api/summaries/:id', { id, duration: Date.now() - startTime });
      send(res, 200, JSON.stringify({ ok: true }));
      return true;
    }

    // GET /api/featured - جلب كروت الصفحة الرئيسية (عام)
    if (method === 'GET' && url.pathname === '/api/featured') {
      logger.info('GET /api/featured', { duration: Date.now() - startTime });
      send(res, 200, JSON.stringify(await readFeatured()));
      return true;
    }

    // POST /api/featured - إنشاء كارت (محمي)
    if (method === 'POST' && url.pathname === '/api/featured') {
      if (!requireAuth(req, res)) return true;
      const items = await readFeatured();
      const payload = normalizeFeatured(JSON.parse(await readBody(req) || '{}'));
      if (!payload.title) throw new Error('عنوان الكارت مطلوب.');
      const id = nextFeaturedId(items);
      const coverImage = await saveFeaturedCover(id, payload);
      const created = {
        id,
        title: payload.title,
        description: payload.description,
        coverImage: coverImage || payload.coverImage,
        icon: payload.icon,
        badge: payload.badge,
        color: payload.color,
        subject: payload.subject
      };
      items.push(created);
      await writeFeatured(items);
      logger.info('POST /api/featured', { id, title: payload.title, duration: Date.now() - startTime });
      send(res, 201, JSON.stringify(created));
      return true;
    }

    const featuredIdMatch = url.pathname.match(/^\/api\/featured\/([^/]+)$/);

    // PUT /api/featured/:id - تعديل كارت (محمي)
    if (featuredIdMatch && method === 'PUT') {
      if (!requireAuth(req, res)) return true;
      const items = await readFeatured();
      const id = decodeURIComponent(featuredIdMatch[1]);
      const index = items.findIndex((item) => String(item.id) === String(id));
      if (index === -1) {
        send(res, 404, JSON.stringify({ message: 'الكارت غير موجود.' }));
        return true;
      }
      const payload = normalizeFeatured(JSON.parse(await readBody(req) || '{}'));
      if (!payload.title) throw new Error('عنوان الكارت مطلوب.');
      const coverImage = await saveFeaturedCover(id, payload);
      const existing = items[index];
      items[index] = {
        id,
        title: payload.title,
        description: payload.description,
        coverImage: coverImage || payload.coverImage || existing.coverImage,
        icon: payload.icon,
        badge: payload.badge,
        color: payload.color,
        subject: payload.subject
      };
      await writeFeatured(items);
      logger.info('PUT /api/featured/:id', { id, duration: Date.now() - startTime });
      send(res, 200, JSON.stringify(items[index]));
      return true;
    }

    // DELETE /api/featured/:id - حذف كارت (محمي)
    if (featuredIdMatch && method === 'DELETE') {
      if (!requireAuth(req, res)) return true;
      const items = await readFeatured();
      const id = decodeURIComponent(featuredIdMatch[1]);
      const filtered = items.filter((item) => String(item.id) !== String(id));
      if (filtered.length === items.length) {
        send(res, 404, JSON.stringify({ message: 'الكارت غير موجود.' }));
        return true;
      }
      await writeFeatured(filtered);
      logger.info('DELETE /api/featured/:id', { id, duration: Date.now() - startTime });
      send(res, 200, JSON.stringify({ ok: true }));
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`${method} ${endpoint}`, { 
      duration: Date.now() - startTime, 
      error: error.message 
    });
    send(res, 400, JSON.stringify({ message: error.message || 'تعذرت معالجة الطلب.' }));
    return true;
  }
};

const handleAuth = async (req, res, url) => {
  const method = req.method;
  try {
    // POST /api/auth/login
    if (method === 'POST' && url.pathname === '/api/auth/login') {
      const body = JSON.parse(await readBody(req) || '{}');
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!auth.verifyCredentials(username, password)) {
        send(res, 401, JSON.stringify({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }));
        return true;
      }
      const token = auth.createSession(username);
      send(res, 200, JSON.stringify({ ok: true, user: { username } }),
        'application/json; charset=utf-8', { 'Set-Cookie': auth.sessionCookie(token) });
      return true;
    }

    // POST /api/auth/logout
    if (method === 'POST' && url.pathname === '/api/auth/logout') {
      auth.destroySession(auth.getRequestToken(req));
      send(res, 200, JSON.stringify({ ok: true }),
        'application/json; charset=utf-8', { 'Set-Cookie': auth.sessionCookie('') });
      return true;
    }

    // GET /api/auth/me
    if (method === 'GET' && url.pathname === '/api/auth/me') {
      const session = auth.sessionFromRequest(req);
      send(res, 200, JSON.stringify({
        authenticated: Boolean(session),
        user: session ? { username: session.username } : null
      }));
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`${method} ${url.pathname}`, { error: error.message });
    send(res, 400, JSON.stringify({ message: error.message || 'تعذرت معالجة الطلب.' }));
    return true;
  }
};

const serveStatic = async (req, res, url) => {
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);

  if (req.method === 'GET' && auth.isProtectedPage(requested) && !auth.sessionFromRequest(req)) {
    send(res, 303, '', 'text/plain; charset=utf-8', { 'Location': '/login.html' });
    return;
  }

  const publicPath = path.normalize(path.join(publicDir, requested));
  if (publicPath.startsWith(publicDir)) {
    try {
      const data = await fs.readFile(publicPath);
      send(res, 200, data, mimeTypes[path.extname(publicPath).toLowerCase()] || 'application/octet-stream');
      return;
    } catch {
      // fall back to rootDir
    }
  }

  const filePath = path.normalize(path.join(rootDir, requested));
  if (!filePath.startsWith(rootDir)) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    send(res, 200, data, mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
  }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // معالجة طلبات CORS preflight
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  if (url.pathname.startsWith('/api/auth/') && await handleAuth(req, res, url)) return;
  if (url.pathname.startsWith('/api/') && await handleApi(req, res, url)) return;
  await serveStatic(req, res, url);
});

server.on('error', (err) => {
  logger.error('Server error', { error: err.message });
  if (err.code === 'EADDRINUSE') {
    console.error(`المنفذ ${port} مشغول. جرّب: PORT=3001 node server.js`);
    process.exit(1);
  }
});

server.listen(port, () => {
  logger.success('Server started', { port, url: `http://localhost:${port}` });
  console.log(`\n✅ ملخصاتي يعمل على http://localhost:${port}`);
  console.log(`   لوحة التحكم: http://localhost:${port}/admin.html`);
  console.log(`   اضغط Ctrl+C لإيقاف الخادم\n`);
});
