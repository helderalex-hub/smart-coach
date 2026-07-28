import React, { createContext, useContext, useState } from "react";
import { Language, LANGUAGES, LanguageInfo, translations } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  langInfo: LanguageInfo;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("aetheris_language") as Language;
    if (saved && LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
    return "pt";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("aetheris_language", lang);
  };

  const langInfo = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const t = (key: string, fallback?: string): string => {
    const dict = (translations as any)[language];
    if (dict && dict[key]) {
      return dict[key];
    }
    const defaultDict = (translations as any)["pt"];
    if (defaultDict && defaultDict[key]) {
      return defaultDict[key];
    }
    return fallback !== undefined ? fallback : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, langInfo, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
