import { getSummaryById, getSimilarSummaries } from './api.js';
import { qs, qsa, createElementFromHTML, safeText } from './helpers.js';
import { createSummaryCover } from './covers.js';

const queryId = new URLSearchParams(window.location.search).get('id');
const titleEls = qsa('[data-summary-title]');
const subjectEl = qs('[data-summary-subject]');
const levelEl = qs('[data-summary-level]');
const pagesEl = qs('[data-summary-pages]');
const yearEl = qs('[data-summary-year]');
const descriptionEl = qs('[data-summary-description]');
const sizeEl = qs('[data-summary-size]');
const authorEl = qs('[data-summary-author]');
const pdfUrlEl = qs('[data-summary-pdf-link]');

const canvas = qs('#pdf-canvas');
const placeholder = qs('#pdf-placeholder');
const pageInfo = qs('#page-info');
const zoomLevel = qs('#zoom-level');
const prevBtn = qs('#prev-page');
const nextBtn = qs('#next-page');
const zoomInBtn = qs('#zoom-in');
const zoomOutBtn = qs('#zoom-out');
const imagePage = qs('#image-page');
const downloadPage = qs('#download-page');
const relatedHeading = qs('.mt-xl h3');
const navSearchButton = qs('a[aria-label="Search"]');
const mobilePageInfo = document.getElementById('mobile-page-info');

const mobileThumbsWrap = document.getElementById('mobile-thumbs-wrap');
const mobileThumbs = document.getElementById('mobile-thumbs');
const mobileStage = document.getElementById('mobile-stage');
const desktopStage = document.getElementById('pdf-container');
const mobileZoomIn = document.getElementById('mobile-zoom-in');
const mobileZoomOut = document.getElementById('mobile-zoom-out');

const fsViewer = document.getElementById('fullscreen-viewer');
const fsViewport = document.getElementById('fs-viewport');
const fsImageEl = document.getElementById('fs-image');
const fsCanvasEl = document.getElementById('fs-canvas');
const fsIndicator = document.getElementById('fs-indicator');
const fsClose = document.getElementById('fs-close');
const fsDownload = document.getElementById('fs-download');

let pdfDoc = null;
let imagePages = [];
let currentImageIndex = 0;
let currentPage = 1;
let totalPages = 0;
let currentScale = 1.0;
let viewerMode = 'empty';
let lastImageIndex = -1;
let lastPdfPage = -1;
let currentSummary = null;
let fsTouchMoved = false;

const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
const isFullscreenDevice = () => window.matchMedia('(max-width: 1024px)').matches;

const relatedSlider = document.getElementById('related-slider');
const relatedGrid = document.getElementById('related-summary-cards');
const relatedPrev = document.getElementById('related-prev');
const relatedNext = document.getElementById('related-next');

const pagesSliderContainer = document.getElementById('pages-slider-container');
const pagesSlider = document.getElementById('pages-slider');
const pagesPrev = document.getElementById('pages-prev');
const pagesNext = document.getElementById('pages-next');

const setPdfControlsEnabled = (enabled) => {
  [prevBtn, nextBtn, zoomInBtn, zoomOutBtn].forEach((button) => {
    if (button) button.disabled = !enabled;
  });
  if (pageInfo && !enabled) pageInfo.textContent = '0 / 0';
};

const renderPage = async (pageNum) => {
  if (!pdfDoc || !canvas) return;
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: currentScale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.maxWidth = isMobile() ? 'none' : '100%';
  if (pageNum !== lastPdfPage) {
    canvas.style.opacity = '0';
    lastPdfPage = pageNum;
  }
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  canvas.style.opacity = '1';
  if (pageInfo) pageInfo.textContent = `${pageNum} / ${totalPages}`;
  if (mobilePageInfo) mobilePageInfo.textContent = `صفحة ${pageNum} من ${totalPages}`;
  if (prevBtn) prevBtn.disabled = pageNum <= 1;
  if (nextBtn) nextBtn.disabled = pageNum >= totalPages;
};

const renderImagePage = () => {
  if (!imagePage || !imagePages.length) return;
  const url = imagePages[currentImageIndex];
  viewerMode = 'images';
  currentPage = currentImageIndex + 1;
  totalPages = imagePages.length;
  if (currentImageIndex !== lastImageIndex) {
    imagePage.style.opacity = '0';
    imagePage.onload = () => { imagePage.style.opacity = '1'; };
    lastImageIndex = currentImageIndex;
  }
  imagePage.src = url;
  imagePage.style.transform = `scale(${currentScale})`;
  imagePage.classList.remove('hidden');
  if (canvas) canvas.classList.add('hidden');
  if (placeholder) placeholder.classList.add('hidden');
  setPdfControlsEnabled(true);
  if (downloadPage) {
    downloadPage.href = url;
    downloadPage.download = `summary-page-${currentImageIndex + 1}.webp`;
    downloadPage.classList.remove('hidden');
  }
  if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}`;
  if (mobilePageInfo) mobilePageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentImageIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentImageIndex >= imagePages.length - 1;
  updatePagesSliderActive();
  updateMobileThumbsActive();
};

const updatePagesSliderActive = () => {
  if (!pagesSlider || isMobile()) return;
  const buttons = Array.from(pagesSlider.querySelectorAll('button'));
  buttons.forEach((btn, index) => {
    if (index === currentImageIndex) {
      btn.classList.add('border-primary');
      btn.classList.remove('border-outline-variant/30', 'hover:border-primary/50');
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      btn.classList.remove('border-primary');
      btn.classList.add('border-outline-variant/30', 'hover:border-primary/50');
    }
  });
};

const isSliderHorizontal = isMobile;

const updatePagesSliderButtons = () => {
  if (!pagesSlider || !pagesPrev || !pagesNext) return;
  const horizontal = isSliderHorizontal();
  const maxScroll = horizontal
    ? pagesSlider.scrollWidth - pagesSlider.clientWidth
    : pagesSlider.scrollHeight - pagesSlider.clientHeight;
  const pos = horizontal ? pagesSlider.scrollLeft : pagesSlider.scrollTop;
  pagesPrev.style.opacity = pos <= 4 ? '0' : '1';
  pagesPrev.style.pointerEvents = pos <= 4 ? 'none' : 'auto';
  pagesNext.style.opacity = pos >= maxScroll - 4 ? '0' : '1';
  pagesNext.style.pointerEvents = pos >= maxScroll - 4 ? 'none' : 'auto';
};

const scrollPagesSlider = (direction) => {
  if (!pagesSlider) return;
  const card = pagesSlider.querySelector('button');
  if (!card) return;
  const horizontal = isSliderHorizontal();
  const cardSize = horizontal ? card.offsetWidth + 12 : card.offsetHeight + 16;
  const scrollAmount = cardSize * (direction === 'next' ? 1 : -1);
  const axis = horizontal ? 'left' : 'top';
  pagesSlider.scrollBy({ [axis]: scrollAmount, behavior: 'smooth' });
};

const renderPagesSlider = () => {
  if (!pagesSliderContainer || !pagesSlider) return;
  if (imagePages.length <= 1) {
    pagesSliderContainer.classList.add('hidden');
    pagesSliderContainer.classList.remove('flex');
    return;
  }
  
  pagesSliderContainer.classList.remove('hidden');
  pagesSliderContainer.classList.add('flex');
  pagesSlider.innerHTML = '';

  const horizontal = isSliderHorizontal();
  if (pagesPrev) pagesPrev.querySelector('.material-symbols-outlined').textContent = horizontal ? 'chevron_right' : 'keyboard_arrow_up';
  if (pagesNext) pagesNext.querySelector('.material-symbols-outlined').textContent = horizontal ? 'chevron_left' : 'keyboard_arrow_down';
  
  imagePages.forEach((url, index) => {
    const card = createElementFromHTML(`
      <button class="group relative w-[64px] md:w-[100px] shrink-0 snap-start rounded-lg border-2 overflow-hidden transition-all ${index === currentImageIndex ? 'border-primary' : 'border-outline-variant/30 hover:border-primary/50'} bg-white flex flex-col">
        <img src="${url}" class="w-full h-auto object-contain" loading="lazy" alt="الصفحة ${index + 1}">
        <div class="w-full bg-surface/90 backdrop-blur-sm py-1 text-center font-caption text-[11px] text-on-surface border-t border-outline-variant/20">
          صفحة ${index + 1}
        </div>
      </button>
    `);
    
    card.addEventListener('click', () => {
      currentImageIndex = index;
      renderImagePage();
    });
    
    pagesSlider.appendChild(card);
  });
  
  updatePagesSliderButtons();
  renderMobileThumbs();
};

const renderMobileThumbs = () => {
  if (!mobileThumbs || !mobileThumbsWrap) return;
  if (!isMobile() || imagePages.length <= 1) {
    mobileThumbsWrap.classList.add('hidden');
    return;
  }
  mobileThumbsWrap.classList.remove('hidden');
  mobileThumbs.innerHTML = '';

  imagePages.forEach((url, index) => {
    const btn = createElementFromHTML(`
      <button class="shrink-0 snap-center w-[64px] aspect-[1/1.414] rounded-lg overflow-hidden border-2 transition-all ${index === currentImageIndex ? 'border-primary' : 'border-transparent'} bg-surface-container-low" aria-label="الصفحة ${index + 1}">
        <img src="${url}" class="w-full h-full object-cover" loading="lazy" alt="الصفحة ${index + 1}">
      </button>
    `);
    btn.addEventListener('click', () => {
      currentImageIndex = index;
      renderImagePage();
    });
    mobileThumbs.appendChild(btn);
  });

  updateMobileThumbsActive();
};

const updateMobileThumbsActive = () => {
  if (!mobileThumbs) return;
  const btns = mobileThumbs.querySelectorAll('button');
  btns.forEach((btn, index) => {
    if (index === currentImageIndex) {
      btn.classList.add('border-primary');
      btn.classList.remove('border-transparent');
    } else {
      btn.classList.remove('border-primary');
      btn.classList.add('border-transparent');
    }
  });
  const active = btns[currentImageIndex];
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
};

const stageNodes = [placeholder, canvas, imagePage].filter(Boolean);

const relocateStage = () => {
  if (!mobileStage || !desktopStage) return;
  const target = isMobile() ? mobileStage : desktopStage;
  stageNodes.forEach((node) => {
    if (node.parentElement !== target) target.appendChild(node);
  });
};

const renderCurrent = async () => {
  if (viewerMode === 'images') {
    renderImagePage();
  } else if (viewerMode === 'pdf' && pdfDoc) {
    await renderPage(currentPage);
  }
};

const goNext = async () => {
  if (viewerMode === 'images') {
    if (currentImageIndex < imagePages.length - 1) {
      currentImageIndex += 1;
      renderImagePage();
    }
    return;
  }
  if (pdfDoc && currentPage < totalPages) {
    currentPage += 1;
    currentImageIndex = currentPage - 1;
    await renderPage(currentPage);
  }
};

const goPrev = async () => {
  if (viewerMode === 'images') {
    if (currentImageIndex > 0) {
      currentImageIndex -= 1;
      renderImagePage();
    }
    return;
  }
  if (pdfDoc && currentPage > 1) {
    currentPage -= 1;
    currentImageIndex = currentPage - 1;
    await renderPage(currentPage);
  }
};

const applyZoom = (delta) => {
  currentScale = Math.min(3.0, Math.max(0.5, currentScale + delta));
  if (zoomLevel) zoomLevel.textContent = `${Math.round(currentScale * 100)}%`;
  if (viewerMode === 'images') {
    renderImagePage();
  } else if (pdfDoc) {
    renderPage(currentPage);
  }
};

const initMobileViewer = () => {
  if (!mobileStage) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  mobileStage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchActive = true;
    fsTouchMoved = false;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  mobileStage.addEventListener('touchmove', (e) => {
    if (!touchActive || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) fsTouchMoved = true;
  }, { passive: true });

  mobileStage.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    if (currentScale !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }, { passive: true });
};

const loadImagePages = (pages) => {
  imagePages = Array.isArray(pages) ? pages.filter(Boolean) : [];
  if (!imagePages.length) return false;
  pdfDoc = null;
  currentImageIndex = 0;
  currentScale = 1;
  if (zoomLevel) zoomLevel.textContent = '100%';
  renderPagesSlider();
  renderImagePage();
  relocateStage();
  renderCurrent();
  return true;
};

const loadPdf = async (url) => {
  if (!url || !canvas || !placeholder || !window.pdfjsLib) {
    setPdfControlsEnabled(false);
    return false;
  }
  try {
    viewerMode = 'pdf';
    imagePages = [];
    if (imagePage) imagePage.classList.add('hidden');
    if (downloadPage) downloadPage.classList.add('hidden');
    const loadingTask = pdfjsLib.getDocument(url);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    currentPage = 1;
    setPdfControlsEnabled(true);
    canvas.classList.remove('hidden');
    placeholder.classList.add('hidden');
    await renderPage(currentPage);
    relocateStage();
    await renderCurrent();
    return true;
  } catch (error) {
    console.error('Failed to load PDF:', error);
    setPdfControlsEnabled(false);
    canvas.classList.add('hidden');
    placeholder.classList.remove('hidden');
    placeholder.querySelector('h2').textContent = 'تعذر فتح ملف PDF';
    placeholder.querySelector('p').textContent = 'يرجى التحقق من وجود الملف أو تجربة رابط المصدر.';
    return false;
  }
};

const setSummaryDetails = (summary) => {
  if (!summary) {
    document.body.innerHTML = `<main class="container mx-auto py-24 text-center"><h1 class="text-4xl font-semibold">ملخص غير موجود</h1><p class="mt-4 text-on-surface-variant">يرجى التحقق من رابط الملخص أو العودة إلى الصفحة الرئيسية.</p><a href="summaries.html" class="inline-flex mt-8 px-6 py-3 rounded-xl bg-primary text-on-primary">عودة إلى الملخصات</a></main>`;
    return;
  }

  currentSummary = summary;

  titleEls.forEach((element) => {
    element.textContent = summary.title;
  });
  document.title = `${summary.title} | ملخصاتي`;
  if (subjectEl) subjectEl.textContent = summary.subject || 'غير محدد';
  if (levelEl) levelEl.textContent = summary.level || 'غير محدد';
  const pagesCount = summary.pageImages?.length || summary.pages || 0;
  if (pagesEl) pagesEl.textContent = pagesCount ? `${pagesCount} صفحة` : 'غير محدد';
  if (yearEl) yearEl.textContent = summary.year || 'غير محدد';
  if (descriptionEl) descriptionEl.textContent = summary.description || 'لا يوجد وصف متاح لهذا الملخص.';
  if (sizeEl) sizeEl.textContent = summary.size || 'غير محدد';
  if (authorEl) {
    authorEl.innerHTML = `
      <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <span class="material-symbols-outlined">person</span>
      </div>
      <div>
        <p class="font-caption text-caption text-on-surface-variant">المؤلف</p>
        <p class="font-label-md text-label-md text-on-background">${safeText(summary.author || 'غير محدد')}</p>
      </div>
    `;
  }
  if (pdfUrlEl) {
    if (summary.pdfUrl) {
      pdfUrlEl.textContent = summary.pdfName || 'عرض ملف PDF';
      pdfUrlEl.href = summary.pdfUrl;
      pdfUrlEl.setAttribute('download', summary.pdfName || '');
    } else {
      pdfUrlEl.textContent = 'غير متوفر';
      pdfUrlEl.removeAttribute('href');
      pdfUrlEl.removeAttribute('download');
    }
  }
  if (relatedHeading) relatedHeading.textContent = `ملخصات مشابهة في ${summary.subject || 'نفس التصنيف'}`;

  if (loadImagePages(summary.pageImages)) {
    return;
  }

  if (summary.pdfUrl) {
    loadPdf(summary.pdfUrl);
  } else if (placeholder) {
    viewerMode = 'empty';
    setPdfControlsEnabled(false);
    placeholder.classList.remove('hidden');
    if (canvas) canvas.classList.add('hidden');
    if (imagePage) imagePage.classList.add('hidden');
    if (downloadPage) downloadPage.classList.add('hidden');
  }
};

const renderRelatedSummaries = (similarSummaries) => {
  if (!relatedSlider && !relatedGrid) return;

  const container = relatedGrid || relatedSlider;
  container.innerHTML = '';

  const items = similarSummaries.slice(0, 4);
  if (items.length === 0) {
    const wrapper = relatedGrid ? document.querySelector('.mt-xl') : null;
    if (wrapper) wrapper.classList.add('hidden');
    return;
  }

  items.forEach((item) => {
    const card = createElementFromHTML(`
      <a href="summary.html?id=${item.id}" class="group block rounded-2xl border border-outline-variant/20 overflow-hidden bg-surface-container-lowest shadow-sm transition-all hover:shadow-md hover:border-primary/20">
        ${createSummaryCover(item, { className: 'aspect-[5/3] w-full', compact: true })}
        <div class="p-sm">
          <h3 class="font-label-lg text-on-surface line-clamp-2 leading-snug">${safeText(item.title)}</h3>
          <p class="font-caption text-on-surface-variant mt-1.5">${safeText(item.subject || '')} ${item.level ? `• ${safeText(item.level)}` : ''}</p>
        </div>
      </a>
    `);
    container.appendChild(card);
  });

  updateSliderButtons();
};

const scrollSlider = (direction) => {
  if (!relatedSlider) return;
  const card = relatedSlider.querySelector('a');
  if (!card) return;
  const cardWidth = card.offsetWidth + 16;
  const scrollAmount = cardWidth * (direction === 'next' ? 1 : -1);
  relatedSlider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
};

const updateSliderButtons = () => {
  if (!relatedSlider || !relatedPrev || !relatedNext) return;
  const maxScrollLeft = relatedSlider.scrollWidth - relatedSlider.clientWidth;
  relatedPrev.style.opacity = relatedSlider.scrollLeft <= 4 ? '0' : '1';
  relatedPrev.style.pointerEvents = relatedSlider.scrollLeft <= 4 ? 'none' : 'auto';
  relatedNext.style.opacity = relatedSlider.scrollLeft >= maxScrollLeft - 4 ? '0' : '1';
  relatedNext.style.pointerEvents = relatedSlider.scrollLeft >= maxScrollLeft - 4 ? 'none' : 'auto';
};

/* ============================================================
   Mobile / Tablet Full-Screen Page Viewer
   ============================================================ */
let fsOpen = false;
let fsZoom = 1;
let fsPanX = 0;
let fsPanY = 0;
let fsDragX = 0;
let fsDragY = 0;
let fsPushed = false;
let fsTouchStartX = 0;
let fsTouchStartY = 0;
let fsTouchStartT = 0;
let fsPointerActive = false;
let fsLastTap = 0;

const currentFsEl = () => (viewerMode === 'pdf' && pdfDoc) ? fsCanvasEl : fsImageEl;

const setFsTransform = (extraX = 0) => {
  const el = currentFsEl();
  if (!el) return;
  el.style.transform = `translate(${fsPanX + extraX}px, ${fsPanY}px) scale(${fsZoom})`;
};

const updateFsIndicator = () => {
  if (fsIndicator) fsIndicator.textContent = `${currentImageIndex + 1} / ${totalPages}`;
};

const updateFsDownload = () => {
  if (!fsDownload) return;
  if (viewerMode === 'pdf' && currentSummary && currentSummary.pdfUrl) {
    fsDownload.href = currentSummary.pdfUrl;
    fsDownload.download = currentSummary.pdfName || 'summary.pdf';
    fsDownload.classList.remove('hidden');
  } else if (viewerMode === 'images' && imagePages[currentImageIndex]) {
    fsDownload.href = imagePages[currentImageIndex];
    fsDownload.download = `summary-page-${currentImageIndex + 1}.webp`;
    fsDownload.classList.remove('hidden');
  } else {
    fsDownload.classList.add('hidden');
  }
};

const preloadNeighbors = () => {
  if (viewerMode !== 'images') return;
  if (currentImageIndex > 0) { const img = new Image(); img.src = imagePages[currentImageIndex - 1]; }
  if (currentImageIndex < imagePages.length - 1) { const img = new Image(); img.src = imagePages[currentImageIndex + 1]; }
};

const renderFsPdfPage = async () => {
  if (!pdfDoc || !fsCanvasEl) return;
  try {
    const page = await pdfDoc.getPage(currentImageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const fit = Math.min(window.innerWidth / base.width, window.innerHeight / base.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.max(0.5, fit) * dpr;
    const viewport = page.getViewport({ scale });
    fsCanvasEl.width = viewport.width;
    fsCanvasEl.height = viewport.height;
    fsCanvasEl.style.maxWidth = '100%';
    fsCanvasEl.style.maxHeight = '100%';
    await page.render({ canvasContext: fsCanvasEl.getContext('2d'), viewport }).promise;
  } catch (err) {
    console.error('Failed to render fullscreen PDF page:', err);
  }
};

const setFsContent = () => {
  if (viewerMode === 'pdf' && pdfDoc) {
    fsImageEl.classList.add('hidden');
    fsCanvasEl.classList.remove('hidden');
    renderFsPdfPage();
  } else {
    fsCanvasEl.classList.add('hidden');
    fsImageEl.classList.remove('hidden');
    fsImageEl.src = imagePages[currentImageIndex];
    preloadNeighbors();
  }
  updateFsIndicator();
  updateFsDownload();
};

const hideFullscreen = () => {
  if (!fsOpen) return;
  fsOpen = false;
  if (fsViewer) fsViewer.classList.add('hidden');
  document.body.style.overflow = '';
  if (viewerMode === 'images' && imagePages.length) renderImagePage();
  else if (viewerMode === 'pdf' && pdfDoc) renderCurrent();
  updateMobileThumbsActive();
  updatePagesSliderActive();
};

const closeFullscreen = () => {
  if (!fsOpen) return;
  hideFullscreen();
  if (fsPushed) {
    fsPushed = false;
    history.back();
  }
};

const openFullscreen = () => {
  if (fsOpen || !isFullscreenDevice()) return;
  if (!((viewerMode === 'images' && imagePages.length) || (viewerMode === 'pdf' && pdfDoc))) return;
  fsOpen = true;
  fsZoom = 1;
  fsPanX = 0;
  fsPanY = 0;
  fsDragX = 0;
  fsDragY = 0;
  if (viewerMode === 'pdf' && pdfDoc) currentImageIndex = currentPage - 1;
  if (fsViewer) fsViewer.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setFsContent();
  setFsTransform(0);
  history.pushState({ fullscreen: true }, '');
  fsPushed = true;
};

let fsAnimating = false;
const animateFsPageChange = (dir) => {
  if (fsAnimating || fsZoom !== 1) return;
  const el = currentFsEl();
  if (!el) return;
  fsAnimating = true;
  const w = window.innerWidth;
  el.style.transition = 'transform 200ms ease';
  el.style.transform = `translate(${dir > 0 ? -w : w}px, 0px) scale(1)`;
  const finish = async () => {
    if (dir > 0) await goNext();
    else await goPrev();
    setFsContent();
    const el2 = currentFsEl();
    if (!el2) { fsAnimating = false; return; }
    el2.style.transition = 'none';
    el2.style.transform = `translate(${dir > 0 ? w : -w}px, 0px) scale(1)`;
    void el2.offsetWidth;
    requestAnimationFrame(() => {
      el2.style.transition = 'transform 200ms ease';
      el2.style.transform = 'translate(0px, 0px) scale(1)';
      fsAnimating = false;
    });
  };
  let done = false;
  const run = () => { if (done) return; done = true; el.removeEventListener('transitionend', run); finish(); };
  el.addEventListener('transitionend', run);
  setTimeout(run, 230);
};

const initFullscreenViewer = () => {
  if (!fsViewport) return;

  fsClose?.addEventListener('click', closeFullscreen);

  fsViewport.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const el = currentFsEl();
    if (el) el.style.transition = 'none';
    fsTouchStartX = e.touches[0].clientX;
    fsTouchStartY = e.touches[0].clientY;
    fsTouchStartT = Date.now();
    fsPointerActive = true;
  }, { passive: true });

  fsViewport.addEventListener('touchmove', (e) => {
    if (!fsPointerActive || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - fsTouchStartX;
    const dy = e.touches[0].clientY - fsTouchStartY;
    if (fsZoom > 1) {
      fsPanX = fsDragX + dx;
      fsPanY = fsDragY + dy;
      setFsTransform(0);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      setFsTransform(dx);
    }
  }, { passive: true });

  fsViewport.addEventListener('touchend', (e) => {
    if (!fsPointerActive) return;
    fsPointerActive = false;
    const dx = e.changedTouches[0].clientX - fsTouchStartX;
    const dy = e.changedTouches[0].clientY - fsTouchStartY;
    const dt = Date.now() - fsTouchStartT;

    if (dt < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      if (Date.now() - fsLastTap < 300) {
        fsZoom = fsZoom > 1 ? 1 : 2.5;
        fsPanX = 0;
        fsPanY = 0;
        fsDragX = 0;
        fsDragY = 0;
        const el = currentFsEl();
        if (el) {
          el.style.transition = 'transform 200ms ease';
          el.style.transform = `translate(0px, 0px) scale(${fsZoom})`;
        }
        fsLastTap = 0;
        return;
      }
      fsLastTap = Date.now();
    }

    if (fsZoom > 1) {
      fsDragX = fsPanX;
      fsDragY = fsPanY;
      return;
    }

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      animateFsPageChange(dx < 0 ? 1 : -1);
    } else {
      const el = currentFsEl();
      if (el) {
        el.style.transition = 'transform 200ms ease';
        el.style.transform = 'translate(0px, 0px) scale(1)';
      }
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (fsOpen && viewerMode === 'pdf' && pdfDoc) renderFsPdfPage();
  });
};

const initPage = async () => {
  navSearchButton?.addEventListener('click', () => {
    window.location.href = 'summaries.html';
  });

  try {
    const summary = await getSummaryById(queryId);
    if (!summary) {
      setSummaryDetails(null);
      return;
    }
    setSummaryDetails(summary);
    renderRelatedSummaries(await getSimilarSummaries(summary));
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<main class="container mx-auto py-24 text-center"><h1 class="text-4xl font-semibold">تعذر تحميل البيانات</h1><p class="mt-4 text-on-surface-variant">يرجى تشغيل المشروع عبر الخادم المحلي والمحاولة مرة أخرى.</p><a href="summaries.html" class="inline-flex mt-8 px-6 py-3 rounded-xl bg-primary text-on-primary">عودة إلى الملخصات</a></main>`;
    return;
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', goPrev);
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', goNext);
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => applyZoom(0.25));
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => applyZoom(-0.25));
  }

  if (mobileZoomIn) {
    mobileZoomIn.addEventListener('click', () => applyZoom(0.25));
  }

  if (mobileZoomOut) {
    mobileZoomOut.addEventListener('click', () => applyZoom(-0.25));
  }

  initMobileViewer();
  initFullscreenViewer();

  const onPageTap = () => {
    if (!isFullscreenDevice()) return;
    if (fsTouchMoved) return;
    openFullscreen();
  };
  if (imagePage) imagePage.addEventListener('click', onPageTap);
  if (canvas) canvas.addEventListener('click', onPageTap);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fsOpen) closeFullscreen();
  });
  window.addEventListener('popstate', () => {
    if (fsOpen) {
      fsPushed = false;
      hideFullscreen();
    }
  });

  const mq = window.matchMedia('(max-width: 767px)');
  mq.addEventListener('change', async (e) => {
    relocateStage();
    await renderCurrent();
    if (e.matches) {
      renderMobileThumbs();
    } else {
      updatePagesSliderActive();
    }
  });

  if (relatedSlider) {
    relatedSlider.addEventListener('scroll', updateSliderButtons);
  }
  if (relatedPrev) {
    relatedPrev.addEventListener('click', () => scrollSlider('prev'));
  }
  if (relatedNext) {
    relatedNext.addEventListener('click', () => scrollSlider('next'));
  }

  if (pagesSlider) {
    pagesSlider.addEventListener('scroll', updatePagesSliderButtons);
  }
  if (pagesPrev) {
    pagesPrev.addEventListener('click', () => scrollPagesSlider('prev'));
  }
  if (pagesNext) {
    pagesNext.addEventListener('click', () => scrollPagesSlider('next'));
  }
};

initPage();
