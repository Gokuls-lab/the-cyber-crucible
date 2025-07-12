import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ActivityIndicator } from 'react-native';

import { Dimensions } from 'react-native';
// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;
export default function SplashScreen({ onFinish, backgroundColor = '#050d18' }: { onFinish?: () => void; backgroundColor?: string }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (onFinish) {
      timer = setTimeout(onFinish, 1800); // Show splash for 1.8 seconds
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <View style={[styles.container, { backgroundColor }]}> 
      <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} />
      <Image source={require('@/assets/images/slogan.jpeg')} style={styles.slogan} />
      <ActivityIndicator size="large" color="#fff" style={{ marginTop: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: vs(150),
    height: vs(150),
    resizeMode: 'contain',
    marginBottom: vs(24),
    marginLeft:vs(-10),
  },
  slogan: {
    width: vs(220),
    height: vs(60),
    marginLeft:vs(10),
    resizeMode: 'contain',
  },
});
