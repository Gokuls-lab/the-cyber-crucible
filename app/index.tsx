import React from 'react';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet, Text, Dimensions } from 'react-native';
import { useExam } from '@/contexts/ExamContext';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function Index() {
  const { session, loading, error } = useAuth();
  const { exam } = useExam();
  const [timeoutError, setTimeoutError] = React.useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (session) {
        if (!exam) {
          console.log('[Index] Authenticated, no exam, navigating to /exam-selection');
          router.replace('/exam-selection');
        } else {
          console.log('[Index] Authenticated, exam selected, navigating to /(tabs)');
          router.replace('/(tabs)');
        }
      } else {
        console.log('[Index] Not authenticated, navigating to /auth');
        router.replace('/auth');
      }
    } else {
      // If loading for more than 10s, show error
      const timeout = setTimeout(() => {
        setTimeoutError('App is taking too long to load. Please check your internet connection or try reinstalling.');
        console.error('[Index] Loading timeout: stuck on splash screen.');
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [session, loading, exam]);

  if (error || timeoutError) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: 'red', fontSize: 16, textAlign: 'center' }}>
            {timeoutError || error?.message || 'Unknown error occurred.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1E40AF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});