import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://nvhsljphmjlzongmsvvn.supabase.co";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHNsanBobWpsem9uZ21zdnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNDkzNDksImV4cCI6MjA2NDkyNTM0OX0.WUdKh-scq-FzO09a39EgjE0mKPyClTtgCdb7b3Z0zTA";
if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('[supabase.ts] Using fallback Supabase URL or anon key! Check your production environment variables.');
}
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
        