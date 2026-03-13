import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import colors from '../../theme/colors';
import { familiesApi, usersApi } from '../../services/api';
import { useAuth } from '../../store/authStore';

export default function JoinFamilyScreen({ navigation, route }) {
  const { updateUser } = useAuth();
  const fromProfile = route?.params?.fromProfile;
  const [code, setCode] = useState('');
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (code.trim().length !== 6) {
      Alert.alert('提示', '请输入 6 位邀请码');
      return;
    }
    if (!alias.trim()) {
      Alert.alert('提示', '请填写你在家庭内的称呼');
      return;
    }
    setLoading(true);
    try {
      await familiesApi.join(code.trim().toUpperCase(), alias.trim());
      const me = await usersApi.me();
      updateUser(me);
      if (fromProfile) {
        Alert.alert('加入成功', '', [{ text: '确定', onPress: () => navigation.goBack() }]);
      }
    } catch (err) {
      Alert.alert('加入失败', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>加入家庭</Text>
      <Text style={styles.subtitle}>输入家庭管理员分享的 6 位邀请码</Text>

      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="K7M2P9"
        placeholderTextColor={colors.stone}
        maxLength={6}
        autoCapitalize="characters"
        autoFocus
      />

      <Text style={styles.label}>你在家庭中的称呼</Text>
      <TextInput
        style={styles.aliasInput}
        value={alias}
        onChangeText={setAlias}
        placeholder="例如：爸爸、大宝、奶奶"
        placeholderTextColor={colors.stone}
        maxLength={20}
      />

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleJoin}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? '加入中...' : '加入家庭'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('CreateFamily', { fromProfile })} style={styles.link}>
        <Text style={styles.linkText}>创建新家庭</Text>
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
  subtitle: { fontSize: 15, color: colors.stone, marginTop: 8, marginBottom: 48, lineHeight: 22 },
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
  aliasInput: {
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
  link: { alignItems: 'center', marginTop: 24 },
  linkText: { fontSize: 14, color: colors.primary },
});
