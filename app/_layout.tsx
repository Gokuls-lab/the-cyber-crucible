import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ExamProvider } from '@/contexts/ExamContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import SplashScreen from './SplashScreen';

function AppContent() {
  const { loading } = useAuth();
  if (loading) {
    return <SplashScreen backgroundColor="#050d18" />;
  }
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ExamProvider>
        <AppContent />
      </ExamProvider>
    </AuthProvider>
  );
}