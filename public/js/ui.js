import { qs, qsa, createElementFromHTML } from './helpers.js';
import { createSummaryCover } from './covers.js';

export const clearChildren = (element) => {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
};

export const renderStatBlocks = (container, stats) => {
  clearChildren(container);
  stats.forEach((stat) => {
    const card = createElementFromHTML(`
      <div class="flex items-center gap-3 p-sm rounded-xl border border-outline-variant/10 bg-surface-container-low/60">
        <span class="material-symbols-outlined text-primary text-[28px]">${stat.icon || 'info'}</span>
        <div class="flex flex-col">
          <div class="font-display-lg-mobile text-primary font-bold leading-none stat-number" data-target="${stat.target}">${stat.initial}</div>
          <div class="font-body-md text-on-surface-variant">${stat.label}</div>
        </div>
      </div>
    `);
    container.appendChild(card);
  });
};

export const createSummaryCard = (summary) => {
  const cover = createSummaryCover(summary, { fit: 'contain' });

  const card = createElementFromHTML(`
    <article class="bg-surface-container-lowest rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_25px_rgba(17,85,208,0.08)] transition-all duration-300 group overflow-hidden border border-surface-container flex flex-col cursor-pointer" data-summary-id="${summary.id}">
      <a href="summary.html?id=${summary.id}" class="aspect-[4/3] overflow-hidden relative bg-surface-container flex-shrink-0 block group">
        ${cover}
      </a>
      <div class="p-3 md:p-4 text-right flex flex-col flex-1">
        <div class="flex flex-row-reverse items-center justify-between mb-2">
          <span class="bg-primary-fixed text-primary px-2.5 py-1 rounded-full text-[11px] font-bold">${summary.subject}</span>
        </div>
        <a href="summary.html?id=${summary.id}" class="font-headline-md text-headline-md text-on-surface mb-1.5 leading-snug line-clamp-2 hover:text-primary transition-colors">${summary.title}</a>
        <div class="flex items-center gap-3 text-on-surface-variant mb-4">
          <span class="flex items-center gap-1 font-caption text-caption">
            <span class="material-symbols-outlined text-[16px]">description</span>
            ${summary.pages} صفحة
          </span>
          <span class="flex items-center gap-1 font-caption text-caption">
            <span class="material-symbols-outlined text-[16px]">hard_drive</span>
            ${summary.size}
          </span>
        </div>
        <a href="summary.html?id=${summary.id}" class="w-full py-2.5 border border-primary/20 text-primary rounded-lg font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-all duration-200 border block text-center mt-auto">عرض الملخص</a>
      </div>
    </article>
  `);

  card.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    window.location.href = `summary.html?id=${summary.id}`;
  });

  return card;
};

export const renderSummariesGrid = (container, summaries) => {
  clearChildren(container);
  if (summaries.length === 0) {
    container.appendChild(createElementFromHTML('<div class="text-center p-lg text-on-surface-variant">لا توجد ملخصات مطابقة للبحث.</div>'));
    return;
  }
  summaries.forEach((summary) => container.appendChild(createSummaryCard(summary)));
};

export const renderPagination = (container, pageInfo, onPageChange) => {
  const { current, totalPages } = pageInfo;
  clearChildren(container);

  const createPageButton = (page, active = false) => {
    const btn = createElementFromHTML(`
      <button class="w-10 h-10 rounded-lg ${active ? 'bg-primary text-on-primary' : 'border border-outline-variant hover:bg-primary/5 text-on-surface-variant'} transition-all font-label-md text-label-md">${page}</button>
    `);
    btn.addEventListener('click', () => onPageChange(page));
    return btn;
  };

  if (current > 1) {
    const prev = createElementFromHTML(`
      <button class="w-10 h-10 rounded-lg border border-outline-variant hover:bg-primary/5 text-on-surface-variant transition-all flex items-center justify-center">
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
    `);
    prev.addEventListener('click', () => onPageChange(current - 1));
    container.appendChild(prev);
  }

  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, current + 2);

  for (let page = start; page <= end; page += 1) {
    container.appendChild(createPageButton(page, page === current));
  }

  if (current < totalPages) {
    const next = createElementFromHTML(`
      <button class="w-10 h-10 rounded-lg border border-outline-variant hover:bg-primary/5 text-on-surface-variant transition-all flex items-center justify-center">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
    `);
    next.addEventListener('click', () => onPageChange(current + 1));
    container.appendChild(next);
  }
};
