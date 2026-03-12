import React from 'react';
import { enableScreens } from 'react-native-screens';
import { AuthProvider } from './src/store/authStore';
import AppNavigator from './src/navigation';

enableScreens();

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
