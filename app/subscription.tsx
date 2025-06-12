import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check, Crown } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

const SUBSCRIPTION_FEATURES = [
  'Access to all quiz modes',
  'Unlimited practice questions',
  'Detailed performance analytics',
  'Progress tracking across devices',
  'Ad-free experience',
  'Priority customer support',
  'Custom study plans',
  'Offline access',
];

const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$9.99',
    period: 'per month',
    popular: false,
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '$89.99',
    period: 'per year',
    popular: true,
    savings: 'Save 25%',
  },
];

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = React.useState('annual');

  const handleSubscribe = (planId: string) => {
    Alert.alert(
      'Confirm Subscription',
      'This will redirect you to complete the payment process.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // TODO: Implement payment processing
            Alert.alert('Success', 'Subscription activated successfully!');
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#F8FAFC" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Upgrade to Premium</Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.crownContainer}>
              <Crown size={40} color="#F59E0B" strokeWidth={2} />
            </View>
            <Text style={styles.heroTitle}>Unlock Your Full Potential</Text>
            <Text style={styles.heroSubtitle}>
              Get unlimited access to all features and accelerate your certification journey
            </Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            {SUBSCRIPTION_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.checkIcon}>
                  <Check size={16} color="#10B981" strokeWidth={2} />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Subscription Plans */}
          <View style={styles.plansContainer}>
            {SUBSCRIPTION_PLANS.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  selectedPlan === plan.id && styles.selectedPlan,
                  plan.popular && styles.popularPlan,
                ]}
                onPress={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Most Popular</Text>
                  </View>
                )}
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
                {plan.savings && (
                  <Text style={styles.savingsText}>{plan.savings}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={() => handleSubscribe(selectedPlan)}
          >
            <Text style={styles.subscribeButtonText}>
              Subscribe Now
            </Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By subscribing, you agree to our Terms of Service and Privacy Policy
          </Text>
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
    paddingTop: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    padding: 32,
  },
  crownContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#1E293B',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    padding: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#064E3B',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#F8FAFC',
  },
  plansContainer: {
    padding: 20,
    flexDirection: 'row',
    gap: 16,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#475569',
  },
  selectedPlan: {
    borderColor: '#F59E0B',
    backgroundColor: '#1E293B',
  },
  popularPlan: {
    borderColor: '#F59E0B',
  },
  popularBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  popularBadgeText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  priceContainer: {
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  planPeriod: {
    fontSize: 14,
    color: '#94A3B8',
  },
  savingsText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  subscribeButton: {
    backgroundColor: '#F59E0B',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  termsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
});