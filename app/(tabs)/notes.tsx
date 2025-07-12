import SvgIcon from "@/components/svgIcon";
import { useExam } from '@/contexts/ExamContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Alert, Dimensions, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from 'react-native-svg';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function Notes(){
    const insets = useSafeAreaInsets();
    const [loading,setLoading] = useState(true);
    const { exam, subject } = useExam();
    const [resources,setResources] = useState<any[]>([]);
    const [files,setFiles] = useState<any[]>([]);

    useEffect(() => {
        const loadResourcesAndFiles = async () => {
          setLoading(true);
          const { data, error } = await supabase
            .from('file_resource_exams')
            .select(`
              *,
              file_resources (*)
            `)
            .eq('exam_id', exam.id);
      
          if (error) {
            console.error('Failed to load resources and files:', error);
            setLoading(false);
            return;
          }
      
          setResources(data); // original linking table
          setFiles(data.map((d: any) => d.file_resources)); // extract joined file_resources
          setLoading(false);
        };
      
        loadResourcesAndFiles();
      }, [exam]);
      
      function getFileExtension(fileName: string): string | null {
        const parts = fileName.split('.');
        if (parts.length > 1 && parts[parts.length - 1]) {
          return parts.pop()?.toLowerCase() || null;
        }
        return null;
      }
      
        
    // Handler to confirm before opening external link
    const handleOpenLink = (file: any) => {
        let url = '';
        if (file.resource_type === 'file') {
            url = `https://nvhsljphmjlzongmsvvn.supabase.co/storage/v1/object/public/notes/${file.file_name}`;
        } else {
            url = file.file_url;
        }
        Alert.alert(
            'Open external link?',
            'You are about to open an external link. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open', onPress: () => Linking.openURL(url) }
            ]
        );
    };
  if (loading) {
    return (
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={{...styles.safeArea,paddingBottom:vs(60) + (insets.bottom || 10)}}>
        <View style={styles.header}>
                    <Text style={styles.title}>Notes</Text>
                    <Text style={styles.subtitle}>Your Study Materials</Text>
                </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <SpinnerAnimation />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  } 
    return(
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
        <SafeAreaView style={{...styles.safeArea,paddingBottom:vs(60) + (insets.bottom || 10)}}>
                <View style={styles.header}>
                    <Text style={styles.title}>Notes</Text>
                    <Text style={styles.subtitle}>Your Study Materials</Text>
                </View>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {files.map((file: any) => (
    <TouchableOpacity
        key={file.id}
        onPress={() => handleOpenLink(file)}
    >
        <View style={styles.noteCard}>
            {file.resource_type === "file" && (
                <SvgIcon width={vs(50)} height={vs(50)} iconName={getFileExtension(file.file_name) || 'unknown'} />
            )}
            {file.resource_type === "youtube_link" && (
                <SvgIcon width={vs(55)} height={vs(55)} iconName='yt' />
            )}
            <View style={styles.noteTextContainer}>
                <Text style={styles.noteTitle}>{file.title}</Text>
                <Text style={styles.noteDescription}>{file.description}</Text>
            </View>
        </View>
    </TouchableOpacity>
))}
            </ScrollView>
        </SafeAreaView>
    </LinearGradient>
    )
}

const styles = StyleSheet.create({
  container: {
    width:'100%',
    paddingTop: 30,
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,

  },
  scrollView: {
    flex: 1,

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
  noteCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap:20
  },
  noteTextContainer: {
    width:'80%',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  noteDescription: {
    fontSize: 14,
    color: '#CBD5E1',
  },
})

function SpinnerAnimation() {
  const rotation = useSharedValue(0);
  useEffect(() => {
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