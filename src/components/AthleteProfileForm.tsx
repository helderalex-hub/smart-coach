import React from "react";
import { 
  Heart, 
  User, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Compass, 
  Dumbbell, 
  ShieldAlert, 
  Sparkles, 
  Check, 
  Info,
  Activity
} from "lucide-react";
import { AthleteProfile } from "../coach/types";
import { useLanguage } from "../i18n/LanguageContext";

interface AthleteProfileFormProps {
  athleteProfile: AthleteProfile;
  setAthleteProfile: (profile: AthleteProfile) => void;
  profileSaved: boolean;
  setProfileSaved: (saved: boolean) => void;
  showValidationErrors?: boolean;
  setShowValidationErrors?: (show: boolean) => void;
}

export default function AthleteProfileForm({
  athleteProfile,
  setAthleteProfile,
  profileSaved,
  setProfileSaved,
  showValidationErrors,
  setShowValidationErrors
}: AthleteProfileFormProps) {
  const { t } = useLanguage();

  const [localShowErrors, setLocalShowErrors] = React.useState(false);
  const showErrors = showValidationErrors !== undefined ? showValidationErrors : localShowErrors;
  const setShowErrors = setShowValidationErrors !== undefined ? setShowValidationErrors : setLocalShowErrors;

  const [showScientificMethodology, setShowScientificMethodology] = React.useState(false);

  // Validate fields
  const isAgeInvalid = showErrors && (!athleteProfile.age || athleteProfile.age < 1 || athleteProfile.age > 120);
  const isGenderInvalid = showErrors && !athleteProfile.gender;
  const isWeightInvalid = showErrors && athleteProfile.weight !== undefined && !isNaN(Number(athleteProfile.weight)) && (Number(athleteProfile.weight) < 30 || Number(athleteProfile.weight) > 250);
  const isHeightCmInvalid = showErrors && (!athleteProfile.heightCm || athleteProfile.heightCm < 100 || athleteProfile.heightCm > 250);
  const isObjectiveInvalid = showErrors && !athleteProfile.objective;
  const isAvailableTimeInvalid = showErrors && !athleteProfile.availableTimePerWorkout;
  const isSportsHistoryInvalid = showErrors && !athleteProfile.sportsHistory?.trim();
  const isLimitationsInvalid = showErrors && !athleteProfile.limitations?.trim();

  const getInputClassName = (isInvalid: boolean, extraClasses: string = "") => {
    return `w-full bg-white/5 border rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none transition-all duration-200 ${
      isInvalid 
        ? "border-red-500 bg-red-500/5 focus:border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]" 
        : "border-white/10 focus:border-brand-neon focus:shadow-[0_0_8px_rgba(34,211,238,0.2)]"
    } ${extraClasses}`;
  };

  const getSelectClassName = (isInvalid: boolean, extraClasses: string = "") => {
    return `w-full bg-neutral-900 border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-all duration-200 ${
      isInvalid 
        ? "border-red-500 bg-red-500/5 focus:border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]" 
        : "border-white/10 focus:border-brand-neon focus:shadow-[0_0_8px_rgba(34,211,238,0.25)]"
    } ${extraClasses}`;
  };

  const getTextareaClassName = (isInvalid: boolean, extraClasses: string = "") => {
    return `w-full bg-white/5 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all duration-200 leading-relaxed ${
      isInvalid 
        ? "border-red-500 bg-red-500/5 focus:border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]" 
        : "border-white/10 focus:border-brand-neon focus:shadow-[0_0_8px_rgba(34,211,238,0.2)]"
    } ${extraClasses}`;
  };

  // Calculate Heart Rate Zones based on Karvonen formula (Scientific Definition)
  const restHr = parseInt(athleteProfile.restingHeartRate as string) || 60;
  const maxHr = parseInt(athleteProfile.maxHeartRate as string) || 190;
  const hrR = maxHr - restHr;

  const z1Min = Math.round(restHr + hrR * 0.50);
  const z1Max = Math.round(restHr + hrR * 0.60);
  const z2Min = Math.round(restHr + hrR * 0.60);
  const z2Max = Math.round(restHr + hrR * 0.70);
  const z3Min = Math.round(restHr + hrR * 0.70);
  const z3Max = Math.round(restHr + hrR * 0.80);
  const z4Min = Math.round(restHr + hrR * 0.80);
  const z4Max = Math.round(restHr + hrR * 0.90);
  const z5Min = Math.round(restHr + hrR * 0.90);
  const z5Max = maxHr;

  const getHeartRateZones = () => {
    return [
      { name: "Zona 1 (Regenerativo)", range: `${z1Min} - ${z1Max} bpm`, desc: "Recuperação ativa, regeneração pós-treino e metabolismo de gorduras inicial.", color: "border-teal-500/35 text-teal-400 bg-teal-500/5" },
      { name: "Zona 2 (Base Aeróbica / Lipólise)", range: `${z2Min} - ${z2Max} bpm`, desc: "Estímulo mitocondrial, aumento da capilarização e queima de gordura ideal.", color: "border-blue-500/35 text-blue-400 bg-blue-500/5" },
      { name: "Zona 3 (Tempo / Aeróbico Intensivo)", range: `${z3Min} - ${z3Max} bpm`, desc: "Resistência aeróbica geral, capilarização e ritmo confortável de prova.", color: "border-indigo-500/35 text-indigo-400 bg-indigo-500/5" },
      { name: "Zona 4 (Limiar de Lactato)", range: `${z4Min} - ${z4Max} bpm`, desc: "Ponto de acúmulo de ácido lático, aumento da tolerância à fadiga muscular.", color: "border-orange-500/35 text-orange-400 bg-orange-500/5" },
      { name: "Zona 5 (VO2 Máximo / Potência)", range: `${z5Min} - ${z5Max} bpm`, desc: "Capacidade cardiorrespiratória máxima, velocidade e explosão.", color: "border-red-500/35 text-red-400 bg-red-500/5" },
    ];
  };

  const handleInputChange = (field: keyof AthleteProfile, value: any) => {
    setAthleteProfile({
      ...athleteProfile,
      [field]: value
    });
    setProfileSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const isFormValid = 
      athleteProfile.age && 
      athleteProfile.gender && 
      athleteProfile.weight && 
      athleteProfile.heightCm && 
      athleteProfile.objective && 
      athleteProfile.availableTimePerWorkout && 
      athleteProfile.sportsHistory?.trim() && 
      athleteProfile.limitations?.trim();

    if (!isFormValid) {
      setShowErrors(true);
      return;
    }

    setProfileSaved(true);
    setShowErrors(false);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const hrZones = getHeartRateZones();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="atleta-onboarding">
      
      {/* LEFT COLUMN: Comprehensive Onboarding Form (7 columns) */}
      <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-6">
        <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-neon/15 text-brand-neon flex items-center justify-center border border-brand-neon/20">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-display uppercase tracking-wider text-white">{t("profileTitle", "Conhecendo o Atleta")}</h2>
                <p className="text-xs text-slate-400 font-sans mt-0.5">{t("athleteProfile", "Perfil Biométrico e Fisiológico do Atleta")}</p>
              </div>
            </div>
            
            <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 uppercase tracking-widest bg-cyan-950/45 border border-cyan-500/20 px-2 py-0.5 rounded">
              Aetheris Engine
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Seção 1: Dados Biométricos & Fisiológicos */}
            <div>
              <h3 className="text-xs font-bold text-brand-neon tracking-widest uppercase font-mono mb-3 flex items-center gap-1.5">
                <span>01 /</span> {t("profileTitle", "Dados Biométricos & Fisiológicos")}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("age", "Idade")} <span className="text-red-500 font-bold ml-1">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    value={athleteProfile.age}
                    onChange={(e) => handleInputChange("age", parseInt(e.target.value) || "")}
                    className={getInputClassName(isAgeInvalid)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("gender", "Gênero")} <span className="text-red-500 font-bold ml-1">*</span>
                  </label>
                  <select
                    required
                    value={athleteProfile.gender || "Masculino"}
                    onChange={(e) => handleInputChange("gender", e.target.value)}
                    className={getSelectClassName(isGenderInvalid)}
                  >
                    <option value="Masculino">{t("male", "Masculino")}</option>
                    <option value="Feminino">{t("female", "Feminino")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("weight", "Peso Atual (kg)")} <span className="text-slate-500 text-[9px] font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="30"
                      max="250"
                      placeholder="Ex: 75"
                      value={athleteProfile.weight}
                      onChange={(e) => handleInputChange("weight", parseFloat(e.target.value) || "")}
                      className={getInputClassName(isWeightInvalid, "pr-8")}
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 text-xs font-mono">kg</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("weightGoal", "Peso Desejado (kg)")}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="30"
                      max="250"
                      value={athleteProfile.weightGoalKg || ""}
                      onChange={(e) => handleInputChange("weightGoalKg", e.target.value)}
                      className={getInputClassName(false, "pr-8")}
                      placeholder="Ex: 85"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 text-xs font-mono">kg</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("height", "Altura (cm)")} <span className="text-red-500 font-bold ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="100"
                      max="250"
                      value={athleteProfile.heightCm}
                      onChange={(e) => handleInputChange("heightCm", parseInt(e.target.value) || "")}
                      className={getInputClassName(isHeightCmInvalid, "pr-8")}
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 text-xs font-mono">cm</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("restHr", "FC de Repouso (BPM)")}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="30"
                      max="120"
                      value={athleteProfile.restingHeartRate}
                      onChange={(e) => handleInputChange("restingHeartRate", parseInt(e.target.value) || "")}
                      className={getInputClassName(false, "pr-10")}
                      placeholder="Garmin FIT / Apple Health"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 text-xs font-mono">bpm</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("maxHr", "FC Máxima (BPM)")}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="100"
                      max="220"
                      value={athleteProfile.maxHeartRate}
                      onChange={(e) => handleInputChange("maxHeartRate", parseInt(e.target.value) || "")}
                      className={getInputClassName(false, "pr-10")}
                      placeholder="Importada do Garmin quando disponível"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 text-xs font-mono">bpm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 2: Objetivo & Disponibilidade de Treino */}
            <div>
              <h3 className="text-xs font-bold text-brand-neon tracking-widest uppercase font-mono mb-3 flex items-center gap-1.5">
                <span>02 /</span> Objetivo & Disponibilidade de Treino
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Objetivo Principal <span className="text-red-500 font-bold ml-1">*</span>
                  </label>
                  <select
                    required
                    value={athleteProfile.objective}
                    onChange={(e) => handleInputChange("objective", e.target.value)}
                    className={getSelectClassName(isObjectiveInvalid)}
                  >
                    <option value="general_fitness">Condicionamento Físico Geral</option>
                    <option value="weight_loss">Perda de Peso e Saúde</option>
                    <option value="race_5k_10k">Performance em Provas (5K a 10K)</option>
                    <option value="half_marathon">Meia Maratona (21K)</option>
                    <option value="marathon">Maratona Completa (42K)</option>
                    <option value="ultra_trail">Ultra-maratona e Trail Running</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Tempo Disponível por Treino <span className="text-red-500 font-bold ml-1">*</span>
                  </label>
                  <select
                    required
                    value={athleteProfile.availableTimePerWorkout || "90 minutos"}
                    onChange={(e) => handleInputChange("availableTimePerWorkout", e.target.value)}
                    className={getSelectClassName(isAvailableTimeInvalid)}
                  >
                    {Array.from({ length: (240 - 15) / 5 + 1 }, (_, i) => {
                      const minutes = 15 + i * 5;
                      const hours = Math.floor(minutes / 60);
                      const mins = minutes % 60;
                      const label = hours > 0 
                        ? `${minutes} minutos (${hours}h${mins > 0 ? mins : ''})`
                        : `${minutes} minutos`;
                      const val = `${minutes} minutos`;
                      return (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Days of week availability Yes/No */}
              <div className="mt-4">
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">Disponibilidade por Dia da Semana (Sim ou Não)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"].map((day) => {
                    const availableDays = athleteProfile.availableDays || ["Segunda-feira", "Terça-feira", "Quarta-feira", "Sexta-feira", "Sábado", "Domingo"];
                    const isAvailable = availableDays.includes(day);
                    return (
                      <div key={day} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-between gap-2 text-center">
                        <span className="text-[10px] font-mono font-bold text-slate-300 leading-none">{day.split("-")[0]}</span>
                        <div className="flex gap-1 w-full mt-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAvailable) {
                                const newDays = [...availableDays, day];
                                setAthleteProfile({
                                  ...athleteProfile,
                                  availableDays: newDays,
                                  weeklyTrainingDays: newDays.length
                                });
                                setProfileSaved(false);
                              }
                            }}
                            className={`flex-1 py-1 rounded text-[10px] font-mono font-extrabold uppercase transition-all ${
                              isAvailable 
                                ? "bg-brand-neon text-brand-dark shadow-sm" 
                                : "bg-white/5 text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isAvailable) {
                                const newDays = availableDays.filter(d => d !== day);
                                setAthleteProfile({
                                  ...athleteProfile,
                                  availableDays: newDays,
                                  weeklyTrainingDays: newDays.length
                                });
                                setProfileSaved(false);
                              }
                            }}
                            className={`flex-1 py-1 rounded text-[10px] font-mono font-extrabold uppercase transition-all ${
                              !isAvailable 
                                ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                                : "bg-white/5 text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            Não
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">Dia do Longão Alvo</label>
                <select
                  value={athleteProfile.longRunDay || "Domingo"}
                  onChange={(e) => handleInputChange("longRunDay", e.target.value)}
                  className="w-full sm:w-1/2 bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-neon transition-colors"
                >
                  {["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"].map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seção 3: Histórico de Corrida & Performance Recente */}
            <div>
              <h3 className="text-xs font-bold text-brand-neon tracking-widest uppercase font-mono mb-3 flex items-center gap-1.5">
                <span>03 /</span> Histórico Esportivo & Performance Recente
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Histórico de Corrida ou Esportivo <span className="text-red-500 font-bold ml-1">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={athleteProfile.sportsHistory || ""}
                    onChange={(e) => handleInputChange("sportsHistory", e.target.value)}
                    className={getTextareaClassName(isSportsHistoryInvalid)}
                    placeholder={"Conte sua experiência.\nEx.:\n• Comecei a correr em 2022.\n• Faço musculação 2x/semana.\n• Corri minha primeira meia maratona em abril."}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Maior Distância nos Últimos 3 Meses
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.longestDistance3Months || ""}
                      onChange={(e) => handleInputChange("longestDistance3Months", e.target.value)}
                      className={getInputClassName(false)}
                      placeholder="Ex: 21 km ou 10 km"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Pace ou Tempo Recente nos Últimos 3 Meses
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.recentPaceOrTime || ""}
                      onChange={(e) => handleInputChange("recentPaceOrTime", e.target.value)}
                      className={getInputClassName(false)}
                      placeholder="Ex: 5:00/km em treino ou 10k em 50min"
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 p-3 rounded-lg flex gap-2.5 items-start">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    <strong>Nota sobre recência:</strong> Consideramos &ldquo;recente&rdquo; aquilo que aconteceu nos últimos 3 meses. Se você não tiver dados desse período, pode informar dados mais antigos e indicar há quanto tempo aconteceram.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">Nível Prático</label>
                    <select
                      value={athleteProfile.fitnessLevel}
                      onChange={(e) => handleInputChange("fitnessLevel", e.target.value)}
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-neon transition-colors"
                    >
                      <option value="beginner">Iniciante</option>
                      <option value="intermediate">Intermediário</option>
                      <option value="advanced">Avançado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Recorde 5K
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.best5k}
                      onChange={(e) => handleInputChange("best5k", e.target.value)}
                      className={getInputClassName(false, "font-mono")}
                      placeholder="Ex: 20:10"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Recorde 10K
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.best10k}
                      onChange={(e) => handleInputChange("best10k", e.target.value)}
                      className={getInputClassName(false, "font-mono")}
                      placeholder="Ex: 42:10"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">Pace Confortável Atual</label>
                    <input
                      type="text"
                      value={athleteProfile.estimatedPaceCurrent}
                      onChange={(e) => handleInputChange("estimatedPaceCurrent", e.target.value)}
                      className={getInputClassName(false, "font-mono")}
                      placeholder="Ex: 6:20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 4: Segurança Clinica & Equipamento de Força */}
            <div>
              <h3 className="text-xs font-bold text-brand-neon tracking-widest uppercase font-mono mb-3 flex items-center gap-1.5">
                <span>04 /</span> Segurança Clínica & Equipamentos
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Lesões, dores ou restrições <span className="text-red-500 font-bold ml-1">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={athleteProfile.limitations}
                    onChange={(e) => handleInputChange("limitations", e.target.value)}
                    className={getTextareaClassName(isLimitationsInvalid)}
                    placeholder="Se não possuir dores ou restrições clínicas, basta preencher com 'Não tenho'."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Equipamentos de Força Disponíveis
                  </label>
                  <textarea
                    rows={2}
                    value={athleteProfile.strengthEquipment || ""}
                    onChange={(e) => handleInputChange("strengthEquipment", e.target.value)}
                    className={getTextareaClassName(false)}
                    placeholder="Ex: Academia completa, Halteres em casa, Caneleiras, Elásticos de resistência..."
                  />
                </div>
              </div>
            </div>

            {/* Save Buttons & Feedback */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/5 pt-5 gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                  Os dados do seu perfil serão utilizados para personalizar zonas cardíacas, ritmos de treino, carga semanal e projeções fisiológicas.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
                {profileSaved && (
                  <span className="flex items-center gap-1 text-emerald-400 font-mono text-xs animate-fade-in-out">
                    <Check className="w-4 h-4" /> {t("saved", "Perfil Atualizado!")}
                  </span>
                )}
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-brand-neon hover:bg-cyan-300 text-brand-dark font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-brand-neon/15 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  {t("saveProfile", "Salvar Configuração de Atleta")}
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Scientific Definition of Heart Rate Zones (5 columns) */}
      <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-6">
        <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <h3 className="text-sm uppercase font-bold text-slate-200 tracking-wider mb-2 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 animate-pulse" style={{ animationDuration: "2s" }} />
            Suas Zonas Cardíacas
          </h3>
          <p className="text-xs text-slate-400 font-sans leading-relaxed mb-6">
            Zonas personalizadas baseadas no seu perfil físico atual e reserva de frequência cardíaca.
          </p>

          {/* Camada 1: Zonas Simplificadas (Foco em Zona 2) */}
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider block mb-0.5">Foco de Base Mitocondrial</span>
              <h4 className="text-sm font-black text-white uppercase font-mono">Zona 2 (Aeróbica)</h4>
              <p className="text-[11px] text-slate-300 font-sans mt-0.5 leading-normal">
                Será utilizada na maioria das rodagens para construção de endurance.
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <span className="text-xl font-black text-blue-400 font-mono block">{z2Min}–{z2Max}</span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">bpm</span>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setShowScientificMethodology(!showScientificMethodology)}
              className="text-xs font-mono text-cyan-400 hover:text-brand-neon transition-colors border border-cyan-500/15 bg-cyan-950/20 px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Activity className="w-3.5 h-3.5" />
              {showScientificMethodology ? "Ocultar metodologia científica" : "Ver metodologia científica"}
            </button>
          </div>

          {/* Camada 2: Detalhes Científicos (Karvonen & Espectro Completo) */}
          {showScientificMethodology && (
            <div className="mt-6 space-y-6 animate-fade-in border-t border-white/5 pt-6">
              <div>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  Sua planilha de ritmos baseia-se na metodologia <strong>Karvonen (Fórmula de Reserva Cardíaca)</strong>, utilizando sua frequência cardíaca basal de repouso (<span className="text-cyan-400 font-bold font-mono">{restHr} bpm</span>) e máxima (<span className="text-cyan-400 font-bold font-mono">{maxHr} bpm</span>) para delimitar o esforço.
                </p>
              </div>

              {/* Continuous heart rate spectrum visual bar */}
              <div className="bg-black/45 border border-white/5 p-4 rounded-xl">
                <div className="flex flex-col sm:flex-row justify-between text-[10px] font-mono text-slate-400 mb-2 gap-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"></span>Repouso ({restHr} bpm)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span>Limiar Lactato ({z4Min} bpm)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>Máxima ({maxHr} bpm)</span>
                </div>
                
                <div className="h-4 w-full rounded-lg flex overflow-hidden border border-white/10 shadow-lg relative group">
                  <div className="h-full bg-teal-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90 border-r border-black/25" title={`Z1: ${z1Min} - ${z1Max} bpm`}>
                    <span>Z1</span>
                  </div>
                  <div className="h-full bg-blue-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90 border-r border-black/25" title={`Z2: ${z2Min} - ${z2Max} bpm`}>
                    <span>Z2</span>
                  </div>
                  <div className="h-full bg-indigo-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90 border-r border-black/25" title={`Z3: ${z3Min} - ${z3Max} bpm`}>
                    <span>Z3</span>
                  </div>
                  <div className="h-full bg-orange-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90 border-r border-black/25" title={`Z4: ${z4Min} - ${z4Max} bpm`}>
                    <span>Z4</span>
                  </div>
                  <div className="h-full bg-red-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90" title={`Z5: ${z5Min} - ${z5Max} bpm`}>
                    <span>Z5</span>
                  </div>
                </div>
                
                <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-2">
                  <span>50%</span>
                  <span>60%</span>
                  <span>70%</span>
                  <span>80%</span>
                  <span>90%</span>
                  <span>100% HRR</span>
                </div>
              </div>

              <div className="space-y-3">
                {hrZones.map((zone, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-xl border border-white/5 flex flex-col gap-1.5 transition-all hover:translate-x-1 duration-200 ${zone.color}`}
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-black uppercase tracking-wider font-mono">{zone.name}</span>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-black/50 border border-white/10 text-white">{zone.range}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                      {zone.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-brand-neon/5 border border-brand-neon/10 p-4 rounded-xl mt-5 flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-brand-neon shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-400 leading-relaxed font-sans">
              <strong className="text-brand-neon uppercase tracking-wider font-mono block mb-1">Ajuste Dinâmico Inteligente</strong>
              O treinador combina sua frequência cardíaca, percepção de esforço e desempenho nos treinos para ajustar automaticamente suas zonas e ritmos ao longo do tempo.
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
