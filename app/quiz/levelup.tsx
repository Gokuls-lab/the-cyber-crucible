import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
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

import ConfettiCannon from 'react-native-confetti-cannon';
import * as Progress from 'react-native-progress';
// Lottie for celebration animations
import LottieView from 'lottie-react-native';

interface Question {
  id: string;
  question_text: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  domain: string;
  options: {
    id: string;
    option_text: string;
    option_letter: string;
    is_correct: boolean;
  }[];
}

const STAGES: Question['difficulty'][] = ['easy', 'medium', 'hard'];

const getDifficultyStyle = (difficulty: Question['difficulty']) => {
  switch (difficulty) {
    case 'easy':
      return { backgroundColor: 'rgba(52, 211, 153, 0.2)', textColor: '#A7F3D0' }; // Light Green
    case 'medium':
      return { backgroundColor: 'rgba(250, 204, 21, 0.2)', textColor: '#FDE68A' }; // Light Yellow
    case 'hard':
      return { backgroundColor: 'rgba(248, 113, 113, 0.2)', textColor: '#FECACA' }; // Light Red
    default:
      return { backgroundColor: '#334155', textColor: '#E2E8F0' };
  }
};

// Animation assets (replace with your own Lottie files if available)
const stageCelebrations = [
  null, // require('@/assets/animations/celebrate_easy.json'),
  null, // require('@/assets/animations/celebrate_medium.json'),
  null, // require('@/assets/animations/celebrate_hard.json'),
];
const finalCelebration = null; // require('@/assets/animations/final_celebration.json');

export default function LevelUpQuizScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [stageCompleted, setStageCompleted] = useState(false);
  const [allStagesCompleted, setAllStagesCompleted] = useState(false);
  const confettiRef = useRef<ConfettiCannon>(null);
  const lottieRef = useRef<LottieView>(null);
  const [questionAnim] = useState(new Animated.Value(1));

  const fetchUserStage = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_progress')
      .select('level_up_stage')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user stage:', error);
      Alert.alert('Error', 'Could not fetch your current level.');
      router.back();
    } else {
      setStageIndex(data?.level_up_stage || 0);
    }
  }, [user]);

  const fetchQuestions = useCallback(async () => {
    if (!user) return;

    if (stageIndex >= STAGES.length) {
      setAllStagesCompleted(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    const currentDifficulty = STAGES[stageIndex];

    const { data, error } = await supabase
      .from('questions')
      .select('*, options:question_options(*)')
      .eq('difficulty', currentDifficulty);

    if (error) {
      console.error('Error fetching questions:', error);
      Alert.alert('Error', 'Failed to load questions.');
      setQuestions([]);
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  }, [user, stageIndex]);

  useEffect(() => {
    fetchUserStage();
  }, [fetchUserStage]);

  useEffect(() => {
    if (user) {
      fetchQuestions();
    }
  }, [user, stageIndex, fetchQuestions]);

  const handleAnswer = (optionId: string, isCorrectOption: boolean) => {
    setSelectedOption(optionId);
    setIsCorrect(isCorrectOption);
    if (isCorrectOption) {
      setScore(score + 1);
    }
    setShowExplanation(true);
  };


  const resetLevels = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_progress')
      .update({ level_up_stage: 0 })
      .eq('user_id', user.id);
    if (error) {
      console.error('Error resetting levels:', error);
      Alert.alert('Error', 'Could not reset your levels.');
    } else {
      ToastAndroid.show('Levels reset successfully', ToastAndroid.SHORT);
      setStageIndex(0);
      setScore(0);
      setCurrentQuestionIndex(0);
      setStageCompleted(false);
      setAllStagesCompleted(false);
    }
  };

  const handleNext = async () => {
    setShowExplanation(false);
    setSelectedOption(null);
    setIsCorrect(null);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setStageCompleted(true);
      confettiRef.current?.start();
      if (user) {
        const newStageIndex = stageIndex + 1;
        const { error } = await supabase
          .from('user_progress')
          .upsert({ user_id: user.id, level_up_stage: newStageIndex, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

        if (error) {
          console.error('Error updating stage:', error);
          Alert.alert('Error', 'Could not save your progress.');
        }
      }
    }
  };

  const handleNextStage = () => {
    setStageCompleted(false);
    setCurrentQuestionIndex(0);
    setScore(0);
    setStageIndex(stageIndex + 1);
  };
if(stageIndex==3){
  return(
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={{...styles.centered,flex:0.9}}>
        <Text style={styles.noQuestionsText}>Congratulations 🎉</Text>
        <Text style={styles.noQuestionsSubText}>You've completed all levels!</Text>
        <View style={{justifyContent:'space-between',flexDirection:'row',gap:hs(30)}}>
          <Text style={{color:'gold',fontSize:16,marginTop:16,fontWeight:'bold'}} onPress={()=>router.back()}>Back</Text>
          <Text style={{color:'gold',fontSize:16,marginTop:16,fontWeight:'bold'}} onPress={()=>resetLevels()}>Reset levels</Text>
        </View>
      </View>
    </SafeAreaView>
  </LinearGradient>
  )
}
  if (allStagesCompleted) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.centered}>
            <Text style={[styles.noQuestionsText, { fontSize: ms(22) }]}>Congratulations!</Text>
            <Text style={styles.noQuestionsSubText}>You've completed all levels!</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={{...styles.centered,flex:0.9}}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={[styles.loadingText, { fontSize: ms(16) }]}>
            {STAGES[stageIndex] ? `Loading ${STAGES[stageIndex]} questions...` : 'Loading...'}
          </Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (stageCompleted) {
    const currentStageName = STAGES[stageIndex];
    const isLastStage = stageIndex >= STAGES.length - 1;
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <ConfettiCannon count={200} origin={{ x: -10, y: 0 }} autoStart={true} ref={confettiRef} />
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={{ justifyContent: 'center', alignItems: 'center', paddingVertical: vs(24),flex:0.9 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.completionTitle, { fontSize: ms(28) }]}>{currentStageName.toUpperCase()} Stage Complete!</Text>
            <Text style={[styles.scoreText, { fontSize: ms(20) }]}>Your Score: {score} / {questions.length}</Text>
            {!isLastStage ? (
              <TouchableOpacity style={styles.nextStageButton} onPress={handleNextStage}>
                <Text style={styles.nextStageButtonText}>Continue to {STAGES[stageIndex + 1]}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.nextStageButton} onPress={() => router.replace('/(tabs)')}>
                <Text style={styles.nextStageButtonText}>Finish</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (questions.length === 0) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{...styles.centered,flex:0.9}}>
            <Text style={styles.noQuestionsText}>No Questions Found</Text>
            <Text style={styles.noQuestionsSubText}>
              There are no questions for the {STAGES[stageIndex]} stage.
            </Text>
            <TouchableOpacity style={[styles.nextStageButton, {marginTop: 20}]} onPress={handleNextStage}>
                <Text style={styles.nextStageButtonText}>Skip to Next Stage</Text>
              </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = (currentQuestionIndex + 1) / questions.length;
  const { backgroundColor, textColor } = getDifficultyStyle(currentQuestion.difficulty);
  const currentStageName = STAGES[stageIndex];

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Level Up - {currentStageName.toUpperCase()}</Text>
        </View>

        <Progress.Bar progress={progress} width={null} style={styles.progressBar} color={'#F59E0B'} unfilledColor={'#334155'} borderWidth={0} />
        <Text style={{ color: '#94A3B8', fontSize: ms(14), textAlign: 'center', marginTop: vs(4),marginBottom: vs(14) }}>{currentQuestionIndex + 1} of {questions.length}</Text>
        <ScrollView
          contentContainerStyle={{ paddingBottom: vs(32) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
           <Animated.View style={[styles.quizContainer, { opacity: questionAnim }]}> 
            {/* <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.domainText}>{currentQuestion.domain}</Text>
              <View style={[styles.difficultyBadge, { backgroundColor }]}> 
                <Text style={[styles.difficultyText, { color: textColor }]}>{currentQuestion.difficulty.toUpperCase()}</Text>
              </View>
            </View> */}
            <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  selectedOption === option.id && (isCorrect ? styles.correctOption : styles.incorrectOption),
                  selectedOption && selectedOption !== option.id && styles.disabledOption
                ]}
                onPress={() => handleAnswer(option.id, option.is_correct)}
                disabled={!!selectedOption}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ marginRight: 20 }}>
                    <Text style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: ms(15) }}>{option.option_letter}.</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionText}>{option.option_text}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

          {showExplanation && (
            <View style={styles.explanationContainer}>
              <Text style={styles.explanationTitle}>Explanation</Text>
              <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: vs(30) },
  safeArea: { flex: 1, padding: hs(10) },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: vs(10), fontSize: ms(16), textTransform: 'capitalize' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), borderBottomWidth: ms(1), borderBottomColor: '#334155', paddingBottom: vs(16) },
  backButton: { padding: hs(8) },
  headerTitle: { color: '#fff', fontSize: ms(20), fontWeight: 'bold', marginLeft: hs(16) },
  progressBar: { marginVertical: vs(16) },
  quizContainer: { marginTop: vs(13), padding: hs(10) },
  difficultyBadge: {
    alignSelf: 'center',
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
    borderRadius: ms(7),
    marginLeft: hs(10),
  },
  domainText: {
    fontSize: ms(12),
    color: '#94A3B8',
    backgroundColor: '#334155',
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  difficultyText: {
    fontWeight: 'bold',
    fontSize: ms(12),
    textTransform: 'uppercase',
  },
  questionText: { color: '#E2E8F0', fontSize: ms(17), marginTop: vs(12), marginBottom: vs(24), textAlign: 'left' },
  optionButton: {
    backgroundColor: '#334155',
    padding: vs(16),
    borderRadius: ms(8),
    marginBottom: vs(12),
  },
  optionText: { color: '#fff', fontSize: ms(13) },
  correctOption: { backgroundColor: '#16A34A', borderColor: '#22C55E', borderWidth: ms(2) },
  incorrectOption: { backgroundColor: '#DC2626', borderColor: '#EF4444', borderWidth: ms(2) },
  disabledOption: { opacity: 0.6 },
  explanationContainer: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: ms(12),
    padding: hs(16),
    marginBottom: vs(24),
    // position: 'absolute',
    bottom: 0,
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
  nextButton: {
    backgroundColor: '#F59E0B',
    padding: vs(16),
    borderRadius: ms(8),
    alignItems: 'center',
    marginTop: vs(16),
  },
  nextButtonText: { color: '#fff', fontSize: ms(16), fontWeight: 'bold' },
  completionTitle: { fontSize: ms(28), fontWeight: 'bold', color: '#fff', marginBottom: vs(20), textTransform: 'capitalize' },
  scoreText: { fontSize: ms(20), color: '#CBD5E1', marginBottom: vs(40) },
  nextStageButton: {
    backgroundColor: '#2563EB',
    paddingVertical: vs(16),
    paddingHorizontal: hs(32),
    borderRadius: ms(50),
  },
  nextStageButtonText: { color: '#fff', fontSize: ms(18), fontWeight: 'bold', textTransform: 'capitalize' },
  noQuestionsText: { color: '#fff', fontSize: ms(22), fontWeight: 'bold' },
  noQuestionsSubText: { color: '#94A3B8', fontSize: ms(16), marginTop: vs(8) },
});
