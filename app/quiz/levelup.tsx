import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Progress from 'react-native-progress';
import ConfettiCannon from 'react-native-confetti-cannon';
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
      <View style={styles.centered}>
        <Text style={styles.noQuestionsText}>Congratulations 🎉</Text>
        <Text style={styles.noQuestionsSubText}>You've completed all levels!</Text>
        <Text style={{color:'gold',fontSize:16,marginTop:16,fontWeight:'bold'}} onPress={()=>router.back()}>Back</Text>
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
            <Text style={styles.noQuestionsText}>Congratulations!</Text>
            <Text style={styles.noQuestionsSubText}>You've completed all levels!</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>
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
          <View style={styles.centered}>
            <Text style={styles.completionTitle}>{currentStageName.toUpperCase()} Stage Complete!</Text>
            <Text style={styles.scoreText}>Your Score: {score} / {questions.length}</Text>
            {!isLastStage ? (
              <TouchableOpacity style={styles.nextStageButton} onPress={handleNextStage}>
                <Text style={styles.nextStageButtonText}>Continue to {STAGES[stageIndex + 1]}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.nextStageButton} onPress={() => router.replace('/(tabs)')}>
                <Text style={styles.nextStageButtonText}>Finish</Text>
              </TouchableOpacity>
            )}
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
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.centered}>
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
        <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', marginTop: 4,marginBottom: 14 }}>{currentQuestionIndex + 1} of {questions.length}</Text>
        <Animated.View style={[styles.quizContainer, { opacity: questionAnim }]}> 
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>

          <Text style={styles.domainText}>{currentQuestion.domain}</Text>
          <View style={[styles.difficultyBadge, { backgroundColor }]}> 
            <Text style={[styles.difficultyText, { color: textColor }]}>{currentQuestion.difficulty.toUpperCase()}</Text>
          </View>
          </View>
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
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={{marginRight: 20}}>
                 <Text style={{color: '#F59E0B',fontWeight: 'bold',fontSize: 17}}>{option.option_letter}.</Text> 
                </View>
                <View style={{flex: 1}}>
                <Text style={styles.optionText}>
                 {option.option_text}
                </Text>
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
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 ,paddingTop: 30},
  safeArea: { flex: 1,padding: 10},
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 16, textTransform: 'capitalize' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 ,borderBottomWidth: 1,borderBottomColor: '#334155',paddingBottom: 16},
  backButton: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 16 },
  progressBar: { marginVertical: 16 },
  quizContainer: { flex: 1 ,marginTop: 13, padding: 10 },
  difficultyBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    marginLeft: 10,
  },
  domainText: {
    fontSize: 12,
    color: '#94A3B8',
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  questionText: { color: '#E2E8F0', fontSize: 21, marginTop: 12,marginBottom: 24, textAlign: 'left' },
  optionButton: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  optionText: { color: '#fff', fontSize: 17 },
  correctOption: { backgroundColor: '#16A34A', borderColor: '#22C55E', borderWidth: 2 },
  incorrectOption: { backgroundColor: '#DC2626', borderColor: '#EF4444', borderWidth: 2 },
  disabledOption: { opacity: 0.6 },
  explanationContainer: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    position: 'absolute',
    bottom: 0,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  nextButton: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  completionTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 20, textTransform: 'capitalize' },
  scoreText: { fontSize: 20, color: '#CBD5E1', marginBottom: 40 },
  nextStageButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
  },
  nextStageButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textTransform: 'capitalize' },
  noQuestionsText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  noQuestionsSubText: { color: '#94A3B8', fontSize: 16, marginTop: 8 },
});
