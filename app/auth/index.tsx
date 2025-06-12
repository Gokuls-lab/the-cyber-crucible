import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, ArrowLeft, ArrowRight } from 'lucide-react-native';

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

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showAuth, setShowAuth] = useState(false);

  const { signUp, signIn } = useAuth();

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !fullName)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = isSignUp 
        ? await signUp(email, password, fullName)
        : await signIn(email, password);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        // router.replace('/(tabs)');
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
        style={styles.container}
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

            <View style={styles.illustrationContainer}>
              <Image
                source={{ uri: 'https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=400' }}
                style={styles.illustration}
                resizeMode="cover"
              />
            </View>

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
        <ScrollView style={styles.authContainer} showsVerticalScrollIndicator={false}>
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
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#64748B"
                secureTextEntry
              />
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
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  authContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 5,
    padding: 8,
  },
  logo: {
    width: 80,
    height: 80,
    backgroundColor: '#1E40AF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40,
  },
  slideSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 24,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  illustration: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#1E40AF',
  },
  navigationContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  navButton: {
    padding: 16,
  },
  nextButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    marginLeft: 60,
  },
  nextButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    marginTop: 20,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#F8FAFC',
  },
  authButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 24,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 40,
  },
  switchButtonText: {
    color: '#94A3B8',
    fontSize: 14,
  },
});