import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuizModes } from '@/lib/QuizModes';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChartBar as BarChart, Calendar, ChevronLeft, ChevronRight, Clock, Crown, CreditCard as Edit, Layers, Target, TrendingUp, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const today = new Date();

const QUIZ_MODES = [
  {
    id: 'daily',
    title: 'Question of the Day',
    icon: Calendar,
    subtitle: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    color: '#3B82F6',
    order_index: 0,
    isPremium: false,
  },
  {
    id: 'flashcard',
    title: 'Flashcards',
    icon: Layers,
    subtitle: 'Adaptive Learning',
    color: '#EC4899',
    order_index: 1,
    isPremium: true,
  },
  {
    id: 'quick_10',
    title: 'Practice Quiz',
    icon: Target,
    subtitle: 'Short quiz round',
    color: '#8B5CF6',
    order_index: 2,
    isPremium: false,
  },
  {
    id: 'timed',
    title: 'Timed Quiz',
    icon: Clock,
    subtitle: 'Beat the clock',
    color: '#06B6D4',
    order_index: 3,
    isPremium: false,
  },
  {
    id: 'level_up',
    title: 'Level Up',
    icon: TrendingUp,
    subtitle: 'Progressive difficulty',
    color: '#8B5CF6',
    order_index: 4,
    isPremium: true,
  },
  {
    id: 'missed',
    title: 'Missed Questions Quiz',
    icon: X,
    subtitle: 'Practice weak areas',
    color: '#EF4444',
    order_index: 5,
    isPremium: true,
  },
  {
    id: 'weakest_subject',
    title: 'Weakest Domain Quiz',
    icon: BarChart,
    subtitle: 'Focus on gaps',
    color: '#F97316',
    order_index: 6,
    isPremium: true,
  },
  {
    id: 'custom',
    title: 'Build Your Own Quiz',
    icon: Edit,
    subtitle: 'Customize your practice',
    color: '#10B981',
    order_index: 7,
    isPremium: true,
  },
];

function enrichModesFromLocal(fetchedModes: any[]): any[] {
  return fetchedModes.map(fetched => {
    const local = QUIZ_MODES.find(localMode => localMode.id === fetched.id);
    return {
      ...fetched,
      subtitle: local?.id === 'daily' ? today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : fetched.subtitle,
      icon: local?.icon,
      color: local?.color,
      order_index: local?.order_index,
      isPremium: fetched.is_premium,
    };
  });
}


export default function StudyScreen() {
  // const temp_app=true;
  // if(temp_app){
  //   return(<Text>StudyScreen</Text>);
  // }
  const insets = useSafeAreaInsets();

  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const { user } = useAuth();
  const { isPro } = useRevenueCat(); // Get real-time status
  const { exam } = useExam();


  const {
    data: rawQuizModes,
    isLoading: isQuizModesLoading,
    isError: isQuizModesError,
    error: quizModesError
  } = useQuizModes();
  const quizModes = Array.isArray(rawQuizModes) ? enrichModesFromLocal(rawQuizModes) : [];
  console.log(quizModes)

  const [studiedDays, setStudiedDays] = useState<number[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [freeProgress, setFreeProgress] = useState({ total: 0, consumed: 0, loading: true });

  useEffect(() => {
    const fetchFreeProgress = async () => {
      if (!user || isPro || !exam) {
        setFreeProgress(prev => ({ ...prev, loading: false }));
        return;
      }
      setFreeProgress(prev => ({ ...prev, loading: true }));
      try {
        // 1. Total Free Questions for this exam
        const { count: total, error: totalError } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('exam', exam.id)
          .eq('is_premium', false);

        if (totalError) throw totalError;

        // 2. Questions answered correctly by this user for this exam (free only)
        // Note: Relation syntax "questions!inner" filters the user_answers based on joined questions table
        const { data: answeredData, error: ansError } = await supabase
          .from('user_answers')
          .select('question_id, questions!inner(id, exam, is_premium)')
          .eq('user_id', user.id)
          .eq('is_correct', true)
          .eq('questions.exam', exam.id)
          .eq('questions.is_premium', false);

        if (ansError) throw ansError;

        const uniqueAnswered = new Set((answeredData || []).map((a: any) => a.question_id)).size;
        setFreeProgress({ total: total || 0, consumed: uniqueAnswered, loading: false });
      } catch (err) {
        console.error('Error fetching free progress:', err);
        setFreeProgress(prev => ({ ...prev, loading: false }));
      }
    };

    fetchFreeProgress();
  }, [user, exam]);


  const progressWidth = useSharedValue(0);

  useEffect(() => {
    if (freeProgress.total > 0) {
      const percentage = Math.min((freeProgress.consumed / freeProgress.total) * 100, 100);
      progressWidth.value = withTiming(percentage, { duration: 1000, easing: Easing.out(Easing.exp) });
    }
  }, [freeProgress]);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const getMonthName = (date: Date) =>
    date.toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    // Fetch quiz sessions for the displayed month and mark days with sessions as studied
    const fetchStudiedDays = async () => {
      if (!user) return;
      setLoadingCalendar(true);
      const month = calendarMonth.getMonth() + 1;
      const year = calendarMonth.getFullYear();
      const daysInMonth = new Date(year, month, 0).getDate();
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${daysInMonth}`;
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('exam_id', exam.id)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);
      // console.log('Supabase quiz_sessions data:', data, 'error:', error);
      if (!error && data) {
        // Extract unique days from created_at timestamps
        const daysSet = new Set<number>();
        data.forEach((row: any) => {
          const d = new Date(row.created_at);
          // console.log('Session row:', row.created_at, '->', d.getFullYear(), d.getMonth() + 1, d.getDate());
          if (
            d.getFullYear() === year &&
            d.getMonth() + 1 === month
          ) {
            daysSet.add(d.getDate());
          }
        });
        const studiedArr = Array.from(daysSet);
        // console.log('Fetched studied days:', studiedArr);
        setStudiedDays(studiedArr);
      } else {
        setStudiedDays([]);
      }
      setLoadingCalendar(false);
    };
    fetchStudiedDays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, calendarMonth]);

  const handleQuizMode = async (mode: any) => {
    // Use isPro for instant real-time check. 
    // user.subscription_status might be slightly stale if AuthContext hasn't refreshed.
    if (mode.isPremium && !isPro) {
      Alert.alert(
        'Premium Feature',
        'This quiz mode is available with a premium subscription.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/subscription') },
        ]
      );
      return;
    }

    // ... rest of function

    try {
      // Create session at quiz start
      // const { data, error } = await supabase
      //   .from('quiz_sessions')
      //   .insert([
      //     {
      //       user_id: user?.id,
      //       quiz_type: mode.id,
      //       created_at: new Date().toISOString(),
      //     },
      //   ])
      //   .select()
      //   .single();
      // if (error) {
      //   console.error('Failed to create quiz session:', error);
      //   Alert.alert('Error', 'Could not start quiz session.');
      //   return;
      // }
      if (mode.id === 'daily') {
        router.push('/quiz/daily');
      } else if (mode.id === 'level_up') {
        router.push('/quiz/levelup');
      } else if (mode.id === 'flashcard' || mode.id === 'adaptive') {
        router.push('/flashcards');
      }
      else {
        router.push(`/quiz/${mode.id}`);
      }
    } catch (err) {
      console.error('Unexpected error creating quiz session:', err);
      Alert.alert('Error', 'Could not start quiz session.');
    }
  };



  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 90 }}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Header */}
          <View style={{ ...styles.header, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexDirection: 'row' }}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <TouchableOpacity onPress={() => router.push('/exam-selection')}>
              <View style={styles.examSelector}>
                <Text style={{ ...styles.examText, color: '#F59E0B', fontSize: vs(14) }}>{exam ? exam.short_name : ''}</Text>
              </View>
            </TouchableOpacity>
          </View>



          {/* Study Calendar */}
          <View style={styles.calendarContainer}>
            {/* Month navigation */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 12 }}>
              <TouchableOpacity
                onPress={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                style={{ backgroundColor: colors.inputBg, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: colors.border, marginRight: 8 }}
                accessibilityLabel="Previous Month"
              >
                <ChevronLeft size={20} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', textAlign: 'center', letterSpacing: 0.5 }}>
                  {getMonthName(calendarMonth)}
                </Text>
                <TouchableOpacity
                  onPress={() => setCalendarMonth(new Date())}
                  style={{ marginLeft: 12, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}
                  accessibilityLabel="Jump to Today"
                >
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Today</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                style={{ backgroundColor: colors.inputBg, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: colors.border, marginLeft: 8 }}
                accessibilityLabel="Next Month"
              >
                <ChevronRight size={20} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarGrid}>
              {getDaysInMonth(calendarMonth).map((day) => {
                const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const isToday = (() => {
                  const now = new Date();
                  return (
                    dateObj.getFullYear() === now.getFullYear() &&
                    dateObj.getMonth() === now.getMonth() &&
                    dateObj.getDate() === now.getDate()
                  );
                })();
                const isStudied = studiedDays.includes(day);
                // console.log('Rendering day:', day, 'isStudied:', isStudied, 'studiedDays:', studiedDays);
                return (
                  <View
                    key={day}
                    style={[
                      styles.calendarDay,
                      isStudied && styles.studiedDay,
                      isToday && styles.todayDay,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        isStudied && styles.studiedDayText,
                        isToday && { color: colors.background, fontWeight: 'bold' },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.calendarLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Studied</Text>
              </View>
              <View style={[styles.legendItem, { marginLeft: 16 }]}>
                <View style={[styles.legendDot, { backgroundColor: colors.text, borderWidth: 1, borderColor: colors.border }]} />
                <Text style={styles.legendText}>Today</Text>
              </View>
            </View>

          </View>

          {/* Free Questions Progress Bar (Free Users Only) */}
          {!isPro && !freeProgress.loading && freeProgress.total > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Free Questions Limit</Text>
                <Text style={styles.progressCount}>
                  {freeProgress.consumed} <Text style={{ color: '#94A3B8', fontSize: 14 }}>/ {freeProgress.total}</Text>
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    animatedProgressStyle
                  ]}
                />
              </View>
              <Text style={styles.progressFooter}>
                {freeProgress.total - freeProgress.consumed} questions remaining
              </Text>
            </View>
          )}

          {/* Premium Subscription Banner */}
          {!isPro && (
            <TouchableOpacity onPress={() => router.push('/subscription')} style={styles.premiumBanner}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.premiumGradient}
              >
                <Crown size={24} color="#0F172A" strokeWidth={2} />
                <Text style={styles.premiumText}>Subscribe for all 6 quiz modes</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Quiz Modes */}
          <View style={styles.quizModesContainer}>
            <Text style={styles.sectionTitle}>Quiz Modes</Text>

            {(isQuizModesLoading) &&
              (

                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <SpinnerAnimation color={colors.primary} />
                </View>
              )
            }

            {quizModes?.sort((a, b) => a.order_index - b.order_index)?.map((mode: any) => {
              const IconComponent = mode.icon;

              if (mode.is_active) {
                return (
                  <TouchableOpacity
                    key={mode.id}
                    style={[styles.quizModeCard]}
                    onPress={() => handleQuizMode(mode)}
                  >
                    <View style={styles.quizModeContent}>
                      <View style={[styles.quizModeIcon, { backgroundColor: mode.color }]}>
                        <IconComponent size={24} color="#FFFFFF" strokeWidth={2} />
                      </View>
                      <View style={styles.quizModeText}>
                        <Text style={styles.quizModeTitle}>{mode.title}</Text>
                        <Text style={styles.quizModeSubtitle}>
                          {mode.subtitle}
                        </Text>
                      </View>
                      {mode.isPremium && (
                        <View style={styles.premiumBadge}>
                          <Crown size={16} color="#F59E0B" strokeWidth={2} />
                          <Text style={styles.premiumBadgeText}>Premium</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }
            })}
          </View>
        </ScrollView>

        {/* Daily Question Modal */}

      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    // paddingTop removed (dynamic)
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingRight: hs(20),
    paddingLeft: hs(10),
    marginTop: 20, // Reduced from 40
    marginBottom: 30,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 15,
  },
  examTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  examSelector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    padding: hs(14),
    paddingVertical: vs(13),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  examText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 0,
  },
  examSubtext: {
    fontSize: 14,
    color: colors.subText,
  },
  progressContainer: {
    backgroundColor: colors.card,
    marginHorizontal: 0,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  progressCount: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  progressFooter: {
    color: colors.subText,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  calendarContainer: {
    marginBottom: 30,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    // paddingHorizontal: vs(10),
  },
  calendarGrid: {
    marginTop: vs(20),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: vs(8),
    marginLeft: hs(10),
    marginBottom: vs(16),
  },
  calendarDay: {
    width: vs(30),
    height: vs(30),
    borderRadius: 8,
    backgroundColor: colors.border, // or inputBg
    justifyContent: 'center',
    alignItems: 'center',
  },
  studiedDay: {
    backgroundColor: colors.success,
  },
  todayDay: {
    backgroundColor: colors.text, // Inverted high contrast
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subText,
  },
  studiedDayText: {
    color: '#FFFFFF', // success is usually dark enough or light enough? Success #10B981 is mid. White text is fine.
  },
  calendarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: vs(10),
    marginTop: hs(10),
    width: '100%'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.subText,
  },
  premiumBanner: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  premiumText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  quizModesContainer: {
    marginBottom: 20,
  },
  quizModeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  quizModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  quizModeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quizModeText: {
    flex: 1,
  },
  quizModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  quizModeSubtitle: {
    fontSize: 13,
    color: colors.subText,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
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