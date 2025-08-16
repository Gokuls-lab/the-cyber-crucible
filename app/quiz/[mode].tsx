import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { updateProgress } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle, Clock, RotateCcw, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';

import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import SectionedMultiSelect from 'react-native-sectioned-multi-select';

import { useQuizModes } from '@/lib/QuizModes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375; // iPhone 11 Pro width
const guidelineBaseHeight = 812; // iPhone 11 Pro height

export const hs = (size: number) => (width / guidelineBaseWidth) * size;
export const vs = (size: number) => (height / guidelineBaseHeight) * size;
export const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

interface Subject {
  id: string;
  name: string;
  domain: string; // Added domain field for filtering
}

interface Question {
  id: string;
  question_text: string;
  explanation: string;
  difficulty: string;
  domain: string;
  options: {
    id: string;
    option_text: string;
    option_letter: string;
    is_correct: boolean;
  }[];
}

export default function QuizScreen() {

  // Domain Dropdown
  const [domainOpen, setDomainOpen] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [domainItems, setDomainItems] = useState<{label: string, value: string}[]>([]);
  // Subject Dropdown
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectItems, setSubjectItems] = useState<{label: string, value: string}[]>([]);


  const { mode } = useLocalSearchParams<{ mode: string }>();
  const { user } = useAuth();
  const { exam } = useExam();
  const {
    data: rawQuizModes,
    isLoading: isQuizModesLoading,
    isError: isQuizModesError,
    error: quizModesError
  } = useQuizModes();
  // Build your own quiz modal state
  const [showBuildQuizModal, setShowBuildQuizModal] = useState(false);
  const [buildQuizStarted, setBuildQuizStarted] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [subjectSearchText, setSubjectSearchText] = useState<string>('');
  const [buildQuizNumQuestions, setBuildQuizNumQuestions] = useState<number>(10);
  const [buildQuizTime, setBuildQuizTime] = useState<number>(600); // default 10 min
  const [isTimedQuiz, setIsTimedQuiz] = useState<boolean>(true); // new: toggle for time limit
  const [buildQuizDifficulty, setBuildQuizDifficulty] = useState<string[]>([]);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [domainSearchText, setDomainSearchText] = useState<string>('');

  // ...existing states
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startTime] = useState(Date.now());

    // Update dropdown items when availableDomains/Subjects change
    useEffect(() => {
      setDomainItems(availableDomains.map(d => ({ label: d, value: d })));
    }, [availableDomains]);
    useEffect(() => {
      setSubjectItems(availableSubjects.map(s => ({ label: s.name, value: s.id, domain: s.domain })));
    }, [availableSubjects]);
    // ...existing hooks
  const insets = useSafeAreaInsets();

  // Fetch available subjects for build your own quiz
  // Re-fetch domains and subjects when modal opens or selectedDomains changes
  useEffect(() => {
    if (mode === 'custom') {
      setShowBuildQuizModal(true);
      setBuildQuizStarted(false);
      setLoading(false);
      // Fetch domains for the exam, then fetch subjects for selected domains
      const fetchDomainsAndSubjects = async () => {
        if (!exam) return;
        // 1. Get subject IDs for this exam
        const { data: subjectExams, error: subjectExamError } = await supabase
          .from('subject_exams')
          .select('subject_id')
          .eq('exam_id', exam.id);
        if (subjectExamError) return;
        if (!subjectExams || subjectExams.length === 0) {
          setAvailableDomains([]);
          setAvailableSubjects([]);
          return;
        }
        const subjectIds = subjectExams.map(se => se.subject_id);
        // 2. Fetch all unique domains across all subjects for this exam
        const { data: domainsData, error: domainsError } = await supabase
          .from('questions')
          .select('domain')
          .in('subject_id', subjectIds);
        if (domainsError || !domainsData) {
          setAvailableDomains([]);
          setAvailableSubjects([]);
          return;
        }
        const uniqueDomains = Array.from(new Set(domainsData.map((q: { domain: string }) => q.domain)));
        setAvailableDomains(uniqueDomains);

        // 3. If domains are selected, fetch subjects that have at least one question in those domains
        if (selectedDomains.length > 0) {
          const { data: domainQuestions, error: dqErr } = await supabase
            .from('questions')
            .select('subject_id')
            .in('domain', selectedDomains)
            .in('subject_id', subjectIds);
          if (dqErr || !domainQuestions) {
            setAvailableSubjects([]);
            return;
          }
          const domainSubjectIds = Array.from(new Set(domainQuestions.map((q: { subject_id: string }) => q.subject_id)));
          if (domainSubjectIds.length === 0) {
            setAvailableSubjects([]);
            return;
          }
          // 4. Get subject details for those IDs
          const { data: subjects, error: subjectsError } = await supabase
            .from('subjects')
            .select('id, name, domain')
            .in('id', domainSubjectIds);
          if (subjectsError) {
            setAvailableSubjects([]);
            return;
          }
          setAvailableSubjects(subjects || []);
        } else {
          setAvailableSubjects([]);
        }
      };
      fetchDomainsAndSubjects();
    }
  }, [mode, exam, selectedDomains]);

  // Handler for starting custom quiz
  const handleStartBuildQuiz = async () => {
    setShowBuildQuizModal(false);
    setLoading(true);
    setBuildQuizStarted(true);
  
    try {
      let query = supabase
        .from('questions')
        .select(`
          id,
          question_text,
          explanation,
          difficulty,
          domain,
          subject_id,
          question_options(*)
        `); // Restored question_options join
  
        console.log('selectedSubjects', selectedSubjects);
        console.log('buildQuizDifficulty', buildQuizDifficulty);
        console.log('selectedDomains', selectedDomains);
        

        if (buildQuizDifficulty && buildQuizDifficulty.length > 0) {
          query = query.in('difficulty', buildQuizDifficulty);
        }
        if (selectedDomains && selectedDomains.length > 0) {
          query = query.in('domain', selectedDomains);
        }
  
      // Fetch a reasonable upper bound of questions (e.g., 1000)
      query = query.limit(50);

      const { data, error } = await query;
      console.log('Supabase error:', error);
      console.log('Supabase data:', data);
      if (error) throw error;
      if (!data || data.length === 0) {
        Alert.alert('No questions found for your filters.');
        setQuestions([]);
        setTimeLeft(isTimedQuiz ? buildQuizTime : null); // use null for no timer
        setLoading(false);
        return;
      }
      // Shuffle and pick N questions in JS
      function shuffle(array: any[]) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      }
      const mappedQuestions = (data as any[]).map(q => ({
        ...q,
        options: q.question_options || [],
      }));
      const shuffled = shuffle(mappedQuestions);
      const selected = shuffled.slice(0, buildQuizNumQuestions);
      setQuestions(selected as Question[]);
      setTimeLeft(isTimedQuiz ? buildQuizTime : null); // use null for no timer
    } catch (err) {
      Alert.alert('Error', 'Could not fetch questions for your quiz.');
    }
    setLoading(false);
  };

  const fetchQuestions = useCallback(async () => {
    if (mode === 'custom') return; // handled in build quiz modal
    if (!exam) return;
    setLoading(true);
    try {
      let questionCount = 10; // Default for quick_10
    if (mode === 'quick_10') {
      questionCount = rawQuizModes[1]?.num_questions;
    }


      if (mode === 'timed') {
        questionCount = rawQuizModes[2]?.num_questions;
        setTimeLeft(rawQuizModes[2]?.time_per_question * questionCount)
      }
      if (mode === 'missed') {
        questionCount = rawQuizModes[4]?.num_questions;
      }
      if (mode === 'weakest_subject') {
        questionCount = rawQuizModes[5]?.num_questions;
      }
      
      questionCount = questionCount || 10;

      if (mode === 'weakest_subject') {
        if (!user || !user.id) throw new Error('User not found');
        const sessions = await supabase
          .from('quiz_sessions')
          .select('id')
          .eq('user_id', user.id);
        console.log('sessions: ', sessions);
        if (!sessions.data || sessions.data.length === 0) {
          Alert.alert('No Weakest Subject', 'Could not determine your weakest subject. Have you answered any questions yet?');
          router.back();
          return;
        }
        const { data: weakestSubject, error: weakestSubjectError } = await supabase
          .rpc('get_weakest_domain', { user_id_param: user.id, exam_id_param: exam.id });

        if (weakestSubjectError) throw weakestSubjectError;
        if (!weakestSubject || weakestSubject.length === 0) {
          Alert.alert('No Weakest Domain', 'Could not determine your weakest domain. Have you answered any questions yet?');
          router.back();
          return;
        }

        const domain = weakestSubject[0].domain;

        const { data, error } = await supabase
          .from('questions')
          .select(`
            id,
            question_text,
            explanation,
            difficulty,
            domain,
            question_options (
              id,
              option_text,
              option_letter,
              is_correct
            )
          `)
          .eq('domain', domain)
          .limit(questionCount);

        if (error) throw error;
        setQuestions(
          (data as any[]).map(q => ({
            ...q,
            options: q.question_options || [],
          })) as Question[]
        );
        setLoading(false);
        return;
      }

      if (mode === 'missed') {
        // Get user's missed (incorrect) questions for this exam
        const { data: subjectExams, error: subjectExamError } = await supabase
          .from('subject_exams')
          .select('subject_id')
          .eq('exam_id', exam.id);
        if (subjectExamError) throw subjectExamError;
        if (!subjectExams || subjectExams.length === 0) throw new Error('No subjects found for this exam');
        const subjectIds = subjectExams.map(se => se.subject_id);

        // Get the user's most recent answer for each question, and only include if the latest is incorrect
        if (!user || !user.id) throw new Error('User not found');
        // 1. Get all answers for this user, ordered by question and answered_at desc
        const { data: allAnswers, error: allAnswersError } = await supabase
          .from('user_answers')
          .select('question_id, is_correct, answered_at')
          .eq('user_id', user.id)
          .order('answered_at', { ascending: false });
        if (allAnswersError) throw allAnswersError;
        if (!allAnswers || allAnswers.length === 0) {
          Alert.alert('No Missed Questions', 'You have not answered any questions yet.');
          router.back();
          setQuestions([]);
          setLoading(false);
          return;
        }
        // 2. For each question_id, keep only the latest answer
        const latestByQuestion = new Map();
        for (const ans of allAnswers) {
          if (!latestByQuestion.has(ans.question_id)) {
            latestByQuestion.set(ans.question_id, ans);
          }
        }
        // 3. Only include questions where the latest answer is incorrect
        const missedQuestionIds = Array.from(latestByQuestion.values())
          .filter(ans => ans.is_correct === false)
          .map(ans => ans.question_id);
        if (missedQuestionIds.length === 0) {
          Alert.alert('No Missed Questions', 'You have no currently missed questions!');
          router.back();
          setQuestions([]);
          setLoading(false);
          return;
        }
        // Fetch the missed questions (and their options), but only for this exam's subjects
        const { data, error } = await supabase
          .from('questions')
          .select(`
            id,
            question_text,
            explanation,
            difficulty,
            domain,
            subject_id,
            question_options (
              id,
              option_text,
              option_letter,
              is_correct
            )
          `)
          .in('id', missedQuestionIds)
          .in('subject_id', subjectIds)
          .limit(questionCount);
        if (error) throw error;
        if (!data || data.length === 0) {
          Alert.alert('No Missed Questions', 'You have not answered any questions incorrectly yet.');
          router.back();
          setQuestions([]);
          setLoading(false);
          return;
        }
        const formattedQuestions = data.map((q: any) => ({
          id: q.id,
          question_text: q.question_text,
          explanation: q.explanation,
          difficulty: q.difficulty,
          domain: q.domain,
          options: q.question_options.sort((a: any, b: any) =>
            a.option_letter.localeCompare(b.option_letter)
          ),
        }));
        setQuestions(formattedQuestions);
        setLoading(false);
        return;
      }

      // Default: fetch questions for selected exam's subjects
      // Defensive check for exam and exam.id
      if (!exam || !exam.id) {
        throw new Error('Exam is not defined or missing id');
      }
      // Get ALL subject_ids for the selected exam
      const { data: subjectExams, error: subjectExamError } = await supabase
        .from('subject_exams')
        .select('subject_id')
        .eq('exam_id', exam.id);
      if (subjectExamError) throw subjectExamError;
      if (!subjectExams || subjectExams.length === 0) throw new Error('No subjects found for this exam');
      const subjectIds = subjectExams.map(se => se.subject_id);

      // Now, fetch questions for all those subjects
      // const { data, error } = await supabase
      //   .from('questions')
      //   .select(`
      //     id,
      //     question_text,
      //     explanation,
      //     difficulty,
      //     domain,
      //     question_options (
      //       id,
      //       option_text,
      //       option_letter,
      //       is_correct
      //     )
      //   `)
      //   .in('subject_id', subjectIds)
      //   .limit(questionCount);
      // if (error) throw error;

      //[START] => Manual random
      // const { data, error } = await supabase
      //   .from('questions')
      //   .select(`
      //     id,
      //     question_text,
      //     explanation,
      //     difficulty,
      //     domain,
      //     question_options (
      //       id,
      //       option_text,
      //       option_letter,
      //       is_correct
      //     )
      //   `)
      //   // .in('subject_id', subjectIds)
      //   .eq('exam',exam.id)
      //   .limit(questionCount);


      // if (error) throw error;

      // // Shuffle the data manually
      // const shuffled = data.sort(() => Math.random() - 0.5).slice(0, questionCount);

      // const formattedQuestions = shuffled.map((q: any) => ({
      //   id: q.id,
      //   question_text: q.question_text,
      //   explanation: q.explanation,
      //   difficulty: q.difficulty,
      //   domain: q.domain,
      //   options: q.question_options.sort((a: any, b: any) => 
      //     a.option_letter.localeCompare(b.option_letter)
      //   ),
      // }));
      //[END] => Manual random
      const { data, error } = await supabase
      .rpc('fetch_unique_random_questions', { 
        p_exam_id: exam.id, 
        p_limit_count: questionCount,
        p_user_id: user?.id,
        p_quiz_mode: mode
      })
      .select(`
            id,
            question_text,
            explanation,
            difficulty,
            domain,
            question_options (
              id,
              option_text,
              option_letter,
              is_correct
            )
          `);

        if (error) throw error;

        const formattedQuestions = data.map(q => ({
          id: q.id,
          question_text: q.question_text,
          explanation: q.explanation,
          difficulty: q.difficulty,
          domain: q.domain,
          options: q.question_options.sort((a, b) =>
            a.option_letter.localeCompare(b.option_letter)
          )
        }));

        setQuestions(formattedQuestions);
    } catch (err) {
      console.error('Error fetching questions:', err);
      Alert.alert('Error', 'Failed to load quiz questions');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [mode, user, exam]);

  // Fetch questions on component mount
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Timer effect for timed quizzes
  useEffect(() => {
    if (timeLeft === null || quizCompleted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          handleQuizComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, quizCompleted]);

  const handleAnswerSelect = (optionId: string) => {
    setSelectedAnswer(optionId);
  };

  const handleNextQuestion = () => {
    if (!selectedAnswer) return;

    // Save the answer
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: selectedAnswer
    }));

    setShowResult(true);
  };

  const handleContinue = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      handleQuizComplete();
    }
  };

  const handleQuizComplete = async () => {
    if (quizCompleted || !user) {
      if (!user) {
        Alert.alert("Not Logged In", "You must be logged in to save quiz results.");
        router.back();
      }
      return;
    }
    setQuizCompleted(true);

    try {
      // Calculate score
      let correctAnswers = 0;
      const sessionAnswers = [];
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const userAnswerId = userAnswers[i];
        const correctOption = question.options.find(opt => opt.is_correct);
        const isCorrect = userAnswerId === correctOption?.id;
        if (isCorrect) correctAnswers++;
        sessionAnswers.push({
          question_id: question.id,
          selected_option_id: userAnswerId,
          is_correct: isCorrect,
        });
      }
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      // Create quiz session
      const quizTypeMap: Record<string, string> = {
        weakest_subject: 'weakest',
        quick_10: 'quick_10',
        timed: 'timed',
        level_up: 'level_up',
        missed: 'missed',
        custom: 'custom',
        daily: 'daily',
        weakest: 'weakest',
      };
      const quizType = quizTypeMap[mode] || mode;

      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .insert({
          user_id: user.id,
          quiz_type: quizType,
          score: correctAnswers,
          total_questions: questions.length,
          time_taken_seconds: timeTaken,
          completed_at: new Date().toISOString(),
          exam_id: exam?.id,
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error("Failed to create session and get ID.");

      const newSessionId = sessionData.id;

      // Save individual answers
      const answersToInsert = sessionAnswers.map(answer => ({
        ...answer,
        user_id: user.id,
        quiz_session_id: newSessionId,
      }));
      const { error: answersError } = await supabase
        .from('user_answers')
        .insert(answersToInsert);
      if (answersError) throw answersError;

      // Update user progress
      await updateProgress(user.id, {
        questionsAnswered: questions.length,
        correctAnswers,
        timeTaken,
      });

      // Navigate to results
      router.replace(`/results?session=${newSessionId}`);
    } catch (err) {
      console.error('Error completing quiz:', err);
      Alert.alert('Error', 'Failed to save quiz results');
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuizTitle = () => {
    switch (mode) {
      case 'quick_10': return rawQuizModes[1]?.title;
      case 'timed': return rawQuizModes[2]?.title;
      case 'level_up': return rawQuizModes[3]?.title;
      case 'missed': return rawQuizModes[4]?.title;
      case 'weakest_subject': return rawQuizModes[5]?.title;
      case 'custom': return rawQuizModes[6]?.title;
      default: return 'Quiz';
    }
  };

  // --- Custom Quiz Modal ---
  if (mode === 'custom' && showBuildQuizModal && !buildQuizStarted) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={[styles.container, {justifyContent:'center',alignItems:'center'}]}>
        <SafeAreaView style={[styles.safeArea, {justifyContent:'center',alignItems:'center',paddingTop:vs(10), width: '100%',paddingBottom: insets.bottom + vs(2),}]}>
          <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          style={styles.centeredModalWrapper}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
        >
            <Text style={styles.modalTitleStrong}>Build Your Own Quiz</Text>
            <View style={styles.modalContainerCompact}>

            {/* Domain Selection - Multi-Select Dropdown */}
            <Text style={styles.modalLabel}>Select Domains</Text>
            <SectionedMultiSelect
              items={availableDomains.map(domain => ({ id: domain, name: domain }))}
              IconRenderer={(props: any) => <Icon {...props} /> as any}
              uniqueKey="id"
              onSelectedItemsChange={setSelectedDomains}
              selectedItems={selectedDomains}
              selectText="Choose domains..."
              searchPlaceholderText="Search domains..."
              confirmText="Confirm"
              colors={{ primary: '#F59E0B', success: '#10B981', text: '#F8FAFC', chipColor: '#F59E0B', selectToggleTextColor: '#F8FAFC', searchPlaceholderTextColor: '#94A3B8' }}
              styles={{
                selectToggle: { backgroundColor: '#334155', borderColor: '#F59E0B', marginBottom: vs(10), borderRadius: 8, padding: 12 },
                chipsWrapper: { backgroundColor: '#1E293B', padding: 15, borderRadius: 8, },
                itemText: { color: 'black' },
                selectedItemText: { color: '#F59E0B', fontWeight: 'bold' },
              }}
              disabled={availableDomains.length === 0}
            />



            {/* Difficulty Selection */}
            <Text style={styles.modalLabel}>Select Difficulty (optional)</Text>
            <View style={styles.optionRow}>
              {['easy', 'medium', 'hard'].map((diff) => (
                <TouchableOpacity
                  key={diff}
                  style={[
                    styles.optionButton,
                    (Array.isArray(buildQuizDifficulty) ? buildQuizDifficulty.includes(diff) : buildQuizDifficulty === diff) && styles.optionButtonSelected,
                  ]}
                  onPress={() => {
                    setBuildQuizDifficulty((prev) => {
                      if (!Array.isArray(prev)) return [diff];
                      return prev.includes(diff)
                        ? prev.filter((d) => d !== diff)
                        : [...prev, diff];
                    });
                  }}
                >
                  <Text style={styles.optionButtonText}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Number of Questions - free input */}
            <Text style={styles.modalLabel}>Number of Questions (MAX 50)</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Questions:</Text>
              <TextInput
                style={styles.inputBox}
                keyboardType="numeric"
                value={buildQuizNumQuestions.toString()}
                onChangeText={(val) => {
                  const v = parseInt(val.replace(/[^0-9]/g, ''), 10);
                  if (!isNaN(v)) {
                    if (v <= 50) {
                      setBuildQuizNumQuestions(v);
                    } else {
                      setBuildQuizNumQuestions(50);
                    }
                  } else {
                    setBuildQuizNumQuestions(0);
                  }
                }}
                placeholder="e.g. 10"
                maxLength={3}
              />
            </View>


            {/* Time Limit Toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: 12 }}>
              <Text style={styles.modalLabel}>Enable Time Limit (minutes)</Text>
              <Switch
                style={{ marginLeft: 12 }}
                value={isTimedQuiz}
                onValueChange={setIsTimedQuiz}
                trackColor={{ false: '#64748B', true: '#10B981' }}
                thumbColor={isTimedQuiz ? '#F8FAFC' : '#CBD5E1'}
                accessibilityLabel="Enable Time Limit"
              />
            </View>
            {/* Time Limit - free input (only show if timed) */}
            {isTimedQuiz && (
              <>
                {/* <Text style={styles.modalLabel}>Time Limit (minutes)</Text> */}
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Minutes:</Text>
                  <TextInput
                    style={styles.inputBox}
                    keyboardType="numeric"
                    value={Math.floor(buildQuizTime / 60).toString()}
                    onChangeText={(val) => {
                      const v = parseInt(val.replace(/[^0-9]/g, ''), 10);
                      setBuildQuizTime(isNaN(v) ? 0 * 60 : v * 60);
                    }}
                    placeholder="e.g. 10"
                    maxLength={5}
                  />
                </View>
              </>
            )}


            {/* Start Quiz Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                (selectedDomains.length === 0) && styles.actionButtonDisabled,
              ]}
              onPress={handleStartBuildQuiz}
              disabled={selectedDomains.length === 0}
            >
              <Text style={styles.actionButtonText}>Start Quiz</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading quiz...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (questions.length === 0) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color="#F8FAFC" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.title}>Quiz</Text>
          </View>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No questions available</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchQuestions}>
              <RotateCcw size={20} color="#F8FAFC" strokeWidth={2} />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#F8FAFC" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>{getQuizTitle()}</Text>
          {timeLeft !== null && (
            <View style={styles.timerContainer}>
              <Clock size={16} color="#F59E0B" strokeWidth={2} />
              <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
            </View>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {currentQuestionIndex + 1} of {questions.length}
          </Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Question */}
          <View style={styles.questionContainer}>
            <View style={styles.questionHeader}>
              {/* <View style={styles.questionMeta}>
                <Text style={styles.difficultyText}>{currentQuestion.difficulty}</Text>
                <Text style={styles.domainText}>{currentQuestion.domain}</Text>
              </View> */}
            </View>
            <Text style={styles.questionText}>{currentQuestion.question_text}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option) => (
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
                <View style={styles.optionContent}>
                  <Text style={styles.optionLetter}>{option.option_letter}.</Text>
                  <Text style={styles.optionText}>{option.option_text}</Text>
                </View>
                {showResult && option.is_correct && (
                  <CheckCircle size={20} color="#10B981" strokeWidth={2} />
                )}
                {showResult && selectedAnswer === option.id && !option.is_correct && (
                  <X size={20} color="#EF4444" strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Explanation */}
          {showResult && (
            <View style={styles.explanationContainer}>
              <Text style={styles.explanationTitle}>Explanation</Text>
              <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
            </View>
          )}
        </ScrollView>

        {/* Action Button */}
        <View style={[styles.actionContainer, { paddingBottom: insets.bottom || vs(30) }]}>
          {!showResult ? (
            <TouchableOpacity
              style={[styles.actionButton, !selectedAnswer && styles.actionButtonDisabled]}
              onPress={handleNextQuestion}
              disabled={!selectedAnswer}
            >
              <Text style={styles.actionButtonText}>Submit Answer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionButton} onPress={handleContinue}>
              <Text style={styles.actionButtonText}>
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  centeredModalWrapper: {
    width: '96%',
    maxWidth: 420,
    alignSelf: 'center',
    // backgroundColor: 'rgba(30,41,59,0.98)',
    padding: hs(16),
    marginTop: vs(36),
    marginBottom: vs(10),
  },
  modalContainerCompact: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: ms(14),
    gap: hs(10),
    paddingVertical: vs(8),
    paddingHorizontal: hs(2),
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingBottom: vs(16),

  },
  modalTitleStrong: {
    fontSize: ms(20),
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: vs(16),
    textAlign: 'center',
  },
  // --- Custom Modal Styles ---
  modalContentContainer: {
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  subjectSearchBox: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: ms(8),
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    fontSize: ms(15),
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: '#334155',
  },
  subjectListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(8),
    paddingHorizontal: hs(12),
    borderRadius: ms(8),
    marginBottom: vs(4),
    backgroundColor: '#334155',
  },
  subjectListItemSelected: {
    backgroundColor: '#0EA5E9',
  },
  subjectListItemText: {
    color: '#F8FAFC',
    fontSize: ms(15),
    flex: 1,
  },
  subjectListItemCheck: {
    color: '#22D3EE',
    fontWeight: 'bold',
    fontSize: ms(16),
    marginLeft: hs(8),
  },
  selectedCountText: {
    color: '#38BDF8',
    fontSize: ms(13),
    marginTop: vs(4),
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(10),
  },
  inputLabel: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: ms(14),
    marginRight: hs(8),
  },
  inputBox: {
    backgroundColor: '#334155',
    color: '#F8FAFC',
    borderRadius: ms(8),
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    fontSize: ms(15),
    minWidth: hs(60),
    borderWidth: 1,
    borderColor: '#475569',
  },
  modalContainer: {
    flex:1,
    padding: hs(20),
    // backgroundColor: '#1E293B',
    borderRadius: ms(16),
    gap:hs(15),
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.2,
    // shadowRadius: 4,
    // elevation: 5,
    // paddingBottom: vs(36),
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: ms(22),
    fontWeight: '700',
    marginBottom: vs(16),
    textAlign: 'center',
  },
  modalLabel: {
    color: '#F59E0B',
    fontSize: ms(15),
    fontWeight: '600',
    marginTop: vs(12),
    marginBottom: vs(6),
  },
  subjectList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(8),
    marginBottom: vs(10),
  },
  subjectButton: {
    backgroundColor: '#334155',
    borderRadius: ms(8),
    paddingVertical: vs(6),
    paddingHorizontal: hs(14),
    marginRight: hs(8),
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: '#334155',
  },
  subjectButtonSelected: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  subjectButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    gap: hs(12),
    marginBottom: vs(10),
  },
  optionButton: {
    backgroundColor: '#334155',
    borderRadius: ms(8),
    paddingVertical: vs(6),
    paddingHorizontal: hs(16),
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionButtonSelected: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  optionButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: ms(15),
  },
// Use responsive units for all values below

  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: vs(30),

  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: ms(16),
    color: '#F8FAFC',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: hs(20),
  },
  emptyText: {
    fontSize: ms(18),
    color: '#94A3B8',
    marginBottom: vs(20),
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: hs(12),
    borderRadius: ms(8),
    gap: hs(8),
  },
  retryText: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(20),
    paddingVertical: vs(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  backButton: {
    marginRight: hs(16),
  },
  title: {
    flex: 1,
    fontSize: ms(20),
    fontWeight: '700',
    color: '#F8FAFC',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
    borderRadius: ms(8),
    gap: hs(6),
  },
  timerText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#F59E0B',
  },
  progressContainer: {
    paddingHorizontal: hs(20),
    paddingVertical: vs(16),
  },
  progressBar: {
    height: vs(4),
    backgroundColor: '#334155',
    borderRadius: ms(2),
    marginBottom: vs(8),
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: ms(2),
  },
  progressText: {
    fontSize: ms(14),
    color: '#94A3B8',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: hs(20),
  },
  questionContainer: {
    marginBottom: vs(24),
  },
  questionHeader: {
    marginBottom: vs(16),
  },
  questionMeta: {
    flexDirection: 'row',
    gap: hs(12),
  },
  difficultyText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#F59E0B',
    backgroundColor: '#1E293B',
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  domainText: {
    fontSize: ms(12),
    color: '#94A3B8',
    backgroundColor: '#334155',
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  questionText: {
    fontSize: ms(18),
    color: '#F8FAFC',
    lineHeight: ms(26),
  },
  optionsContainer: {
    gap: hs(12),
    marginBottom: vs(24),
  },
  optionButton: {
    backgroundColor: '#334155',
    borderRadius: ms(12),
    padding: hs(16),
    borderWidth: StyleSheet.hairlineWidth,
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
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionLetter: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#F59E0B',
    marginRight: hs(12),
    minWidth: hs(20),
  },
  optionText: {
    fontSize: ms(16),
    color: '#F8FAFC',
    flex: 1,
  },
  explanationContainer: {
    backgroundColor: '#1E293B',
    borderRadius: ms(12),
    padding: hs(16),
    marginBottom: vs(24),
  },
  explanationTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: vs(8),
  },
  explanationText: {
    fontSize: ms(14),
    color: '#CBD5E1',
    lineHeight: ms(20),
  },
  actionContainer: {
    padding: hs(20),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
  },
  actionButton: {
    backgroundColor: '#F59E0B',
    padding: hs(16),
    borderRadius: ms(12),
    alignItems: 'center',
    marginBottom:hs(10)
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: ms(16),
    fontWeight: '600',
    color: '#0F172A',
  },
});