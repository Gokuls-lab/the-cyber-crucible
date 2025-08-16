import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useLevelUpAccuracy } from '@/hooks/useLevelUpAccuracy';
import { useQuizModes } from '@/lib/QuizModes';
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

import { BarChart, Clock, Sparkles, Target, Trophy } from 'lucide-react-native';

export default function LevelUpQuizScreen() {
  const { exam } = useExam();
  const [stagePassed, setStagePassed] = useState<boolean | null>(null); // null=not completed, true=pass, false=fail
  const [stageFailInfo, setStageFailInfo] = useState<any>(null);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [lastStageTime, setLastStageTime] = useState<number | null>(null);
  const [pendingStageResult, setPendingStageResult] = useState<{ score: number; total: number } | null>(null);
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
  const [userAnswers, setUserAnswers] = useState<any[]>([]); // Track answers for current stage
  const [stageStartTime, setStageStartTime] = useState<number | null>(null); // For timing
  const confettiRef = useRef<ConfettiCannon>(null);
  const lottieRef = useRef<LottieView>(null);
  const [questionAnim] = useState(new Animated.Value(1));
  const { accuracyData, isLevelUpLoading, error, refresh } = useLevelUpAccuracy(user?.id, exam?.id);
  const { data: rawQuizModes, isLoading: isQuizModesLoading, isError: isQuizModesError } = useQuizModes();

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
      // setStageIndex(data?.level_up_stage?.[exam?.id] || 0);
      setStageIndex(data?.level_up_stage?.[exam?.id] ?? 0);
    }
  }, [user]);

  // Fisher-Yates shuffle
  function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const fetchQuestions = useCallback(async () => {
    if (!user) return;

    if (stageIndex >= STAGES.length) {
      setAllStagesCompleted(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    const currentDifficulty = STAGES[stageIndex];
    // const { data, error } = await supabase
    //   .from('questions')
    //   .select('*, options:question_options(*)')
    //   .eq('difficulty', currentDifficulty).limit(rawQuizModes[3]?.num_questions)
    //   ;

    // Step 1: Get previous correctly answered question IDs from level_up sessions
    const { data: levelUpSessions, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('exam_id', exam?.id)
      .eq('quiz_type', 'level_up');

    const levelUpSessionIds = levelUpSessions?.map(s => s.id);

    const { data: correctAnswers, error: answersError } = await supabase
      .from('user_answers')
      .select('question_id')
      .eq('user_id', user.id)
      .eq('is_correct', true)
      .in('quiz_session_id', levelUpSessionIds || []);

    const correctQuestionIds = correctAnswers?.map(a => a.question_id) || [];

    // Step 2: Fetch new questions excluding those correctly answered before
    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('*, options:question_options(*)')
      .eq('difficulty', currentDifficulty)
      .eq('exam', exam?.id)
      .not('id', 'in', `(${correctQuestionIds.join(',')})`)
.limit(rawQuizModes[3]?.num_questions);


    if (questionError) {
      console.error('Error fetching questions:', questionError);
      Alert.alert('Error', 'Failed to load questions.');
      setQuestions([]);
    } else {
      // Shuffle questions and their options
      let shuffledQuestions = shuffleArray(questions || []).map(q => ({
        ...q,
        options: shuffleArray(q.options || [])
      }));
      setQuestions(shuffledQuestions);
      setStageStartTime(Date.now()); // Start timing when new questions load
    }
    setLoading(false);
  }, [user, stageIndex, rawQuizModes]);

  useEffect(() => {
    fetchUserStage();
  }, [fetchUserStage]);

  useEffect(() => {
    if (user) {
      fetchQuestions();
    }
  }, [user, stageIndex, fetchQuestions]);

  useEffect(() => {
    // Process the stage result once accuracy data is refreshed
    if (pendingStageResult && accuracyData) {
      const currentStageName = STAGES[stageIndex];
      if (!accuracyData[currentStageName]) return;

      const { score, total } = pendingStageResult;
      const latestAccuracy = accuracyData[currentStageName].accuracy;
      const newStageIndex = stageIndex + 1;

      // if (latestAccuracy >= 70) {
      //   setStagePassed(true);
      //   // Update user progress in Supabase
      //   const updateUserProgress = async () => {
      //     if (user) {
      //       const { error: updateError } = await supabase
      //         .from('user_progress')
      //         .upsert({ user_id: user.id, level_up_stage: newStageIndex, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      //       if (updateError) {
      //         console.error('Error updating stage:', updateError);
      //         Alert.alert('Error', 'Could not save your progress.');
      //       }
      //     }
      //   };
      //   updateUserProgress();
      // } 
      if (latestAccuracy >= 70) {
        setStagePassed(true);
      
        // Update user progress in Supabase using RPC
        const updateUserProgress = async () => {
          if (user && exam?.id) {
            const { error: updateError } = await supabase.rpc('update_exam_stage', {
              uid: user.id,
              exam_id: exam.id,
              new_stage: newStageIndex,
            });
      
            if (updateError) {
              console.error('Error updating stage:', updateError);
              Alert.alert('Error', 'Could not save your progress.');
            }
          }
        };
      
        updateUserProgress();
      }      
      else {
        setStagePassed(false);
        setStageFailInfo({
          score,
          total,
          percentage: latestAccuracy.toFixed(0),
          reason: `Your total accuracy is (${latestAccuracy.toFixed(0)}%). You need at least 70% to pass this stage.`,
        });
      }
      // Reset the pending state
      setPendingStageResult(null);
    }
  }, [pendingStageResult, accuracyData]);

  const handleAnswer = (optionId: string, _isCorrectOption: boolean) => {
    // Only record the selection for now; do not reveal correctness yet.
    setSelectedOption(optionId);
  };


  const resetLevels = () => {
    if (!user) return;
  
    Alert.alert(
      "Reset Level Up Progress",
      "Warning: This will permanently erase:\n\n• Your Level Up quiz history\n• All performance statistics for this mode\n• Your current Level Up stage and progress\n\nThis action cannot be undone. Do you want to proceed?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Reset level_up_stage
              const { error: updateError } = await supabase.rpc("update_exam_stage", {
                uid: user.id,
                exam_id: exam.id,
                new_stage: 0, // reset current exam only
              });
  
              if (updateError) throw updateError;
  
              // 2. Get all level_up session IDs
              const { data: sessions, error: sessionError } = await supabase
                .from('quiz_sessions')
                .select('id')
                .eq('user_id', user.id)
                .eq('exam_id', exam?.id)
                .eq('quiz_type', 'level_up');
  
              if (sessionError) throw sessionError;
  
              const sessionIds = (sessions ?? []).map((s) => s.id);
  
              if (sessionIds.length > 0) {
                // 3. Delete related user_answers
                const { error: answerDeleteError } = await supabase
                  .from('user_answers')
                  .delete()
                  .in('quiz_session_id', sessionIds);
  
                if (answerDeleteError) throw answerDeleteError;
  
                // 4. Delete level_up sessions
                const { error: sessionDeleteError } = await supabase
                  .from('quiz_sessions')
                  .delete()
                  .in('id', sessionIds);
  
                if (sessionDeleteError) throw sessionDeleteError;
              }
  
              // 5. Reset local frontend states
              ToastAndroid.show('Level Up progress reset successfully', ToastAndroid.SHORT);
              setStageIndex(0);
              setScore(0);
              setCurrentQuestionIndex(0);
              setUserAnswers([]);
              setStageCompleted(false);
              setAllStagesCompleted(false);
            } catch (err) {
              console.error('Error resetting Level Up progress:', err);
              Alert.alert('Error', 'Could not reset your Level Up data.');
            }
          }
        }
      ]
    );
  };
  

  const handleNext = async () => {
    // Phase 1: If feedback not shown yet, reveal correctness and explanation
    if (!showExplanation) {
      if (!selectedOption) return;
      const correctId = questions[currentQuestionIndex]?.options.find(o => o.is_correct)?.id;
      const wasCorrect = selectedOption === correctId;
      setIsCorrect(wasCorrect);
      if (wasCorrect) {
        setScore(prev => prev + 1);
      }
      // Track answer now (when revealing feedback)
      setUserAnswers(prev => [
        ...prev,
        {
          question_id: questions[currentQuestionIndex]?.id,
          selected_option_id: selectedOption,
          is_correct: wasCorrect,
          answered_at: new Date().toISOString(),
        },
      ]);
      setShowExplanation(true);
      return;
    }

    // Phase 2: Feedback already shown -> move to next question or finish
    setShowExplanation(false);
    setSelectedOption(null);
    setIsCorrect(null);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Calculate time taken
      const now = Date.now();
      const timeTakenSeconds = stageStartTime ? Math.round((now - stageStartTime) / 1000) : 0;
      setStageCompleted(true);

      confettiRef.current?.start();
      if (user) {
        const newStageIndex = stageIndex + 1;
        // 1. Insert quiz session
        let sessionId = null;
        try {
          const { data: sessionData, error: sessionError } = await supabase
            .from('quiz_sessions')
            .insert([
              {
                user_id: user.id,
                quiz_type: 'level_up',
                score: score,
                total_questions: questions.length,
                time_taken_seconds: timeTakenSeconds,
                completed_at: new Date().toISOString(),
                exam_id: exam?.id,
              },
            ])
            .select('id')
            .single();
          if (sessionError) throw sessionError;
          sessionId = sessionData.id;
        } catch (err) {
          console.error('Error creating quiz session:', err);
          Alert.alert('Error', 'Could not save your quiz session.');
          return;
        }
        // 2. Insert user answers
        try {
          const answersToInsert = userAnswers.map(ans => ({
            ...ans,
            user_id: user.id,
            quiz_session_id: sessionId,
          }));
          const { error: answersError } = await supabase.from('user_answers').insert(answersToInsert);
          if (answersError) throw answersError;
        } catch (err) {
          console.error('Error saving answers:', err);
          Alert.alert('Error', 'Could not save your answers.');
          // Don't return; still update progress
        }
        // After saving, refresh accuracy and compute pass/fail
        setLastSessionId(sessionId);
        setLastStageTime(timeTakenSeconds);
        await refresh();
        setPendingStageResult({ score, total: questions.length });
      }
    }
  };

  const handleNextStage = () => {
    setStageCompleted(false);
    // setShowStageResults(false);
    setCurrentQuestionIndex(0);
    setScore(0);
    setUserAnswers([]); // Reset answers for new stage
    setStageStartTime(Date.now()); // Start timing for next stage
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
if (pendingStageResult) {
  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F59E0B" /> 
          <Text style={[styles.noQuestionsText, { fontSize: ms(22) }]}>Processing...</Text>
          <Text style={styles.noQuestionsSubText}>Please wait while we process your results.</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}
  if (stageCompleted && stagePassed !== null && !pendingStageResult) {
    return (
      <StageResult
        passed={stagePassed}
        accuracyData={accuracyData}
        stageIndex={stageIndex}
        score={score}
        totalQuestions={questions.length}
        timeTaken={lastStageTime}
        onNextStage={handleNextStage}
        onRetry={() => {
          setUserAnswers([]);
          setStageCompleted(false);
          setCurrentQuestionIndex(0);
          setScore(0);
          fetchQuestions();
        }}
        onBack={() => router.back()}
      />
    );
  }
//   if (stageCompleted && false) {
//     const currentStageName = STAGES[stageIndex];
//     const isLastStage = stageIndex >= STAGES.length - 1;

//     return (
//       <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
//         <SafeAreaView style={styles.safeArea}>
//           <ScrollView
//             contentContainerStyle={{ justifyContent: 'center', alignItems: 'center', paddingVertical: vs(24), flex: 0.9 }}
//             keyboardShouldPersistTaps="handled"
//             showsVerticalScrollIndicator={false}
//           >
//             {!stagePassed && stageFailInfo && (
//               <View style={{ width: '100%', backgroundColor: '#1e293b', borderRadius: ms(16), padding: hs(20), alignItems: 'center', borderWidth: 2, borderColor: '#dc2626',flex:1}}>
//                 <View style={{ backgroundColor: '#dc2626', borderRadius: 50, padding: 18, marginBottom: vs(10) }}>
//                   <Text style={{ fontSize: ms(32), color: '#fff' }}>❌</Text>
//                 </View>
//                 <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: ms(22), marginBottom: vs(8) }}>Stage Not Passed</Text>
//                 <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>{stageFailInfo.reason}</Text>
//                 {/* Stats Grid */}
//                 <View style={{marginTop:vs(40)}}>

//                 <StatsGrid
//                   accuracy={((score / questions.length) * 100).toFixed(0)}
//                   score={score}
//                   total={questions.length}
//                   timeInMinutes={lastStageTime ? Number((lastStageTime/60).toFixed(1)) : 0}
//                   />
//                   {!isLevelUpLoading && accuracyData && accuracyData[currentStageName] ? (
//                     <View>
//                     <Text style={{ color: '#fff', fontSize: ms(20), marginBottom: vs(8), textAlign: 'center' ,fontWeight:'bold',marginTop:vs(20)}}>
//                       Overall Stats </Text>
//                     <StatsGrid 
//                       accuracy={Number(accuracyData[currentStageName].accuracy).toFixed(0)}
//                       score={accuracyData[currentStageName].correct}
//                       total={accuracyData[currentStageName].total}
//                       timeInMinutes={lastStageTime ? Number((lastStageTime/60).toFixed(1)) : 0}
//                       isOverall={true}
//                       />
//                       </View>
// ) : null}
//                   {isLevelUpLoading && <><ActivityIndicator size="large" color="#fff" /> <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>Loading...</Text></>}
//                   {!accuracyData && <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>No accuracy data available</Text>}
//                   </View>
//                 <View style={{ flexDirection: 'row', gap: hs(12), marginTop: vs(16) }}>
//                   <TouchableOpacity style={[styles.nextStageButton, { backgroundColor: '#dc2626', padding:vs(10) }]} onPress={() => {
//                     setCurrentQuestionIndex(0);
//                     setScore(0);
//                     setUserAnswers([]);
//                     setStageCompleted(false);
//                     setStageFailInfo(null);
//                     setStagePassed(null);
//                     fetchQuestions();
//                   }}>
//                     <Text style={styles.nextStageButtonText}>Try Again</Text>
//                   </TouchableOpacity>
//                   {/* {lastSessionId && (
//                     <TouchableOpacity style={[styles.nextStageButton, { backgroundColor: '#334155', padding:vs(10) }]} onPress={() => router.push(`/results?session=${lastSessionId}&mode=level_up`)}>
//                       <Text style={styles.nextStageButtonText}>View Result</Text>
//                     </TouchableOpacity>
//                   )} */}
//                 </View>
//               </View>
//             )} 
//             {stagePassed && (
//               <>
//                 <View style={{ width: '100%', backgroundColor: '#1e293b', borderRadius: ms(16), padding: hs(20), alignItems: 'center', borderWidth: 2, borderColor: '#22c55e',flex:1}}>
//                 <ConfettiCannon count={200} origin={{ x: -10, y: 0 }} autoStart={true} ref={confettiRef} fadeOut={true}/>
//                   <View style={{ backgroundColor: '#22c55e', borderRadius: 50, padding: 18, marginBottom: vs(10) }}>
//                     <Text style={{ fontSize: ms(32), color: '#fff' }}>🏆</Text>
//                   </View>
//                   <Text style={{ color: '#22c55e', fontWeight: 'bold', fontSize: ms(22), marginBottom: vs(8) }}>{currentStageName.toUpperCase()} Stage Complete!</Text>
//                   {/* <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8) }}>Your Score: {score} / {questions.length}</Text> */}
//                   <Text style={{ color: '#fff', fontSize: ms(20),textAlign: 'center' ,fontWeight:'bold',marginTop:vs(20)}}>
//                       Current Assessment </Text>
//                   {/* Stats Grid */}
//                   <View style={{marginTop:vs(40)}}>

//                   <StatsGrid
//                     accuracy={((score / questions.length) * 100).toFixed(0)}
//                     score={score}
//                     total={questions.length}
//                     timeInMinutes={lastStageTime ? Number((lastStageTime / 60).toFixed(1)) : 0}
//                     />

//                   {!isLevelUpLoading &&accuracyData && accuracyData[currentStageName] ? (
//                     <View>
//                     <Text style={{ color: '#fff', fontSize: ms(20), marginBottom: vs(8), textAlign: 'center' ,fontWeight:'bold',marginTop:vs(20)}}>
//                       Overall Stats </Text>
//                     <StatsGrid 
//                       accuracy={Number(accuracyData[currentStageName].accuracy).toFixed(0)}
//                       score={accuracyData[currentStageName].correct}
//                       total={accuracyData[currentStageName].total}
//                       timeInMinutes={lastStageTime ? Number((lastStageTime/60).toFixed(1)) : 0}
//                       isOverall={true}
//                       />
//                       </View>
//                   ) : null}
//                   {isLevelUpLoading && <View><ActivityIndicator size="large" color="#fff" /> <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>Loading...</Text></View>}
//                   {!accuracyData && <Text style={{ color: '#fff', fontSize: ms(16), marginBottom: vs(8), textAlign: 'center' }}>No accuracy data available</Text>}

                  
//                     </View>
//                   <View style={{ flexDirection: 'row', gap: hs(12), marginTop: vs(16) }}>
//                     {!isLastStage ? (
//                       <TouchableOpacity style={[styles.nextStageButton, { flex: 1 }]} onPress={handleNextStage}>
//                         <Text style={styles.nextStageButtonText}>Continue</Text>
//                       </TouchableOpacity>
//                     ) : (
//                       <TouchableOpacity style={[styles.nextStageButton, { flex: 1 }]} onPress={() => router.replace('/(tabs)')}>
//                         <Text style={styles.nextStageButtonText}>Finish</Text>
//                       </TouchableOpacity>
//                     )}
//                     {/* {lastSessionId && (
//                       <TouchableOpacity style={[styles.nextStageButton, { backgroundColor: '#334155', flex: 1 }]} onPress={() => router.push(`/results?session=${lastSessionId}&mode=level_up`)}>
//                         <Text style={styles.nextStageButtonText}>View Result</Text>
//                       </TouchableOpacity>
//                     )} */}
//                   </View>
//                 </View>
//               </>
//             )} 
//           </ScrollView>
//         </SafeAreaView>
//       </LinearGradient>
//     );
//   }

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

            {currentQuestion.options.map((option,index) => {
              const letter = String.fromCharCode(65 + index); // Converts 0 to 'A', 1 to 'B', etc.
              return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  // Gold highlight for selected option before feedback
                  !showExplanation && selectedOption === option.id && styles.selectedOptionGoldBorder,
                  // Only show correctness styles after feedback is revealed
                  showExplanation && (
                    option.id === selectedOption
                      ? (isCorrect ? styles.correctOption : styles.incorrectOption)
                      : (!isCorrect && option.is_correct ? styles.correctOption : undefined)
                  ),
                  // Dim other options only after feedback is shown
                  showExplanation && selectedOption && selectedOption !== option.id && styles.disabledOption
                ]}
                onPress={() => handleAnswer(option.id, option.is_correct)}
                disabled={showExplanation}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ marginRight: 20 }}>
                    <Text style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: ms(15) }}>{letter}.</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionText}>{option.option_text}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              );
              })}

            {!showExplanation && selectedOption && (
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Submit</Text>
              </TouchableOpacity>
            )}

            {showExplanation && (
              <View style={styles.explanationContainer}>
                <Text style={styles.explanationTitle}>Explanation</Text>
                <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Continue</Text>
              </TouchableOpacity>
              </View>
            )}
        </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
// ...
}

const StatsGrid1 = ({ accuracy, score, total, timeInMinutes,isOverall=false }: { accuracy: string, score: number, total: number, timeInMinutes: number,isOverall?: boolean }) => (
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
      <Text style={styles.statValue}>{score} / {total}</Text>
      <Text style={styles.statLabel}>Score</Text>
    </View>
    {!isOverall && <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Clock size={24} color="#8B5CF6" strokeWidth={2} />
      </View>
      <Text style={styles.statValue}>{timeInMinutes}m</Text>
      <Text style={styles.statLabel}>Time</Text>
    </View>}
  </View>
);

interface StageResultProps {
  passed: boolean;
  accuracyData: any;
  stageIndex: number;
  score: number;
  totalQuestions: number;
  timeTaken: number | null;
  onNextStage: () => void;
  onRetry: () => void;
  onBack: () => void;
}

function StageResult({
  passed,
  accuracyData,
  stageIndex,
  score,
  totalQuestions,
  timeTaken,
  onNextStage,
  onRetry,
  onBack,
}: StageResultProps) {
  const currentStage = STAGES[stageIndex];
  const overallAccuracy = accuracyData?.[currentStage]?.accuracy.toFixed(0) || '...';
  const thisRoundAccuracy = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(0) : '0';

  const resultTitle = passed ? "Stage Passed!" : "Stage Failed";
  const resultColor = passed ? '#22C55E' : '#EF4444';
  const resultIcon = passed ? '🎉' : '😔';

  const stats = [
    { icon: Trophy, label: 'Overall Score', value: `${accuracyData?.[currentStage]?.correct}/${accuracyData?.[currentStage]?.total}` },
    { icon: Sparkles, label: 'This Round Score', value: `${score}/${totalQuestions}` },
    { icon: BarChart, label: 'Overall Acc.', value: `${overallAccuracy}%` },
    { icon: Target, label: 'This Round', value: `${thisRoundAccuracy}%` },
    { icon: Clock, label: 'Time', value: `${timeTaken ? Number((timeTaken/60).toFixed(1)) : 0}m` },

  ];

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.centered}>
          <View style={styles.resultCard}>
            <Text style={styles.resultIcon}>{resultIcon}</Text>
            <Text style={[styles.resultTitle, { color: resultColor }]}>{resultTitle}</Text>
            
            {passed ? (
              <Text style={styles.resultSubtitle}>
                Congratulations! You've mastered the <Text style={{fontWeight:'bold'}}>{currentStage}</Text> stage.
              </Text>
            ) : (
              <Text style={styles.resultSubtitle}>
                Don't worry, you can try again. You need <Text style={{fontWeight:'bold'}}>70%</Text> overall accuracy to pass.
              </Text>
            )}

            <View style={styles.divider} />

            <Text style={styles.statsHeader}>Stage Statistics</Text>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',width:'100%',marginBottom:10}}>
              <Text style={{color:'grey'}}>Overall score</Text>
              <Text style={{color:'grey'}}>{accuracyData?.[currentStage]?.correct}/{accuracyData?.[currentStage]?.total}</Text>
            </View>
            <View style={{width:'100%',height:10,backgroundColor:'gray',borderRadius:5}}>
              <View style={{width:`${overallAccuracy}%`,height:10,backgroundColor:overallAccuracy<40?'red':overallAccuracy<70?'orange':'green',borderRadius:5}}></View>
            </View>
            <StatsGrid items={stats} />

            <View style={styles.divider} />

            {passed ? (
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#22C55E' }]} onPress={onNextStage}>
                <Text style={styles.actionButtonText}>Next Stage</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#F59E0B' }]} onPress={onRetry}>
                <Text style={styles.actionButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
                        <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backLink}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

interface StatsGridProps {
  items: { icon: React.ElementType; label: string; value: string }[];
}

function StatsGrid({ items }: StatsGridProps) {
  return (
    <View style={styles.statsGrid}>
      {items.map((item, index) => (
        <View key={index} style={styles.statGridItem}>
          <item.icon color="#94A3B8" size={ms(24)} />
          <Text style={styles.statGridLabel}>{item.label}</Text>
          <Text style={styles.statGridValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  selectedOptionGoldBorder: {
    borderColor: '#FFD700',
    borderWidth: ms(2),
  },

  
  
  
  // container: { flex: 1, paddingTop: vs(30) },
  // safeArea: { flex: 1, padding: hs(10) },
  // centered: { justifyContent: 'center', alignItems: 'center' },
  // loadingText: { color: '#fff', marginTop: vs(10), fontSize: ms(16), textTransform: 'capitalize' },
  // header: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), borderBottomWidth: ms(1), borderBottomColor: '#334155', paddingBottom: vs(16) },
  // backButton: { padding: hs(8) },
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
    alignItems:'center',
    justifyContent:'center',
    borderRadius: ms(20),
  },
  nextStageButtonText: { color: '#fff', fontSize: ms(15), fontWeight: 'bold', textTransform: 'capitalize' },
  noQuestionsText: { color: '#fff', fontSize: ms(22), fontWeight: 'bold' },
  noQuestionsSubText: { color: '#94A3B8', fontSize: ms(16), marginTop: vs(8) },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // justifyContent: 'space-around',
    justifyContent:'center',
    alignItems: 'center',
    marginVertical: vs(18),
    width: '100%',
    gap: hs(20),
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: ms(16),
    alignItems: 'center',
    paddingVertical: vs(18),
    marginHorizontal: hs(5),
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  statIcon: {
    marginBottom: vs(6),
    backgroundColor: '#1E293B',
    borderRadius: ms(12),
    padding: ms(7),
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: ms(18),
    fontWeight: 'bold',
    marginBottom: vs(2),
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: ms(14),
    fontWeight: '600',
  },
  // New
  container: { flex: 1, paddingTop: vs(30) },
  safeArea: { flex: 1, padding: hs(10) },
  centered: { justifyContent: 'center', alignItems: 'center', flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(10),
    paddingBottom: vs(10),
  },
  backButton: { padding: hs(5) },
  progressContainer: {
    width: '90%',
    marginBottom: vs(20),
    alignItems: 'center',
  },
  progressText: {
    color: '#E2E8F0',
    fontSize: ms(14),
    marginBottom: vs(5),
  },
  questionContainer: {
    backgroundColor: '#1E293B',
    borderRadius: ms(12),
    padding: hs(20),
    width: '100%',
    marginBottom: vs(20),
  },
  // difficultyBadge: {
  //   position: 'absolute',
  //   top: hs(-10),
  //   right: hs(15),
  //   paddingHorizontal: hs(10),
  //   paddingVertical: vs(4),
  //   borderRadius: ms(8),
  // },
  // difficultyText: { fontSize: ms(12), fontWeight: 'bold' },
  // questionText: {
  //   color: '#F1F5F9',
  //   fontSize: ms(18),
  //   lineHeight: ms(26),
  //   marginBottom: vs(20),
  //   fontWeight: '600',
  // },
  // optionButton: {
  //   backgroundColor: '#334155',
  //   padding: hs(15),
  //   borderRadius: ms(10),
  //   marginBottom: vs(10),
  //   flexDirection: 'row',
  //   alignItems: 'center',
  // },
  optionLetter: {
    color: '#94A3B8',
    fontWeight: 'bold',
    fontSize: ms(16),
    marginRight: hs(12),
  },
  // optionText: { color: '#E2E8F0', fontSize: ms(16), flex: 1 },
  // explanationContainer: {
  //   marginTop: vs(15),
  //   padding: hs(15),
  //   backgroundColor: 'rgba(255, 255, 255, 0.05)',
  //   borderRadius: ms(8),
  // },
  // explanationTitle: {
  //   color: '#FBBF24',
  //   fontSize: ms(16),
  //   fontWeight: 'bold',
  //   marginBottom: vs(5),
  // },
  // explanationText: { color: '#CBD5E1', fontSize: ms(15), lineHeight: ms(22) },
  // nextButton: {
  //   backgroundColor: '#3B82F6',
  //   padding: hs(15),
  //   borderRadius: ms(10),
  //   alignItems: 'center',
  //   marginTop: vs(10),
  // },
  // nextButtonText: { color: '#fff', fontSize: ms(16), fontWeight: 'bold' },
  loadingText: { color: '#fff', marginTop: vs(10) },
  // noQuestionsText: { color: '#fff', fontSize: ms(18), fontWeight: 'bold' },
  // noQuestionsSubText: { color: '#94A3B8', fontSize: ms(14), marginTop: vs(8), textAlign: 'center' },
  // statsGrid: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-around',
  //   width: '100%',
  //   marginVertical: vs(10),
  // },
  statItem: {
    alignItems: 'center',
    padding: hs(10),
    borderRadius: ms(10),
    backgroundColor: '#334155',
    minWidth: hs(90),
  },
  // statLabel: { color: '#94A3B8', fontSize: ms(12), marginTop: vs(5) },
  // statValue: { color: '#F1F5F9', fontSize: ms(18), fontWeight: 'bold' },
  resultCard: {
    backgroundColor: '#1E293B',
    borderRadius: ms(16),
    padding: hs(20),
    margin: hs(15),
    alignItems: 'center',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  resultIcon: {
    fontSize: ms(50),
    marginBottom: vs(10),
  },
  resultTitle: {
    fontSize: ms(28),
    fontWeight: 'bold',
    marginBottom: vs(8),
  },
  resultSubtitle: {
    fontSize: ms(16),
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: vs(20),
    lineHeight: ms(24),
  },
  statsHeader: {
    fontSize: ms(18),
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: vs(15),
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    width: '100%',
    marginVertical: vs(20),
  },
  actionButton: {
    borderRadius: ms(12),
    paddingVertical: vs(15),
    paddingHorizontal: hs(30),
    width: '100%',
    alignItems: 'center',
    marginBottom: vs(15),
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: ms(18),
    fontWeight: 'bold',
  },
  backLink: {
    color: '#94A3B8',
    fontSize: ms(14),
    marginTop: vs(5),
  },
  statGridItem: {
    alignItems: 'center',
    padding: hs(10),
    borderRadius: ms(10),
    backgroundColor: '#334155',
    minWidth: hs(90),
  },
  statGridLabel: { color: '#94A3B8', fontSize: ms(12), marginTop: vs(5) },
  statGridValue: { color: '#F1F5F9', fontSize: ms(18), fontWeight: 'bold' },
  //New end
});
