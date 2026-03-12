import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.icon}>⚖️</Text>
        <Text style={styles.title}>Family Court</Text>
        <Text style={styles.subtitle}>家  庭  法  院</Text>
        <Text style={styles.tagline}>用仪式感降温，让每一场矛盾有始有终地被解决</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('PhoneInput')}
        >
          <Text style={styles.primaryBtnText}>开始使用</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warmLight,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 64, marginBottom: 24 },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.black,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: colors.stone,
    letterSpacing: 8,
    marginTop: 8,
  },
  tagline: {
    fontSize: 14,
    color: colors.stone,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 22,
  },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
});
