import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import colors from '../../theme/colors';
import { authApi } from '../../services/api';

export default function PhoneInputScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const trimmed = phone.trim();
    if (!/^1[3-9]\d{9}$/.test(trimmed)) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }
    setLoading(true);
    try {
      await authApi.sendCode(trimmed);
      navigation.navigate('CodeVerify', { phone: trimmed });
    } catch (err) {
      Alert.alert('发送失败', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>输入手机号</Text>
      <Text style={styles.subtitle}>我们将向您发送验证码</Text>

      <View style={styles.inputWrapper}>
        <Text style={styles.prefix}>+86</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="请输入手机号"
          placeholderTextColor={colors.stone}
          maxLength={11}
          autoFocus
        />
      </View>

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleSend}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? '发送中...' : '获取验证码'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warmLight,
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  title: { fontSize: 28, fontWeight: '600', color: colors.black },
  subtitle: { fontSize: 15, color: colors.stone, marginTop: 8, marginBottom: 48 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primaryMid,
    marginBottom: 48,
    paddingBottom: 12,
  },
  prefix: { fontSize: 18, color: colors.black, marginRight: 12 },
  input: { flex: 1, fontSize: 22, color: colors.black, letterSpacing: 2 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '600' },
});
