import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import colors from '../../theme/colors';
import { useAuth } from '../../store/authStore';

export default function CodeVerifyScreen({ navigation, route }) {
  const { phone } = route.params;
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert('提示', '请输入 6 位验证码');
      return;
    }
    setLoading(true);
    try {
      await login(phone, code, nickname || undefined);
      // Navigation handled by AppNavigator based on user state
    } catch (err) {
      Alert.alert('验证失败', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>输入验证码</Text>
      <Text style={styles.subtitle}>已发送至 {phone}</Text>

      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={colors.stone}
        autoFocus
      />

      <Text style={styles.label}>昵称（选填）</Text>
      <TextInput
        style={styles.nicknameInput}
        value={nickname}
        onChangeText={setNickname}
        placeholder="你希望别人怎么称呼你"
        placeholderTextColor={colors.stone}
        maxLength={30}
      />

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleVerify}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? '验证中...' : '确认登录'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>重新输入手机号</Text>
      </TouchableOpacity>
    </View>
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
  codeInput: {
    fontSize: 36,
    letterSpacing: 12,
    color: colors.black,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primaryMid,
    paddingBottom: 12,
    marginBottom: 36,
    textAlign: 'center',
  },
  label: { fontSize: 13, color: colors.stone, marginBottom: 8 },
  nicknameInput: {
    fontSize: 17,
    color: colors.black,
    borderBottomWidth: 1,
    borderBottomColor: colors.stoneLight,
    paddingBottom: 10,
    marginBottom: 48,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '600' },
  back: { alignItems: 'center', marginTop: 24 },
  backText: { fontSize: 14, color: colors.stone },
});
