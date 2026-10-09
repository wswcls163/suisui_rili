export type HomeTheme = {
  colors: {
    backdrop: string;
    background: string;
    surface: string;
    surfaceMuted: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    accent: string;
    accentSoft: string;
    selected: string;
    selectedText: string;
    today: string;
    birthday: string;
    birthdaySoft: string;
    festival: string;
    festivalSoft: string;
    memory: string;
    memorySoft: string;
    success: string;
    error: string;
    navInactive: string;
    pressed: string;
  };
  typography: {
    appTitle: number;
    monthTitle: number;
    pageTitle: number;
    sectionTitle: number;
    dayNumber: number;
    body: number;
    label: number;
    caption: number;
    tiny: number;
    regular: '400';
    medium: '500';
    semibold: '600';
    bold: '700';
  };
  spacing: {
    xxs: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    round: number;
  };
  size: {
    dayCell: number;
    selectedDay: number;
    iconButton: number;
    eventIcon: number;
    bottomNavigation: number;
    addButton: number;
    previewCanvas: number;
    homeCanvas: number;
  };
};

export const defaultHomeTheme: HomeTheme = {
  colors: {
    backdrop: '#E9E8E4',
    background: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceMuted: '#F2F3F1',
    textPrimary: '#202426',
    textSecondary: '#636A6D',
    textTertiary: '#969B9D',
    border: '#E1E3E1',
    accent: '#E65345',
    accentSoft: '#FCE9E6',
    selected: '#2F97D1',
    selectedText: '#FFFFFF',
    today: '#2F97D1',
    birthday: '#E35E7A',
    birthdaySoft: '#FBE7EC',
    festival: '#D99027',
    festivalSoft: '#FBF0D8',
    memory: '#45A36F',
    memorySoft: '#E3F2E9',
    success: '#4D765E',
    error: '#B13D38',
    navInactive: '#71787A',
    pressed: '#ECEFEC',
  },
  typography: {
    appTitle: 17,
    monthTitle: 26,
    pageTitle: 22,
    sectionTitle: 13,
    dayNumber: 15,
    body: 15,
    label: 12,
    caption: 10,
    tiny: 9,
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  spacing: {
    xxs: 3,
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 13,
    lg: 18,
    round: 999,
  },
  size: {
    dayCell: 57,
    selectedDay: 32,
    iconButton: 40,
    eventIcon: 34,
    bottomNavigation: 68,
    addButton: 50,
    previewCanvas: 420,
    homeCanvas: 620,
  },
};
