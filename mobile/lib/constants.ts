export const Colors = {
  primary: '#163a32',
  primaryLight: '#edf4ea',
  background: '#f6f2e7',
  card: '#fffef8',
  surfaceMuted: '#faf8f1',
  text: '#163a32',
  textSecondary: '#4d655d',
  border: '#aebfb4',
  borderStrong: '#587167',
  danger: '#b62f2f',
  dangerLight: '#fff0ed',
  success: '#2f765c',
  successLight: '#edf7f1',
  accent: '#a94d33',
  accentLight: '#fbede7',
  sage: '#84ac95',
  orange: '#c65f3d',
  purple: '#76587f',
  indigo: '#466b78',
};

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const Typography = {
  eyebrow: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
  },
  display: {
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.45,
  },
  sectionTitle: {
    fontFamily: 'Georgia',
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 15,
  },
  bodySmall: {
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
} as const;

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';
