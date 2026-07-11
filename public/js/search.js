export const matchQuery = (summary, query) => {
  if (!query) return true;
  const lower = query.trim().toLowerCase();
  const searchable = [
    summary.title,
    summary.description,
    summary.subject,
    summary.level,
    summary.author,
    summary.tags?.join(' '),
    summary.year,
    summary.size
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return searchable.includes(lower);
};

export const filterSummaries = (summaries, filters = {}) => {
  return summaries.filter((summary) => {
    const matchesQuery = matchQuery(summary, filters.query || '');
    const matchesSubject = !filters.subject || filters.subject === 'all' || summary.subject === filters.subject;
    const matchesLevel = !filters.level || filters.level === 'all' || summary.level === filters.level;
    const matchesYear = !filters.year || filters.year === 'all' || summary.year === filters.year;
    return matchesQuery && matchesSubject && matchesLevel && matchesYear;
  });
};

export const sortSummaries = (summaries, sortKey) => {
  const sorted = [...summaries];
  switch (sortKey) {
    case 'latest':
      return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'title-asc':
      return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ar'));
    case 'title-desc':
      return sorted.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'ar'));
    case 'pages-desc':
      return sorted.sort((a, b) => (b.pages || 0) - (a.pages || 0));
    default:
      return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
};

export const paginateSummaries = (summaries, page = 1, pageSize = 8) => {
  const total = summaries.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  const paginated = summaries.slice(start, start + pageSize);
  return { paginated, current, totalPages, total };
};
