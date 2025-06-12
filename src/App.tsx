import React, { useEffect, useState } from 'react';
import { StorageService } from './services/StorageService';
import { AuthProvider } from '../contexts/AuthContext';

// ...existing code...

function App() {
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  // Placeholder options, replace with real data source if available
  const examOptions: { id: string; name: string }[] = [
    { id: 'exam1', name: 'Exam 1' },
    { id: 'exam2', name: 'Exam 2' },
  ];
  const versionOptions: { id: string; name: string }[] = [
    { id: 'v1', name: 'Version 1' },
    { id: 'v2', name: 'Version 2' },
  ];

  // ...existing code...

  useEffect(() => {
    // Load saved selections when app starts
    const savedExam = StorageService.getSelectedExam();
    const savedVersion = StorageService.getSelectedVersion();
    
    if (savedExam) {
      setSelectedExam(savedExam);
    }
    if (savedVersion) {
      setSelectedVersion(savedVersion);
    }
  }, []);

  const handleExamChange = (examId: string) => {
    setSelectedExam(examId);
    StorageService.saveSelectedExam(examId);
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersion(versionId);
    StorageService.saveSelectedVersion(versionId);
  };

    return (
    <AuthProvider>
      <>
        <h1>Exam and Version Selector</h1>
      <div>
        <label htmlFor="exam-select">Select Exam:</label>
        <select
          id="exam-select"
          value={selectedExam || ''}
          onChange={(e) => handleExamChange(e.target.value)}
        >
          <option value="" disabled>
            -- Choose Exam --
          </option>
          {examOptions.map((exam: { id: string; name: string }) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="version-select">Select Version:</label>
        <select
          id="version-select"
          value={selectedVersion || ''}
          onChange={(e) => handleVersionChange(e.target.value)}
        >
          <option value="" disabled>
            -- Choose Version --
          </option>
          {versionOptions.map((ver: { id: string; name: string }) => (
            <option key={ver.id} value={ver.id}>
              {ver.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 20 }}>
        <strong>Selected Exam:</strong> {selectedExam || 'None'}
        <br />
        <strong>Selected Version:</strong> {selectedVersion || 'None'}
      </div>
      </>
    </AuthProvider>
  );
}
