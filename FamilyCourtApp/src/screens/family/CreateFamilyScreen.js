import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Share } from 'react-native';
import colors from '../../theme/colors';
import { familiesApi } from '../../services/api';
import { useAuth } from '../../store/authStore';

export default function CreateFamilyScreen({ navigation }) {
  const { updateUser } = useAuth();
  const [name, setName] = useState('');
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入家庭名称');
      return;
    }
    setLoading(true);
    try {
      const family = await familiesApi.create(name.trim());
      const me = await (await import('../../services/api')).usersApi.me();
      updateUser(me);
      setCreated(family);
    } catch (err) {
      Alert.alert('创建失败', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    await Share.share({
      message: `加入我的家庭法院「${created.name}」，邀请码：${created.invite_code}`,
    });
  }

  if (created) {
    return (
      <View style={styles.container}>
        <Text style={styles.success}>✅ 家庭已创建</Text>
        <Text style={styles.familyName}>{created.name}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>邀请码</Text>
          <Text style={styles.code}>{created.invite_code}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>分享邀请码</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>家庭成员 ≥ 3 人时才能指定真人法官</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>创建我的家庭</Text>
      <Text style={styles.subtitle}>给你的家庭起个名字吧，比如「王家法院」</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="家庭名称（最多 50 字）"
        placeholderTextColor={colors.stone}
        maxLength={50}
        autoFocus
      />
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? '创建中...' : '创建家庭'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('JoinFamily')} style={styles.link}>
        <Text style={styles.linkText}>已有邀请码？加入家庭</Text>
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
  input: {
    fontSize: 20,
    color: colors.black,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primaryMid,
    paddingBottom: 12,
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
  success: { fontSize: 20, color: colors.statusClosed, marginBottom: 16 },
  familyName: { fontSize: 28, fontWeight: '600', color: colors.black, marginBottom: 32 },
  codeBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  codeLabel: { fontSize: 13, color: colors.stone, marginBottom: 8 },
  code: { fontSize: 36, fontWeight: '700', color: colors.primary, letterSpacing: 8 },
  shareBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  shareBtnText: { color: colors.white, fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.stone, textAlign: 'center', lineHeight: 20 },
});
