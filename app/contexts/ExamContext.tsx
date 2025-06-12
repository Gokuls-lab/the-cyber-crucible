import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface ExamContextType {
  exam: any;
  setExam: (exam: any) => void;
  subject: any;
  setSubject: (subject: any) => void;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

export function ExamProvider({ children }: { children: ReactNode }) {
  const [exam, setExamState] = useState<any>(null);
  const [subject, setSubject] = useState<any>(null);

  // Load exam from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const storedExam = await AsyncStorage.getItem('selectedExam');
        if (storedExam) {
          setExamState(JSON.parse(storedExam));
        }
      } catch (e) {
        // handle error (optional)
      }
    })();
  }, []);

  // Save exam to storage
  const setExam = (exam: any) => {
    setExamState(exam);
    if (exam) {
      AsyncStorage.setItem('selectedExam', JSON.stringify(exam));
    } else {
      AsyncStorage.removeItem('selectedExam');
    }
  };

  return (
    <ExamContext.Provider value={{ exam, setExam, subject, setSubject }}>
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  const context = useContext(ExamContext);
  if (!context) throw new Error('useExam must be used within an ExamProvider');
  return context;
} 