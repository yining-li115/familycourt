import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Share } from 'react-native';
import colors from '../../theme/colors';
import { familiesApi } from '../../services/api';
import { useAuth } from '../../store/authStore';

export default function CreateFamilyScreen({ navigation, route }) {
  const { updateUser } = useAuth();
  const fromProfile = route?.params?.fromProfile;
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入家庭名称');
      return;
    }
    if (!alias.trim()) {
      Alert.alert('提示', '请输入你在该家庭中的称呼');
      return;
    }
    setLoading(true);
    try {
      const family = await familiesApi.create(name.trim(), alias.trim());
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

  function handleDone() {
    if (fromProfile) {
      navigation.goBack();
    }
    // Otherwise the navigation guard in index.js will handle it (user now has family_id)
  }

  if (created) {
    return (
      <View style={styles.container}>
        <Text style={styles.success}>家庭已创建</Text>
        <Text style={styles.familyName}>{created.name}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>邀请码</Text>
          <Text style={styles.code}>{created.invite_code}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>分享邀请码</Text>
        </TouchableOpacity>
        {fromProfile && (
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>返回</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.hint}>家庭成员 ≥ 3 人时才能指定真人法官</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{fromProfile ? '创建新家庭' : '创建我的家庭'}</Text>
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
      <Text style={styles.aliasLabel}>你在该家庭中的称呼</Text>
      <TextInput
        style={styles.aliasInput}
        value={alias}
        onChangeText={setAlias}
        placeholder="例如：爸爸、男朋友、室友"
        placeholderTextColor={colors.stone}
        maxLength={20}
      />
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? '创建中...' : '创建家庭'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('JoinFamily', { fromProfile })} style={styles.link}>
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
  subtitle: { fontSize: 15, color: colors.stone, marginTop: 8, marginBottom: 32, lineHeight: 22 },
  input: {
    fontSize: 20,
    color: colors.black,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primaryMid,
    paddingBottom: 12,
    marginBottom: 24,
  },
  aliasLabel: { fontSize: 13, color: colors.stone, marginBottom: 8 },
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
  success: { fontSize: 20, color: colors.primary, marginBottom: 16, fontWeight: '600' },
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
    marginBottom: 16,
  },
  shareBtnText: { color: colors.white, fontSize: 17, fontWeight: '600' },
  doneBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  doneBtnText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
  hint: { fontSize: 13, color: colors.stone, textAlign: 'center', lineHeight: 20 },
});
