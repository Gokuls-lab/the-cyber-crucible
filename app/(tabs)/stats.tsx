import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChartBar as BarChart, Calendar, ChevronDown, ChevronUp, Clock, Target, Trash2 } from 'lucide-react-native';
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
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [achievements, setAchievements] = useState<any[]>([]);
  const { user } = useAuth();
  const { exam, subject, loading: examLoading } = useExam();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const router = useRouter();

  // UX Improvement: Topic filtering state
  const [topicFilter, setTopicFilter] = useState<'weakest' | 'strongest' | 'all'>('weakest');
  const [showAllTopics, setShowAllTopics] = useState(false);

  // Animated values for entry
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (!loading) {
      opacity.value = withTiming(1, { duration: 800 });
      translateY.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) });
    }
  }, [loading]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const fetchStats = async () => {
    if (!user || !exam) return;
    if (!refreshing) setLoading(true);
    try {
      // 1. (Skipped) Subjects fetching removed as we now use Domains.
      // Use existing 'subjects' state as empty or remove if fully unused later.
      setSubjects([]);

      // 2. Fetch all quiz sessions for the current exam
      const { data: sessions, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('id, completed_at, time_taken_seconds')
        .eq('user_id', user.id)
        .eq('exam_id', exam.id);
      if (sessionError) throw sessionError;

      // 3. Fetch all question IDs and Domains for the current exam
      const { data: examQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id, domain')
        .eq('exam', exam.id);
      if (questionsError) throw questionsError;

      const questionIdsForExam = (examQuestions || []).map(q => q.id);

      // Get unique domains from the questions
      const allDomains = [...new Set((examQuestions || []).map(q => q.domain).filter(d => d && d.trim() !== ''))].sort();

      // If there are no questions for this exam, there's nothing to show.
      if (questionIdsForExam.length === 0) {
        setStats({ streak: 0, totalQuestions: 0, accuracy: 0, studyTime: '0m', weeklyProgress: Array(7).fill(0), subjectScores: [] });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 4. Fetch all user answers that belong to this exam's questions
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

      // Calculate Domain Performance (replaces Subject Scores)
      const latestByQuestion: Record<string, any> = {};
      for (const a of answers) {
        if (!latestByQuestion[a.question_id] || new Date(a.answered_at).getTime() > new Date(latestByQuestion[a.question_id].answered_at).getTime()) {
          latestByQuestion[a.question_id] = a;
        }
      }

      const domainMap: Record<string, { correct: number; total: number }> = {};
      for (const qid in latestByQuestion) {
        const a = latestByQuestion[qid];
        // Use domain from the joined questions table
        const domainName = a.questions?.domain || 'Other';

        if (!domainMap[domainName]) domainMap[domainName] = { correct: 0, total: 0 };
        domainMap[domainName].total++;
        if (a.is_correct) domainMap[domainName].correct++;
      }

      // Defined vibrant colors for domains to cycle through
      const DOMAIN_PALETTE = [
        '#3B82F6', // Blue
        '#10B981', // Emerald
        '#8B5CF6', // Violet
        '#F59E0B', // Amber
        '#EC4899', // Pink
        '#06B6D4', // Cyan
        '#F97316', // Orange
        '#6366F1', // Indigo
      ];

      const getDomainColor = (index: number) => DOMAIN_PALETTE[index % DOMAIN_PALETTE.length];

      const subjectScores = allDomains.map((domainName: string, index: number) => ({
        name: domainName,
        score: domainMap[domainName] ? Math.round((domainMap[domainName].correct / domainMap[domainName].total) * 100) : 0,
        color: getDomainColor(index),
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
      // alert('Failed to load stats.'); // Silent fail on refresh
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [user, exam]);

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

  // Max value for chart
  const maxWeeklyValue = stats ? Math.max(...stats.weeklyProgress, 1) : 1;

  if (examLoading) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.safeArea}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <SpinnerAnimation color={colors.primary} />
            <Text style={{ color: '#CBD5E1', fontSize: 18, marginTop: 16 }}>Loading Stats...</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (!user || !exam) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.safeArea}>
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
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 90 }}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F59E0B" />
          }
        >
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
            </View>
          </View>

          {loading && !refreshing ? (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <SpinnerAnimation color={colors.primary} />
              <Text style={{ color: '#F8FAFC', fontSize: 16, marginTop: 16 }}>Analyzing performance...</Text>
            </View>
          ) : (
            <Animated.View style={[styles.contentContainer, animatedStyle]}>
              <View style={styles.metricsGrid}>
                {/* Metric Cards with polished look */}
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Calendar size={24} color="#F59E0B" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.streak || 0}</Text>
                  <Text style={styles.metricLabel}>Day Streak</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <Target size={24} color="#10B981" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.accuracy ?? 0}%</Text>
                  <Text style={styles.metricLabel}>Accuracy</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <BarChart size={24} color="#3B82F6" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.totalQuestions || 0}</Text>
                  <Text style={styles.metricLabel}>Questions</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                    <Clock size={24} color="#8B5CF6" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.studyTime || '0m'}</Text>
                  <Text style={styles.metricLabel}>Study Time</Text>
                </View>
              </View>

              {/* Normalized Weekly Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>Weekly Activity</Text>
                <View style={styles.chartContainer}>
                  <View style={styles.chart}>
                    {stats?.weeklyProgress?.map((score: number, index: number) => {
                      const heightPercentage = (score / maxWeeklyValue) * 100;
                      // Ensure minimal visibility for 0 values or just use 4px
                      // If score is 0, show very small bar for aesthetics
                      const barHeight = (score > 0 ? `${heightPercentage}%` : 2) as any;

                      return (
                        <View key={index} style={styles.chartColumn}>
                          {/* Bar Wrapper for centering/track */}
                          <View style={styles.chartBarWrapper}>
                            <View
                              style={[
                                styles.chartBar,
                                {
                                  height: barHeight,
                                  backgroundColor: index === 6 ? '#F59E0B' : '#3B82F6',
                                  opacity: score > 0 ? 1 : 0.3,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.chartLabel, index === 6 && { color: '#F59E0B', fontWeight: 'bold' }]}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.chartCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitleNoMargin}>Topic Performance</Text>
                  {/* Filter Tabs */}
                  <View style={styles.filterContainer}>
                    {(['weakest', 'strongest', 'all'] as const).map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        onPress={() => {
                          setTopicFilter(filter);
                          setShowAllTopics(false); // Reset expansion on filter change
                        }}
                        style={[
                          styles.filterTab,
                          topicFilter === filter && styles.filterTabActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterTabText,
                            topicFilter === filter && styles.filterTabTextActive,
                          ]}
                        >
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.subjectsContainer}>
                  {(() => {
                    const allTopics = [...(stats?.subjectScores || [])];
                    if (topicFilter === 'weakest') {
                      allTopics.sort((a: any, b: any) => a.score - b.score);
                    } else if (topicFilter === 'strongest') {
                      allTopics.sort((a: any, b: any) => b.score - a.score);
                    } else {
                      allTopics.sort((a: any, b: any) => a.name.localeCompare(b.name));
                    }

                    const displayedTopics = showAllTopics ? allTopics : allTopics.slice(0, 5);

                    if (allTopics.length === 0) {
                      return <Text style={{ color: '#94A3B8', textAlign: 'center', padding: 20 }}>No topics available.</Text>;
                    }

                    return (
                      <>
                        {displayedTopics.map((subject: any, index: number) => (
                          <View key={index} style={styles.subjectRow}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <Text
                                style={styles.subjectName}
                              >
                                {subject.name}
                              </Text>
                              <Text style={[styles.subjectScore, { color: subjectColor(subject.score) }]}>{subject.score}%</Text>
                            </View>
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
                          </View>
                        ))}

                        {allTopics.length > 5 && (
                          <TouchableOpacity
                            style={styles.showMoreButton}
                            onPress={() => setShowAllTopics(!showAllTopics)}
                          >
                            <Text style={styles.showMoreText}>
                              {showAllTopics ? 'Show Less' : `Show All (${allTopics.length})`}
                            </Text>
                            {showAllTopics ? (
                              <ChevronUp size={16} color="#64748B" />
                            ) : (
                              <ChevronDown size={16} color="#64748B" />
                            )}
                          </TouchableOpacity>
                        )}
                      </>
                    );
                  })()}
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    // paddingTop: 30, // Removed hardcoded padding
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.subText,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.subText,
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitleNoMargin: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 4,
    gap: 0,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: colors.inputBg,
  },
  filterTabText: {
    fontSize: 12,
    color: colors.subText,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  showMoreText: {
    fontSize: 13,
    color: colors.subText,
    fontWeight: '600',
  },
  chartContainer: {
    height: 180,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    // paddingBottom removed to allow columns to manage spacing
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    gap: 8, // Add gap between bar and text
  },
  chartBarWrapper: {
    flex: 1, // Flex 1 to take available height above text
    width: 12,
    justifyContent: 'flex-end', // Aligns bar to bottom of track
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
  },
  chartLabel: {
    fontSize: 11,
    color: colors.subText,
    textAlign: 'center',
    width: '100%',
    // Absolute positioning removed
  },
  subjectsContainer: {
    gap: 16,
  },
  subjectRow: {
    gap: 4,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 12,
    flexWrap: 'wrap',
    lineHeight: 20,
  },
  progressBarContainer: { // Not used in new layout but kept just in case
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  subjectScore: {
    fontSize: 14,
    fontWeight: '700',
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
    color: colors.text,
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 14,
    color: colors.subText,
  },
});

function SpinnerAnimation({ color = '#F59E0B' }: { color?: string }) {
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
          stroke={color}
          strokeWidth={6}
          strokeDasharray={"44 88"}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}