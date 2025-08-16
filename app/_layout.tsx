import SplashScreen from '@/app/SplashScreen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ExamProvider } from '@/contexts/ExamContext';
import { supabase } from '@/lib/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
const queryClient = new QueryClient();
const app_current_version_code = 3;

function AppContent() {
  const [isLatest, setIsLatest] = useState(false);
  const [checking, setChecking] = useState(true);
  const { loading } = useAuth();

  // ✅ Version check on mount
  useEffect(() => {
    const checkLatestVersion = async () => {
      try {
        const { data: appVersion, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('platform', Platform.OS)
        .order('version_code', { ascending: false })
        .limit(1)
        .single();

        if (error) throw error;

        if (appVersion && appVersion.version_code !== app_current_version_code) {
          setIsLatest(false);
        } else {
          setIsLatest(true);
        }
      } catch (err) {
        console.error('Error checking app version:', err.message);
        setIsLatest(false); // fallback
      } finally {
        setChecking(false);
      }
    };

    checkLatestVersion();
  }, []);

  // ✅ Safe navigation inside useEffect
  useEffect(() => {
    if (!checking && !isLatest) {
      router.replace('/update');
    }
  }, [checking, isLatest]);

  if (loading || checking) {
    return <SplashScreen backgroundColor="#151827" />;
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ExamProvider>
          <AppContent />
        </ExamProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
