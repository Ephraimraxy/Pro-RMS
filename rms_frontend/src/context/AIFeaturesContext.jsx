import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../lib/api';

const AIFeaturesContext = createContext({ aiEnabled: true, refreshAI: () => {} });

export const useAIFeatures = () => useContext(AIFeaturesContext);

export const AIFeaturesProvider = ({ children }) => {
  // Default true — fail-open so AI works even before first save
  const [aiEnabled, setAiEnabled] = useState(true);

  const fetchSetting = useCallback(async () => {
    // Skip if not authenticated — avoids 401 → refresh → reload loop on login screen
    if (!localStorage.getItem('rms_token')) return;
    try {
      const res = await settingsAPI.get('ai_features_enabled');
      // Treat null/missing as enabled; only explicitly 'false' disables
      setAiEnabled(res?.value !== 'false');
    } catch {
      // Network error — keep current state
    }
  }, []);

  useEffect(() => {
    fetchSetting();
    // Poll every 15 s so changes made by admin propagate without a page reload
    const interval = setInterval(fetchSetting, 15000);
    return () => clearInterval(interval);
  }, [fetchSetting]);

  return (
    <AIFeaturesContext.Provider value={{ aiEnabled, refreshAI: fetchSetting }}>
      {children}
    </AIFeaturesContext.Provider>
  );
};
