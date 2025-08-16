import { Tabs } from 'expo-router';
import {
  ChartBar as BarChart3,
  BookOpen,
  History,
  Home,
  Settings,
} from 'lucide-react-native';
import React from 'react';
import {
  Dimensions,
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


export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: 'rgba(30, 41, 59, 0.98)',
          borderTopWidth: 0,
          height: vs(60) + (insets.bottom || 10),
          paddingBottom: insets.bottom + vs(20),
          paddingTop: vs(12),
          marginHorizontal: 10,
          marginBottom: hs(5),
          borderRadius: 20,
          position: 'absolute',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: ms(12),
          fontWeight: '600',
          textTransform: 'capitalize',
        },
        tabBarIconStyle: {
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ size, color }) => (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: vs(70),
                height: vs(70),
                borderRadius: vs(70),
                backgroundColor: color==='#F59E0B'? '#F59E0B' : 'transparent',
                alignSelf: 'center',
              }}
            >
              <BookOpen
                size={size}
                color={color==='#F59E0B'? '#FFF' : '#94A3B8'}
                strokeWidth={2}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ size, color }) => (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: vs(70),
                height: vs(70),
                borderRadius: vs(70),
                backgroundColor: color==='#F59E0B'? '#F59E0B' : 'transparent',
                alignSelf: 'center',
              }}
            >
              <BarChart3
                size={size}
                color={color==='#F59E0B'? '#FFF' : '#94A3B8'}
                strokeWidth={2}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: vs(70),
                height: vs(70),
                borderRadius: vs(70),
                backgroundColor: color==='#F59E0B'? '#F59E0B' : 'transparent',
                alignSelf: 'center',
              }}
            >
              <Home
                size={size}
                color={color==='#F59E0B'? '#FFF' : '#94A3B8'}
                strokeWidth={2}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ size, color }) => (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: vs(70),
                height: vs(70),
                borderRadius: vs(70),
                backgroundColor: color==='#F59E0B'? '#F59E0B' : 'transparent',
                alignSelf: 'center',
              }}
            >
              <History
                size={size}
                color={color==='#F59E0B'? '#FFF' : '#94A3B8'}
                strokeWidth={2}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: vs(70),
                height: vs(70),
                borderRadius: vs(70),
                backgroundColor: color==='#F59E0B'? '#F59E0B' : 'transparent',
                alignSelf: 'center',
              }}
            >
              <Settings
                size={size}
                color={color==='#F59E0B'? '#FFF' : '#94A3B8'}
                strokeWidth={2}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
