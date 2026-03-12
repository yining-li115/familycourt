import React from 'react';
import { AuthProvider } from './src/store/authStore';
import AppNavigator from './src/navigation';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
