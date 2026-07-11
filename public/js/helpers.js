export const qs = (selector, parent = document) => parent.querySelector(selector);
export const qsa = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

export const debounce = (callback, delay = 250) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
};

export const createElementFromHTML = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

export const formatCount = (value) => {
  if (typeof value !== 'number') return value;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return value.toString();
};

export const parseQueryParam = (key) => {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
};

export const toArray = (value) => (Array.isArray(value) ? value : [value]);

export const safeText = (value) => value == null ? '' : String(value);

export const escapeHtml = (value) => safeText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
