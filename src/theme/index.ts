// Ping design tokens — sampled from the approved mockups.

export const colors = {
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  border: '#ECEFF5',
  divider: '#F0F2F7',

  ink: '#111827',
  inkSoft: '#374151',
  muted: '#6B7280',
  faint: '#9CA3AF',

  primary: '#4F63F0',
  primaryDeep: '#3F4FE0',
  primarySoft: '#EEF0FE',

  navy: '#1B2240',
  navyRaised: '#262F55',
  navyInk: '#FFFFFF',
  navyMuted: '#AEB5CF',

  green: '#22C55E',
  greenSoft: '#E8F7EE',
  greenDeep: '#15803D',
  amber: '#F59E0B',
  amberInk: '#D97706',
  orange: '#FB923C',
  red: '#EF4444',
  yellow: '#FACC15',

  mapLand: '#E7F0E3',
  mapPark: '#CFE6C9',
  mapBlock: '#F4F6F2',
  mapRoad: '#FFFFFF',
  mapWater: '#A9D3F5',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const fonts = {
  display: 'Lexend_600SemiBold',
  displayBold: 'Lexend_700Bold',
  displayMedium: 'Lexend_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  section: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  cardTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  metric: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink },
} as const;

export const shadow = {
  card: {
    shadowColor: '#1B2240',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  fab: {
    shadowColor: '#4F63F0',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;
