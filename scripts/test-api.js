const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const REPORT = [];

const request = (options, body = null) => new Promise((resolve, reject) => {
  const req = http.request(options, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const data = Buffer.concat(chunks).toString('utf8');
      resolve({ status: res.statusCode, data });
    });
  });
  req.on('error', (error) => {
    if (error.code === 'ECONNREFUSED') {
      reject(new Error('Server not running. Start with: node server.js'));
    }
    reject(error);
  });
  if (body) req.write(body);
  req.end();
});

const get = (url) => request({ method: 'GET', headers: { 'Content-Type': 'application/json' }, path: url });
const post = (url, body) => request({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  path: url,
  body: typeof body === 'string' ? body : JSON.stringify(body || {})
});
const put = (url, body) => request({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  path: url,
  body: typeof body === 'string' ? body : JSON.stringify(body || {})
});
const del = (url) => request({ method: 'DELETE', headers: { 'Content-Type': 'application/json' }, path: url });

const log = (name, status, pass, detail = '') => {
  const statusText = pass ? 'PASS' : 'FAIL';
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${statusText}] ${name} - ${status}${detail ? ' | ' + detail : ''}`);
  REPORT.push({ name, status, pass, detail });
};

const runTests = async () => {
  console.log('\n🚀 Starting API tests...\n');

  let testSummaryId = null;

  // 1. GET /api/settings
  try {
    const res = await get('/api/settings');
    const settings = JSON.parse(res.data);
    log('GET /api/settings', res.status, res.status === 200 && settings.openrouter !== undefined,
      `model: ${settings.openrouter?.model || 'none'}`);
  } catch (e) {
    log('GET /api/settings', 'ERR', false, e.message);
  }

  // 2. PUT /api/settings ( Validation error - missing fields )
  try {
    const res = await put('/api/settings', {});
    log('PUT /api/settings (empty)', res.status, res.status === 400, JSON.parse(res.data).message);
  } catch (e) {
    log('PUT /api/settings (empty)', 'ERR', false, e.message);
  }

  // 3. POST /api/ai/chat ( empty prompt )
  try {
    const res = await post('/api/ai/chat', {});
    log('POST /api/ai/chat (empty prompt)', res.status, res.status === 400, JSON.parse(res.data).message);
  } catch (e) {
    log('POST /api/ai/chat (empty prompt)', 'ERR', false, e.message);
  }

  // 4. POST /api/ai/chat ( no api key in settings )
  try {
    const originalSettings = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'settings.json'), 'utf8'));
    const tempSettings = { ...originalSettings, openrouter: { apiKey: '', model: '' } };
    fs.writeFileSync(path.join(__dirname, 'data', 'settings.json'), JSON.stringify(tempSettings, null, 2));
    
    const res = await post('/api/ai/chat', { prompt: 'test' });
    const body = JSON.parse(res.data);
    log('POST /api/ai/chat (no api key)', res.status, res.status === 400 && body.message.includes('مفتاح'), body.message);
    
    fs.writeFileSync(path.join(__dirname, 'data', 'settings.json'), JSON.stringify(originalSettings, null, 2));
  } catch (e) {
    log('POST /api/ai/chat (no api key)', 'ERR', false, e.message);
    try {
      const originalSettings = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'settings.json'), 'utf8'));
      fs.writeFileSync(path.join(__dirname, 'data', 'settings.json'), JSON.stringify(originalSettings, null, 2));
    } catch {}
  }

  // 5. GET /api/summaries
  try {
    const res = await get('/api/summaries');
    const summaries = JSON.parse(res.data);
    log('GET /api/summaries', res.status, res.status === 200 && Array.isArray(summaries), `count: ${summaries.length}`);
  } catch (e) {
    log('GET /api/summaries', 'ERR', false, e.message);
  }

  // 6. POST /api/summaries (create)
  try {
    const testPayload = {
      title: 'Test Summary ' + Date.now(),
      subject: 'Test',
      status: 'منشور',
      pageImages: [],
      pdfName: 'test.pdf'
    };
    const res = await post('/api/summaries', testPayload);
    const created = JSON.parse(res.data);
    testSummaryId = created.id;
    log('POST /api/summaries', res.status, res.status === 201 && !!created.id, `id: ${created.id}`);
  } catch (e) {
    log('POST /api/summaries', 'ERR', false, e.message);
  }

  // 7. PUT /api/summaries/:id (edit)
  if (testSummaryId) {
    try {
      const testPayload = {
        title: 'Updated Test Summary ' + Date.now(),
        subject: 'Updated Test',
        status: 'قيد المراجعة',
        pageImages: []
      };
      const res = await put(`/api/summaries/${testSummaryId}`, testPayload);
      const updated = JSON.parse(res.data);
      log('PUT /api/summaries/:id', res.status, res.status === 200 && updated.title.includes('Updated'), `id: ${updated.id}`);
    } catch (e) {
      log('PUT /api/summaries/:id', 'ERR', false, e.message);
    }
  }

  // 8. DELETE /api/summaries/:id
  if (testSummaryId) {
    try {
      const res = await del(`/api/summaries/${testSummaryId}`);
      const result = JSON.parse(res.data);
      log('DELETE /api/summaries/:id', res.status, res.status === 200 && result.ok === true, `id: ${testSummaryId}`);
    } catch (e) {
      log('DELETE /api/summaries/:id', 'ERR', false, e.message);
    }
  }

  // 9. Search
  try {
    const res = await get('/api/summaries');
    const summaries = JSON.parse(res.data);
    const found = summaries.some(s => s.title && s.title.includes('Test'));
    log('Search (via GET)', res.status, res.status === 200 && found, 'searchable data available');
  } catch (e) {
    log('Search (via GET)', 'ERR', false, e.message);
  }

  // Summary
  const passed = REPORT.filter(r => r.pass).length;
  const total = REPORT.length;
  console.log(`\n📊 Results: ${passed}/${total} tests passed\n`);

  process.exit(passed === total ? 0 : 1);
};

runTests();
