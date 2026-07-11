import { getAllSummaries, getFeaturedCards } from './api.js';
import { renderStatBlocks } from './ui.js';
import { escapeHtml } from './helpers.js';

const statsContainer = document.getElementById('stats-container');
const featuredGrid = document.getElementById('featured-grid');
const heroSearchInputs = document.querySelectorAll('#hero-search-desktop, #hero-search-mobile');
const heroSearchButtons = document.querySelectorAll('#hero-search-btn-desktop, #hero-search-btn-mobile');

const featuredColorClasses = (color) => ({
  primary: { iconBg: 'bg-primary-fixed/40', iconText: 'text-primary', badgeBg: 'bg-primary-fixed', badgeText: 'text-primary' },
  secondary: { iconBg: 'bg-secondary-fixed/40', iconText: 'text-secondary', badgeBg: 'bg-secondary-fixed', badgeText: 'text-secondary' },
  tertiary: { iconBg: 'bg-tertiary-fixed/40', iconText: 'text-tertiary', badgeBg: 'bg-tertiary-fixed', badgeText: 'text-tertiary' },
  neutral: { iconBg: 'bg-surface-container-high', iconText: 'text-on-surface-variant', badgeBg: 'bg-surface-container-high', badgeText: 'text-on-surface-variant' }
}[color] || { iconBg: 'bg-primary-fixed/40', iconText: 'text-primary', badgeBg: 'bg-primary-fixed', badgeText: 'text-primary' });

const palettes = [
  { from: '#0050cb', to: '#00a676' },
  { from: '#6d28d9', to: '#0ea5e9' },
  { from: '#0f766e', to: '#84cc16' },
  { from: '#be123c', to: '#f59e0b' },
  { from: '#334155', to: '#14b8a6' },
  { from: '#7c2d12', to: '#dc2626' }
];

const iconRules = [
  { keys: ['رياضيات', 'math', 'جبر', 'هندسة', 'احصاء'], icon: 'calculate' },
  { keys: ['فيزياء', 'physics'], icon: 'science' },
  { keys: ['كيمياء', 'chemistry'], icon: 'biotech' },
  { keys: ['علوم', 'science', 'احياء'], icon: 'experiment' },
  { keys: ['لغة', 'عربية', 'فرنسية', 'انجليزية', 'english', 'french'], icon: 'translate' },
  { keys: ['تاريخ', 'جغرافيا', 'history', 'geo'], icon: 'public' },
  { keys: ['برمجة', 'اعلام', 'معلوماتية', 'data', 'python', 'machine'], icon: 'code' },
  { keys: ['اقتصاد', 'تسيير', 'محاسبة', 'business'], icon: 'monitoring' }
];

const hashText = (text) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pickIcon = (text) => {
  const haystack = String(text || '').toLowerCase();
  return iconRules.find((rule) => rule.keys.some((key) => haystack.includes(key.toLowerCase())))?.icon || 'auto_stories';
};

const renderFeaturedCover = (card) => {
  if (card.coverImage) {
    return `<img src="${escapeHtml(card.coverImage)}" alt="" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'h-full w-full flex items-center justify-center bg-surface-container-high\\'><span class=\\'material-symbols-outlined text-surface-container-high text-5xl\\'>image_not_supported</span></div>'">`;
  }
  const palette = palettes[hashText(card.title || card.subject || 'cover') % palettes.length];
  const icon = pickIcon(`${card.subject} ${card.title}`);
  return `
    <div class="absolute inset-0 flex items-center justify-center" style="background: linear-gradient(135deg, ${palette.from}, ${palette.to});">
      <span class="material-symbols-outlined text-white/10 text-[80px] md:text-[100px]">${escapeHtml(icon)}</span>
    </div>
  `;
};

const renderFeaturedCards = (cards) => {
  if (!featuredGrid) return;
  featuredGrid.innerHTML = '';
  if (!cards.length) return;

  cards.forEach((card) => {
    const c = featuredColorClasses(card.color);
    const link = card.subject ? `summaries.html?q=${encodeURIComponent(card.subject)}` : 'summaries.html';
    const cover = renderFeaturedCover(card);
    const el = document.createElement('article');
    el.className = 'bg-surface-container-lowest rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_25px_rgba(17,85,208,0.08)] transition-all duration-300 group overflow-hidden border border-surface-container flex flex-col';
    el.innerHTML = `
      <div class="aspect-[4/3] overflow-hidden relative bg-surface-container flex-shrink-0">
        ${cover}
      </div>
      <div class="p-3 md:p-4 text-right flex flex-col flex-1">
        <div class="flex flex-row-reverse items-center justify-between mb-2">
          <span class="${c.badgeBg} ${c.badgeText} px-2.5 py-1 rounded-full text-[11px] font-bold">${escapeHtml(card.badge || '')}</span>
        </div>
        <h3 class="font-headline-md text-headline-md text-on-surface mb-1.5 leading-snug">${escapeHtml(card.title || 'بدون عنوان')}</h3>
        <p class="hidden md:block font-label-md text-label-md text-on-surface-variant mb-4 leading-relaxed line-clamp-2 flex-1">${escapeHtml(card.description || '')}</p>
        <a href="${escapeHtml(link)}" class="w-full py-2.5 border border-primary/20 text-primary rounded-lg font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-all duration-200 border block text-center mt-auto">تصفح الملخصات</a>
      </div>
    `;
    featuredGrid.appendChild(el);
  });
};

const goToSummaries = (query) => {
  const trimmed = (query || '').trim();
  window.location.href = trimmed ? `summaries.html?q=${encodeURIComponent(trimmed)}` : 'summaries.html';
};

const calcStats = (summaries) => {
  const visitorCount = (() => {
    try {
      const count = parseInt(localStorage.getItem('visitor_count') || '0', 10);
      const newCount = count + 1;
      localStorage.setItem('visitor_count', String(newCount));
      return newCount;
    } catch {
      return 0;
    }
  })();
  return [
    { icon: 'library_books', label: 'ملخص دراسي', target: Math.max(0, summaries.length), initial: '+0' },
    { icon: 'category', label: 'مادة تعليمية', target: new Set(summaries.map((item) => item.subject)).size, initial: '+0' },
    { icon: 'download_done', label: 'ملف مرفوع', target: summaries.filter((item) => item.pdfUrl).length, initial: '+0' },
    { icon: 'visibility', label: 'زائر', target: visitorCount, initial: '+0' }
  ];
};

const animateStatCounters = (container) => {
  const stats = container.querySelectorAll('.stat-number');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const target = parseInt(entry.target.getAttribute('data-target'), 10) || 0;
      let count = 0;
      const updateCount = () => {
        const increment = target / 50 || 1;
        if (count < target) {
          count += increment;
          entry.target.innerText = `+${Math.ceil(count)}`;
          window.setTimeout(updateCount, 30);
        } else {
          entry.target.innerText = `+${target > 1000 ? `${target / 1000}k` : target}`;
        }
      };
      updateCount();
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.5 });
  stats.forEach((stat) => observer.observe(stat));
};

const setupHeroSearch = () => {
  heroSearchInputs.forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      goToSummaries(input.value);
    });
  });

  heroSearchButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector(`#${button.id.replace('-btn', '')}`);
      goToSummaries(input ? input.value : '');
    });
  });
};

const initPage = async () => {
  try {
    const summaries = await getAllSummaries();
    if (statsContainer) {
      renderStatBlocks(statsContainer, calcStats(summaries));
      animateStatCounters(statsContainer);
    }
  } catch (error) {
    console.error(error);
    if (statsContainer) {
      statsContainer.innerHTML = '<div class="col-span-full text-center text-error">تعذر تحميل البيانات.</div>';
    }
  }
  setupHeroSearch();

  try {
    const featured = await getFeaturedCards();
    renderFeaturedCards(featured);
  } catch (error) {
    console.error(error);
  }
};

initPage();
