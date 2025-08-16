
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function UpdateScreen() {
  const [latest, setLatest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  useEffect(() => {
    const fetchLatest = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('platform', platform)
        .order('version_code', { ascending: false })
        .limit(1)
        .single();
      if (error) setError(error.message);
      else setLatest(data || null);
      setLoading(false);
    };
    fetchLatest();
  }, [platform]);

  return (
    <LinearGradient colors={['#232526', '#1a1a2e']} style={styles.container}>
      <View style={styles.glassCard}>
      <Image source={require('@/assets/images/update.png')} style={styles.logo} />

        {loading ? (
          <ActivityIndicator color="#60a5fa" size="large" style={{marginTop: 32}} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : latest ? (
          <>
            <Text style={styles.title}>New update is Available</Text>
            <Text style={styles.versionLabel}>Version {latest.version_name}</Text>
            {latest.force_update ? (
              <Text style={styles.forceUpdateText}>This update is required to continue using the app.</Text>
            ) : (
              <Text style={styles.optionalUpdateText}>A new version is available! Update for the latest features and fixes.</Text>
            )}
            <ScrollView style={styles.notesBox}>
              <Text style={styles.notesTitle}>What's New</Text>
              <Text style={styles.notes}>{latest.release_notes || 'No release notes provided.'}</Text>
            </ScrollView>
            <View style={styles.btnContainer}>

            {latest.download_url ? (
                <TouchableOpacity style={styles.downloadBtn} onPress={() => Linking.openURL(latest.download_url)}>
                <Text style={styles.downloadText}>Update Now</Text>
              </TouchableOpacity>
            ) : null}

            {!latest.force_update && latest.download_url && (
                <TouchableOpacity style={{...styles.downloadBtn,backgroundColor:'rgba(255,255,255,0.10)'}} onPress={() => router.replace('/(tabs)')}>
                <Text style={styles.downloadText}>Update Later</Text>
              </TouchableOpacity>
            )}
            </View>
          </>
        ) : (
          <Text style={styles.error}>No update information found.</Text>
        )}
      </View>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: hs(12),
  },
  logo: {
    width: vs(250),
    height: vs(250),
    resizeMode: 'contain',
    marginBottom: vs(24),
    marginLeft:vs(-10),
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: hs(24),
    padding: hs(18),
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginTop: vs(40),
    marginBottom: vs(24),
    backdropFilter: 'blur(12px)', // web only
    alignItems: 'center',
  },
  title: {
    fontSize: ms(22, 0.7),
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1.2,
    marginBottom: vs(14),
    textAlign: 'center',
  },
  versionLabel: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: ms(16),
    marginBottom: vs(10),
    textAlign: 'center',
  },
  forceUpdateText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: ms(14),
    marginBottom: vs(10),
    textAlign: 'center',
  },
  optionalUpdateText: {
    color: '#60a5fa',
    fontWeight: '600',
    fontSize: ms(14),
    marginBottom: vs(10),
    textAlign: 'center',
  },
  notesBox: {
    backgroundColor: 'rgba(30,41,59,0.7)',
    borderRadius: hs(12),
    padding: hs(18),
    marginBottom: vs(16),
    width: '100%',
    height: '30%'
  },
  notesTitle: {
    color: '#a5b4fc',
    fontWeight: 'bold',
    marginBottom: vs(4),
    fontSize: ms(13),
  },
  notes: {
    color: '#f1f5f9',
    fontSize: ms(13),
    fontStyle: 'italic',
    marginBottom: vs(25),
  },
  downloadBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    marginTop: vs(10),
  },
  downloadText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: ms(15),
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  error: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: vs(24),
    fontSize: ms(15),
  },
  btnContainer: {
    flexDirection: 'row',
    gap: vs(20),
    width: '100%',
    justifyContent: 'center',
  },
}
)