import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import colors from '../../theme/colors';
import { casesApi } from '../../services/api';
import { getStatusLabel, getStatusColor, CATEGORY_LABELS } from '../../utils/caseStatus';

export default function ArchiveScreen({ navigation }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    casesApi.list().then((data) => {
      setCases(data.filter((c) => ['closed', 'archived', 'withdrawn'].includes(c.status)));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>历史档案</Text>
      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const statusColor = getStatusColor(item.status);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
            >
              <View style={styles.row}>
                <Text style={styles.caseNumber}>{item.case_number}</Text>
                <Text style={[styles.status, { color: statusColor }]}>{getStatusLabel(item.status)}</Text>
              </View>
              <Text style={styles.category}>{CATEGORY_LABELS[item.category] || item.category}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('zh-CN')}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>暂无历史案件</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmLight },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.black, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  caseNumber: { fontSize: 13, color: colors.stone, fontFamily: 'monospace' },
  status: { fontSize: 13, fontWeight: '500' },
  category: { fontSize: 15, fontWeight: '500', color: colors.black, marginTop: 8 },
  date: { fontSize: 12, color: colors.stone, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.stone, marginTop: 80, fontSize: 15 },
});
