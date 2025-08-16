import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
import { useQuizModes } from '@/lib/QuizModes';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChartBar as BarChart, Calendar, ChevronLeft, ChevronRight, Clock, Crown, CreditCard as Edit, Target, TrendingUp, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const today = new Date();

const QUIZ_MODES = [
  {
    id: 'daily',
    title: 'Question of the Day',
    icon: Calendar,
    subtitle: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    color: '#3B82F6',
    isPremium: false,
  },
  {
    id: 'quick_10',
    title: 'Practice Quiz',
    icon: Target,
    subtitle: 'Short quiz round',
    color: '#8B5CF6',
    isPremium: false,
  },
  {
    id: 'timed',
    title: 'Timed Quiz',
    icon: Clock,
    subtitle: 'Beat the clock',
    color: '#06B6D4',
    isPremium: false,
  },
  {
    id: 'level_up',
    title: 'Level Up',
    icon: TrendingUp,
    subtitle: 'Progressive difficulty',
    color: '#8B5CF6',
    isPremium: true,
  },
  {
    id: 'missed',
    title: 'Missed Questions Quiz',
    icon: X,
    subtitle: 'Practice weak areas',
    color: '#EF4444',
    isPremium: true,
  },
  {
    id: 'weakest_subject',
    title: 'Weakest Domain Quiz',
    icon: BarChart,
    subtitle: 'Focus on gaps',
    color: '#F97316',
    isPremium: true,
  },
  {
    id: 'custom',
    title: 'Build Your Own Quiz',
    icon: Edit,
    subtitle: 'Customize your practice',
    color: '#10B981',
    isPremium: true,
  },
];

function enrichModesFromLocal(fetchedModes: any[]): any[] {
  return fetchedModes.map(fetched => {
    const local = QUIZ_MODES.find(localMode => localMode.id === fetched.id);
    return {
      ...fetched,
      subtitle: local?.id==='daily' ? today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : fetched.subtitle,
      icon: local?.icon,
      color: local?.color,
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
    
  const { user } = useAuth();
  const { exam } = useExam();
  const {
    data: rawQuizModes,
    isLoading: isQuizModesLoading,
    isError: isQuizModesError,
    error: quizModesError
  } = useQuizModes();
  const quizModes = rawQuizModes ? enrichModesFromLocal(rawQuizModes) : [];
  console.log(quizModes)
  const [showDailyQuestion, setShowDailyQuestion] = useState(false);
  const [studiedDays, setStudiedDays] = useState<number[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [dailyOptions, setDailyOptions] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  

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
    if (mode.isPremium && user?.subscription_status !== 'premium') {
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
        setLoadingDaily(true);
        try {
          const today = new Date().toISOString().slice(0, 10);
          const { data: dq, error: dqError } = await supabase
            .from('daily_questions')
            .select('id, question_id')
            .eq('exam', exam.id)
            .eq('date_assigned', today)
            .single();
          if (dqError || !dq) throw dqError || new Error('No daily question');
          const { data: question, error: qError } = await supabase
            .from('questions')
            .select('*')
            .eq('id', dq.question_id)
            .single();
          if (qError || !question) throw qError || new Error('No question');
          const { data: options, error: oError } = await supabase
            .from('question_options')
            .select('*')
            .eq('question_id', dq.question_id);
          if (oError || !options) throw oError || new Error('No options');
          // console.log(question, options);
          setDailyQuestion(question);
          setDailyOptions(options);
          setShowDailyQuestion(true);
        } catch (err) {
          Alert.alert('Error', 'No daily question available for today');
          setShowDailyQuestion(false);
        } finally {
          setLoadingDaily(false);
        }
      }else if(mode.id === 'level_up') {
        router.push('/quiz/levelup');
      }
      else {
        router.push(`/quiz/${mode.id}`);
      }
    } catch (err) {
      console.error('Unexpected error creating quiz session:', err);
      Alert.alert('Error', 'Could not start quiz session.');
    }
  };

  const handleAnswerSelect = (optionId: string) => {
    setSelectedAnswer(optionId);
  };

  const submitAnswer = async () => {
    if (!selectedAnswer || !dailyQuestion) return;
    const questionId = dailyQuestion.id;
    const selectedOption = dailyOptions.find(opt => opt.id === selectedAnswer);
    const isCorrect = selectedOption?.is_correct ?? false;
    try {
      // 1. Create the quiz session
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .insert([
          {
            user_id: user?.id,
            quiz_type: 'daily',
            score: isCorrect ? 1 : 0,
            total_questions: 1,
            time_taken_seconds: 0, // You can set actual time if available
            exam_id: exam.id,
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();
      if (sessionError || !session) {
        Alert.alert('Error', 'Could not create quiz session.');
        return;
      }
      // 2. Insert the user answer referencing the new session
      const { error: answerError } = await supabase
        .from('user_answers')
        .insert([
          {
            user_id: user?.id,
            question_id: questionId,
            selected_option_id: selectedAnswer,
            is_correct: isCorrect,
            answered_at: new Date().toISOString(),
            quiz_session_id: session.id,
          },
        ]);
      if (answerError) {
        Alert.alert('Error', 'Could not save your answer.');
        return;
      }
      setShowResult(true);
    } catch (err) {
      Alert.alert('Error', 'Unexpected error on submit.');
    }
  };

  const closeModal = () => {
    setShowDailyQuestion(false);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={{...styles.safeArea,paddingBottom:vs(60) + (insets.bottom || 10)}}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{...styles.header,display:'flex',alignItems:'baseline',justifyContent:'space-between',flexDirection:'row'}}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            {/* <Text style={styles.examTitle}>
              {exam ? exam.title : 'No exam selected. Please choose an exam.'}
            </Text> */}
            {/* <Text style={styles.examTitle}>
              {exam ? "CISSP" : 'No exam selected. Please choose an exam.'}
            </Text> */}
            <TouchableOpacity onPress={() => router.push('/exam-selection')}> 
            <View style={styles.examSelector}>
              <Text style={{...styles.examText,color:'#F59E0B',fontSize:vs(14)}}>{exam ? exam.short_name : ''}</Text>
            </View>
            </TouchableOpacity>
          </View>

          {/* Study Calendar */}
          <View style={styles.calendarContainer}>
            {/* Month navigation */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 12 }}>
              <TouchableOpacity
                onPress={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                style={{ backgroundColor: '#1E293B', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#334155', marginRight: 8 }}
                accessibilityLabel="Previous Month"
              >
                <ChevronLeft size={20} color="#F8FAFC" strokeWidth={2.5} />
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 'bold', textAlign: 'center', letterSpacing: 0.5 }}>
                  {getMonthName(calendarMonth)}
                </Text>
                <TouchableOpacity
                  onPress={() => setCalendarMonth(new Date())}
                  style={{ marginLeft: 12, backgroundColor: '#334155', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}
                  accessibilityLabel="Jump to Today"
                >
                  <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600' }}>Today</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                style={{ backgroundColor: '#1E293B', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#334155', marginLeft: 8 }}
                accessibilityLabel="Next Month"
              >
                <ChevronRight size={20} color="#F8FAFC" strokeWidth={2.5} />
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
                        isToday && { color: '#0F172A', fontWeight: 'bold' },
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
                <View style={[styles.legendDot, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#334155' }]} />
                <Text style={styles.legendText}>Today</Text>
              </View>
            </View>

          </View>

          {/* Premium Subscription Banner */}
          <TouchableOpacity onPress={() => router.push('/subscription')} style={styles.premiumBanner}>
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.premiumGradient}
            >
              <Crown size={24} color="#0F172A" strokeWidth={2} />
              <Text style={styles.premiumText}>Subscribe for all 6 quiz modes</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Quiz Modes */}
          <View style={styles.quizModesContainer}>
            <Text style={styles.sectionTitle}>Quiz Modes</Text>
            
              {(isQuizModesLoading) &&
                 (

                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <SpinnerAnimation />
                      </View>
                )
              }
            
            {quizModes?.map((mode:any) => {
              const IconComponent = mode.icon;
              if(mode.is_active){
                return (
                <TouchableOpacity
                  key={mode.id}
                  style={styles.quizModeCard}
                  onPress={() => handleQuizMode(mode)}
                >
                  <View style={styles.quizModeContent}>
                    <View style={[styles.quizModeIcon, { backgroundColor: mode.color }]}>
                      <IconComponent size={24} color="#FFFFFF" strokeWidth={2} />
                    </View>
                    <View style={styles.quizModeText}>
                      <Text style={styles.quizModeTitle}>{mode.title}</Text>
                      <Text style={styles.quizModeSubtitle}>{mode.subtitle}</Text>
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
        <Modal
          visible={showDailyQuestion}
          animationType="slide"
          transparent={true}
          onRequestClose={closeModal}
        >
          <ScrollView>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Calendar size={24} color="#F59E0B" strokeWidth={2} />
                <Text style={styles.modalTitle}>Today's Question of the Day</Text>
                <TouchableOpacity onPress={closeModal}>
                  <X size={24} color="#94A3B8" strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {loadingDaily ? (
                <ActivityIndicator size="large" color="#F59E0B" />
              ) : (
                <>
                  <Text style={styles.questionText}>{dailyQuestion?.question_text}</Text>

                  <View style={styles.optionsContainer}>
                    {dailyOptions.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.optionButton,
                          selectedAnswer === option.id && styles.selectedOption,
                          showResult && option.is_correct && styles.correctOption,
                          showResult && selectedAnswer === option.id && !option.is_correct && styles.incorrectOption,
                        ]}
                        onPress={() => handleAnswerSelect(option.id)}
                        disabled={showResult}
                      >
                        <Text style={styles.optionText}>{option.option_text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {!showResult ? (
                    <TouchableOpacity
                      style={[styles.submitButton, !selectedAnswer && styles.submitButtonDisabled]}
                      onPress={submitAnswer}
                      disabled={!selectedAnswer}
                    >
                      <Text style={styles.submitButtonText}>Submit Answer</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.resultContainer}>
                      <Text style={styles.resultText}>
                        {(() => {
                          if (!selectedAnswer || !dailyOptions.length) return '';
                          const selected = dailyOptions.find(opt => opt.id === selectedAnswer);
                          return selected?.is_correct ? 'Correct!' : 'Incorrect!';
                        })()}
                      </Text>
                      {/* You can add an explanation here if needed */}
                      <Text style={styles.explanationText}>
                        {dailyQuestion?.explanation}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
          </ScrollView>
        </Modal>
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
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  header: {
    flexDirection:'column',
    alignItems:'flex-start',
    justifyContent:'space-between',
    paddingRight:hs(20),
    paddingLeft:hs(10),
    marginTop: 40,
    marginBottom: 30,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 15,
  },
  examTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 8,
  },
  examSelector: {
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    backgroundColor: '#334155',
    padding: hs(14),
    paddingVertical:vs(13),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  examText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 0,
  },
  examSubtext: {
    fontSize: 14,
    color: '#94A3B8',
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
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studiedDay: {
    backgroundColor: '#10B981',
  },
  todayDay: {
    backgroundColor: '#F8FAFC',
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  studiedDayText: {
    color: '#FFFFFF',
  },
  calendarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:'flex-start',
    paddingHorizontal: vs(10),
    marginTop:hs(10),
    width:'100%'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  premiumBanner: {
    marginBottom: 30,
    borderRadius: 12,
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
    fontWeight: '600',
    color: '#0F172A',
  },
  quizModesContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  quizModeCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#475569',
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
    color: '#F8FAFC',
    marginBottom: 4,
  },
  quizModeSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  questionText: {
    fontSize: 16,
    color: '#F8FAFC',
    lineHeight: 24,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionButton: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedOption: {
    borderColor: '#F59E0B',
    backgroundColor: '#1E293B',
  },
  correctOption: {
    borderColor: '#10B981',
    backgroundColor: '#064E3B',
  },
  incorrectOption: {
    borderColor: '#EF4444',
    backgroundColor: '#7F1D1D',
  },
  optionText: {
    fontSize: 16,
    color: '#F8FAFC',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  resultContainer: {
    alignItems: 'center',
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  explanationText: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20,
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