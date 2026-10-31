import { useState, useEffect } from 'react';

export type UIDesignMode = 'official_erp' | 'global_pro' | 'classic_original';

const UI_DESIGN_MODE_KEY = 'sec_platform_ui_design_mode_v3_classic';
const UI_DESIGN_EVENT = 'sec-ui-design-mode-change';

export function getSavedUIDesignMode(): UIDesignMode {
  if (typeof window !== 'undefined') {
    document.documentElement.setAttribute('data-ui-mode', 'official_erp');
  }
  return 'official_erp';
}

export function setSavedUIDesignMode(mode: UIDesignMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UI_DESIGN_MODE_KEY, mode);
    document.documentElement.setAttribute('data-ui-mode', mode);
    window.dispatchEvent(new CustomEvent(UI_DESIGN_EVENT, { detail: mode }));
  } catch (_) {}
}

export function useUIDesignMode(): [UIDesignMode, (mode: UIDesignMode) => void, () => void] {
  const [mode, setModeState] = useState<UIDesignMode>('official_erp');

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-mode', 'official_erp');
  }, [mode]);

  const setMode = (next: UIDesignMode) => {
    setModeState(next);
    setSavedUIDesignMode(next);
  };

  const toggleMode = () => {
    setMode('official_erp');
  };

  return ['official_erp', setMode, toggleMode];
}
