import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useExam } from './contexts/ExamContext';

export default function Index() {
  const { session, loading } = useAuth();
  const { exam } = useExam();

  useEffect(() => {
    if (!loading) {
      if (session) {
        if (!exam) {
          router.replace('/exam-selection');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/auth');
      }
    }
  }, [session, loading, exam]);

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