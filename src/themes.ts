export const THEME_STORAGE_KEY = 'fifi-image-theme';

export type ThemeId = 'mist-green' | 'moon-blue' | 'sandstone' | 'wisteria' | 'sea-salt' | 'graphite';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  swatches: [string, string, string];
}

export const THEMES: ThemeOption[] = [
  {
    id: 'mist-green',
    label: '雾森绿',
    description: '灰绿护眼',
    swatches: ['#dfe6df', '#f3f4ee', '#527a72']
  },
  {
    id: 'moon-blue',
    label: '月雾蓝',
    description: '冷静清爽',
    swatches: ['#dfe5eb', '#f3f5f6', '#526f8f']
  },
  {
    id: 'sandstone',
    label: '砂岩白',
    description: '柔和暖灰',
    swatches: ['#e7e1d8', '#f6f2eb', '#8a6f5a']
  },
  {
    id: 'wisteria',
    label: '薄藤紫',
    description: '低饱和紫',
    swatches: ['#e4e1e8', '#f5f2f6', '#74658a']
  },
  {
    id: 'sea-salt',
    label: '海盐青',
    description: '干净轻快',
    swatches: ['#dce7e7', '#f1f6f4', '#4f7f82']
  },
  {
    id: 'graphite',
    label: '夜间石墨',
    description: '低亮深色',
    swatches: ['#262b2d', '#313638', '#89aaa2']
  }
];

export function getThemeById(id: string | null | undefined): ThemeOption {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
