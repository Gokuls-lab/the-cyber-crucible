import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Target, Clock, Award, ChartBar as BarChart, Calendar } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Animated, { Easing, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useExam } from '../contexts/ExamContext';
import { useRouter } from 'expo-router';

const SUBJECT_COLORS: Record<string, string> = {
  'Network Security': '#10B981',
  'Penetration Testing': '#3B82F6',
  'Vulnerability Assessment': '#8B5CF6',
  'Risk Management': '#EF4444',
  'Incident Response': '#F59E0B',
};

export default function StatsScreen() {
  const [achievements, setAchievements] = useState<any[]>([]);
  const { user } = useAuth();
  const { exam, subject } = useExam();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!exam) {
      setSubjects([]);
      return;
    }

    (async () => {
      // 1. Fetch all subject_exams for the selected exam
      const { data: subjectExams, error: subjectExamsError } = await supabase
        .from('subject_exams')
        .select('subject_id')
        .eq('exam_id', exam.id);
      if (subjectExamsError) {
        setSubjects([]);
        return;
      }
      // 2. Extract unique subject_ids
      const subjectIds = [...new Set((subjectExams || []).map((se: any) => se.subject_id).filter(Boolean))];
      if (subjectIds.length === 0) {
        setSubjects([]);
        return;
      }
      // 3. Fetch only those subjects
      const { data: filteredSubjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .in('id', subjectIds);
      if (subjectsError) {
        setSubjects([]);
        return;
      }
      setSubjects(filteredSubjects || []);
    })();
  }, [exam]);

  const fetchStats = async () => {
    if (!user || !exam) return;
    setLoading(true);
    try {
      const { data: sessions, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('id, completed_at, time_taken_seconds')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });
      if (sessionError) throw sessionError;
      let answersQuery = supabase
        .from('user_answers')
        .select('id, is_correct, answered_at, question_id, questions:question_id (domain, subject_id)');
      if (subject) answersQuery = answersQuery.eq('questions.subject_id', subject.id);
      const { data: answers, error: answerError } = await answersQuery.order('answered_at', { ascending: false });
      if (answerError) throw answerError;
      const daysSet = new Set((sessions || []).map((s: any) => (s.completed_at || '').slice(0, 10)));
      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (daysSet.has(ds)) {
          streak++;
        } else {
          break;
        }
      }
      const totalQuestions = answers.length;
      const correctAnswers = answers.filter((a: any) => a.is_correct).length;
      const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
      // Calculate quiz time (from sessions)
      const quizTimeSeconds = (sessions || []).reduce((sum: number, s: any) => sum + (s.time_taken_seconds || 0), 0);
      // Calculate review time (from user_answers)
      let reviewTimeSeconds = 0;
      if (answers && answers.length > 0) {
        // Group answers by quiz_session_id
        const answersBySession: Record<string, any[]> = {};
        for (const a of answers) {
          const sid = a.quiz_session_id || 'no_session';
          if (!answersBySession[sid]) answersBySession[sid] = [];
          answersBySession[sid].push(a);
        }
        for (const sid in answersBySession) {
          const sessionAnswers = answersBySession[sid];
          if (sessionAnswers.length > 1) {
            // Find earliest and latest answered_at
            const timestamps = sessionAnswers.map(a => new Date(a.answered_at).getTime()).filter(Boolean);
            if (timestamps.length > 1) {
              const min = Math.min(...timestamps);
              const max = Math.max(...timestamps);
              // If review session is longer than quiz session, count the extra as review time
              const session = (sessions || []).find((s: any) => s.id === sid);
              const quizSessionTime = session ? (session.time_taken_seconds || 0) : 0;
              const reviewSessionTime = Math.max(0, Math.floor((max - min) / 1000) - quizSessionTime);
              reviewTimeSeconds += reviewSessionTime;
            }
          }
        }
      }
      const totalStudyTimeHours = Math.round(((quizTimeSeconds + reviewTimeSeconds) / 3600) * 10) / 10;
      const studyTime = totalStudyTimeHours;
      const weeklyProgress = Array(7).fill(0);
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const ds = d.toISOString().slice(0, 10);
        weeklyProgress[i] = answers.filter((a: any) => (a.answered_at || '').slice(0, 10) === ds).length;
      }
      // Deduplicate answers: keep only the latest (by answered_at) per question_id
      const latestByQuestion: Record<string, any> = {};
      for (const a of answers) {
        if (!latestByQuestion[a.question_id] || new Date(a.answered_at).getTime() > new Date(latestByQuestion[a.question_id].answered_at).getTime()) {
          latestByQuestion[a.question_id] = a;
        }
      }
      const subjectMap: Record<string, { correct: number; total: number }> = {};
      for (const qid in latestByQuestion) {
        const a = latestByQuestion[qid];
        let sid: string = 'Other';
        if (a.questions && typeof a.questions === 'object' && 'subject_id' in a.questions && a.questions.subject_id) {
          sid = String(a.questions.subject_id);
        }
        if (!subjectMap[sid]) subjectMap[sid] = { correct: 0, total: 0 };
        subjectMap[sid].total++;
        if (a.is_correct) subjectMap[sid].correct++;
      }
      const subjectScores = (subjects.length > 0 ? subjects : []).map((s: any) => ({
        name: s.name,
        score: subjectMap[s.id] ? Math.round((subjectMap[s.id].correct / subjectMap[s.id].total) * 100) : 0,
        color: SUBJECT_COLORS[s.name] || '#3B82F6',
      }));
      setStats({
        streak,
        totalQuestions,
        correctAnswers,
        accuracy,
        studyTime,
        weeklyProgress,
        subjectScores,
      });
    } catch (err) {
      setStats(null);
      alert('Failed to load stats.');
      console.error(err);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  };

  useEffect(() => {
    if (!initialLoaded && user && exam) {
      fetchStats();
    }
  }, [user, exam, subject, initialLoaded]);

  // Re-fetch stats when subjects change and all dependencies are loaded
  useEffect(() => {
    if (initialLoaded && user && exam) {
      fetchStats();
    }
  }, [subjects, initialLoaded, user, exam]);

  if (!exam) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#F8FAFC', fontSize: 18, textAlign: 'center' }}>
              Please select an exam to view your stats.
            </Text>
            <TouchableOpacity
              style={{ marginTop: 24, backgroundColor: '#F59E0B', padding: 12, borderRadius: 8 }}
              onPress={() => router.push('/exam-selection')}
            >
              <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>Select Exam</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Your Statistics</Text>
            <Text style={styles.subtitle}>Track your certification journey</Text>
            {!loading && (
              <View style={{ position: 'absolute', right: 0, top: 0 }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#F59E0B', padding: 8, borderRadius: 8 }}
                  onPress={fetchStats}
                >
                  <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>Reload</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {loading ? (
            <View style={{ alignItems: 'center', marginTop: 20 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 16 }}>Loading stats...</Text>
            </View>
          ) : (
            <>
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <View style={styles.metricIcon}>
                    <Calendar size={24} color="#F59E0B" strokeWidth={2} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.streak}</Text>
                  <Text style={styles.metricLabel}>Day Streak</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricIcon}>
                    <Target size={24} color="#10B981" strokeWidth={2} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.accuracy ?? 'N/A'}%</Text>
                  <Text style={styles.metricLabel}>Accuracy</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricIcon}>
                    <BarChart size={24} color="#3B82F6" strokeWidth={2} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.totalQuestions}</Text>
                  <Text style={styles.metricLabel}>Questions</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricIcon}>
                    <Clock size={24} color="#8B5CF6" strokeWidth={2} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.studyTime}h</Text>
                  <Text style={styles.metricLabel}>Study Time</Text>
                </View>
              </View>

              <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>Weekly Progress</Text>
                <View style={styles.chartContainer}>
                  <View style={styles.chart}>
                    {stats?.weeklyProgress?.map((score: number, index: number) => (
                      <View key={index} style={styles.chartColumn}>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height: `${score}%`,
                              backgroundColor: index === 6 ? '#F59E0B' : '#3B82F6',
                            },
                          ]}
                        />
                        <Text style={styles.chartLabel}>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>Subject Performance</Text>
                <View style={styles.subjectsContainer}>
                  {stats?.subjectScores?.map((subject: any, index: number) => (
                    <View key={index} style={styles.subjectRow}>
                      <Text style={styles.subjectName}>{subject.name}</Text>
                      <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${subject.score}%`,
                                backgroundColor: subject.color,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.subjectScore}>{subject.score}%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>Recent Achievements</Text>
                <View style={styles.achievementsContainer}>
                  {achievements.length === 0 ? (
                    <Text style={{ color: '#94A3B8' }}>No recent achievements yet.</Text>
                  ) : (
                    achievements.map(a => (
                      <View key={a.id} style={styles.achievementItem}>
                        <View style={styles.achievementIcon} />
                        <View style={styles.achievementText}>
                          <Text style={styles.achievementTitle}>{a.title}</Text>
                          <Text style={styles.achievementDesc}>{a.description}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 30,
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#CBD5E1',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30,
  },
  metricCard: {
    backgroundColor: '#334155',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: '#475569',
  },
  metricIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: '#334155',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#475569',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 20,
  },
  chartContainer: {
    height: 200,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingBottom: 30,
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  chartBar: {
    width: 20,
    borderRadius: 4,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: '#94A3B8',
    position: 'absolute',
    bottom: 0,
  },
  subjectsContainer: {
    gap: 16,
  },
  subjectRow: {
    gap: 12,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  subjectScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    minWidth: 40,
    textAlign: 'right',
  },
  achievementsContainer: {
    gap: 16,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementText: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 14,
    color: '#94A3B8',
  },
});

function SpinnerAnimation() {
  const rotation = useSharedValue(0);
  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={[{ width: 64, height: 64, marginBottom: 16 }, animatedStyle]}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle
          cx={32}
          cy={32}
          r={28}
          stroke="#F59E0B"
          strokeWidth={6}
          strokeDasharray={"44 88"}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}