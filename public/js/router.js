import { initializeSummaries } from './api.js';

export const getCurrentPage = () => {
  const path = window.location.pathname.split('/').pop();
  return path || 'index.html';
};

export const initApp = async () => {
  await initializeSummaries();
};
