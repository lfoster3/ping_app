import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Screen, ScreenHeader } from '@/components/Screen';
import { useFamily } from '@/data/FamilyProvider';
import { statusLine } from '@/data/format';
import { colors, fonts, space } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export default function SettingsScreen() {
  const { members, connectLive, disconnectLive, garminUnsupported } = useFamily();
  const pedro = members.find((m) => m.live);
  const me = members[0];
  const [prefs, setPrefs] = useState({
    heartAlerts: true,
    arrivals: true,
    lowBattery: true,
    shareLocation: true,
    shareHeart: true,
  });
  const toggle = (k: keyof typeof prefs) => (v: boolean) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <Screen>
      <ScreenHeader
        icon={<Ionicons name="settings" size={24} color={colors.primary} />}
        title="Settings"
        subtitle="Family, alerts & privacy"
      />

      <Card style={styles.profile}>
        <Avatar member={me} size={52} showState={false} />
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{me.name}</Text>
          <Text style={styles.profileSub}>Family admin · Ping band connected</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Admin</Text>
        </View>
      </Card>

      <Group title="Family circle">
        {members.map((m, i) => (
          <Row
            key={m.id}
            first={i === 0}
            leading={<Avatar member={m} size={32} showState={false} />}
            title={m.name}
            subtitle={`${m.role === 'parent' ? 'Parent' : 'Child'} · ${m.live ? 'Garmin' : `band ${m.battery}%`}`}
            chevron
          />
        ))}
        <Row icon="person-add-outline" iconColor={colors.primary} title="Invite family member" tint={colors.primary} chevron />
      </Group>

      <Group title="Alerts">
        <Row first icon="heart-outline" title="Heart rate outside usual range" subtitle="Based on each person's 30-day baseline">
          <Toggle value={prefs.heartAlerts} onValueChange={toggle('heartAlerts')} />
        </Row>
        <Row icon="location-outline" title="Arrivals & departures" subtitle="Home, School and saved places">
          <Toggle value={prefs.arrivals} onValueChange={toggle('arrivals')} />
        </Row>
        <Row icon="battery-half-outline" title="Low band battery">
          <Toggle value={prefs.lowBattery} onValueChange={toggle('lowBattery')} />
        </Row>
        <Row icon="alert-circle-outline" iconColor={colors.red} title="SOS alerts" subtitle="Always on for everyone in the circle">
          <Text style={styles.always}>Always on</Text>
        </Row>
      </Group>

      <Group title="Privacy">
        <Row first icon="navigate-outline" title="Share my location">
          <Toggle value={prefs.shareLocation} onValueChange={toggle('shareLocation')} />
        </Row>
        <Row icon="pulse-outline" title="Share my heart rate">
          <Toggle value={prefs.shareHeart} onValueChange={toggle('shareHeart')} />
        </Row>
        <Row icon="pause-circle-outline" title="Pause sharing for 1 hour" chevron />
      </Group>

      <Group title="Devices">
        <Row first icon="watch-outline" title="Mom's Ping band" subtitle="Firmware 1.2.0 · last sync 4 min ago">
          <Text style={styles.value}>{me.battery}%</Text>
        </Row>
        {pedro?.live && (
          <Row
            icon="bluetooth"
            iconColor={pedro.live.status === 'connected' ? colors.primary : colors.inkSoft}
            title={`${pedro.name}'s ${pedro.live.source === 'simulated' ? 'simulated signal' : 'Garmin'}`}
            subtitle={
              pedro.live.status === 'error'
                ? pedro.live.error
                : pedro.live.status === 'idle'
                  ? garminUnsupported ?? 'Broadcast Heart Rate over Bluetooth'
                  : statusLine(pedro)
            }>
            {pedro.live.status === 'idle' || pedro.live.status === 'error' ? (
              <Pill label="Connect" onPress={() => connectLive('garmin')} disabled={!!garminUnsupported} />
            ) : (
              <Pill label="Disconnect" onPress={disconnectLive} tone="muted" />
            )}
          </Row>
        )}
        {__DEV__ && pedro?.live && pedro.live.source !== 'simulated' && (
          <Row icon="flask-outline" title="Simulate Pedro's signal" subtitle="Dev only — fake data, labelled as simulated">
            <Pill label="Start" onPress={() => connectLive('simulated')} tone="muted" />
          </Row>
        )}
      </Group>

      <Group title="Account">
        <Row first icon="help-circle-outline" title="Help & support" chevron />
        <Row icon="shield-checkmark-outline" title="Privacy policy" chevron />
        <Row icon="log-out-outline" iconColor={colors.red} title="Sign out" tint={colors.red} />
      </Group>
    </Screen>
  );
}

function Pill({ label, onPress, disabled, tone = 'primary' }: { label: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'muted' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        tone === 'muted' && styles.pillMuted,
        (disabled || pressed) && { opacity: disabled ? 0.4 : 0.7 },
      ]}>
      <Text style={[styles.pillText, tone === 'muted' && { color: colors.inkSoft }]}>{label}</Text>
    </Pressable>
  );
}

function Toggle(props: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Switch
      {...props}
      trackColor={{ false: '#E5E7EB', true: colors.primary }}
      thumbColor="#fff"
      ios_backgroundColor="#E5E7EB"
    />
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: space.xl }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <Card style={{ overflow: 'hidden' }}>{children}</Card>
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  leading?: ReactNode;
  tint?: string;
  chevron?: boolean;
  first?: boolean;
  children?: ReactNode;
};

function Row({ title, subtitle, icon, iconColor = colors.inkSoft, leading, tint, chevron, first, children }: RowProps) {
  // TODO: wire navigation for chevron rows once those screens exist.
  return (
    <Pressable
      disabled={!chevron && !tint}
      accessibilityRole={chevron || tint ? 'button' : undefined}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && { backgroundColor: '#F8F9FC' }]}>
      {leading ??
        (icon && (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={17} color={iconColor} />
          </View>
        ))}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, tint && { color: tint }]}>{title}</Text>
        {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {children}
      {chevron && <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  profileName: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  profileSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  badge: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.primary },
  groupTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: space.sm,
    marginLeft: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 13 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  always: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  pill: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillMuted: { backgroundColor: '#F1F3F8' },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: '#fff' },
  value: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.green },
});
