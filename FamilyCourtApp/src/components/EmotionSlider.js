import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../theme/colors';

// Interpolate between green (#27AE60) and red (#C0392B) based on value 1-10
function interpolateColor(value) {
  if (value === null || value === undefined) return colors.stoneLight;

  // Clamp to 1-10
  const v = Math.max(1, Math.min(10, value));
  const t = (v - 1) / 9; // 0 → 1

  // RGB for green (#27AE60) and red (#C0392B)
  const r = Math.round(0x27 + t * (0xC0 - 0x27));
  const g = Math.round(0xAE + t * (0x39 - 0xAE));
  const b = Math.round(0x60 + t * (0x2B - 0x60));

  return `rgb(${r},${g},${b})`;
}

function getDescription(value) {
  if (value === null || value === undefined) return '未选择';
  if (value <= 3) return '平静';
  if (value <= 6) return '有些情绪';
  if (value <= 9) return '比较激动';
  return '非常激动';
}

export default function EmotionSlider({ value, onChange, label = '情绪温度' }) {
  const dots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {value !== null && value !== undefined && (
          <Text style={[styles.valueText, { color: interpolateColor(value) }]}>
            {value} / 10
          </Text>
        )}
      </View>

      <View style={styles.dotsRow}>
        {dots.map((n) => {
          const isSelected = value === n;
          const dotColor = interpolateColor(n);
          return (
            <TouchableOpacity
              key={n}
              onPress={() => onChange(value === n ? null : n)}
              style={styles.dotWrapper}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: dotColor },
                  isSelected && styles.dotSelected,
                  !isSelected && styles.dotUnselected,
                ]}
              >
                {isSelected && (
                  <Text style={styles.dotNumber}>{n}</Text>
                )}
              </View>
              {!isSelected && (
                <Text style={[styles.dotLabel, { color: dotColor }]}>{n}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.descRow}>
        <Text style={styles.descLeft}>😌 平静</Text>
        <Text
          style={[
            styles.descCenter,
            { color: value !== null && value !== undefined ? interpolateColor(value) : colors.stone },
          ]}
        >
          {getDescription(value)}
        </Text>
        <Text style={styles.descRight}>😡 激动</Text>
      </View>

      {value === null || value === undefined ? (
        <Text style={styles.optional}>选填，点击数字选择；再次点击取消选择</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    color: colors.stone,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  dotWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotSelected: {
    width: 36,
    height: 36,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dotUnselected: {
    opacity: 0.25,
  },
  dotNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  dotLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  descRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  descLeft: {
    fontSize: 12,
    color: colors.stone,
  },
  descCenter: {
    fontSize: 13,
    fontWeight: '600',
  },
  descRight: {
    fontSize: 12,
    color: colors.stone,
  },
  optional: {
    fontSize: 11,
    color: colors.stone,
    marginTop: 8,
    textAlign: 'center',
  },
});
