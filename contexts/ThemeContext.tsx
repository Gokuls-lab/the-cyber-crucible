import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
    background: string;
    card: string;
    text: string;
    subText: string;
    border: string;
    primary: string;
    secondary: string;
    tint: string;
    success: string;
    error: string;
    warning: string;
    inputBg: string;
    overlay: string;
    gradientStart: string;
    gradientEnd: string;
}

const lightColors: ThemeColors = {
    background: '#F8F9FA', // Off-white
    card: '#FFFFFF',
    text: '#09090B',
    subText: '#52525B',
    border: '#E4E4E7',
    primary: '#F59E0B',
    secondary: '#3B82F6',
    tint: '#F59E0B',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    inputBg: '#F1F5F9',
    overlay: 'rgba(0,0,0,0.5)',
    gradientStart: '#FFFFFF', // Light gradient
    gradientEnd: '#F1F5F9'
};

const darkColors: ThemeColors = {
    background: '#000000', // Pure Black
    card: '#121212', // Material Dark
    text: '#FAFAFA',
    subText: '#A1A1AA',
    border: '#27272A',
    primary: '#F59E0B',
    secondary: '#3B82F6',
    tint: '#F59E0B',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    inputBg: '#18181B',
    overlay: 'rgba(0,0,0,0.7)',
    gradientStart: '#18181B', // Dark gradient for headers etc
    gradientEnd: '#000000'
};

interface ThemeContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
    colors: ThemeColors;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    themeMode: 'system',
    setThemeMode: () => { },
    toggleTheme: () => { },
    colors: lightColors,
    isDark: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeMode] = useState<ThemeMode>('system');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const storedTheme = await AsyncStorage.getItem('themeMode');
            if (storedTheme) {
                setThemeMode(storedTheme as ThemeMode);
            }
        } catch (e) {
            console.log('Failed to load theme', e);
        }
    };

    const saveTheme = async (mode: ThemeMode) => {
        try {
            await AsyncStorage.setItem('themeMode', mode);
            setThemeMode(mode);
        } catch (e) {
            console.log('Failed to save theme', e);
        }
    };

    const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
    const colors = isDark ? darkColors : lightColors;

    const toggleTheme = () => {
        const nextMode = isDark ? 'light' : 'dark';
        saveTheme(nextMode);
    };

    return (
        <ThemeContext.Provider value={{ themeMode, setThemeMode: saveTheme, toggleTheme, colors, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};


export const useTheme = () => useContext(ThemeContext);

