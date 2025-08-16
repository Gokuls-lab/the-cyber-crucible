import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export const useQuizModes = () => {
  return useQuery({
    queryKey: ['quiz_modes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quiz_modes')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    staleTime: 1000 * 60 * 5, // cache is fresh for 5 mins
    cacheTime: 1000 * 60 * 30, // keep in cache for 30 mins
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
