import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, TextInput, ScrollView, Clipboard,
} from 'react-native';
import colors from '../../theme/colors';
import { familiesApi, usersApi } from '../../services/api';
import { useAuth } from '../../store/authStore';

const ROLE_PRESETS = ['爸爸', '妈妈', '儿子', '女儿', '爷爷', '奶奶', '姥姥', '姥爷'];

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingNickname, setEditingNickname] = useState(false);
  const [editingAlias, setEditingAlias] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.family_id) {
      Promise.all([familiesApi.me(), familiesApi.members()])
        .then(([f, m]) => { setFamily(f); setMembers(m); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user?.family_id]);

  async function saveNickname() {
    const trimmed = nicknameInput.trim();
    if (!trimmed || trimmed === user?.nickname) {
      setEditingNickname(false);
      return;
    }
    setSaving(true);
    try {
      await usersApi.update({ nickname: trimmed });
      updateUser({ nickname: trimmed });
      setEditingNickname(false);
    } catch (err) {
      Alert.alert('保存失败', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAlias(value) {
    const trimmed = (value || aliasInput).trim();
    if (!trimmed || trimmed === user?.family_alias) {
      setEditingAlias(false);
      return;
    }
    setSaving(true);
    try {
      await usersApi.update({ family_alias: trimmed });
      updateUser({ family_alias: trimmed });
      setEditingAlias(false);
    } catch (err) {
      Alert.alert('保存失败', err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCopyInviteCode() {
    if (family?.invite_code) {
      Clipboard.setString(family.invite_code);
      Alert.alert('已复制', `邀请码 ${family.invite_code} 已复制到剪贴板`);
    }
  }

  function handleLogout() {
    Alert.alert('确认登出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: logout },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Personal Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>个人信息</Text>

        {/* Nickname */}
        <View style={styles.row}>
          <Text style={styles.label}>昵称</Text>
          {editingNickname ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.input}
                value={nicknameInput}
                onChangeText={setNicknameInput}
                maxLength={30}
                autoFocus
                placeholder="输入昵称"
              />
              <TouchableOpacity onPress={saveNickname} disabled={saving} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{saving ? '...' : '保存'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingNickname(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.valueRow}
              onPress={() => { setNicknameInput(user?.nickname || ''); setEditingNickname(true); }}
            >
              <Text style={styles.value}>{user?.nickname || '未设置'}</Text>
              <Text style={styles.editIcon}>{'>'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Phone */}
        <View style={styles.row}>
          <Text style={styles.label}>手机号</Text>
          <Text style={styles.value}>{user?.phone}</Text>
        </View>

        {/* Family Alias / Role */}
        <View style={styles.row}>
          <Text style={styles.label}>家庭称呼</Text>
          {editingAlias ? (
            <View style={styles.editCol}>
              <View style={styles.editRow}>
                <TextInput
                  style={styles.input}
                  value={aliasInput}
                  onChangeText={setAliasInput}
                  maxLength={20}
                  autoFocus
                  placeholder="输入称呼，如爸爸"
                />
                <TouchableOpacity onPress={() => saveAlias()} disabled={saving} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>{saving ? '...' : '保存'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingAlias(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>取消</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.presetRow}>
                {ROLE_PRESETS.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.presetChip, aliasInput === role && styles.presetChipActive]}
                    onPress={() => { setAliasInput(role); saveAlias(role); }}
                  >
                    <Text style={[styles.presetText, aliasInput === role && styles.presetTextActive]}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.valueRow}
              onPress={() => { setAliasInput(user?.family_alias || ''); setEditingAlias(true); }}
            >
              <Text style={styles.value}>{user?.family_alias || '未设置'}</Text>
              <Text style={styles.editIcon}>{'>'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Family Info */}
      {family && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>家庭信息</Text>
          <View style={styles.row}>
            <Text style={styles.label}>家庭名称</Text>
            <Text style={styles.value}>{family.name}</Text>
          </View>
          <TouchableOpacity style={styles.row} onPress={handleCopyInviteCode}>
            <Text style={styles.label}>邀请码</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.value, styles.code]}>{family.invite_code}</Text>
              <Text style={styles.copyHint}>点击复制</Text>
            </View>
          </TouchableOpacity>

          {/* Members list */}
          <View style={styles.membersSection}>
            <Text style={styles.membersTitle}>成员 ({members.length} 人)</Text>
            {members.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{(m.family_alias || m.nickname || '?')[0]}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.nickname}</Text>
                  {m.family_alias && <Text style={styles.memberAlias}>{m.family_alias}</Text>}
                </View>
                {m.id === family.admin_id && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>管理员</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {members.length < 3 && (
            <Text style={styles.warning}>成员不足 3 人，案件将由 AI 担任法官</Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmLight },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 13, color: colors.stone, marginBottom: 12, fontWeight: '500' },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stoneLight,
  },
  label: { fontSize: 14, color: colors.stone, marginBottom: 4 },
  value: { fontSize: 16, color: colors.black, fontWeight: '500' },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editIcon: { fontSize: 16, color: colors.stone },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editCol: {
    marginTop: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.black,
    backgroundColor: colors.stoneLight,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveBtnText: { color: colors.white, fontSize: 14, fontWeight: '500' },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cancelBtnText: { color: colors.stone, fontSize: 14 },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    backgroundColor: colors.stoneLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  presetChipActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  presetText: { fontSize: 14, color: colors.stone },
  presetTextActive: { color: colors.primary, fontWeight: '500' },
  code: { fontFamily: 'monospace', letterSpacing: 4, color: colors.primary },
  copyHint: { fontSize: 12, color: colors.stone, marginLeft: 8 },
  membersSection: { marginTop: 12 },
  membersTitle: { fontSize: 13, color: colors.stone, marginBottom: 8, fontWeight: '500' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  memberAvatarText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, color: colors.black, fontWeight: '500' },
  memberAlias: { fontSize: 12, color: colors.stone, marginTop: 1 },
  adminBadge: {
    backgroundColor: colors.warmLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adminBadgeText: { fontSize: 11, color: colors.warm, fontWeight: '500' },
  warning: { fontSize: 13, color: '#C4813A', marginTop: 10, lineHeight: 20 },
  logoutBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E74C3C',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { fontSize: 16, color: '#E74C3C', fontWeight: '500' },
});
