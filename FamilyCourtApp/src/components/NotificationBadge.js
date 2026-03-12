import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export default function NotificationBadge({ count }) {
  if (!count || count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);
  const isWide = count > 9;

  return (
    <View style={[styles.badge, isWide && styles.badgeWide]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeWide: {
    minWidth: 22,
    paddingHorizontal: 5,
    borderRadius: 10,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 13,
  },
});
