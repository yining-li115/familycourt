import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import colors from '../../theme/colors';
import { notificationsApi } from '../../services/api';

// ─── Notification type → icon mapping ────────────────────────────────────────

function getIcon(type) {
  const map = {
    case_filed: '⚖️',
    judge_accepted: '📋',
    defendant_defended: '💬',
    inquiry_sent: '❓',
    fact_finding_published: '📄',
    claim_submitted: '📝',
    mediation_started: '🤝',
    case_closed: '✅',
    case_archived: '🗂️',
    case_withdrawn: '↩️',
    ai_takeover_warning: '🤖',
  };
  return map[type] || '🔔';
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotificationItem({ item, onPress, onMarkRead }) {
  return (
    <TouchableOpacity
      style={[styles.card, item.read && styles.cardRead]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={styles.iconWrapper}>
        <Text style={styles.icon}>{getIcon(item.type)}</Text>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, item.read && styles.textRead]}>{item.title}</Text>
        <Text style={[styles.cardBodyText, item.read && styles.textRead]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
      </View>
      {!item.read && (
        <TouchableOpacity
          style={styles.readBtn}
          onPress={() => onMarkRead(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.readBtnText}>已读</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Sort: unread first, then by created_at desc
  function sorted(list) {
    return [...list].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await notificationsApi.list({ limit: 50 });
      setNotifications(sorted(res.data ?? []));
    } catch (err) {
      Alert.alert('加载失败', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handlePress = useCallback(
    (item) => {
      // Mark as read on tap
      if (!item.read) {
        notificationsApi.markRead(item.id).catch(() => {});
        setNotifications((prev) =>
          sorted(prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
        );
      }
      if (item.case_id) {
        navigation.navigate('CaseDetail', { caseId: item.case_id });
      }
    },
    [navigation]
  );

  const handleMarkRead = useCallback((id) => {
    notificationsApi.markRead(id).catch(() => {});
    setNotifications((prev) =>
      sorted(prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    );
  }, []);

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => sorted(prev.map((n) => ({ ...n, read: true }))));
    } catch (err) {
      Alert.alert('操作失败', err.message);
    }
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
      {/* Title bar */}
      <View style={styles.titleBar}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>通知</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>全部已读</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem item={item} onPress={handlePress} onMarkRead={handleMarkRead} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>暂无通知</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warmLight,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.stoneLight,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.black,
  },
  unreadBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
  },
  markAllText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'flex-start',
  },
  cardRead: {
    opacity: 0.65,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warmLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
    position: 'relative',
  },
  icon: {
    fontSize: 20,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 3,
  },
  cardBodyText: {
    fontSize: 13,
    color: colors.stone,
    lineHeight: 19,
    marginBottom: 6,
  },
  textRead: {
    color: colors.stone,
    fontWeight: '400',
  },
  cardTime: {
    fontSize: 11,
    color: colors.stone,
  },
  readBtn: {
    marginLeft: 8,
    backgroundColor: colors.stoneLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  readBtnText: {
    fontSize: 12,
    color: colors.stone,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.stone,
  },
});
