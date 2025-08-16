import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChartBar as BarChart, Calendar, Clock, RotateCw, Target, Trash2 } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

const SUBJECT_COLORS: Record<string, string> = {
  'SASE': '#10B981',
  'Penetration Testing': '#3B82F6',
  'Access Control Models': '#8B5CF6',
  'Virtual TPM (vTPM)': '#EF4444',
  'Incident Response': '#F59E0B',
};
function subjectColor(score: number) {
  if (score >= 80) return '#10B981';
  if (score > 49) return '#F59E0B';
  return '#EF4444';
}
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [achievements, setAchievements] = useState<any[]>([]);
  const { user } = useAuth();
  const { exam, subject, loading: examLoading } = useExam();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<any[]>([]);
  const router = useRouter();

  const fetchStats = async () => {
    if (!user || !exam) return;
    setLoading(true);
    try {
      // 1. Fetch subjects for the exam
      const { data: subjectExams, error: subjectExamsError } = await supabase
        .from('subject_exams')
        .select('subject_id')
        .eq('exam_id', exam.id);
      if (subjectExamsError) throw subjectExamsError;
      const subjectIds = [...new Set((subjectExams || []).map((se: any) => se.subject_id).filter(Boolean))];
      const { data: filteredSubjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .in('id', subjectIds);
      if (subjectsError) throw subjectsError;
      setSubjects(filteredSubjects || []);

      // 2. Fetch all quiz sessions for the current exam
      const { data: sessions, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('id, completed_at, time_taken_seconds')
        .eq('user_id', user.id)
        .eq('exam_id', exam.id);
      if (sessionError) throw sessionError;

      // 3. Fetch all question IDs for the current exam
      const { data: examQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id')
        .eq('exam', exam.id);
      if (questionsError) throw questionsError;
      const questionIdsForExam = (examQuestions || []).map(q => q.id);

      // If there are no questions for this exam, there's nothing to show.
      if (questionIdsForExam.length === 0) {
        setStats({ streak: 0, totalQuestions: 0, accuracy: 0, studyTime: '0m', weeklyProgress: Array(7).fill(0), subjectScores: [] });
        setLoading(false);
        return;
      }

      // 4. Fetch all user answers that belong to this exam's questions
      // This is the most reliable way to scope the data, covering both quiz and review modes.
      let answersQuery = supabase
        .from('user_answers')
        .select('id, is_correct, answered_at, question_id, quiz_session_id, questions:question_id (domain, subject_id)')
        .eq('user_id', user.id)
        .in('question_id', questionIdsForExam);

      if (subject) {
        answersQuery = answersQuery.eq('questions.subject_id', subject.id);
      }

      const { data: answers, error: answerError } = await answersQuery.order('answered_at', { ascending: false });
      if (answerError) throw answerError;

      // 5. All subsequent calculations are now correctly scoped because `answers` and `sessions` are filtered.

      // Calculate Streak (from exam-specific sessions)
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

      // Calculate Core Stats (from exam-specific answers)
      const totalQuestions = answers.length;
      const correctAnswers = answers.filter((a: any) => a.is_correct).length;
      const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

      // Calculate Study Time
      const quizTimeSeconds = (sessions || []).reduce((sum: number, s: any) => sum + (s.time_taken_seconds || 0), 0);
      let reviewTimeSeconds = 0;
      const nonQuizAnswers = answers.filter(a => !a.quiz_session_id);
      if (nonQuizAnswers.length > 0) {
        const answersByDate: Record<string, any[]> = {};
        nonQuizAnswers.forEach(a => {
          const date = a.answered_at.split('T')[0];
          if (!answersByDate[date]) answersByDate[date] = [];
          answersByDate[date].push(a);
        });

        Object.values(answersByDate).forEach(dateAnswers => {
          const sortedAnswers = dateAnswers.sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime());
          sortedAnswers.forEach((answer, index) => {
            if (index === 0) return;
            const timeDiff = (new Date(answer.answered_at).getTime() - new Date(sortedAnswers[index - 1].answered_at).getTime()) / 1000;
            if (timeDiff <= 300) { // Only count if answers are within 5 minutes
              reviewTimeSeconds += timeDiff;
            }
          });
        });
      }
      const totalSeconds = quizTimeSeconds + reviewTimeSeconds;
      const totalMinutes = Math.round(totalSeconds / 60);
      const totalHours = totalMinutes / 60;
      const studyTime = totalMinutes < 60 ? `${totalMinutes}m` : `${totalHours.toFixed(1)}h`;

      // Calculate Weekly Progress
      const weeklyProgress = Array(7).fill(0);
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const ds = d.toISOString().slice(0, 10);
        weeklyProgress[i] = answers.filter((a: any) => (a.answered_at || '').slice(0, 10) === ds).length;
      }

      // Calculate Subject Scores
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
      const subjectScores = (filteredSubjects || []).map((s: any) => ({
        name: s.name,
        score: subjectMap[s.id] ? Math.round((subjectMap[s.id].correct / subjectMap[s.id].total) * 100) : 0,
        color: SUBJECT_COLORS[s.name] || '#3B82F6',
      }));

      // 6. Set the final, correctly-scoped state
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
    }
  };

  const handleRefresh = () => {
    fetchStats();
  };

  const handleReset = async () => {
    Alert.alert(
      "Reset All Data",
      "Warning:- This will permanently erase data for the current exam:\n\n• Your quiz history and results\n• All performance statistics\n• Study time tracking\n• Achievement records\n• Level Up Progress\n\nThis action cannot be undone. Do you want to proceed?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              
              // Delete quiz sessions for the current exam
              await supabase
                .from('quiz_sessions')
                .delete()
                .eq('user_id', user?.id)
                .eq('exam_id', exam.id);

              // Get all question IDs for the current exam to delete associated answers
              const { data: examQuestions, error: questionsError } = await supabase
                .from('questions')
                .select('id')
                .eq('exam', exam.id);

              if (questionsError) throw questionsError;

              const questionIds = examQuestions.map(q => q.id);

              if (questionIds.length > 0) {
                // Delete user answers for the questions in the current exam
                await supabase
                  .from('user_answers')
                  .delete()
                  .eq('user_id', user?.id)
                  .in('question_id', questionIds);
              }

              // Note: user_progress is not exam-specific, so we might not want to reset it here
              // or we need a more granular progress tracking per exam.
              // For now, we'll leave it as is, but it's a point for future improvement.
              // Delete user_progress
              await supabase.rpc('update_exam_stage', {
                              uid: user?.id,
                              exam_id: exam.id,
                              new_stage: 0,
                            });
              // Reset stats
              setStats(null);
              setAchievements([]);
              
              ToastAndroid.show('All data has been reset successfully', ToastAndroid.SHORT);
              
              // Refresh stats to show empty state
              fetchStats();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to reset data. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (!examLoading && user && exam) {
      fetchStats();
    }
  }, [user, exam, examLoading]);

  if (examLoading) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.safeArea}>
        <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <SpinnerAnimation />
            <Text style={{ color: '#CBD5E1', fontSize: 18, marginTop: 16 }}>Loading Stats...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user || !exam) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.safeArea}>
        <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#F8FAFC', fontSize: 18, textAlign: 'center', marginBottom: 24 }}>
              Please select an exam to view your stats.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#F59E0B', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
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
      <SafeAreaView style={{ ...styles.safeArea, paddingBottom: vs(60) + (insets.bottom || 10) }}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Your Statistics</Text>
              <Text style={styles.subtitle}>Track your certification journey</Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                onPress={handleReset}
                style={[styles.iconButton, styles.resetButton]}
                disabled={loading}
              >
                <Trash2 
                  size={20} 
                  color="#EF4444" 
                  style={loading ? { opacity: 0.5 } : undefined}
                />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleRefresh}
                style={styles.iconButton}
                disabled={loading}
              >
                <RotateCw 
                  size={20} 
                  color="#F8FAFC" 
                  style={loading ? { opacity: 0.5 } : undefined}
                />
              </TouchableOpacity>
            </View>
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
                  <Text style={styles.metricValue}>{stats?.studyTime}</Text>
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
                              maxHeight:'100%',
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
                <View style={{ justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.cardTitle}>Topic wise Performance</Text>
                </View>
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
                                backgroundColor: subjectColor(subject.score),
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

              {/* <View style={styles.chartCard}>
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
              </View> */}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  resetButton: {
    backgroundColor: '#1E1E1E',
    borderColor: '#EF4444',
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
    color: 'rgb(200,200,200)',
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