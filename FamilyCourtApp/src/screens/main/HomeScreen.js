import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import colors from '../../theme/colors';
import { casesApi } from '../../services/api';
import { getStatusLabel, getStatusColor, CATEGORY_LABELS } from '../../utils/caseStatus';
import { useAuth } from '../../store/authStore';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      const data = await casesApi.list();
      setCases(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  function getRoleLabel(c) {
    if (c.plaintiff_id === user.id) return '原告';
    if (c.defendant_id === user.id) return '被告';
    if (c.judge_id === user.id) return '法官';
    return '旁观';
  }

  function renderCase({ item }) {
    const statusColor = getStatusColor(item.status);
    const role = getRoleLabel(item);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.caseNumber}>{item.case_number}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.category}>{CATEGORY_LABELS[item.category] || item.category}</Text>
          <Text style={styles.role}>{role}</Text>
        </View>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('zh-CN')}</Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>案件</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('CaseDetail', { isNew: true })}
        >
          <Text style={styles.newBtnText}>+ 新起诉</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cases.filter((c) => !['closed', 'archived', 'withdrawn'].includes(c.status))}
        keyExtractor={(item) => item.id}
        renderItem={renderCase}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCases(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⚖️</Text>
            <Text style={styles.emptyText}>暂无进行中的案件</Text>
            <Text style={styles.emptyHint}>家庭和睦，是最好的结案</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmLight },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.black },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newBtnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caseNumber: { fontSize: 13, color: colors.stone, fontFamily: 'monospace' },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '500' },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  category: { fontSize: 16, fontWeight: '500', color: colors.black },
  role: { fontSize: 13, color: colors.stone },
  date: { fontSize: 12, color: colors.stone, marginTop: 8 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 17, color: colors.black, fontWeight: '500' },
  emptyHint: { fontSize: 14, color: colors.stone, marginTop: 8 },
});
