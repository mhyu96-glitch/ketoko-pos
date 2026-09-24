import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeCategory = 'soft' | 'bright' | 'dark';

export interface ThemeConfig {
  id: string;
  name: string;
  category: ThemeCategory;
  categoryLabel: string;
  description: string;
  colors: {
    // Primary / Action
    primary: string;
    primaryHover: string;
    primaryLight: string;
    // Header gradient & accent
    headerFrom: string;
    headerTo: string;
    headerBadge: string;
    headerText: string;
    headerSubtext: string;
    // Canvas & Cards
    canvasBg: string;
    cardBg: string;
    cardBgHover: string;
    surfaceAlt: string;
    // Borders
    border: string;
    borderSubtle: string;
    // Text
    textMain: string;
    textMuted: string;
    // Table
    tableHeaderBg: string;
    tableHeaderText: string;
    // Active Tab
    activeTabBg: string;
    activeTabText: string;
    // Swatch preview colors
    swatch: string[];
  };
}

export const THEME_PRESETS: ThemeConfig[] = [
  // =========================================================================
  // --- KATEGORI 1: SOFT (Warna Lembut, Pastel, Hangat & Nyaman di Mata) ---
  // =========================================================================
  {
    id: 'coklat_susu',
    name: 'Coklat Susu Latte',
    category: 'soft',
    categoryLabel: 'Soft / Lembut',
    description: 'Palet creamy milk chocolate yang hangat, elegan, dan menenangkan mata kasir seharian.',
    colors: {
      primary: '#96633b',
      primaryHover: '#83532e',
      primaryLight: '#faebd7',
      headerFrom: '#96633b',
      headerTo: '#a6744c',
      headerBadge: '#83532e',
      headerText: '#ffffff',
      headerSubtext: '#fcefe3',
      canvasBg: '#fcf9f5',
      cardBg: '#ffffff',
      cardBgHover: '#fbf7f2',
      surfaceAlt: '#f5ebe0',
      border: '#e5d0be',
      borderSubtle: '#eed7c4',
      textMain: '#3d2617',
      textMuted: '#8a6b53',
      tableHeaderBg: '#f5ebe0',
      tableHeaderText: '#5c3c26',
      activeTabBg: '#96633b',
      activeTabText: '#ffffff',
      swatch: ['#96633b', '#a6744c', '#f5ebe0', '#fcf9f5']
    }
  },
  {
    id: 'sage_matcha',
    name: 'Sage Matcha Green',
    category: 'soft',
    categoryLabel: 'Soft / Lembut',
    description: 'Nuansa hijau sage herbal yang sejuk, asri, dan menyejukkan pandangan operasional toko.',
    colors: {
      primary: '#52795d',
      primaryHover: '#3f6249',
      primaryLight: '#e4eee6',
      headerFrom: '#52795d',
      headerTo: '#688f73',
      headerBadge: '#3f6249',
      headerText: '#ffffff',
      headerSubtext: '#e8f3ea',
      canvasBg: '#f6f9f7',
      cardBg: '#ffffff',
      cardBgHover: '#f0f5f1',
      surfaceAlt: '#e6efe8',
      border: '#c8dcce',
      borderSubtle: '#d8e7dc',
      textMain: '#1e3324',
      textMuted: '#5b7863',
      tableHeaderBg: '#e6efe8',
      tableHeaderText: '#2d4b35',
      activeTabBg: '#52795d',
      activeTabText: '#ffffff',
      swatch: ['#52795d', '#688f73', '#e6efe8', '#f6f9f7']
    }
  },
  {
    id: 'pastel_rose',
    name: 'Pastel Rose Berry',
    category: 'soft',
    categoryLabel: 'Soft / Lembut',
    description: 'Sentuhan warna rose berry lembut yang manis, rapi, dan memberikan suasana toko bersahabat.',
    colors: {
      primary: '#a85b73',
      primaryHover: '#8f465d',
      primaryLight: '#fbebf0',
      headerFrom: '#a85b73',
      headerTo: '#be7189',
      headerBadge: '#8f465d',
      headerText: '#ffffff',
      headerSubtext: '#fdeff3',
      canvasBg: '#fcf8f9',
      cardBg: '#ffffff',
      cardBgHover: '#f9eff2',
      surfaceAlt: '#f7e4ea',
      border: '#e8cad4',
      borderSubtle: '#f2dce3',
      textMain: '#3b1c25',
      textMuted: '#875161',
      tableHeaderBg: '#f7e4ea',
      tableHeaderText: '#542634',
      activeTabBg: '#a85b73',
      activeTabText: '#ffffff',
      swatch: ['#a85b73', '#be7189', '#f7e4ea', '#fcf8f9']
    }
  },
  {
    id: 'warm_sand',
    name: 'Warm Sand Linen',
    category: 'soft',
    categoryLabel: 'Soft / Lembut',
    description: 'Warna pasir hangat minimalis bergaya Scandinavian yang netral, bersih, dan modern.',
    colors: {
      primary: '#85735d',
      primaryHover: '#6e5d48',
      primaryLight: '#f3ece2',
      headerFrom: '#85735d',
      headerTo: '#9a8770',
      headerBadge: '#6e5d48',
      headerText: '#ffffff',
      headerSubtext: '#f8f2eb',
      canvasBg: '#faf8f5',
      cardBg: '#ffffff',
      cardBgHover: '#f5f0e9',
      surfaceAlt: '#ede5d8',
      border: '#dccebe',
      borderSubtle: '#e8ded0',
      textMain: '#362d22',
      textMuted: '#786957',
      tableHeaderBg: '#ede5d8',
      tableHeaderText: '#4f4233',
      activeTabBg: '#85735d',
      activeTabText: '#ffffff',
      swatch: ['#85735d', '#9a8770', '#ede5d8', '#faf8f5']
    }
  },
  {
    id: 'lavender_cream',
    name: 'Lavender Milk Cream',
    category: 'soft',
    categoryLabel: 'Soft / Lembut',
    description: 'Paduan warna ungu lavender susu dan krim vanila yang lembut, tenang, dan bersih.',
    colors: {
      primary: '#7b6899',
      primaryHover: '#655382',
      primaryLight: '#f1ecf7',
      headerFrom: '#7b6899',
      headerTo: '#927eb0',
      headerBadge: '#655382',
      headerText: '#ffffff',
      headerSubtext: '#f4f0f9',
      canvasBg: '#faf8fc',
      cardBg: '#ffffff',
      cardBgHover: '#f4eff9',
      surfaceAlt: '#eee7f5',
      border: '#d8cbe8',
      borderSubtle: '#e6dced',
      textMain: '#2f2340',
      textMuted: '#6e5c85',
      tableHeaderBg: '#eee7f5',
      tableHeaderText: '#463261',
      activeTabBg: '#7b6899',
      activeTabText: '#ffffff',
      swatch: ['#7b6899', '#927eb0', '#eee7f5', '#faf8fc']
    }
  },
  {
    id: 'caramel_latte',
    name: 'Caramel Macchiato',
    category: 'soft',
    categoryLabel: 'Soft / Lembut',
    description: 'Nuansa karamel manis berkrim lembut yang memancarkan aura toko roti & cafe modern.',
    colors: {
      primary: '#b87333',
      primaryHover: '#9e5e24',
      primaryLight: '#fdf2e9',
      headerFrom: '#b87333',
      headerTo: '#c98544',
      headerBadge: '#9e5e24',
      headerText: '#ffffff',
      headerSubtext: '#fdf3ea',
      canvasBg: '#fdfaf7',
      cardBg: '#ffffff',
      cardBgHover: '#fbf4ee',
      surfaceAlt: '#f7ebd9',
      border: '#e8d2b7',
      borderSubtle: '#f0e0cd',
      textMain: '#42260f',
      textMuted: '#8c5a2b',
      tableHeaderBg: '#f7ebd9',
      tableHeaderText: '#613814',
      activeTabBg: '#b87333',
      activeTabText: '#ffffff',
      swatch: ['#b87333', '#c98544', '#f7ebd9', '#fdfaf7']
    }
  },
  {
    id: 'dusty_teal',
    name: 'Dusty Teal Breeze',
    category: 'soft',
    categoryLabel: 'Soft / Lembut',
    description: 'Sentuhan warna toska laut pastel yang santai, rileks, dan ramah pengguna.',
    colors: {
      primary: '#4b858d',
      primaryHover: '#386e75',
      primaryLight: '#e6f2f3',
      headerFrom: '#4b858d',
      headerTo: '#609ca4',
      headerBadge: '#386e75',
      headerText: '#ffffff',
      headerSubtext: '#e8f4f5',
      canvasBg: '#f5fafb',
      cardBg: '#ffffff',
      cardBgHover: '#edf6f7',
      surfaceAlt: '#e4eff0',
      border: '#c2dcde',
      borderSubtle: '#d5e9ea',
      textMain: '#1a3438',
      textMuted: '#50767c',
      tableHeaderBg: '#e4eff0',
      tableHeaderText: '#274f55',
      activeTabBg: '#4b858d',
      activeTabText: '#ffffff',
      swatch: ['#4b858d', '#609ca4', '#e4eff0', '#f5fafb']
    }
  },

  // =========================================================================
  // --- KATEGORI 2: CERAH (Warna Cerah, Fresh, Dinamis & Enerjik) ---
  // =========================================================================
  {
    id: 'ocean_blue',
    name: 'Ocean Sky Blue',
    category: 'bright',
    categoryLabel: 'Cerah / Fresh',
    description: 'Biru langit bahari yang cerah, menyegarkan, profesional, dan memberikan kesan modern berteknologi tinggi.',
    colors: {
      primary: '#0284c7',
      primaryHover: '#0369a1',
      primaryLight: '#e0f2fe',
      headerFrom: '#0284c7',
      headerTo: '#0ea5e9',
      headerBadge: '#0369a1',
      headerText: '#ffffff',
      headerSubtext: '#e0f2fe',
      canvasBg: '#f0f9ff',
      cardBg: '#ffffff',
      cardBgHover: '#e8f4fc',
      surfaceAlt: '#e0f2fe',
      border: '#bae6fd',
      borderSubtle: '#d4edfc',
      textMain: '#0c4a6e',
      textMuted: '#0284c7',
      tableHeaderBg: '#e0f2fe',
      tableHeaderText: '#0369a1',
      activeTabBg: '#0284c7',
      activeTabText: '#ffffff',
      swatch: ['#0284c7', '#0ea5e9', '#e0f2fe', '#f0f9ff']
    }
  },
  {
    id: 'sunset_amber',
    name: 'Sunset Amber Coral',
    category: 'bright',
    categoryLabel: 'Cerah / Fresh',
    description: 'Warna oranye senja karang yang bersemangat, ceria, dan memacu produktivitas kasir.',
    colors: {
      primary: '#ea580c',
      primaryHover: '#c2410c',
      primaryLight: '#ffedd5',
      headerFrom: '#ea580c',
      headerTo: '#f97316',
      headerBadge: '#c2410c',
      headerText: '#ffffff',
      headerSubtext: '#ffedd5',
      canvasBg: '#fffaf5',
      cardBg: '#ffffff',
      cardBgHover: '#fdf2e9',
      surfaceAlt: '#fed7aa',
      border: '#fdba74',
      borderSubtle: '#fed7aa',
      textMain: '#431407',
      textMuted: '#9a3412',
      tableHeaderBg: '#ffedd5',
      tableHeaderText: '#7c2d12',
      activeTabBg: '#ea580c',
      activeTabText: '#ffffff',
      swatch: ['#ea580c', '#f97316', '#ffedd5', '#fffaf5']
    }
  },
  {
    id: 'emerald_mint',
    name: 'Emerald Mint Fresh',
    category: 'bright',
    categoryLabel: 'Cerah / Fresh',
    description: 'Hijau zamrud mint cerah dan segar, sangat cocok untuk minimarket organik dan toko modern.',
    colors: {
      primary: '#059669',
      primaryHover: '#047857',
      primaryLight: '#d1fae5',
      headerFrom: '#059669',
      headerTo: '#10b981',
      headerBadge: '#047857',
      headerText: '#ffffff',
      headerSubtext: '#d1fae5',
      canvasBg: '#f0fdf4',
      cardBg: '#ffffff',
      cardBgHover: '#e6f7ec',
      surfaceAlt: '#dcfce7',
      border: '#a7f3d0',
      borderSubtle: '#c6f5de',
      textMain: '#064e3b',
      textMuted: '#059669',
      tableHeaderBg: '#dcfce7',
      tableHeaderText: '#065f46',
      activeTabBg: '#059669',
      activeTabText: '#ffffff',
      swatch: ['#059669', '#10b981', '#dcfce7', '#f0fdf4']
    }
  },
  {
    id: 'royal_violet',
    name: 'Royal Violet Grape',
    category: 'bright',
    categoryLabel: 'Cerah / Fresh',
    description: 'Ungu lavender bangsawan yang mewah, ekspresif, dan memiliki estetika visual premium.',
    colors: {
      primary: '#7c3aed',
      primaryHover: '#6d28d9',
      primaryLight: '#ede9fe',
      headerFrom: '#7c3aed',
      headerTo: '#8b5cf6',
      headerBadge: '#6d28d9',
      headerText: '#ffffff',
      headerSubtext: '#ede9fe',
      canvasBg: '#faf5ff',
      cardBg: '#ffffff',
      cardBgHover: '#f3e8ff',
      surfaceAlt: '#ede9fe',
      border: '#ddd6fe',
      borderSubtle: '#e9d5ff',
      textMain: '#3b0764',
      textMuted: '#7c3aed',
      tableHeaderBg: '#ede9fe',
      tableHeaderText: '#581c87',
      activeTabBg: '#7c3aed',
      activeTabText: '#ffffff',
      swatch: ['#7c3aed', '#8b5cf6', '#ede9fe', '#faf5ff']
    }
  },
  {
    id: 'ruby_crimson',
    name: 'Ruby Crimson Scarlet',
    category: 'bright',
    categoryLabel: 'Cerah / Fresh',
    description: 'Merah delima cerah dan dinamis, menarik perhatian kasir dan berdaya pikat tinggi.',
    colors: {
      primary: '#dc2626',
      primaryHover: '#b91c1c',
      primaryLight: '#fee2e2',
      headerFrom: '#dc2626',
      headerTo: '#ef4444',
      headerBadge: '#b91c1c',
      headerText: '#ffffff',
      headerSubtext: '#fee2e2',
      canvasBg: '#fef2f2',
      cardBg: '#ffffff',
      cardBgHover: '#fde8e8',
      surfaceAlt: '#fecaca',
      border: '#fca5a5',
      borderSubtle: '#fed7d7',
      textMain: '#450a0a',
      textMuted: '#991b1b',
      tableHeaderBg: '#fecaca',
      tableHeaderText: '#7f1d1d',
      activeTabBg: '#dc2626',
      activeTabText: '#ffffff',
      swatch: ['#dc2626', '#ef4444', '#fecaca', '#fef2f2']
    }
  },
  {
    id: 'golden_honey',
    name: 'Golden Honey Citrus',
    category: 'bright',
    categoryLabel: 'Cerah / Fresh',
    description: 'Warna madu keemasan bernuansa matahari cerah yang hangat, optimistis, dan mewah.',
    colors: {
      primary: '#d97706',
      primaryHover: '#b45309',
      primaryLight: '#fef3c7',
      headerFrom: '#d97706',
      headerTo: '#f59e0b',
      headerBadge: '#b45309',
      headerText: '#ffffff',
      headerSubtext: '#fef3c7',
      canvasBg: '#fffbeb',
      cardBg: '#ffffff',
      cardBgHover: '#fdf6db',
      surfaceAlt: '#fde68a',
      border: '#fcd34d',
      borderSubtle: '#fef08a',
      textMain: '#451a03',
      textMuted: '#92400e',
      tableHeaderBg: '#fde68a',
      tableHeaderText: '#78350f',
      activeTabBg: '#d97706',
      activeTabText: '#ffffff',
      swatch: ['#d97706', '#f59e0b', '#fde68a', '#fffbeb']
    }
  },
  {
    id: 'electric_cyan',
    name: 'Electric Aqua Marine',
    category: 'bright',
    categoryLabel: 'Cerah / Fresh',
    description: 'Biru toska cerah khas laguna tropis yang sejuk, jernih, dan memikat mata.',
    colors: {
      primary: '#0d9488',
      primaryHover: '#0f766e',
      primaryLight: '#ccfbf1',
      headerFrom: '#0d9488',
      headerTo: '#14b8a6',
      headerBadge: '#0f766e',
      headerText: '#ffffff',
      headerSubtext: '#ccfbf1',
      canvasBg: '#f0fdfa',
      cardBg: '#ffffff',
      cardBgHover: '#e6faf7',
      surfaceAlt: '#99f6e4',
      border: '#5eead4',
      borderSubtle: '#a7f3d0',
      textMain: '#134e4a',
      textMuted: '#115e59',
      tableHeaderBg: '#99f6e4',
      tableHeaderText: '#042f2e',
      activeTabBg: '#0d9488',
      activeTabText: '#ffffff',
      swatch: ['#0d9488', '#14b8a6', '#99f6e4', '#f0fdfa']
    }
  },

  // =========================================================================
  // --- KATEGORI 3: GELAP (Dark Mode, Obsidian, Espresso & Kontras Tinggi) ---
  // =========================================================================
  {
    id: 'midnight_obsidian',
    name: 'Midnight Obsidian Slate',
    category: 'dark',
    categoryLabel: 'Gelap / Dark Mode',
    description: 'Dark mode slate premium dengan aksen sky blue elektrik yang sangat hemat daya dan elegan.',
    colors: {
      primary: '#0284c7',
      primaryHover: '#0369a1',
      primaryLight: '#1e293b',
      headerFrom: '#0f172a',
      headerTo: '#1e293b',
      headerBadge: '#334155',
      headerText: '#f8fafc',
      headerSubtext: '#94a3b8',
      canvasBg: '#090d16',
      cardBg: '#131d2e',
      cardBgHover: '#1c293d',
      surfaceAlt: '#1a2638',
      border: '#27384e',
      borderSubtle: '#1e2e42',
      textMain: '#f1f5f9',
      textMuted: '#94a3b8',
      tableHeaderBg: '#1e293b',
      tableHeaderText: '#cbd5e1',
      activeTabBg: '#0284c7',
      activeTabText: '#ffffff',
      swatch: ['#0f172a', '#1e293b', '#0284c7', '#090d16']
    }
  },
  {
    id: 'roasted_espresso',
    name: 'Dark Roasted Espresso',
    category: 'dark',
    categoryLabel: 'Gelap / Dark Mode',
    description: 'Nuansa coklat tua espresso sangrai gelap dengan aksen emas amber yang eksklusif.',
    colors: {
      primary: '#c27847',
      primaryHover: '#a66032',
      primaryLight: '#2a1e17',
      headerFrom: '#1c130e',
      headerTo: '#2b1d16',
      headerBadge: '#3d2b21',
      headerText: '#fef3c7',
      headerSubtext: '#d6b89e',
      canvasBg: '#140c08',
      cardBg: '#211510',
      cardBgHover: '#2d1e18',
      surfaceAlt: '#2a1a12',
      border: '#473024',
      borderSubtle: '#38251b',
      textMain: '#faf5f0',
      textMuted: '#c4a68e',
      tableHeaderBg: '#2d1e18',
      tableHeaderText: '#fed7aa',
      activeTabBg: '#c27847',
      activeTabText: '#ffffff',
      swatch: ['#1c130e', '#2b1d16', '#c27847', '#140c08']
    }
  },
  {
    id: 'cyber_charcoal',
    name: 'Cyber Charcoal Cyan',
    category: 'dark',
    categoryLabel: 'Gelap / Dark Mode',
    description: 'Latar abu-abu arang futuristik dengan aksen cyan neon berteknologi tinggi.',
    colors: {
      primary: '#06b6d4',
      primaryHover: '#0891b2',
      primaryLight: '#162834',
      headerFrom: '#111827',
      headerTo: '#1f2937',
      headerBadge: '#374151',
      headerText: '#e0f2fe',
      headerSubtext: '#94a3b8',
      canvasBg: '#090d14',
      cardBg: '#111827',
      cardBgHover: '#1f2937',
      surfaceAlt: '#1a2434',
      border: '#283548',
      borderSubtle: '#1e293b',
      textMain: '#f9fafb',
      textMuted: '#9ca3af',
      tableHeaderBg: '#1f2937',
      tableHeaderText: '#a5f3fc',
      activeTabBg: '#06b6d4',
      activeTabText: '#ffffff',
      swatch: ['#111827', '#1f2937', '#06b6d4', '#090d14']
    }
  },
  {
    id: 'deep_emerald_night',
    name: 'Deep Forest Emerald',
    category: 'dark',
    categoryLabel: 'Gelap / Dark Mode',
    description: 'Hijau hutan pinus malam hari yang sejuk, tenang, dan berkarakter kuat.',
    colors: {
      primary: '#10b981',
      primaryHover: '#059669',
      primaryLight: '#132c21',
      headerFrom: '#0a1c13',
      headerTo: '#123323',
      headerBadge: '#1a4530',
      headerText: '#f0fdf4',
      headerSubtext: '#a7f3d0',
      canvasBg: '#07140e',
      cardBg: '#0e2419',
      cardBgHover: '#143324',
      surfaceAlt: '#163827',
      border: '#20523a',
      borderSubtle: '#173d2a',
      textMain: '#f0fdf4',
      textMuted: '#86efac',
      tableHeaderBg: '#163827',
      tableHeaderText: '#d1fae5',
      activeTabBg: '#10b981',
      activeTabText: '#ffffff',
      swatch: ['#0a1c13', '#123323', '#10b981', '#07140e']
    }
  },
  {
    id: 'amethyst_dark',
    name: 'Amethyst Velvet Dark',
    category: 'dark',
    categoryLabel: 'Gelap / Dark Mode',
    description: 'Nuansa beludru ungu gelap bertabur batu mulia ametis yang misterius dan mewah.',
    colors: {
      primary: '#a855f7',
      primaryHover: '#9333ea',
      primaryLight: '#26163b',
      headerFrom: '#180b26',
      headerTo: '#291540',
      headerBadge: '#3c1e5e',
      headerText: '#faf5ff',
      headerSubtext: '#e9d5ff',
      canvasBg: '#10071a',
      cardBg: '#1f0e33',
      cardBgHover: '#2b1447',
      surfaceAlt: '#2d144a',
      border: '#4c227d',
      borderSubtle: '#37185c',
      textMain: '#faf5ff',
      textMuted: '#d8b4fe',
      tableHeaderBg: '#2d144a',
      tableHeaderText: '#f3e8ff',
      activeTabBg: '#a855f7',
      activeTabText: '#ffffff',
      swatch: ['#180b26', '#291540', '#a855f7', '#10071a']
    }
  },
  {
    id: 'vampire_crimson_dark',
    name: 'Crimson Dracula Dark',
    category: 'dark',
    categoryLabel: 'Gelap / Dark Mode',
    description: 'Kontras gelap hitam arang dengan aksen merah rubi darah yang dramatis dan tajam.',
    colors: {
      primary: '#f43f5e',
      primaryHover: '#e11d48',
      primaryLight: '#33141c',
      headerFrom: '#1f0a10',
      headerTo: '#33101b',
      headerBadge: '#4d1828',
      headerText: '#fff1f2',
      headerSubtext: '#fecdd3',
      canvasBg: '#14050a',
      cardBg: '#240a13',
      cardBgHover: '#330e1b',
      surfaceAlt: '#38101e',
      border: '#5e1b32',
      borderSubtle: '#471325',
      textMain: '#fff1f2',
      textMuted: '#fda4af',
      tableHeaderBg: '#38101e',
      tableHeaderText: '#ffe4e6',
      activeTabBg: '#f43f5e',
      activeTabText: '#ffffff',
      swatch: ['#1f0a10', '#33101b', '#f43f5e', '#14050a']
    }
  },
  {
    id: 'oled_stealth',
    name: 'OLED Stealth Monolith',
    category: 'dark',
    categoryLabel: 'Gelap / Dark Mode',
    description: 'Hitam pekat OLED murni dengan teks putih tajam, paling hemat daya baterai untuk tablet kasir.',
    colors: {
      primary: '#e2e8f0',
      primaryHover: '#cbd5e1',
      primaryLight: '#27272a',
      headerFrom: '#09090b',
      headerTo: '#18181b',
      headerBadge: '#27272a',
      headerText: '#ffffff',
      headerSubtext: '#d4d4d8',
      canvasBg: '#000000',
      cardBg: '#09090b',
      cardBgHover: '#18181b',
      surfaceAlt: '#18181b',
      border: '#27272a',
      borderSubtle: '#1f1f23',
      textMain: '#ffffff',
      textMuted: '#a1a1aa',
      tableHeaderBg: '#18181b',
      tableHeaderText: '#f4f4f5',
      activeTabBg: '#e2e8f0',
      activeTabText: '#09090b',
      swatch: ['#09090b', '#18181b', '#e2e8f0', '#000000']
    }
  }
];

interface ThemeContextType {
  currentTheme: ThemeConfig;
  setThemeById: (id: string) => void;
  allThemes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<string>(() => {
    return localStorage.getItem('ketoko_theme_id') || 'coklat_susu';
  });

  const currentTheme = THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];

  const applyThemeToDOM = (theme: ThemeConfig) => {
    const root = document.documentElement;
    const colors = theme.colors;

    root.style.setProperty('--theme-primary', colors.primary);
    root.style.setProperty('--theme-primary-hover', colors.primaryHover);
    root.style.setProperty('--theme-primary-light', colors.primaryLight);
    root.style.setProperty('--theme-header-from', colors.headerFrom);
    root.style.setProperty('--theme-header-to', colors.headerTo);
    root.style.setProperty('--theme-header-badge', colors.headerBadge);
    root.style.setProperty('--theme-header-text', colors.headerText);
    root.style.setProperty('--theme-header-subtext', colors.headerSubtext);
    root.style.setProperty('--theme-canvas-bg', colors.canvasBg);
    root.style.setProperty('--theme-card-bg', colors.cardBg);
    root.style.setProperty('--theme-card-bg-hover', colors.cardBgHover);
    root.style.setProperty('--theme-surface-alt', colors.surfaceAlt);
    root.style.setProperty('--theme-border', colors.border);
    root.style.setProperty('--theme-border-subtle', colors.borderSubtle);
    root.style.setProperty('--theme-text-main', colors.textMain);
    root.style.setProperty('--theme-text-muted', colors.textMuted);
    root.style.setProperty('--theme-table-header-bg', colors.tableHeaderBg);
    root.style.setProperty('--theme-table-header-text', colors.tableHeaderText);
    root.style.setProperty('--theme-active-tab-bg', colors.activeTabBg);
    root.style.setProperty('--theme-active-tab-text', colors.activeTabText);

    // Also update body background
    document.body.style.backgroundColor = colors.canvasBg;
    document.body.style.color = colors.textMain;

    // Set theme attributes for CSS targeting
    root.setAttribute('data-theme', theme.id);
    root.setAttribute('data-theme-category', theme.category);
  };

  useEffect(() => {
    applyThemeToDOM(currentTheme);
  }, [currentTheme]);

  const setThemeById = (id: string) => {
    const found = THEME_PRESETS.find((t) => t.id === id);
    if (found) {
      setThemeId(found.id);
      localStorage.setItem('ketoko_theme_id', found.id);
      applyThemeToDOM(found);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setThemeById, allThemes: THEME_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
