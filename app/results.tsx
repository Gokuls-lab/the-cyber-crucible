import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart, ChevronLeft, Clock, Target } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function ResultsScreen() {
  const { session } = useLocalSearchParams<{ session: string }>();
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const [results, setResults] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.replace('/(tabs)');
      return;
    }
    
    fetchResults();
  }, [session]);

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', session)
        .single();

      if (error) throw error;
      setResults(data);
      // Try to fetch exam info if quiz_type matches an exam short_name
      if (data?.quiz_type) {
        const { data: examData, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('short_name', data.quiz_type)
          .single();
        if (!examError && examData) setExam(examData);
      }
    } catch (err) {
      console.error('Error fetching results:', err);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };


  if (loading || !results) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading results...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const accuracy = Math.round((results.score / results.total_questions) * 100);
  const timeInMinutes = Math.round(results.time_taken_seconds / 60 * 10) / 10;

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <ChevronLeft size={24} color="#F8FAFC" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Quiz Results</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.examTitle}>
            {exam?.title || 'Quiz'}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Target size={24} color="#10B981" strokeWidth={2} />
              </View>
              <Text style={styles.statValue}>{accuracy}%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <BarChart size={24} color="#3B82F6" strokeWidth={2} />
              </View>
              <Text style={styles.statValue}>{results.score}</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Clock size={24} color="#8B5CF6" strokeWidth={2} />
              </View>
              <Text style={styles.statValue}>{timeInMinutes}m</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
          </View>
{
  mode === 'level_up' && (
    <TouchableOpacity
    style={styles.button}
    onPress={() => router.replace('/quiz/levelup')}
  >
    <Text style={styles.buttonText}>continue</Text>
  </TouchableOpacity>
  )
}
{
  mode !== 'level_up' && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.buttonText}>Return to Home</Text>
          </TouchableOpacity>
          )
}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  examTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  examVersion: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 40,
  },
  statCard: {
    backgroundColor: '#334155',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderColor: '#475569',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  button: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
});
