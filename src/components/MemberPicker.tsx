import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFamily } from '@/data/FamilyProvider';
import { statusLine } from '@/data/format';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar } from './Avatar';

type Props = { visible: boolean; onClose: () => void };

/** Bottom sheet for switching which family member the Map / Trends tabs show. */
export function MemberPicker({ visible, onClose }: Props) {
  const { members, focusedId, focus } = useFamily();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Show family member</Text>
        {members.map((m) => {
          const selected = m.id === focusedId;
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                focus(m.id);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && { opacity: 0.7 }]}>
              <Avatar member={m} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.sub}>{statusLine(m)}</Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(17,24,39,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: 6,
  },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.sm },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  rowSelected: { backgroundColor: colors.primarySoft },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 1 },
});
