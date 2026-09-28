import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadow } from '@/theme';

export function Card({ style, dark, ...rest }: ViewProps & { dark?: boolean }) {
  return <View style={[styles.card, dark && styles.dark, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  dark: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
    shadowOpacity: 0.18,
  },
});
