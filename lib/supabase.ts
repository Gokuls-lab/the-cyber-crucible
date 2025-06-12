import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseUrl = "https://nvhsljphmjlzongmsvvn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHNsanBobWpsem9uZ21zdnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNDkzNDksImV4cCI6MjA2NDkyNTM0OX0.WUdKh-scq-FzO09a39EgjE0mKPyClTtgCdb7b3Z0zTA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});