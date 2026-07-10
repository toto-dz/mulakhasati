import { getAllSummaries, addSummary, updateSummary, deleteSummary, getFeaturedCards, addFeaturedCard, updateFeaturedCard, deleteFeaturedCard } from './api.js';
import { debounce, createElementFromHTML, safeText, escapeHtml } from './helpers.js';
import { createSummaryCover } from './covers.js';
import { generateTitle, generateDescription, generateCoverPrompt, suggestCategory, AI_MODELS } from '../services/aiService.js';
import { requireAdmin, logout } from './auth-guard.js';

// حماية الصفحة: توجيه غير المسجّلين إلى صفحة تسجيل الدخول
(async () => {
  const user = await requireAdmin();
  if (!user) return; // جارٍ التوجيه إلى login.html
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  }
})();

const tableBody = document.getElementById('admin-summaries-body');
const cardsGrid = document.getElementById('admin-summaries-grid');
const searchInput = document.getElementById('admin-search-input');
const addButton = document.getElementById('add-summary-button');
const sidebarAddBtn = document.getElementById('sidebar-add-btn');
const statTotal = document.getElementById('admin-stat-total');
const statFiles = document.getElementById('admin-stat-files');
const statSubjects = document.getElementById('admin-stat-subjects');
const statPending = document.getElementById('admin-stat-pending');
const modal = document.getElementById('newSummaryModal');
const form = document.getElementById('newSummaryForm');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('modal-submit-btn');

const titleInput = document.getElementById('summaryTitle');
const subjectInput = document.getElementById('summarySubject');
const statusInput = document.getElementById('summaryStatus');
const descriptionInput = document.getElementById('summaryDescription');
const coverPromptInput = document.getElementById('summaryCoverPrompt');
const sectionInput = document.getElementById('summarySection');
const levelInput = document.getElementById('summaryLevel');
const yearInput = document.getElementById('summaryYear');
const tagsInput = document.getElementById('summaryTags');
const fileInput = document.getElementById('summaryFile');
const aiGenerateTitleBtn = document.getElementById('aiGenerateTitle');
const aiGenerateDescriptionBtn = document.getElementById('aiGenerateDescription');
const aiGenerateCoverBtn = document.getElementById('aiGenerateCover');
const aiAutoCategoryBtn = document.getElementById('aiAutoCategory');
const aiModelSelect = document.getElementById('aiModelSelect');

if (aiModelSelect && Array.isArray(AI_MODELS)) {
  AI_MODELS.forEach((model) => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    aiModelSelect.appendChild(option);
  });
}

const getSelectedAiModel = () => (aiModelSelect ? aiModelSelect.value : '');
const coverInput = document.getElementById('summaryCover');
const coverPreviewWrap = document.getElementById('coverPreviewWrap');
const coverPreview = document.getElementById('coverPreview');
const dropZone = document.getElementById('summaryDropZone');
const pagesInput = document.getElementById('summaryPagesInput');
const addPagesButton = document.getElementById('addPagesButton');
const uploadQueue = document.getElementById('uploadQueue');
const pagesGrid = document.getElementById('summaryPagesGrid');
const pagesCounter = document.getElementById('pagesCounter');
const imagePreviewModal = document.getElementById('imagePreviewModal');
const imagePreviewTarget = document.getElementById('imagePreviewTarget');
const closeImagePreview = document.getElementById('closeImagePreview');

let summaries = [];
let editingId = null;
let pageItems = [];
let coverData = null;
let coverName = '';
let coverFromPageId = null;

const makeId = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : `page-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const showToast = (message, type = 'success') => {
  const existing = document.getElementById('toast-container');
  if (!existing) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;';
    document.body.appendChild(container);
  }
  const container = document.getElementById('toast-container');
  const colors = {
    success: 'background:#166534;color:#fff;',
    error: 'background:#991b1b;color:#fff;',
    info: 'background:#1e3a8a;color:#fff;'
  };
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  const toast = document.createElement('div');
  toast.style.cssText = `${colors[type] || colors.info}padding:12px 20px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);animation:toastIn 0.3s ease;min-width:250px;max-width:400px;`;
  toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${icons[type] || 'info'}</span>${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes toastIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes toastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

const statusClass = (status) => ({
  'منشور': 'published',
  'قيد المراجعة': 'pending',
  'مسودة': 'draft'
}[status] || 'draft');

const getStatusBadge = (status) => `<span class="status-badge ${statusClass(status)}">${escapeHtml(status || 'غير محدد')}</span>`;

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return safeText(dateStr).slice(0, 10);
  }
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الملف.'));
  reader.readAsDataURL(file);
});

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الصورة.'));
  reader.readAsDataURL(blob);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('تعذر فتح الصورة.'));
  image.src = src;
});

const urlToDataUrl = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.height || image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const webp = canvas.toDataURL('image/webp', 0.8);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
    } catch (error) {
      reject(error);
    }
  };
  image.onerror = () => reject(new Error('تعذر تحميل الصورة للتحليل.'));
  image.src = src;
});

/**
 * بناء مصدر المحتوى الذي يُرسَل للذكاء الاصطناعي:
 * النص المستخرج (إن وُجد)، أو صور الصفحات، أو ملف PDF، حسب المتوفر.
 */
const getAiContentSource = async () => {
  const pdfName = fileInput?.files?.[0]?.name || '';
  const title = titleInput?.value.trim() || '';
  const subject = subjectInput?.value.trim() || '';

  const images = [];
  const imageLimit = 2;
  for (const page of pageItems) {
    if (images.length >= imageLimit) break;
    let dataUrl = '';
    if (page.data) {
      dataUrl = page.data;
    } else if (page.url) {
      try {
        dataUrl = await urlToDataUrl(page.url);
      } catch (error) {
        console.warn('تعذر تحويل صفحة إلى بيانات للتحليل:', error);
      }
    }
    if (dataUrl) images.push(dataUrl);
  }

  return { text: '', images, pdfName, title, subject };
};

const hasAiContent = (content) => Boolean(
  content?.images?.length ||
  content?.pdfName ||
  content?.title ||
  content?.subject ||
  content?.text
);

const setAiButtonLoading = (button, loading) => {
  if (!button) return;
  if (loading) {
    if (button.dataset.idleHtml === undefined) button.dataset.idleHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="material-symbols-outlined animate-spin text-[22px]" style="animation:spin 1s linear infinite">progress_activity</span><span class="font-label-md text-label-md">...جاري التوليد</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.idleHtml !== undefined) button.innerHTML = button.dataset.idleHtml;
  }
};

const runAiTask = async (button, task) => {
  if (!button || button.disabled) return;
  setAiButtonLoading(button, true);
  try {
    await task();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'تعذر تنفيذ العملية.', 'error');
  } finally {
    setAiButtonLoading(button, false);
  }
};

const validateImageFile = (file) => {
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    || /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!isImage) throw new Error(`الملف ${file.name} ليس صورة مدعومة.`);
  if (file.size > 15 * 1024 * 1024) throw new Error(`الصورة ${file.name} أكبر من 15MB.`);
};

const canvasToBlob = (canvas, quality = 0.82) => new Promise((resolve) => {
  canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
});

const compressImage = async (file) => {
  const originalUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(originalUrl);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
    const webpBlob = await canvasToBlob(canvas);
    let blob, isWebp;
    if (webpBlob?.type === 'image/webp') {
      blob = webpBlob;
      isWebp = true;
    } else {
      const pngBlob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
      blob = pngBlob || webpBlob || file;
      isWebp = blob.type === 'image/webp';
    }
    const data = await blobToDataUrl(blob);
    return {
      data,
      url: URL.createObjectURL(blob),
      name: file.name.replace(/\.[^.]+$/, isWebp ? '.webp' : '.png'),
      size: blob.size
    };
  } finally {
    URL.revokeObjectURL(originalUrl);
  }
};

const createQueueRow = (file) => {
  const row = createElementFromHTML(`
    <div class="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
      <div class="flex items-center justify-between gap-3 mb-2">
        <span class="font-caption text-caption text-on-surface truncate">${escapeHtml(file.name)}</span>
        <span data-progress-label class="font-caption text-caption text-on-surface-variant">0%</span>
      </div>
      <div class="h-2 rounded-full bg-surface-container-high overflow-hidden">
        <div data-progress-bar class="h-full bg-primary rounded-full transition-all" style="width:0%"></div>
      </div>
    </div>
  `);
  uploadQueue?.appendChild(row);
  return row;
};

const setQueueProgress = (row, value, error = false) => {
  const progress = Math.max(0, Math.min(100, value));
  const bar = row.querySelector('[data-progress-bar]');
  const label = row.querySelector('[data-progress-label]');
  if (bar) {
    bar.style.width = `${progress}%`;
    bar.classList.toggle('bg-error', error);
    bar.classList.toggle('bg-primary', !error);
  }
  if (label) label.textContent = error ? 'فشل' : `${progress}%`;
};

const addFiles = async (files) => {
  const list = Array.from(files || []);
  if (!list.length) return;
  const failures = [];

  for (const file of list) {
    const row = createQueueRow(file);
    try {
      validateImageFile(file);
      setQueueProgress(row, 22);
      const compressed = await compressImage(file);
      setQueueProgress(row, 86);
      pageItems.push({
        id: makeId(),
        name: compressed.name,
        url: compressed.url,
        data: compressed.data,
        rotation: 0,
        isNew: true
      });
      setQueueProgress(row, 100);
      window.setTimeout(() => row.remove(), 900);
    } catch (error) {
      console.error(error);
      failures.push(error.message);
      setQueueProgress(row, 100, true);
    }
    renderPages();
  }

  if (failures.length) showToast(`فشل رفع ${failures.length} صورة، وتمت معالجة الباقي.`, 'error');
};

const renderPages = () => {
  if (!pagesGrid) return;
  pagesGrid.innerHTML = '';
  if (pagesCounter) pagesCounter.textContent = `${pageItems.length} صفحة`;

  if (!pageItems.length) {
    pagesGrid.appendChild(createElementFromHTML(`
      <div class="col-span-full min-h-[170px] rounded-xl border border-dashed border-outline-variant/50 flex flex-col items-center justify-center text-on-surface-variant">
        <span class="material-symbols-outlined text-[42px] opacity-40">image_not_supported</span>
        <p class="font-caption text-caption mt-2">لم تتم إضافة صفحات بعد.</p>
      </div>
    `));
    return;
  }

  pageItems.forEach((page, index) => {
    const card = createElementFromHTML(`
      <div class="summary-page-card ${coverFromPageId === page.id ? 'cover-selected' : ''} rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shadow-sm" draggable="true" data-page-id="${page.id}">
        <div class="relative aspect-[3/4] bg-surface-container-high overflow-hidden">
          <img src="${escapeHtml(page.url)}" alt="صفحة ${index + 1}" class="w-full h-full object-cover transition-transform" style="transform:rotate(${page.rotation || 0}deg)" loading="lazy">
          <span class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-xs flex items-center justify-center">${index + 1}</span>
          ${coverFromPageId === page.id ? '<span class="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-primary text-white text-[11px] font-bold">الغلاف</span>' : ''}
        </div>
        <div class="p-2 grid grid-cols-5 gap-1">
          <button type="button" data-page-action="preview" class="p-1 rounded hover:bg-primary/10 text-primary" title="معاينة"><span class="material-symbols-outlined text-[18px] pointer-events-none">zoom_in</span></button>
          <button type="button" data-page-action="cover" class="p-1 rounded hover:bg-primary/10 text-primary" title="Set as Cover"><span class="material-symbols-outlined text-[18px] pointer-events-none">wallpaper</span></button>
          <button type="button" data-page-action="rotate" class="p-1 rounded hover:bg-primary/10 text-primary" title="تدوير"><span class="material-symbols-outlined text-[18px] pointer-events-none">rotate_right</span></button>
          <button type="button" data-page-action="replace" class="p-1 rounded hover:bg-primary/10 text-primary" title="استبدال"><span class="material-symbols-outlined text-[18px] pointer-events-none">find_replace</span></button>
          <button type="button" data-page-action="delete" class="p-1 rounded hover:bg-error/10 text-error" title="حذف"><span class="material-symbols-outlined text-[18px] pointer-events-none">delete</span></button>
        </div>
      </div>
    `);
    pagesGrid.appendChild(card);
  });
};

const reorderPages = (sourceId, targetId) => {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const sourceIndex = pageItems.findIndex((item) => item.id === sourceId);
  const targetIndex = pageItems.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const [moved] = pageItems.splice(sourceIndex, 1);
  pageItems.splice(targetIndex, 0, moved);
  renderPages();
};

const rotatePage = async (page) => {
  const image = await loadImage(page.url);
  const canvas = document.createElement('canvas');
  canvas.width = image.height;
  canvas.height = image.width;
  const context = canvas.getContext('2d');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(Math.PI / 2);
  context.drawImage(image, -image.width / 2, -image.height / 2);
  const webpBlob = await canvasToBlob(canvas, 0.85);
  let blob, isWebp;
  if (webpBlob?.type === 'image/webp') {
    blob = webpBlob;
    isWebp = true;
  } else {
    const pngBlob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    blob = pngBlob || webpBlob;
    isWebp = blob?.type === 'image/webp';
    if (!blob) throw new Error('تعذر تدوير الصورة.');
  }
  if (page.isNew && page.url.startsWith('blob:')) URL.revokeObjectURL(page.url);
  page.url = URL.createObjectURL(blob);
  page.data = await blobToDataUrl(blob);
  page.name = page.name.replace(/\.[^.]+$/, isWebp ? '.webp' : '.png');
  page.isNew = true;
};

const replacePage = async (page) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      validateImageFile(file);
      const compressed = await compressImage(file);
      if (page.isNew && page.url.startsWith('blob:')) URL.revokeObjectURL(page.url);
      page.url = compressed.url;
      page.data = compressed.data;
      page.name = compressed.name;
      page.rotation = 0;
      page.isNew = true;
      renderPages();
      showToast('تم استبدال الصفحة.', 'success');
    } catch (error) {
      showToast(error.message || 'تعذر استبدال الصفحة.', 'error');
    }
  });
  input.click();
};

const updateCoverPreview = (src) => {
  if (!coverPreviewWrap || !coverPreview) return;
  if (!src) {
    coverPreview.removeAttribute('src');
    coverPreviewWrap.classList.add('hidden');
    return;
  }
  coverPreview.src = src;
  coverPreviewWrap.classList.remove('hidden');
};

const apiBodyFromForm = async () => {
  const title = titleInput.value.trim();
  const subject = subjectInput.value.trim();
  const status = statusInput.value;
  const file = fileInput?.files?.[0] || null;

  if (!title || !subject) throw new Error('الرجاء تعبئة العنوان والتصنيف.');
  if (!pageItems.length && !file && !editingId) throw new Error('أضف صفحات صور أو ملف PDF قبل الحفظ.');
  if (file && !(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
    throw new Error('عارض المستندات يدعم ملفات PDF فقط.');
  }

  const description = descriptionInput?.value.trim() || '';
  const coverPrompt = coverPromptInput?.value.trim() || '';
  const section = sectionInput?.value.trim() || '';
  const level = levelInput?.value.trim() || '';
  const year = yearInput?.value.trim() || '';
  const tags = tagsInput?.value
    ? tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean)
    : [];

  const payload = {
    title,
    subject,
    status,
    description,
    coverPrompt,
    section,
    level,
    year,
    tags,
    pageImages: pageItems.map((page) => (page.isNew ? { name: page.name, data: page.data } : page.url))
  };

  const coverPage = pageItems.find((page) => page.id === coverFromPageId);
  if (coverData) {
    payload.coverName = coverName || 'cover.webp';
    payload.coverData = coverData;
  } else if (coverPage?.isNew) {
    payload.coverName = `cover-${coverPage.name || 'page.webp'}`;
    payload.coverData = coverPage.data;
  } else if (coverPage?.url) {
    payload.coverFromPageUrl = coverPage.url;
  }

  if (file) {
    payload.pdfName = file.name;
    payload.pdfData = await fileToDataUrl(file);
    payload.size = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return JSON.stringify(payload);
};

const renderSkeleton = () => {
  if (!cardsGrid) return;
  cardsGrid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-3">
      <div class="skeleton-row aspect-[4/3] rounded-xl mb-3"></div>
      <div class="skeleton-row h-5 rounded mb-2"></div>
      <div class="skeleton-row h-4 rounded w-2/3"></div>
    </div>
  `).join('');
};

const renderCards = (items) => {
  if (!cardsGrid) return;
  cardsGrid.innerHTML = '';

  if (!items.length) {
    cardsGrid.appendChild(createElementFromHTML(`
      <div class="col-span-full py-12 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-[48px] opacity-30">search_off</span>
        <p>لا توجد ملخصات مطابقة.</p>
      </div>
    `));
    return;
  }

  items.forEach((summary) => {
    const pagesCount = summary.pageImages?.length || summary.pages || 0;
    const card = createElementFromHTML(`
      <article class="rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest shadow-sm hover:shadow-lg transition-all group">
        <div class="aspect-[4/3] overflow-hidden bg-surface-container">
          ${createSummaryCover(summary, { fit: 'contain' })}
        </div>
        <div class="p-md">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h4 class="font-bold text-on-surface truncate" title="${escapeHtml(summary.title)}">${escapeHtml(summary.title || 'بدون عنوان')}</h4>
              <p class="text-caption text-on-surface-variant mt-1">${escapeHtml(summary.subject || '-')}</p>
            </div>
            ${getStatusBadge(summary.status)}
          </div>
          <div class="grid grid-cols-2 gap-2 my-sm text-caption text-on-surface-variant">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">image</span>${pagesCount} صفحة</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">event</span>${formatDate(summary.createdAt)}</span>
          </div>
          <div class="flex items-center justify-end gap-1 border-t border-outline-variant/10 pt-sm">
            <a href="summary.html?id=${encodeURIComponent(summary.id)}" target="_blank" class="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" title="Preview"><span class="material-symbols-outlined">visibility</span></a>
            <button data-action="edit" data-id="${escapeHtml(summary.id)}" class="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" title="Edit"><span class="material-symbols-outlined pointer-events-none">edit</span></button>
            <button data-action="delete" data-id="${escapeHtml(summary.id)}" class="p-2 hover:bg-error/10 text-error rounded-lg transition-colors" title="Delete"><span class="material-symbols-outlined pointer-events-none">delete</span></button>
          </div>
        </div>
      </article>
    `);
    cardsGrid.appendChild(card);
  });
};

const renderTable = (items) => {
  if (!tableBody) return;
  tableBody.innerHTML = '';
  items.forEach((summary) => {
    const pagesCount = summary.pageImages?.length || summary.pages || 0;
    tableBody.appendChild(createElementFromHTML(`
      <tr>
        <td>${escapeHtml(summary.title)}</td>
        <td>${escapeHtml(summary.subject)}</td>
        <td>${getStatusBadge(summary.status)}</td>
        <td>${formatDate(summary.createdAt)}</td>
        <td>${pagesCount}</td>
      </tr>
    `));
  });
};

const updateStats = (items) => {
  const animateNumber = (el, target) => {
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 24));
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, 24);
  };
  animateNumber(statTotal, items.length);
  animateNumber(statFiles, items.filter((item) => Boolean(item.pdfUrl) || (item.pageImages?.length || 0) > 0).length);
  animateNumber(statSubjects, new Set(items.map((item) => item.subject).filter(Boolean)).size);
  animateNumber(statPending, items.filter((item) => item.status === 'قيد المراجعة').length);
};

const filteredSummaries = () => {
  const query = (searchInput?.value || '').trim().toLowerCase();
  if (!query) return summaries;
  return summaries.filter((summary) => [
    summary.title,
    summary.subject,
    summary.author,
    summary.status,
    summary.level,
    summary.year
  ].filter(Boolean).join(' ').toLowerCase().includes(query));
};

const render = () => {
  updateStats(summaries);
  const filtered = filteredSummaries();
  renderCards(filtered);
  renderTable(filtered);
};

const refresh = async () => {
  try {
    renderSkeleton();
    summaries = await getAllSummaries({ force: true });
    render();
  } catch (error) {
    console.error(error);
    if (cardsGrid) {
      cardsGrid.innerHTML = `
        <div class="col-span-full py-12 text-center">
          <span class="material-symbols-outlined text-[48px] text-error opacity-60">cloud_off</span>
          <p class="text-error font-label-md">تعذر تحميل البيانات. تأكد من تشغيل الخادم.</p>
        </div>
      `;
    }
  }
  await loadFeatured();
};

const resetEditorState = () => {
  pageItems.forEach((page) => {
    if (page.isNew && page.url?.startsWith('blob:')) URL.revokeObjectURL(page.url);
  });
  pageItems = [];
  coverData = null;
  coverName = '';
  coverFromPageId = null;
  if (uploadQueue) uploadQueue.innerHTML = '';
};

const openModal = (summary = null) => {
  editingId = summary?.id || null;
  form.reset();
  resetEditorState();
  titleInput.value = summary?.title || '';
  subjectInput.value = summary?.subject || '';
  statusInput.value = summary?.status || 'منشور';
  if (descriptionInput) descriptionInput.value = summary?.description || '';
  if (coverPromptInput) coverPromptInput.value = summary?.coverPrompt || '';
  if (sectionInput) sectionInput.value = summary?.section || '';
  if (levelInput) levelInput.value = summary?.level || '';
  if (yearInput) yearInput.value = summary?.year || '';
  if (tagsInput) {
    const existingTags = Array.isArray(summary?.tags)
      ? summary.tags.join('، ')
      : (summary?.tags || '');
    tagsInput.value = existingTags;
  }

  pageItems = (summary?.pageImages || []).map((url, index) => ({
    id: makeId(),
    name: `page-${index + 1}.webp`,
    url,
    data: '',
    rotation: 0,
    isNew: false
  }));
  const coverPage = pageItems.find((page) => page.url === summary?.coverImage);
  coverFromPageId = coverPage?.id || null;
  updateCoverPreview(summary?.coverImage || '');
  renderPages();

  if (modalTitle) modalTitle.textContent = editingId ? 'تعديل الملخص' : 'إضافة ملخص جديد';
  if (submitBtn) {
    submitBtn.innerHTML = `<span class="material-symbols-outlined">check</span>${editingId ? 'حفظ التعديلات' : 'حفظ الملخص'}`;
  }

  const fileSection = document.getElementById('file-section');
  if (fileSection) {
    fileSection.querySelector('label').textContent = editingId ? 'تغيير ملف PDF اختياري' : 'رفع ملف PDF اختياري';
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  titleInput.focus();
};

const closeModal = () => {
  editingId = null;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
};

const setSubmitting = (loading) => {
  if (!submitBtn) return;
  submitBtn.disabled = loading;
  submitBtn.innerHTML = loading
    ? '<span class="material-symbols-outlined animate-spin" style="animation:spin 1s linear infinite">progress_activity</span> جاري الحفظ...'
    : '<span class="material-symbols-outlined">check</span> ' + (editingId ? 'حفظ التعديلات' : 'حفظ الملخص');
};

const showConfirmDialog = (title, message) => new Promise((resolve) => {
  const dialog = document.createElement('div');
  dialog.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);padding:16px;';
  dialog.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.25);font-family:Cairo,sans-serif;text-align:right;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:40px;height:40px;border-radius:12px;background:#fee2e2;display:flex;align-items:center;justify-content:center;">
          <span class="material-symbols-outlined" style="color:#dc2626;">warning</span>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#111c2d;">${escapeHtml(title)}</h3>
      </div>
      <p style="color:#424656;font-size:14px;line-height:1.6;margin-bottom:24px;">${escapeHtml(message)}</p>
      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button id="confirm-cancel" style="padding:10px 20px;border-radius:10px;border:none;background:#f1f5f9;color:#424656;font-family:Cairo,sans-serif;font-weight:600;cursor:pointer;">إلغاء</button>
        <button id="confirm-ok" style="padding:10px 20px;border-radius:10px;border:none;background:#dc2626;color:#fff;font-family:Cairo,sans-serif;font-weight:600;cursor:pointer;">حذف نهائياً</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('#confirm-ok').addEventListener('click', () => { dialog.remove(); resolve(true); });
  dialog.querySelector('#confirm-cancel').addEventListener('click', () => { dialog.remove(); resolve(false); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { dialog.remove(); resolve(false); } });
});

addButton?.addEventListener('click', () => openModal());
sidebarAddBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  openModal();
});
closeModalBtn?.addEventListener('click', closeModal);
cancelModalBtn?.addEventListener('click', closeModal);
modal?.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!imagePreviewModal?.classList.contains('hidden')) {
      imagePreviewModal.classList.add('hidden');
      return;
    }
    if (!modal?.classList.contains('hidden')) closeModal();
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setSubmitting(true);
  try {
    const body = await apiBodyFromForm();
    if (editingId) {
      await updateSummary(editingId, body);
      showToast('تم تعديل الملخص بنجاح', 'success');
    } else {
      await addSummary(body);
      showToast('تمت إضافة الملخص بنجاح', 'success');
    }
    await refresh();
    closeModal();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'تعذرت العملية.', 'error');
  } finally {
    setSubmitting(false);
  }
});

cardsGrid?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const summary = summaries.find((item) => String(item.id) === String(button.dataset.id));
  if (!summary) return;

  if (button.dataset.action === 'edit') {
    openModal(summary);
    return;
  }

  if (button.dataset.action === 'delete') {
    const confirmed = await showConfirmDialog('حذف الملخص', `هل تريد حذف "${summary.title}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;
    try {
      button.disabled = true;
      await deleteSummary(summary.id);
      await refresh();
      showToast('تم حذف الملخص بنجاح', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'تعذر حذف الملخص.', 'error');
      button.disabled = false;
    }
  }
});

dropZone?.addEventListener('click', () => pagesInput?.click());
addPagesButton?.addEventListener('click', () => pagesInput?.click());
pagesInput?.addEventListener('change', () => {
  addFiles(pagesInput.files);
  pagesInput.value = '';
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });
});
['dragleave', 'drop'].forEach((eventName) => {
  dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
  });
});
dropZone?.addEventListener('drop', (event) => addFiles(event.dataTransfer?.files));

pagesGrid?.addEventListener('dragstart', (event) => {
  const card = event.target.closest('[data-page-id]');
  if (!card) return;
  card.classList.add('dragging');
  event.dataTransfer.setData('text/plain', card.dataset.pageId);
});
pagesGrid?.addEventListener('dragend', (event) => {
  event.target.closest('[data-page-id]')?.classList.remove('dragging');
});
pagesGrid?.addEventListener('dragover', (event) => event.preventDefault());
pagesGrid?.addEventListener('drop', (event) => {
  event.preventDefault();
  const target = event.target.closest('[data-page-id]');
  const sourceId = event.dataTransfer.getData('text/plain');
  reorderPages(sourceId, target?.dataset.pageId);
});

pagesGrid?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-page-action]');
  if (!button) return;
  const card = button.closest('[data-page-id]');
  const page = pageItems.find((item) => item.id === card?.dataset.pageId);
  if (!page) return;

  try {
    if (button.dataset.pageAction === 'preview') {
      imagePreviewTarget.src = page.url;
      imagePreviewModal.classList.remove('hidden');
      imagePreviewModal.classList.add('flex');
    }
    if (button.dataset.pageAction === 'cover') {
      coverData = null;
      coverName = '';
      coverFromPageId = page.id;
      updateCoverPreview(page.url);
      renderPages();
      showToast('تم تعيين الصفحة كغلاف.', 'success');
    }
    if (button.dataset.pageAction === 'rotate') {
      await rotatePage(page);
      renderPages();
      showToast('تم تدوير الصفحة.', 'success');
    }
    if (button.dataset.pageAction === 'replace') {
      await replacePage(page);
    }
    if (button.dataset.pageAction === 'delete') {
      if (page.isNew && page.url.startsWith('blob:')) URL.revokeObjectURL(page.url);
      pageItems = pageItems.filter((item) => item.id !== page.id);
      if (coverFromPageId === page.id) {
        coverFromPageId = null;
        updateCoverPreview(coverData ? coverPreview.src : '');
      }
      renderPages();
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'تعذر تنفيذ العملية.', 'error');
  }
});

coverInput?.addEventListener('change', async () => {
  const cover = coverInput.files?.[0];
  if (!cover) {
    coverData = null;
    coverName = '';
    updateCoverPreview('');
    return;
  }
  try {
    validateImageFile(cover);
    const compressed = await compressImage(cover);
    coverData = compressed.data;
    coverName = compressed.name;
    coverFromPageId = null;
    updateCoverPreview(compressed.url);
    renderPages();
  } catch (error) {
    showToast(error.message || 'صورة الغلاف غير صالحة.', 'error');
  }
});

closeImagePreview?.addEventListener('click', () => {
  imagePreviewModal.classList.add('hidden');
  imagePreviewModal.classList.remove('flex');
});
imagePreviewModal?.addEventListener('click', (event) => {
  if (event.target === imagePreviewModal) {
    imagePreviewModal.classList.add('hidden');
    imagePreviewModal.classList.remove('flex');
  }
});

aiGenerateTitleBtn?.addEventListener('click', () => {
  runAiTask(aiGenerateTitleBtn, async () => {
    const content = await getAiContentSource();
    if (!hasAiContent(content)) {
      showToast('أضف صفحات أو ملف PDF أو العنوان أولاً لتتمكن من توليد العنوان.', 'info');
      return;
    }
    const title = await generateTitle(content, { model: getSelectedAiModel() });
    titleInput.value = title;
    showToast('تم توليد العنوان. يمكنك تعديله قبل الحفظ.', 'success');
  });
});

aiGenerateDescriptionBtn?.addEventListener('click', () => {
  runAiTask(aiGenerateDescriptionBtn, async () => {
    const content = await getAiContentSource();
    if (!hasAiContent(content)) {
      showToast('أضف صفحات أو ملف PDF أو العنوان أولاً لتتمكن من توليد الوصف.', 'info');
      return;
    }
    const description = await generateDescription(content, { model: getSelectedAiModel() });
    descriptionInput.value = description;
    showToast('تم توليد الوصف. يمكنك تعديله قبل الحفظ.', 'success');
  });
});

aiGenerateCoverBtn?.addEventListener('click', () => {
  runAiTask(aiGenerateCoverBtn, async () => {
    const content = await getAiContentSource();
    if (!hasAiContent(content)) {
      showToast('أضف صفحات أو ملف PDF أو العنوان أولاً لتتمكن من توليد الـ Prompt.', 'info');
      return;
    }
    const coverPrompt = await generateCoverPrompt(content, { model: getSelectedAiModel() });
    coverPromptInput.value = coverPrompt;
    showToast('تم توليد Cover Prompt. يمكنك تعديله قبل الحفظ.', 'success');
  });
});

aiAutoCategoryBtn?.addEventListener('click', () => {
  runAiTask(aiAutoCategoryBtn, async () => {
    const content = await getAiContentSource();
    if (!hasAiContent(content)) {
      showToast('أضف صفحات أو ملف PDF أو العنوان أولاً لتتمكن من اقتراح التصنيف.', 'info');
      return;
    }
    const category = await suggestCategory(content, { model: getSelectedAiModel() });
    if (category.subject) subjectInput.value = category.subject;
    if (category.section) sectionInput.value = category.section;
    if (category.level) levelInput.value = category.level;
    if (category.year) yearInput.value = category.year;
    if (category.tags?.length) tagsInput.value = category.tags.join('، ');
    showToast('تم اقتراح التصنيف. راجعه وعدّله قبل الحفظ.', 'success');
  });
});

searchInput?.addEventListener('input', debounce(render, 250));

/* ===================== إدارة كروت الصفحة الرئيسية ===================== */

const featuredGrid = document.getElementById('admin-featured-grid');
const featuredModal = document.getElementById('featuredModal');
const featuredForm = document.getElementById('featuredForm');
const featuredModalTitle = document.getElementById('featured-modal-title');
const addFeaturedButton = document.getElementById('add-featured-button');
const closeFeaturedModalBtn = document.getElementById('closeFeaturedModalBtn');
const cancelFeaturedModalBtn = document.getElementById('cancelFeaturedModalBtn');
const featuredSubmitBtn = document.getElementById('featured-submit-btn');

const featuredTitleInput = document.getElementById('featuredTitle');
const featuredDescriptionInput = document.getElementById('featuredDescription');
const featuredCoverInput = document.getElementById('featuredCover');
const featuredCoverPreview = document.getElementById('featuredCoverPreview');
const featuredIconInput = document.getElementById('featuredIcon');
const featuredBadgeInput = document.getElementById('featuredBadge');
const featuredColorInput = document.getElementById('featuredColor');
const featuredSubjectInput = document.getElementById('featuredSubject');

let featuredItems = [];
let editingFeaturedId = null;
let featuredCoverData = null;
let featuredCoverName = '';

const featuredColorClasses = (color) => ({
  primary: { iconBg: 'bg-primary-fixed/40', iconText: 'text-primary', badgeBg: 'bg-primary-fixed', badgeText: 'text-primary' },
  secondary: { iconBg: 'bg-secondary-fixed/40', iconText: 'text-secondary', badgeBg: 'bg-secondary-fixed', badgeText: 'text-secondary' },
  tertiary: { iconBg: 'bg-tertiary-fixed/40', iconText: 'text-tertiary', badgeBg: 'bg-tertiary-fixed', badgeText: 'text-tertiary' },
  neutral: { iconBg: 'bg-surface-container-high', iconText: 'text-on-surface-variant', badgeBg: 'bg-surface-container-high', badgeText: 'text-on-surface-variant' }
}[color] || { iconBg: 'bg-primary-fixed/40', iconText: 'text-primary', badgeBg: 'bg-primary-fixed', badgeText: 'text-primary' });

const renderFeaturedCards = (items) => {
  if (!featuredGrid) return;
  featuredGrid.innerHTML = '';

  if (!items.length) {
    featuredGrid.appendChild(createElementFromHTML(`
      <div class="col-span-full py-8 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-[40px] opacity-30">apps</span>
        <p>لا توجد كروت بعد. أضف كارتًا لصفحة الرئيسية.</p>
      </div>
    `));
    return;
  }

  items.forEach((card) => {
    const c = featuredColorClasses(card.color);
    const coverImg = card.coverImage ? `<img src="${escapeHtml(card.coverImage)}" alt="" class="h-full w-full object-cover" loading="lazy">` : `<div class="h-full w-full flex items-center justify-center ${c.iconBg}"><span class="material-symbols-outlined ${c.iconText} text-5xl">${escapeHtml(card.icon || 'auto_stories')}</span></div>`;
    const el = createElementFromHTML(`
      <article class="rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest shadow-sm hover:shadow-lg transition-all group">
        <div class="aspect-[4/3] overflow-hidden relative">
          ${coverImg}
        </div>
        <div class="p-md">
          <div class="flex items-center justify-between gap-2 mb-2">
            <h4 class="font-bold text-on-surface truncate" title="${escapeHtml(card.title)}">${escapeHtml(card.title || 'بدون عنوان')}</h4>
            <span class="${c.badgeBg} ${c.badgeText} px-2 py-0.5 rounded-full text-[11px] font-bold">${escapeHtml(card.badge || '')}</span>
          </div>
          <p class="text-caption text-on-surface-variant line-clamp-2 mb-3">${escapeHtml(card.description || '')}</p>
          <div class="flex items-center justify-end gap-1 border-t border-outline-variant/10 pt-2">
            <button data-action="edit" data-id="${escapeHtml(card.id)}" class="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" title="تعديل"><span class="material-symbols-outlined pointer-events-none">edit</span></button>
            <button data-action="delete" data-id="${escapeHtml(card.id)}" class="p-2 hover:bg-error/10 text-error rounded-lg transition-colors" title="حذف"><span class="material-symbols-outlined pointer-events-none">delete</span></button>
          </div>
        </div>
      </article>
    `);
    featuredGrid.appendChild(el);
  });
};

const loadFeatured = async () => {
  try {
    featuredItems = await getFeaturedCards();
    renderFeaturedCards(featuredItems);
  } catch (error) {
    console.error(error);
    if (featuredGrid) {
      featuredGrid.innerHTML = `
        <div class="col-span-full py-8 text-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[40px]">cloud_off</span>
          <p>تعذر تحميل كروت الصفحة الرئيسية.</p>
        </div>
      `;
    }
  }
};

const openFeaturedModal = (card = null) => {
  editingFeaturedId = card?.id || null;
  featuredForm.reset();
  featuredTitleInput.value = card?.title || '';
  featuredDescriptionInput.value = card?.description || '';
  featuredIconInput.value = card?.icon || '';
  featuredBadgeInput.value = card?.badge || '';
  featuredColorInput.value = card?.color || 'primary';
  featuredSubjectInput.value = card?.subject || '';
  featuredCoverData = null;
  featuredCoverName = '';
  if (featuredCoverInput) {
    featuredCoverInput.value = '';
  }
  if (featuredCoverPreview) {
    featuredCoverPreview.src = card?.coverImage || '';
    featuredCoverPreview.classList.toggle('hidden', !card?.coverImage);
  }

  if (featuredModalTitle) {
    featuredModalTitle.innerHTML = `<span class="material-symbols-outlined text-primary">apps</span>${editingFeaturedId ? 'تعديل الكارت' : 'إضافة كارت رئيسي'}`;
  }
  if (featuredSubmitBtn) {
    featuredSubmitBtn.innerHTML = `<span class="material-symbols-outlined">check</span>${editingFeaturedId ? 'حفظ التعديلات' : 'حفظ'}`;
  }

  featuredModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  featuredTitleInput.focus();
};

const closeFeaturedModal = () => {
  editingFeaturedId = null;
  featuredModal.classList.add('hidden');
  document.body.style.overflow = '';
};

const setFeaturedSubmitting = (loading) => {
  if (!featuredSubmitBtn) return;
  featuredSubmitBtn.disabled = loading;
  featuredSubmitBtn.innerHTML = loading
    ? '<span class="material-symbols-outlined animate-spin" style="animation:spin 1s linear infinite">progress_activity</span> جاري الحفظ...'
    : `<span class="material-symbols-outlined">check</span> ${editingFeaturedId ? 'حفظ التعديلات' : 'حفظ'}`;
};

addFeaturedButton?.addEventListener('click', () => openFeaturedModal());
closeFeaturedModalBtn?.addEventListener('click', closeFeaturedModal);
cancelFeaturedModalBtn?.addEventListener('click', closeFeaturedModal);
featuredModal?.addEventListener('click', (event) => {
  if (event.target === featuredModal) closeFeaturedModal();
});

const setupFeaturedCoverUpload = () => {
  featuredCoverInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      validateImageFile(file);
      const compressed = await compressImage(file);
      featuredCoverData = compressed.data;
      featuredCoverName = compressed.name;
      if (featuredCoverPreview) {
        featuredCoverPreview.src = compressed.url;
        featuredCoverPreview.classList.remove('hidden');
      }
    } catch (error) {
      console.error(error);
      showToast('تعذر قراءة صورة الغلاف.', 'error');
    }
  });
};

featuredForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = featuredTitleInput.value.trim();
  if (!title) {
    showToast('الرجاء تعبئة عنوان الكارت.', 'error');
    return;
  }
  const payload = {
    title,
    description: featuredDescriptionInput.value.trim(),
    coverImage: featuredCoverInput.value.trim(),
    icon: featuredIconInput.value.trim(),
    badge: featuredBadgeInput.value.trim(),
    color: featuredColorInput.value,
    subject: featuredSubjectInput.value.trim()
  };
  if (featuredCoverData) {
    payload.coverData = featuredCoverData;
    payload.coverName = featuredCoverName;
  } else if (editingFeaturedId) {
    const existing = featuredItems.find((item) => String(item.id) === String(editingFeaturedId));
    payload.coverImage = existing?.coverImage || '';
  }

  setFeaturedSubmitting(true);
  try {
    if (editingFeaturedId) {
      await updateFeaturedCard(editingFeaturedId, payload);
      showToast('تم تعديل الكارت بنجاح', 'success');
    } else {
      await addFeaturedCard(payload);
      showToast('تمت إضافة الكارت بنجاح', 'success');
    }
    await loadFeatured();
    closeFeaturedModal();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'تعذرت العملية.', 'error');
  } finally {
    setFeaturedSubmitting(false);
  }
});

featuredGrid?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const card = featuredItems.find((item) => String(item.id) === String(button.dataset.id));
  if (!card) return;

  if (button.dataset.action === 'edit') {
    openFeaturedModal(card);
    return;
  }

  if (button.dataset.action === 'delete') {
    const confirmed = await showConfirmDialog('حذف الكارت', `هل تريد حذف "${card.title}" نهائياً؟`);
    if (!confirmed) return;
    try {
      button.disabled = true;
      await deleteFeaturedCard(card.id);
      await loadFeatured();
      showToast('تم حذف الكارت بنجاح', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'تعذر حذف الكارت.', 'error');
      button.disabled = false;
    }
  }
});

refresh();
setupFeaturedCoverUpload();
