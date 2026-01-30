import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ExamProvider } from '@/contexts/ExamContext';
import { RevenueCatProvider } from '@/contexts/RevenueCatContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import * as NativeSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const queryClient = new QueryClient();
const app_current_version_code = 7;

NativeSplashScreen.preventAutoHideAsync();

function AppContent() {
  const [checking, setChecking] = useState(true);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const { loading, loginRequired } = useAuth();
  const { isDark, colors } = useTheme();

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const { data, error } = await supabase
          .from('app_versions')
          .select('version_code')
          .eq('platform', platform)
          .order('version_code', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error checking for updates:', error);
        }

        if (data && data.version_code > app_current_version_code) {
          setIsUpdateAvailable(true);
        }
      } catch (err) {
        console.error('Unexpected error checking for updates:', err);
      } finally {
        setChecking(false);
      }
    };

    checkUpdate();
  }, []);

  useEffect(() => {
    if (!loading && !checking) {
      NativeSplashScreen.hideAsync();
    }
  }, [loading, checking]);

  if (loading || checking) {
    return null; // Keep Native Splash visible
  }

  // Ensure the root navigator is always mounted
  // We can conditionally redirect, but we must return the Stack
  if (isUpdateAvailable) {
    // We intentionally don't return here, but let the render fall through to the Stack
    // and include a Redirect logic below or rely on the Redirect component in the JSX
  }

  return (
    <>
      {isUpdateAvailable && <Redirect href="/update" />}
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background }
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="exam-selection" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="update" options={{ gestureEnabled: false }} />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor="transparent" translucent />
    </>
  );
}


export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RevenueCatProvider>
            <ExamProvider>
              <AppContent />
            </ExamProvider>
          </RevenueCatProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
