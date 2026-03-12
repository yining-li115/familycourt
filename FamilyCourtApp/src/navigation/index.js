import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../store/authStore';
import { notificationsApi } from '../services/api';
import NotificationBadge from '../components/NotificationBadge';

// Auth screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import CodeVerifyScreen from '../screens/auth/CodeVerifyScreen';

// Family onboarding
import CreateFamilyScreen from '../screens/family/CreateFamilyScreen';
import JoinFamilyScreen from '../screens/family/JoinFamilyScreen';

// Main tabs
import HomeScreen from '../screens/main/HomeScreen';
import ArchiveScreen from '../screens/main/ArchiveScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// Case detail
import CaseDetailScreen from '../screens/case/CaseDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Notification badge tab icon ─────────────────────────────────────────────

function BellIcon({ color, unreadCount }) {
  return (
    <View style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}>
      {/* Simple bell drawn with text; replace with an SVG icon library if available */}
      <View style={{ position: 'relative' }}>
        <View
          style={{
            width: 20,
            height: 18,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: color,
            borderBottomWidth: 0,
            marginTop: 4,
          }}
        />
        <View
          style={{
            width: 2,
            height: 4,
            backgroundColor: color,
            alignSelf: 'center',
            marginTop: -1,
          }}
        />
        <NotificationBadge count={unreadCount} />
      </View>
    </View>
  );
}

// ─── Main tabs ────────────────────────────────────────────────────────────────

function MainTabs() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll unread count every 30 s
  useEffect(() => {
    let cancelled = false;

    async function fetchUnread() {
      try {
        const res = await notificationsApi.list({ unread_only: 'true' });
        if (!cancelled) {
          setUnreadCount(res.total ?? 0);
        }
      } catch (_e) {
        // Silently ignore — badge just won't update
      }
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#1A1A1A',
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        tabBarActiveTintColor: '#4A7C59',
        tabBarInactiveTintColor: '#6B6B6B',
        tabBarStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: '案件' }}
      />
      <Tab.Screen
        name="Archive"
        component={ArchiveScreen}
        options={{ title: '档案' }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: '通知',
          tabBarIcon: ({ color }) => (
            <BellIcon color={color} unreadCount={unreadCount} />
          ),
        }}
        listeners={{
          tabPress: () => {
            // Reset badge immediately when tab is pressed; the screen will
            // show "全部已读" to clear them properly.
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: '我的' }}
      />
    </Tab.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: '#1A1A1A',
            headerTitleStyle: { fontWeight: '600' },
            headerShadowVisible: false,
          }}
        >
          {!user ? (
            // Auth flow
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
              <Stack.Screen name="PhoneInput" component={PhoneInputScreen} options={{ title: '手机号登录' }} />
              <Stack.Screen name="CodeVerify" component={CodeVerifyScreen} options={{ title: '验证码' }} />
            </>
          ) : !user.family_id ? (
            // Family onboarding flow
            <>
              <Stack.Screen name="CreateFamily" component={CreateFamilyScreen} options={{ title: '创建家庭', headerBackVisible: false }} />
              <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} options={{ title: '加入家庭' }} />
            </>
          ) : (
            // Main app
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen
                name="CaseDetail"
                component={CaseDetailScreen}
                options={{ headerShown: true, title: '案件详情', headerBackTitle: '返回' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
