import { escapeHtml, safeText } from './helpers.js';

const palettes = [
  { from: '#0050cb', to: '#00a676', ink: '#ffffff' },
  { from: '#6d28d9', to: '#0ea5e9', ink: '#ffffff' },
  { from: '#0f766e', to: '#84cc16', ink: '#ffffff' },
  { from: '#be123c', to: '#f59e0b', ink: '#ffffff' },
  { from: '#334155', to: '#14b8a6', ink: '#ffffff' },
  { from: '#7c2d12', to: '#dc2626', ink: '#ffffff' }
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

const pickIcon = (summary) => {
  const haystack = `${summary.subject || ''} ${summary.title || ''} ${summary.tags?.join(' ') || ''}`.toLowerCase();
  return iconRules.find((rule) => rule.keys.some((key) => haystack.includes(key.toLowerCase())))?.icon || 'auto_stories';
};

export const createSummaryCover = (summary, { className = 'w-full h-full', compact = false, fit = 'cover' } = {}) => {
  const title = safeText(summary.title || 'ملخص دراسي');
  const subject = safeText(summary.subject || 'ملخص');

  if (summary.coverImage) {
    return `
      <img
        src="${escapeHtml(summary.coverImage)}"
        alt="غلاف ${escapeHtml(title)}"
        class="${className} object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      >
    `;
  }

  const palette = palettes[hashText(`${subject}-${title}`) % palettes.length];
  const icon = pickIcon(summary);
  const titleClass = compact ? 'text-sm leading-5 line-clamp-2' : 'text-lg leading-7 line-clamp-3';
  const subjectClass = compact ? 'text-[11px]' : 'text-xs';
  const iconClass = compact ? 'text-[34px]' : 'text-[54px]';

  return `
    <div class="${className} relative overflow-hidden p-4 flex flex-col justify-between text-right" style="background: linear-gradient(135deg, ${palette.from}, ${palette.to}); color: ${palette.ink};">
      <div class="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/15"></div>
      <div class="absolute bottom-3 left-3 text-white/15">
        <span class="material-symbols-outlined text-[96px]">${icon}</span>
      </div>
      <div class="relative flex items-center justify-between gap-3">
        <span class="inline-flex px-3 py-1 rounded-full bg-white/20 backdrop-blur font-label-md ${subjectClass}">${escapeHtml(subject)}</span>
        <span class="material-symbols-outlined ${iconClass}">${icon}</span>
      </div>
      <div class="relative">
        <p class="font-headline-md font-bold ${titleClass}">${escapeHtml(title)}</p>
        <p class="mt-2 font-caption text-[11px] text-white/80">ملخص تعليمي</p>
      </div>
    </div>
  `;
};
