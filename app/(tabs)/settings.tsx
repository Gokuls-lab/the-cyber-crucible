import React from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bell, Calendar, ChevronRight, Crown, CircleHelp as HelpCircle, LogOut, Mail, Shield, Trash2, User } from 'lucide-react-native';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { exam } = useExam();
  const [notifications, setNotifications] = React.useState(true);
  const [soundEffects, setSoundEffects] = React.useState(true);
  const [dailyReminders, setDailyReminders] = React.useState(true);
  const NOTIFICATIONS_KEY = 'notifications_enabled';
  const SOUND_KEY = 'sound_effects_enabled';
  const REMINDER_KEY = 'daily_reminders_enabled';

  React.useEffect(() => {
    // Load persisted settings
    (async () => {
      const notif = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      const sound = await AsyncStorage.getItem(SOUND_KEY);
      const reminder = await AsyncStorage.getItem(REMINDER_KEY);
      if (notif !== null) setNotifications(notif === 'true');
      if (sound !== null) setSoundEffects(sound === 'true');
      if (reminder !== null) setDailyReminders(reminder === 'true');
    })();
  }, []);

  React.useEffect(() => {
    AsyncStorage.setItem(NOTIFICATIONS_KEY, notifications.toString());
    if (notifications) {
      Notifications.requestPermissionsAsync();
    } else {
      Notifications.cancelAllScheduledNotificationsAsync();
    }
  }, [notifications]);

  React.useEffect(() => {
    AsyncStorage.setItem(SOUND_KEY, soundEffects.toString());
    // Use soundEffects state elsewhere in app to mute/unmute
  }, [soundEffects]);

  React.useEffect(() => {
    AsyncStorage.setItem(REMINDER_KEY, dailyReminders.toString());
    if (dailyReminders) {
      // Schedule daily reminder at 8am
      Notifications.cancelAllScheduledNotificationsAsync();
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Study Reminder',
          body: 'Time to practice on Cyber Crucible!',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: 8,
          minute: 0,
          repeats: true,
        },
      });
    } else {
      Notifications.cancelAllScheduledNotificationsAsync();
    }
  }, [dailyReminders]);

  // Handlers for support links
  const handleHelp = () => {
    router.push('/help');
  };
  const handleContact = () => {
    Linking.openURL('mailto:support@thecybercruciora.com');
  };
  const handlePrivacy = () => {
    WebBrowser.openBrowserAsync('https://thecybercruciora.com/privacy');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const handleUpgrade = () => {
    Alert.alert(
      'Upgrade to Premium',
      'Unlock all quiz modes, detailed analytics, and unlimited practice questions.',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Upgrade Now', onPress: () => router.push('/subscription') },
      ]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      "Reset All Progress",
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

              // Note: user_progress is not exam-specific, so we might not want to reset it here
              // or we need a more granular progress tracking per exam.
              // For now, we'll leave it as is, but it's a point for future improvement.
              // Delete user_progress
              await supabase.rpc('update_exam_stage', {
                              uid: user?.id,
                              exam_id: exam.id,
                              new_stage: 0,
                            });

              ToastAndroid.show('All progress has been reset successfully', ToastAndroid.SHORT);
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to reset data. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Customize your experience</Text>
          </View>

          {/* Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.profileCard}>
              <View style={styles.profileInfo}>
                <View style={styles.avatar}>
                  <User size={24} color="#F8FAFC" strokeWidth={2} />
                </View>
                <View style={styles.profileText}>
                  <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
                  <Text style={styles.profileEmail}>{user?.email}</Text>
                  <View style={styles.subscriptionBadge}>
                    <Crown size={14} color={user?.subscription_status === 'premium' ? '#F59E0B' : '#64748B'} strokeWidth={2} />
                    <Text style={[
                      styles.subscriptionText,
                      { color: user?.subscription_status === 'premium' ? '#F59E0B' : '#64748B' }
                    ]}>
                      {user?.subscription_status === 'premium' ? 'Premium' : 'Free'}
                    </Text>
                  </View>
                </View>
              </View>
              {/* <TouchableOpacity onPress={() => router.push('/profile')}>
                <ChevronRight size={20} color="#94A3B8" strokeWidth={2} />
              </TouchableOpacity> */}
            </View>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/exam-selection')}>
              <View style={styles.menuItemInfo}>
                <Text style={styles.menuItemText}>Course Selection</Text>
              </View>
              <ChevronRight size={20} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Subscription Section */}
          {user?.subscription_status !== 'premium' && (
            <View style={styles.section}>
              <TouchableOpacity style={styles.premiumCard} onPress={handleUpgrade}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.premiumGradient}
                >
                  <Crown size={24} color="#0F172A" strokeWidth={2} />
                  <View style={styles.premiumText}>
                    <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                    <Text style={styles.premiumSubtitle}>Unlock all features and quiz modes</Text>
                  </View>
                  <ChevronRight size={20} color="#0F172A" strokeWidth={2} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Bell size={20} color="#F8FAFC" strokeWidth={2} />
                <Text style={styles.settingText}>Push Notifications</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#475569', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Calendar size={20} color="#F8FAFC" strokeWidth={2} />
                <Text style={styles.settingText}>Daily Study Reminders</Text>
              </View>
              <Switch
                value={dailyReminders}
                onValueChange={setDailyReminders}
                trackColor={{ false: '#475569', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>
            {/* <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Volume2 size={20} color="#F8FAFC" strokeWidth={2} />
                <Text style={styles.settingText}>Sound Effects</Text>
              </View>
              <Switch
                value={soundEffects}
                onValueChange={setSoundEffects}
                trackColor={{ false: '#475569', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View> */}
          </View>

          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
              <View style={styles.menuItemInfo}>
                <HelpCircle size={20} color="#F8FAFC" strokeWidth={2} />
                <Text style={styles.menuItemText}>Help & FAQ</Text>
              </View>
              <ChevronRight size={20} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleContact}>
              <View style={styles.menuItemInfo}>
                <Mail size={20} color="#F8FAFC" strokeWidth={2} />
                <Text style={styles.menuItemText}>Contact Support</Text>
              </View>
              <ChevronRight size={20} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handlePrivacy}>
              <View style={styles.menuItemInfo}>
                <Shield size={20} color="#F8FAFC" strokeWidth={2} />
                <Text style={styles.menuItemText}>Privacy Policy</Text>
              </View>
              <ChevronRight size={20} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity style={[styles.menuItem, styles.dangerItem]} onPress={handleResetData}>
              <View style={styles.menuItemInfo}>
                <Trash2 size={20} color="#EF4444" strokeWidth={2} />
                <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Reset All Progress</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
              <View style={styles.menuItemInfo}>
                <LogOut size={20} color="#EF4444" strokeWidth={2} />
                <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.appInfo}>
            <Text style={styles.appVersion}>The Cyber Cruciora v1.0.0</Text>
            <Text style={styles.appCopyright}>© 2025 Cyber Learning Solutions</Text>
          </View>
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
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: '#334155',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subscriptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  premiumCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  premiumText: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 14,
    color: '#1E293B',
  },
  settingItem: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  menuItem: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#475569',
    marginTop: 12,
  },
  menuItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  signOutItem: {
    borderColor: '#7F1D1D',
    backgroundColor: '#1E293B',
  },
  dangerItem: {
    borderColor: '#7F1D1D',
    backgroundColor: '#1E293B',
    marginBottom: 12,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  appVersion: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: '#64748B',
  },
});