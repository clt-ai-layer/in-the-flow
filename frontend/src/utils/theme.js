export const THEME_STORAGE_KEY = 'intheflow_theme';

export const THEME_BG = {
  light: '#F8FAFC',
  dark: '#0F172A',
};

/** @param {'light' | 'dark'} mode */
export function applyTheme(mode) {
  const resolved = mode === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem(THEME_STORAGE_KEY, resolved);
  window.electronAPI?.setBackgroundColor(THEME_BG[resolved]);
  return resolved;
}

export function getCachedTheme() {
  const cached = localStorage.getItem(THEME_STORAGE_KEY);
  return cached === 'light' || cached === 'dark' ? cached : null;
}
