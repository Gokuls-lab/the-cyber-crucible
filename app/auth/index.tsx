import { useAuth } from '@/contexts/AuthContext';
import { useHeaderHeight } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Shield } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

const onboardingSlides = [
  {
    title: 'Master Your Certification',
    subtitle: 'Comprehensive IT exam preparation',
    description: 'Access thousands of practice questions for top IT certifications including CompTIA, Cisco, and cybersecurity exams.',
  },
  {
    title: 'Track Your Progress',
    subtitle: 'Study smarter, not harder',
    description: 'Monitor your learning journey with detailed analytics, streak tracking, and personalized study recommendations.',
  },
  {
    title: 'Show Up Confident',
    subtitle: 'Be exam ready',
    description: 'Build confidence with realistic practice tests, timed quizzes, and expert explanations for every question.',
  },
];



function getPasswordCriteria(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function getPasswordStrength(criteria: ReturnType<typeof getPasswordCriteria>) {
  const met = Object.values(criteria).filter(Boolean).length;
  if (met <= 2) return 'Weak';
  if (met === 3 || met === 4) return 'Medium';
  return 'Strong';
}

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const height = useHeaderHeight()
    const insets = useSafeAreaInsets();
  

  const { signUp, signIn } = useAuth();

  const handleAuth = async () => {
  if (!email || !password || (isSignUp && !fullName)) {
    Alert.alert('Error', 'Please fill in all fields');
    return;
  }

  if (isSignUp) {
    const criteria = getPasswordCriteria(password);
    const unmet: string[] = [];
    if (!criteria.length) unmet.push('At least 8 characters');
    if (!criteria.upper) unmet.push('An uppercase letter');
    if (!criteria.lower) unmet.push('A lowercase letter');
    if (!criteria.number) unmet.push('A number');
    if (!criteria.special) unmet.push('A special character');
    if (unmet.length > 0) {
      Alert.alert(
        'Password requirements not met',
        'Please include:\n' + unmet.map(c => `• ${c}`).join('\n')
      );
      return;
    }
  }

  setLoading(true);
  try {
    if (isSignUp) {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        // Supabase error: email already registered
        if (
          error.message?.toLowerCase().includes('user already registered') ||
          error.message?.toLowerCase().includes('email') && error.message?.toLowerCase().includes('exists')
        ) {
          Alert.alert('Email already exists', 'An account with this email already exists. Please sign in or use a different email.');
        } else {
          Alert.alert('Signup Error', error.message);
        }
        return;
      }
      // Success: prompt user to verify email
      Alert.alert(
        'Verify your email',
        'A verification link has been sent to your email address. Please check your inbox and verify your account before signing in.'
      );
      // Optionally, you may want to clear the form or switch to sign-in mode here
      setIsSignUp(false);
      setPassword('');
      setFullName('');
      // Do NOT navigate to the app yet
      return;
    }

    // Sign in flow
    const { error } = await signIn(email, password);
    if (error) {
      Alert.alert('Sign In Error', error.message);
    } else {
      router.replace('/exam-selection');
    }
  } catch (error) {
    Alert.alert('Error', 'An unexpected error occurred');
  } finally {
    setLoading(false);
  }
};

  const nextSlide = () => {
    if (currentSlide < onboardingSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setShowAuth(true);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };


  if (!showAuth) {
    const slide = onboardingSlides[currentSlide];
    
    return (
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={{...styles.container, paddingBottom: insets.bottom + vs(20)}}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.onboardingContainer}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Shield size={40} color="#F59E0B" strokeWidth={2} />
              </View>
              <Text style={styles.logoText}>The Cyber Crucible</Text>
            </View>

            <View style={styles.slideContent}>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
              <Text style={styles.slideDescription}>{slide.description}</Text>
            </View>

            {/* <View style={styles.illustrationContainer}>
              <Image
                source={{ uri: 'https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=400' }}
                style={styles.illustration}
                resizeMode="cover"
              />
            </View> */}

            <View style={styles.navigationContainer}>
              <View style={styles.dotsContainer}>
                {onboardingSlides.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      { backgroundColor: index === currentSlide ? '#F59E0B' : '#475569' }
                    ]}
                  />
                ))}
              </View>

              <View style={styles.buttonContainer}>
                {currentSlide > 0 && (
                  <TouchableOpacity style={styles.navButton} onPress={prevSlide}>
                    <ArrowLeft size={24} color="#94A3B8" />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.nextButton} onPress={nextSlide}>
                  <Text style={styles.nextButtonText}>
                    {currentSlide === onboardingSlides.length - 1 ? 'Get Started' : 'Next'}
                  </Text>
                  <ArrowRight size={20} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
<LinearGradient
  colors={['#0F172A', '#1E293B']}
  style={styles.container}
>
      <SafeAreaView style={styles.safeArea}>
        {/* <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          > */}
          <ScrollView contentContainerStyle={[styles.authContainer, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
          <KeyboardAvoidingView
      behavior="position"
      style={{ flex: 0.8 }}
      enabled>
            <View style={styles.logoContainer}>
              <TouchableOpacity style={styles.backButton} onPress={() => setShowAuth(false)}>
                <ArrowLeft size={24} color="#94A3B8" />
              </TouchableOpacity>
              <View style={styles.logo}>
                <Shield size={32} color="#F59E0B" strokeWidth={2} />
              </View>
              <Text style={styles.logoText}>The Cyber Crucible</Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.authTitle}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.authSubtitle}>
                {isSignUp 
                  ? 'Start your certification journey today' 
                  : 'Sign in to continue your studies'
                }
              </Text>

              {isSignUp && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#64748B"
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#64748B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
  <Text style={styles.inputLabel}>Password</Text>
  <View style={{ position: 'relative', justifyContent: 'center' }}>
    <TextInput
      style={[styles.input, { paddingRight: 40 }]}
      value={password}
      onChangeText={setPassword}
      placeholder="Enter your password"
      placeholderTextColor="#64748B"
      secureTextEntry={!showPassword}
    />
    <TouchableOpacity
      onPress={() => setShowPassword((prev) => !prev)}
      style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', height: '100%' }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {showPassword ? (
        <EyeOff size={22} color="#64748B" />
      ) : (
        <Eye size={22} color="#64748B" />
      )}
    </TouchableOpacity>
  </View>
  {/* Password criteria and strength for signup */}
  {isSignUp && password.length > 0 && (
  <View style={{ marginTop: hs(16), marginBottom: 2, flexDirection: 'row', alignItems: 'center' }}>
    {(() => {
      const criteria = getPasswordCriteria(password);
      const strength = getPasswordStrength(criteria);
      let barColor = '#ef4444';
      if (strength === 'Medium') barColor = '#f59e42';
      if (strength === 'Strong') barColor = '#22c55e';
      return (
        <>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#1e293b', overflow: 'hidden', marginRight: 10 }}>
            <View style={{ width: strength === 'Weak' ? '33%' : strength === 'Medium' ? '66%' : '100%', height: '100%', backgroundColor: barColor, borderRadius: 4 }} />
          </View>
          <Text style={{ fontWeight: 'bold', fontSize: 12, color: barColor, minWidth: 54, textAlign: 'right' }}>{strength}</Text>
        </>
      );
    })()}
  </View>
)}
</View>

              <TouchableOpacity
                style={[styles.authButton, loading && styles.authButtonDisabled]}
                onPress={handleAuth}
                disabled={loading}
              >
                <Text style={styles.authButtonText}>
                  {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => setIsSignUp(!isSignUp)}
              >
                <Text style={styles.switchButtonText}>
                  {isSignUp 
                    ? 'Already have an account? Sign In' 
                    : "Don't have an account? Sign Up"
                  }
                </Text>
              </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
          </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  onboardingContainer: {
    flex: 1,
    paddingHorizontal: hs(5),
    justifyContent: 'space-between',
  },
  authContainer: {
    flex: 1,
    paddingHorizontal: hs(5),
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: vs(80),
    marginBottom: vs(0),
  },
  backButton: {
    position: 'absolute',
    left: hs(0),
    top: vs(5),
    padding: hs(8),
  },
  logo: {
    width: hs(80),
    height: hs(80),
    backgroundColor: '#1E40AF',
    borderRadius: ms(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  logoText: {
    fontSize: ms(24),
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: hs(20),
  },
  slideTitle: {
    fontSize: ms(32),
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: vs(12),
    lineHeight: ms(40),
  },
  slideSubtitle: {
    fontSize: ms(18),
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: vs(16),
  },
  slideDescription: {
    fontSize: ms(16),
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: ms(24),
  },
  illustrationContainer: {
    alignItems: 'center',
    marginVertical: vs(40),
  },
  illustration: {
    width: hs(200),
    height: hs(200),
    borderRadius: ms(100),
    borderWidth: ms(4),
    borderColor: '#1E40AF',
  },
  navigationContainer: {
    alignItems: 'center',
    paddingBottom: vs(80),
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: vs(40),
  },
  dot: {
    width: hs(8),
    height: hs(8),
    borderRadius: ms(4),
    marginHorizontal: hs(4),
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
    // marginBottom: vs(30),
  },
  navButton: {
    padding: hs(16),
  },
  nextButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: hs(32),
    paddingVertical: vs(16),
    borderRadius: ms(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    flex: 1,
    justifyContent: 'center',
    marginLeft: hs(60),
  },
  nextButtonText: {
    color: '#0F172A',
    fontSize: ms(16),
    fontWeight: '600',
  },
  formContainer: {
    marginTop: vs(20),
    paddingHorizontal: hs(25),
  },
  authTitle: {
    fontSize: ms(28),
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: vs(8),
  },
  authSubtitle: {
    fontSize: ms(16),
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: vs(32),
  },
  inputContainer: {
    marginBottom: vs(20),
    paddingHorizontal: hs(5),
  },
  inputLabel: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: vs(8),
  },
  input: {
    backgroundColor: '#334155',
    borderWidth: ms(1),
    borderColor: '#475569',
    borderRadius: ms(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(14),
    fontSize: ms(16),
    color: '#F8FAFC',
  },
  authButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: vs(16),
    borderRadius: ms(12),
    marginTop: vs(24),
    marginBottom: vs(8), // Reduced to prevent button from being pushed off screen
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    color: '#0F172A',
    fontSize: ms(16),
    fontWeight: '600',
    textAlign: 'center',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: vs(16),
    marginBottom: vs(8), // Reduced to prevent from being off screen
  },
  switchButtonText: {
    color: '#94A3B8',
    fontSize: ms(14),
  },
});