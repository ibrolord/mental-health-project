export const Colors = {
  primary: '#163a32',
  primaryLight: '#edf4ea',
  background: '#f3f0e4',
  card: '#fffef8',
  surfaceMuted: '#f8f6ee',
  text: '#163a32',
  textSecondary: '#4d655d',
  border: '#aebfb4',
  borderStrong: '#587167',
  danger: '#b62f2f',
  dangerLight: '#fff0ed',
  success: '#2f765c',
  successLight: '#edf7f1',
  accent: '#c65f3d',
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
  md: 14,
  lg: 18,
  xl: 24,
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
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },
  sectionTitle: {
    fontFamily: 'Georgia',
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.35,
  },
  cardTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
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
