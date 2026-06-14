import { useEffect, useMemo, useRef, useState } from 'react';
import { getThemeById, THEMES, THEME_STORAGE_KEY, type ThemeId } from '../themes';

function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') {
    return 'mist-green';
  }

  try {
    return getThemeById(window.localStorage.getItem(THEME_STORAGE_KEY)).id;
  } catch {
    return 'mist-green';
  }
}

export function ThemeSwitcher() {
  const switcherRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>(readStoredTheme);
  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
      // Theme still applies for the current session when storage is unavailable.
    }
  }, [themeId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="theme-switcher" ref={switcherRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`切换配色，当前：${activeTheme.label}`}
        className="theme-ring-button"
        onClick={() => setIsOpen((value) => !value)}
        title={`切换配色：${activeTheme.label}`}
        type="button"
      >
        <span className="theme-ring" />
      </button>

      {isOpen && (
        <div aria-label="配色主题" className="theme-menu" role="listbox">
          {THEMES.map((theme) => (
            <button
              aria-selected={theme.id === themeId}
              className="theme-option"
              key={theme.id}
              onClick={() => {
                setThemeId(theme.id);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              <span className="theme-swatches" aria-hidden="true">
                {theme.swatches.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="theme-option-copy">
                <strong>{theme.label}</strong>
                <small>{theme.description}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
