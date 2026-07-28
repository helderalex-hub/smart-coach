import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { LANGUAGES, Language } from "../i18n/translations";
import { Globe, ChevronDown, Check } from "lucide-react";

export default function LanguageSelector() {
  const { language, setLanguage, langInfo } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left z-[2050]" ref={dropdownRef} id="language-selector">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-cyan-500/40 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer group shadow-sm"
        title="Selecione o Idioma / Select Language"
      >
        <span className="text-base sm:text-lg leading-none select-none">{langInfo.flag}</span>
        <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider group-hover:text-cyan-400 transition-colors">
          {langInfo.code}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-cyan-400" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-black/95 border border-white/10 shadow-2xl backdrop-blur-xl py-1.5 z-[2100] animate-fade-in font-mono">
          <div className="px-3 py-1.5 border-b border-white/10 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-cyan-400" /> Idioma / Language
          </div>

          <div className="flex flex-col gap-0.5 px-1">
            {LANGUAGES.map((item) => {
              const isSelected = item.code === language;
              return (
                <button
                  key={item.code}
                  onClick={() => {
                    setLanguage(item.code as Language);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none select-none">{item.flag}</span>
                    <span>{item.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
