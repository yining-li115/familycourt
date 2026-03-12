import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import colors from '../../theme/colors';
import { familiesApi } from '../../services/api';
import { useAuth } from '../../store/authStore';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.family_id) {
      Promise.all([familiesApi.me(), familiesApi.members()])
        .then(([f, m]) => { setFamily(f); setMembers(m); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  function handleLogout() {
    Alert.alert('确认登出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: logout },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>我的</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>个人信息</Text>
        <View style={styles.row}><Text style={styles.label}>昵称</Text><Text style={styles.value}>{user?.nickname}</Text></View>
        <View style={styles.row}><Text style={styles.label}>手机号</Text><Text style={styles.value}>{user?.phone}</Text></View>
        {user?.family_alias && (
          <View style={styles.row}><Text style={styles.label}>家庭称呼</Text><Text style={styles.value}>{user.family_alias}</Text></View>
        )}
      </View>

      {family && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>家庭信息</Text>
          <View style={styles.row}><Text style={styles.label}>家庭名称</Text><Text style={styles.value}>{family.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>邀请码</Text><Text style={[styles.value, styles.code]}>{family.invite_code}</Text></View>
          <View style={styles.row}><Text style={styles.label}>成员数</Text><Text style={styles.value}>{members.length} 人</Text></View>
          {members.length < 3 && (
            <Text style={styles.warning}>⚠️ 成员不足 3 人，案件将由 AI 担任法官</Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmLight, paddingHorizontal: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.black, marginBottom: 24 },
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 13, color: colors.stone, marginBottom: 12, fontWeight: '500' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.stoneLight },
  label: { fontSize: 15, color: colors.stone },
  value: { fontSize: 15, color: colors.black, fontWeight: '500' },
  code: { fontFamily: 'monospace', letterSpacing: 4, color: colors.primary },
  warning: { fontSize: 13, color: colors.warm, marginTop: 10, lineHeight: 20 },
  logoutBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { fontSize: 16, color: colors.error, fontWeight: '500' },
});
