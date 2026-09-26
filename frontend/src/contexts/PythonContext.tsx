/**
 * PythonContext - Global Python Bridge Provider
 * 
 * Ensures QWebChannel is initialized only once at the app level,
 * preventing multiple bridge connections that cause timeouts and conflicts.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { usePython } from '../hooks/usePython';

interface PythonContextType {
  bridge: any;
  isReady: boolean;
}

const PythonContext = createContext<PythonContextType | undefined>(undefined);

interface PythonProviderProps {
  children: ReactNode;
}

export const PythonProvider: React.FC<PythonProviderProps> = ({ children }) => {
  // Initialize bridge once at the top level
  const { bridge, isReady } = usePython();

  console.log('🔌 [PythonProvider] Bridge status:', { isReady, hasBridge: !!bridge });

  return (
    <PythonContext.Provider value={{ bridge, isReady }}>
      {children}
    </PythonContext.Provider>
  );
};

/**
 * Hook to consume the Python bridge from context
 * This replaces direct usePython() calls in components
 */
export const usePythonContext = () => {
  const context = useContext(PythonContext);
  
  if (context === undefined) {
    throw new Error('usePythonContext must be used within a PythonProvider');
  }
  
  return context;
};
