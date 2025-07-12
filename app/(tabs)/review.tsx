import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
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

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck as CheckCircle, ChevronDown, Filter, X } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

// const FILTER_OPTIONS = ['All', 'Incorrect Only', 'By Subject', 'By Difficulty', 'Recent'];
const FILTER_OPTIONS = ['All', 'Incorrect answers', 'Correct answers','Recent'];

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { exam, subject } = useExam();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [reviewedQuestions, setReviewedQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviewedQuestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get latest quiz_sessions for user (limit to last 50 sessions)
      // If exam is selected, get subject_ids for exam
      let subjectIdsForExam: string[] | null = null;
      if (exam) {
        const { data: subjectExams, error: subjectExamError } = await supabase
          .from('subject_exams')
          .select('subject_id')
          .eq('exam_id', exam.id);
        if (subjectExamError) throw subjectExamError;
        subjectIdsForExam = (subjectExams || []).map((se: any) => se.subject_id);
        if (!subjectIdsForExam.length) {
          setReviewedQuestions([]);
          setLoading(false);
          return;
        }
      }
      const { data: sessions, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('id, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(50);
      if (sessionError) throw sessionError;
      const sessionIds = sessions.map((s: any) => s.id);
      if (sessionIds.length === 0) {
        setReviewedQuestions([]);
        setLoading(false);
        return;
      }
      // Get user_answers for these sessions, join with questions and options
      let answersQuery = supabase
        .from('user_answers')
        .select(`
          id,
          question_id,
          selected_option_id,
          is_correct,
          answered_at,
          quiz_session_id,
          questions:question_id (question_text, explanation, difficulty, domain, subject_id),
          selected_option:selected_option_id (option_text),
          quiz_sessions:quiz_session_id (completed_at)
        `)
        .in('quiz_session_id', sessionIds)
        .order('answered_at', { ascending: false });
      // Filter by exam's subjects if exam is selected
      if (exam && subjectIdsForExam) answersQuery = answersQuery.in('questions.subject_id', subjectIdsForExam);
      if (subject) answersQuery = answersQuery.eq('questions.subject_id', subject.id);
      const { data: answers, error: answerError } = await answersQuery;
      if (answerError) throw answerError;
      // For each answer, get the correct option
      const questionIds = [...new Set(answers.map((a: any) => a.question_id))];
      let correctOptionsMap: Record<string, string> = {};
      if (questionIds.length > 0) {
        const { data: correctOptions, error: correctOptErr } = await supabase
          .from('question_options')
          .select('question_id, option_text')
          .eq('is_correct', true)
          .in('question_id', questionIds);
        if (!correctOptErr && correctOptions) {
          correctOptionsMap = correctOptions.reduce((acc: any, cur: any) => {
            acc[cur.question_id] = cur.option_text;
            return acc;
          }, {});
        }
      }
      // Deduplicate: keep only the most recent answer per question_id
      const latestByQuestion = new Map();
      for (const a of answers) {
        if (!latestByQuestion.has(a.question_id)) {
          latestByQuestion.set(a.question_id, a);
        }
      }
      // Map to UI format and filter out questions with empty text
      const reviewed = Array.from(latestByQuestion.values())
        .filter((a: any) => a.questions && a.questions.question_text && a.questions.question_text.trim() !== '')
        .map((a: any) => ({
          id: a.id,
          question: a.questions.question_text,
          userAnswer: a.selected_option?.option_text || '',
          correctAnswer: correctOptionsMap[a.question_id] || '',
          isCorrect: a.is_correct,
          subject: a.questions.domain || '',
          difficulty: a.questions.difficulty || '',
          date: a.quiz_sessions?.completed_at?.slice(0, 10) || '',
          explanation: a.questions.explanation || '',
        }));
      setReviewedQuestions(reviewed);

      // Optionally, you can calculate stats here and pass to the UI
      // const total = reviewed.length;
      // const correct = reviewed.filter(q => q.isCorrect).length;
      // const incorrect = total - correct;
      // const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      // setReviewStats({ total, correct, incorrect, accuracy });
    } catch (err) {
      setReviewedQuestions([]);
      alert('Failed to load review data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, subject]);

  useEffect(() => {
    fetchReviewedQuestions();
  }, [fetchReviewedQuestions]);

  const getFilteredQuestions = () => {
    switch (selectedFilter) {
      case 'Incorrect answers':
        return reviewedQuestions.filter(q => !q.isCorrect);
      case 'Correct answers':
        return reviewedQuestions.filter(q => q.isCorrect);
      case 'Recent':
        if (reviewedQuestions.length === 0) return [];
        const mostRecentDate = reviewedQuestions[0].date;
        return reviewedQuestions.filter(q => q.date === mostRecentDate);
      default:
        return reviewedQuestions;
    }
  };

  const getStatsData = () => {
    const total = reviewedQuestions.length;
    const correct = reviewedQuestions.filter(q => q.isCorrect).length;
    const incorrect = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, incorrect, accuracy };
  };

  const stats = getStatsData();
  const filteredQuestions = getFilteredQuestions();

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <SpinnerAnimation />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={{...styles.safeArea,paddingBottom:vs(60) + (insets.bottom || 10)}}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Review Questions</Text>
            <Text style={styles.subtitle}>Learn from your mistakes</Text>
            {!loading && (
              <TouchableOpacity
                style={{ position: 'absolute', right: 0, top: 0, backgroundColor: '#F59E0B', padding: 8, borderRadius: 8 }}
                onPress={fetchReviewedQuestions}
              >
                <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>Refresh</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats Overview */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Reviewed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.correct}</Text>
              <Text style={styles.statLabel}>Correct</Text>
            </View>
            </View>
            <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.incorrect}</Text>
              <Text style={styles.statLabel}>Incorrect</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.accuracy}%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
          </View>

          {/* Filter Section */}
          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilterMenu(!showFilterMenu)}
            >
              <Filter size={20} color="#F8FAFC" strokeWidth={2} />
              <Text style={styles.filterButtonText}>{selectedFilter}</Text>
              <ChevronDown size={20} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>

            {showFilterMenu && (
              <View style={styles.filterMenu}>
                {FILTER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.filterOption,
                      selectedFilter === option && styles.filterOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedFilter(option);
                      setShowFilterMenu(false);
                    }}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      selectedFilter === option && styles.filterOptionTextSelected
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Questions List */}
          <View style={styles.questionsContainer}>
            {filteredQuestions.map((question) => (
              <View key={question.id} style={styles.questionCard}>
                <TouchableOpacity
                  style={styles.questionHeader}
                  onPress={() => setExpandedQuestion(
                    expandedQuestion === question.id ? null : question.id
                  )}
                >
                  <View style={styles.questionInfo}>
                    <View style={styles.questionMeta}>
                      <View style={[
                        styles.statusIndicator,
                        { backgroundColor: question.isCorrect ? '#10B981' : '#EF4444' }
                      ]}>
                        {question.isCorrect ? (
                          <CheckCircle size={16} color="#FFFFFF" strokeWidth={2} />
                        ) : (
                          <X size={16} color="#FFFFFF" strokeWidth={2} />
                        )}
                      </View>
                      <Text style={styles.subjectText}>{question.subject}</Text>
                      {/* <Text style={styles.difficultyText}>{question.difficulty}</Text> */}
                    </View>
                    <Text style={styles.questionText} numberOfLines={2}>
                      {question.question}
                    </Text>
                  </View>
                  <ChevronDown 
                    size={20} 
                    color="#94A3B8" 
                    strokeWidth={2}
                    style={[
                      styles.expandIcon,
                      expandedQuestion === question.id && styles.expandIconRotated
                    ]}
                  />
                </TouchableOpacity>

                {expandedQuestion === question.id && (
                  <View style={styles.questionDetails}>
                    <View style={styles.answerSection}>
                      <Text style={styles.answerLabel}>Your Answer:</Text>
                      <Text style={[
                        styles.answerText,
                        { color: question.isCorrect ? '#10B981' : '#EF4444' }
                      ]}>
                        {question.userAnswer}
                      </Text>
                    </View>

                    {!question.isCorrect && (
                      <View style={styles.answerSection}>
                        <Text style={styles.answerLabel}>Correct Answer:</Text>
                        <Text style={[styles.answerText, { color: '#10B981' }]}>
                          {question.correctAnswer}
                        </Text>
                      </View>
                    )}

                    <View style={styles.explanationSection}>
                      <Text style={styles.explanationLabel}>Explanation:</Text>
                      <Text style={styles.explanationText}>{question.explanation}</Text>
                    </View>
{/* 
                    <View style={styles.actionButtons}>
                      <TouchableOpacity style={styles.actionButton}>
                        <RotateCcw size={16} color="#F59E0B" strokeWidth={2} />
                        <Text style={styles.actionButtonText}>Practice Again</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity style={styles.actionButton}>
                        <TrendingDown size={16} color="#8B5CF6" strokeWidth={2} />
                        <Text style={styles.actionButtonText}>Similar Questions</Text>
                      </TouchableOpacity>
                    </View> */}
                  </View>
                )}
              </View>
            ))}
          </View>

          {filteredQuestions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No questions found for this filter</Text>
              <Text style={styles.emptyStateSubtext}>Try adjusting your filter settings</Text>
            </View>
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 10,
  },
  filterButton: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  filterButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  filterMenu: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    overflow: 'hidden',
  },
  filterOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
  },
  filterOptionSelected: {
    backgroundColor: '#1E293B',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#F8FAFC',
  },
  filterOptionTextSelected: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  questionsContainer: {
    gap: 16,
    marginBottom: 30,
  },
  questionCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    overflow: 'hidden',
  },
  questionHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionInfo: {
    flex: 1,
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  statusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  questionText: {
    fontSize: 16,
    color: '#F8FAFC',
    lineHeight: 22,
  },
  expandIcon: {
    marginLeft: 12,
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  questionDetails: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#475569',
  },
  answerSection: {
    marginBottom: 16,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  explanationSection: {
    marginBottom: 20,
  },
  explanationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#64748B',
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