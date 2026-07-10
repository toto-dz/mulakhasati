import { getAllSummaries, getSummaryOptions } from './api.js';
import { filterSummaries, sortSummaries, paginateSummaries } from './search.js';
import { renderSummariesGrid, renderPagination } from './ui.js';
import { debounce } from './helpers.js';
import { generateTitle, generateDescription, generateCoverPrompt, suggestCategory, AI_MODELS } from '../services/aiService.js';

// استهداف العناصر بـ ID بشكل صريح لتجنب الخلط مع عناصر أخرى
const listContainer = document.getElementById('summaries-grid');
const paginationContainer = document.getElementById('pagination-container');
const searchInput = document.getElementById('search-input');
const subjectSelect = document.getElementById('subject-filter');
const levelSelect = document.getElementById('level-filter');
const yearSelect = document.getElementById('year-filter');
const sortSelect = document.getElementById('sort-select');
const compactStatsContainer = document.getElementById('compact-stats');
const compactStatsDesktop = document.getElementById('compact-stats-desktop');
const compactStatsMobile = document.getElementById('compact-stats-mobile');
const urlParams = new URLSearchParams(window.location.search);

// AI Assistant
const aiAssistantToggle = document.getElementById('aiAssistantToggle');
const aiAssistantPanel = document.getElementById('aiAssistantPanel');
const aiAssistantClose = document.getElementById('aiAssistantClose');
const aiModelSelect = document.getElementById('aiModelSelect');
const aiTitleInput = document.getElementById('aiTitle');
const aiSubjectInput = document.getElementById('aiSubject');
const aiDescriptionInput = document.getElementById('aiDescription');
const aiCoverPromptInput = document.getElementById('aiCoverPrompt');
const aiSectionInput = document.getElementById('aiSection');
const aiLevelInput = document.getElementById('aiLevel');
const aiYearInput = document.getElementById('aiYear');
const aiTagsInput = document.getElementById('aiTags');
const aiGenerateTitleBtn = document.getElementById('aiGenerateTitle');
const aiGenerateDescriptionBtn = document.getElementById('aiGenerateDescription');
const aiGenerateCoverBtn = document.getElementById('aiGenerateCover');
const aiAutoCategoryBtn = document.getElementById('aiAutoCategory');

let summaries = [];
let currentFilters = { query: urlParams.get('q') || '', subject: 'all', level: 'all', year: 'all' };
let currentSort = 'latest';
let currentPage = 1;

const buildOptions = (options, select, label) => {
  if (!select) return;
  select.innerHTML = `
    <option value="all">${label}</option>
    ${options.map((value) => `<option value="${value}">${value}</option>`).join('')}
  `;
};

const updateResultCount = (total) => {
  const countEl = document.getElementById('results-count');
  if (countEl) {
    countEl.textContent = total > 0
      ? `عُثر على ${total} ملخص`
      : 'لا توجد نتائج';
  }
};

const renderCompactStats = (summaries) => {
  const total = summaries.length;
  const files = summaries.filter((item) => item.pdfUrl).length;
  const subjects = new Set(summaries.map((item) => item.subject).filter(Boolean)).size;
  const pending = summaries.filter((item) => item.status === 'قيد المراجعة').length;
  const stats = [
    { icon: 'library_books', label: 'إجمالي الملخصات', value: total },
    { icon: 'download_done', label: 'ملفات مرفوعة', value: files },
    { icon: 'category', label: 'التصنيفات', value: subjects },
    { icon: 'pending_actions', label: 'قيد المراجعة', value: pending }
  ];
  if (compactStatsContainer) {
    compactStatsContainer.innerHTML = stats.map((stat) => `
      <div class="flex items-center gap-3 bg-surface-container-lowest rounded-xl px-4 py-2 border border-outline-variant/20">
        <span class="material-symbols-outlined text-primary">${stat.icon}</span>
        <div class="flex flex-col">
          <span class="font-headline-md text-headline-md font-bold text-on-surface leading-none">${stat.value}</span>
          <span class="font-caption text-caption text-on-surface-variant">${stat.label}</span>
        </div>
      </div>
    `).join('');
  }

  const statValues = { 'إجمالي الملخصات': total, 'ملفات مرفوعة': files, 'التصنيفات': subjects, 'قيد المراجعة': pending };

  [compactStatsDesktop, compactStatsMobile].forEach((container) => {
    if (!container) return;
    const statNumbers = container.querySelectorAll('.stat-number');
    statNumbers.forEach((counterEl) => {
      const card = counterEl.closest('.flex');
      if (!card) return;
      const labelEl = card.querySelector('.font-caption');
      if (!labelEl || !counterEl) return;
      const label = labelEl.textContent.trim();
      if (statValues[label] !== undefined) {
        counterEl.innerText = statValues[label];
      }
    });
  });
};

const render = () => {
  const filtered = filterSummaries(summaries, currentFilters);
  const sorted = sortSummaries(filtered, currentSort);
  const paged = paginateSummaries(sorted, currentPage, 8);
  updateResultCount(filtered.length);
  renderSummariesGrid(listContainer, paged.paginated);
  renderPagination(paginationContainer, paged, (page) => {
    currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  });
};

const setupFilters = async () => {
  const options = await getSummaryOptions();
  buildOptions(options.subjects, subjectSelect, 'كل التصنيفات');
  buildOptions(options.levels, levelSelect, 'كل المستويات');
  buildOptions(options.years, yearSelect, 'كل السنوات');
};

const attachEvents = () => {
  if (searchInput) {
    searchInput.value = currentFilters.query;
    searchInput.addEventListener('input', debounce((event) => {
      currentFilters.query = event.target.value;
      currentPage = 1;
      render();
    }, 250));
    // دعم مسح البحث عند الضغط على Escape
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        searchInput.value = '';
        currentFilters.query = '';
        currentPage = 1;
        render();
      }
    });
  }

  if (subjectSelect) {
    subjectSelect.addEventListener('change', (event) => {
      currentFilters.subject = event.target.value;
      currentPage = 1;
      render();
    });
  }

  if (levelSelect) {
    levelSelect.addEventListener('change', (event) => {
      currentFilters.level = event.target.value;
      currentPage = 1;
      render();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener('change', (event) => {
      currentFilters.year = event.target.value;
      currentPage = 1;
      render();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (event) => {
      currentSort = event.target.value;
      currentPage = 1;
      render();
    });
  }
};

const initPage = async () => {
  try {
    summaries = await getAllSummaries();
    renderCompactStats(summaries);
    await setupFilters();
    attachEvents();
    render();
  } catch (error) {
    console.error(error);
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center p-lg gap-4 text-center">
          <span class="material-symbols-outlined text-[48px] text-error opacity-60">error</span>
          <p class="text-error font-label-md">تعذر تحميل البيانات. تأكد من تشغيل الخادم.</p>
          <button onclick="location.reload()" class="px-4 py-2 bg-primary text-white rounded-lg font-label-md hover:bg-primary/90 transition">
            إعادة المحاولة
          </button>
        </div>
      `;
    }
    if (paginationContainer) paginationContainer.innerHTML = '';
  }
};

// AI Assistant Helpers
const showToast = (message, type = 'success') => {
  const existing = document.getElementById('ai-toast-container');
  if (!existing) {
    const container = document.createElement('div');
    container.id = 'ai-toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;';
    document.body.appendChild(container);
  }
  const container = document.getElementById('ai-toast-container');
  const colors = {
    success: 'background:#166534;color:#fff;',
    error: 'background:#991b1b;color:#fff;',
    info: 'background:#1e3a8a;color:#fff;'
  };
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  const toast = document.createElement('div');
  toast.style.cssText = `${colors[type] || colors.info}padding:12px 20px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);animation:toastIn 0.3s ease;min-width:250px;max-width:400px;`;
  const h = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${icons[type] || 'info'}</span>${h(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

if (!document.getElementById('ai-toast-styles')) {
  const style = document.createElement('style');
  style.id = 'ai-toast-styles';
  style.textContent = `
    @keyframes toastIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes toastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }
  `;
  document.head.appendChild(style);
}

if (aiModelSelect && Array.isArray(AI_MODELS)) {
  AI_MODELS.forEach((model) => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    aiModelSelect.appendChild(option);
  });
}

const getSelectedAiModel = () => (aiModelSelect ? aiModelSelect.value : '');

const setAiButtonLoading = (button, loading) => {
  if (!button) return;
  if (loading) {
    if (button.dataset.idleHtml === undefined) button.dataset.idleHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="material-symbols-outlined animate-spin text-[22px]">progress_activity</span><span class="font-label-md text-label-md">...جاري التوليد</span>`;
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

const getAiContentSource = () => {
  const title = aiTitleInput?.value?.trim() || '';
  const subject = aiSubjectInput?.value?.trim() || '';
  const description = aiDescriptionInput?.value?.trim() || '';
  return { text: description, images: [], pdfName: '', title, subject };
};

const hasAiContent = (content) => Boolean(
  content?.images?.length ||
  content?.pdfName ||
  content?.title ||
  content?.subject ||
  content?.text
);

aiAssistantToggle?.addEventListener('click', () => {
  aiAssistantPanel?.classList.remove('hidden');
});

aiAssistantClose?.addEventListener('click', () => {
  aiAssistantPanel?.classList.add('hidden');
});

aiGenerateTitleBtn?.addEventListener('click', () => {
  runAiTask(aiGenerateTitleBtn, async () => {
    const content = getAiContentSource();
    if (!hasAiContent(content)) {
      showToast('أدخل عنوان أو تصنيف أو نص أولاً لتتمكن من توليد العنوان.', 'info');
      return;
    }
    const title = await generateTitle(content, { model: getSelectedAiModel() });
    aiTitleInput.value = title;
    showToast('تم توليد العنوان. يمكنك تعديله قبل الحفظ.', 'success');
  });
});

aiGenerateDescriptionBtn?.addEventListener('click', () => {
  runAiTask(aiGenerateDescriptionBtn, async () => {
    const content = getAiContentSource();
    if (!hasAiContent(content)) {
      showToast('أدخل عنوان أو تصنيف أو نص أولاً لتتمكن من توليد الوصف.', 'info');
      return;
    }
    const description = await generateDescription(content, { model: getSelectedAiModel() });
    aiDescriptionInput.value = description;
    showToast('تم توليد الوصف. يمكنك تعديله قبل الحفظ.', 'success');
  });
});

aiGenerateCoverBtn?.addEventListener('click', () => {
  runAiTask(aiGenerateCoverBtn, async () => {
    const content = getAiContentSource();
    if (!hasAiContent(content)) {
      showToast('أدخل عنوان أو تصنيف أو نص أولاً لتتمكن من توليد Cover Prompt.', 'info');
      return;
    }
    const coverPrompt = await generateCoverPrompt(content, { model: getSelectedAiModel() });
    aiCoverPromptInput.value = coverPrompt;
    showToast('تم توليد Cover Prompt. يمكنك تعديله قبل الحفظ.', 'success');
  });
});

aiAutoCategoryBtn?.addEventListener('click', () => {
  runAiTask(aiAutoCategoryBtn, async () => {
    const content = getAiContentSource();
    if (!hasAiContent(content)) {
      showToast('أدخل عنوان أو تصنيف أو نص أولاً لتتمكن من اقتراح التصنيف.', 'info');
      return;
    }
    const category = await suggestCategory(content, { model: getSelectedAiModel() });
    if (category.subject) aiSubjectInput.value = category.subject;
    if (category.section) aiSectionInput.value = category.section;
    if (category.level) aiLevelInput.value = category.level;
    if (category.year) aiYearInput.value = category.year;
    if (category.tags?.length) aiTagsInput.value = category.tags.join('، ');
    showToast('تم اقتراح التصنيف. راجعه وعدّله قبل الحفظ.', 'success');
  });
});

initPage();
