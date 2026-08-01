import React, { useState } from "react";
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
  Activity,
  Layers,
  Zap,
  Moon,
  Apple,
  Brain,
  Award,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  Smartphone,
  Flame,
  Utensils,
  Sun,
  MapPin,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import { AthleteProfile, StructuredInjury } from "../coach/types";
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

  const [localShowErrors, setLocalShowErrors] = useState(false);
  const showErrors = showValidationErrors !== undefined ? showValidationErrors : localShowErrors;
  const setShowErrors = setShowValidationErrors !== undefined ? setShowValidationErrors : setLocalShowErrors;

  const [activeLayerTab, setActiveLayerTab] = useState<number | null>(null);
  const [showNewInjuryModal, setShowNewInjuryModal] = useState(false);
  const [newInjury, setNewInjury] = useState<Partial<StructuredInjury>>({
    type: "Joelho",
    status: "em_tratamento",
    side: "direito",
    limitation: "Evitar acelerações e ladeiras"
  });

  // Calculate Karvonen HR Zones
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

  const getHeartRateZones = () => [
    { name: "Zona 1 (Regenerativo)", range: `${z1Min} - ${z1Max} bpm`, desc: "Recuperação ativa, regeneração pós-treino.", color: "border-teal-500/35 text-teal-400 bg-teal-500/5" },
    { name: "Zona 2 (Base Aeróbica)", range: `${z2Min} - ${z2Max} bpm`, desc: "Estímulo mitocondrial e lipólise ideal.", color: "border-blue-500/35 text-blue-400 bg-blue-500/5" },
    { name: "Zona 3 (Tempo / Aeróbico)", range: `${z3Min} - ${z3Max} bpm`, desc: "Resistência aeróbica geral e sustentabilidade.", color: "border-indigo-500/35 text-indigo-400 bg-indigo-500/5" },
    { name: "Zona 4 (Limiar Lático)", range: `${z4Min} - ${z4Max} bpm`, desc: "Ponto de depuração de lactato e tolerância.", color: "border-orange-500/35 text-orange-400 bg-orange-500/5" },
    { name: "Zona 5 (VO2 Máximo)", range: `${z5Min} - ${z5Max} bpm`, desc: "Potência aeróbica máxima e velocidade.", color: "border-red-500/35 text-red-400 bg-red-500/5" },
  ];

  // Profile Maturity Calculation (% of completed areas)
  const calculateProfileMaturity = () => {
    let score = 0;
    const maxScore = 7;

    if (athleteProfile.name && athleteProfile.age && athleteProfile.weight) score += 1;
    if (athleteProfile.maxHeartRate && athleteProfile.restingHeartRate) score += 1;
    if (athleteProfile.availableDays && athleteProfile.availableDays.length > 0) score += 1;
    if (athleteProfile.currentTargetRaceName || athleteProfile.trainingGoal || (athleteProfile.multipleGoals && athleteProfile.multipleGoals.length > 0)) score += 1;
    if (athleteProfile.missedWorkoutReaction || athleteProfile.primaryMotivation) score += 1;
    if (athleteProfile.baselineCooperTestMeters || athleteProfile.baseline5kTime) score += 1;
    if (athleteProfile.coachStyle || athleteProfile.coachCommunication) score += 1;

    return Math.round((score / maxScore) * 100);
  };

  const maturityPercent = calculateProfileMaturity();

  const getMaturityLevel = (percent: number) => {
    if (percent >= 85) {
      return {
        title: "Perfil Elite",
        subtitle: "",
        icon: "💎",
        badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        color: "from-amber-500 to-emerald-400"
      };
    }
    if (percent >= 65) {
      return {
        title: "Perfil Ouro",
        subtitle: "Treinador conhece bem você",
        icon: "🥇",
        badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
        color: "from-yellow-500 to-amber-400"
      };
    }
    if (percent >= 35) {
      return {
        title: "Perfil Prata",
        subtitle: "Treinador entende suas preferências",
        icon: "🥈",
        badgeClass: "bg-slate-300/20 text-slate-200 border-slate-300/40",
        color: "from-slate-400 to-cyan-400"
      };
    }
    return {
      title: "Perfil Bronze",
      subtitle: "Treinador iniciando aprendizado",
      icon: "🥉",
      badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
      color: "from-orange-500 to-amber-500"
    };
  };

  const level = getMaturityLevel(maturityPercent);

  const handleInputChange = (field: keyof AthleteProfile, value: any) => {
    setAthleteProfile(prev => ({
      ...prev,
      [field]: value
    }));
    setProfileSaved(false);
  };

  const toggleArrayItem = (field: keyof AthleteProfile, item: string) => {
    setAthleteProfile(prev => {
      const currentList = (prev[field] as string[]) || [];
      const updated = currentList.includes(item)
        ? currentList.filter(i => i !== item)
        : [...currentList, item];
      return {
        ...prev,
        [field]: updated
      };
    });
    setProfileSaved(false);
  };

  const isGoalSelected = (goal: string) => {
    const list = athleteProfile.multipleGoals || [];
    if (list.includes(goal)) return true;
    const lowerGoal = goal.toLowerCase();
    return list.some(item => {
      const lowerItem = item.toLowerCase();
      if (lowerGoal === "5km" && (lowerItem.includes("5k") || lowerItem.includes("5 km"))) return true;
      if (lowerGoal === "10km" && (lowerItem.includes("10k") || lowerItem.includes("10 km"))) return true;
      if (lowerGoal === "meia maratona" && lowerItem.includes("meia")) return true;
      if (lowerGoal === "maratona" && lowerItem.includes("maratona") && !lowerItem.includes("meia") && !lowerItem.includes("ultra")) return true;
      if (lowerGoal === "ultramaratona" && lowerItem.includes("ultra")) return true;
      if (lowerGoal === "emagrecimento" && (lowerItem.includes("emagrecimento") || lowerItem.includes("perda de peso"))) return true;
      if (lowerGoal === "saúde & vitalidade" && (lowerItem.includes("saude") || lowerItem.includes("saúde") || lowerItem.includes("vitalidade"))) return true;
      if (lowerGoal === "performance" && lowerItem.includes("performance")) return true;
      if (lowerGoal === "manter forma" && (lowerItem.includes("forma") || lowerItem.includes("manter"))) return true;
      return false;
    });
  };

  const toggleGoalItem = (goal: string) => {
    setAthleteProfile(prev => {
      let currentList = (prev.multipleGoals || []).slice();
      const selected = isGoalSelected(goal);
      const lowerGoal = goal.toLowerCase();

      if (selected) {
        currentList = currentList.filter(item => {
          const lowerItem = item.toLowerCase();
          if (item === goal) return false;
          if (lowerGoal === "5km" && (lowerItem.includes("5k") || lowerItem.includes("5 km"))) return false;
          if (lowerGoal === "10km" && (lowerItem.includes("10k") || lowerItem.includes("10 km"))) return false;
          if (lowerGoal === "meia maratona" && lowerItem.includes("meia")) return false;
          if (lowerGoal === "maratona" && lowerItem.includes("maratona") && !lowerItem.includes("meia") && !lowerItem.includes("ultra")) return false;
          if (lowerGoal === "ultramaratona" && lowerItem.includes("ultra")) return false;
          if (lowerGoal === "emagrecimento" && (lowerItem.includes("emagrecimento") || lowerItem.includes("perda de peso"))) return false;
          if (lowerGoal === "saúde & vitalidade" && (lowerItem.includes("saude") || lowerItem.includes("saúde") || lowerItem.includes("vitalidade"))) return false;
          if (lowerGoal === "performance" && lowerItem.includes("performance")) return false;
          if (lowerGoal === "manter forma" && (lowerItem.includes("forma") || lowerItem.includes("manter"))) return false;
          return true;
        });
      } else {
        currentList.push(goal);
      }

      return {
        ...prev,
        multipleGoals: currentList,
        objective: currentList.join(", "),
        trainingGoal: currentList.length > 0 ? currentList[0] : (prev.trainingGoal || "general")
      };
    });
    setProfileSaved(false);
  };

  const handleAddInjury = () => {
    if (!newInjury.type) return;
    const injuryItem: StructuredInjury = {
      id: `inj-${Date.now()}`,
      type: newInjury.type || "Outro",
      startDate: newInjury.startDate || new Date().toISOString().split("T")[0],
      status: (newInjury.status as any) || "em_tratamento",
      side: (newInjury.side as any) || "direito",
      limitation: newInjury.limitation || "Ajuste de intensidade"
    };
    const currentInjuries = athleteProfile.structuredInjuries || [];
    handleInputChange("structuredInjuries", [...currentInjuries, injuryItem]);
    setShowNewInjuryModal(false);
    setNewInjury({ type: "Joelho", status: "em_tratamento", side: "direito", limitation: "Evitar tiros e ladeiras" });
  };

  const handleRemoveInjury = (id: string) => {
    const current = athleteProfile.structuredInjuries || [];
    handleInputChange("structuredInjuries", current.filter(i => i.id !== id));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setProfileSaved(true);
    setShowErrors(false);
  };

  const getInputClassName = (isInvalid?: boolean) => `w-full bg-white/5 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all ${
    isInvalid ? "border-red-500 bg-red-500/10 focus:border-red-500" : "border-white/10 focus:border-cyan-400"
  }`;

  const getSelectClassName = (isInvalid?: boolean) => `w-full bg-neutral-900 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all ${
    isInvalid ? "border-red-500 bg-red-500/10 focus:border-red-500" : "border-white/10 focus:border-cyan-400"
  }`;

  const categories = [
    { 
      id: 1, 
      title: "1. Perfil & Identidade", 
      icon: User, 
      desc: "Nome, biometria e metas", 
      badge: "Perfil",
      getStatus: () => (athleteProfile.name && athleteProfile.age && athleteProfile.weight ? "Completo" : "Em andamento")
    },
    { 
      id: 2, 
      title: "2. Saúde & Fisiologia", 
      icon: Heart, 
      desc: "Zonas de FC e lesões", 
      badge: "Saúde",
      getStatus: () => {
        const activeInjuries = athleteProfile.structuredInjuries?.filter(
          i => i.status === "em_tratamento" || i.status === "cronica"
        );
        if (activeInjuries && activeInjuries.length > 0) {
          return "Com lesão";
        }
        if (athleteProfile.maxHeartRate || (athleteProfile.structuredInjuries && athleteProfile.structuredInjuries.length > 0)) {
          return "Completo";
        }
        return "Pendente";
      }
    },
    { 
      id: 3, 
      title: "3. Logística & Equipamentos", 
      icon: Clock, 
      desc: "Dias, horários e terrenos", 
      badge: "Rotina",
      getStatus: () => ((athleteProfile.availableDays?.length || 0) > 0 ? "Completo" : "Pendente")
    },
    { 
      id: 4, 
      title: "4. Provas & Metas", 
      icon: Calendar, 
      desc: "Prova alvo e planejamento", 
      badge: "Metas",
      getStatus: () => (athleteProfile.currentTargetRaceName || (athleteProfile.multipleGoals?.length || 0) > 0 ? "Completo" : "Não preenchido")
    },
    { 
      id: 5, 
      title: "5. Estilo Mental & Foco", 
      icon: Brain, 
      desc: "Reação a imprevistos e motivação", 
      badge: "Mental",
      getStatus: () => (athleteProfile.missedWorkoutReaction ? "Completo" : "Pendente")
    },
    { 
      id: 6, 
      title: "6. Histórico & Testes", 
      icon: Award, 
      desc: "Testes de entrada e marcas", 
      badge: "Baseline",
      getStatus: () => (
        athleteProfile.baselineCooperTestMeters || athleteProfile.baseline5kTime || athleteProfile.baseline30minDistanceKm 
          ? "Completo" 
          : "Não preenchido"
      )
    },
    { 
      id: 7, 
      title: "7. Treinador Virtual", 
      icon: Zap, 
      desc: "Estilo de prescrição e tom", 
      badge: "Treinador",
      getStatus: () => (athleteProfile.coachStyle ? "Ativo" : "Pendente")
    },
  ];

  const sportsGoalsList = ["5km", "10km", "Meia Maratona", "Maratona", "Ultramaratona"];
  const personalGoalsList = ["Emagrecimento", "Saúde & Vitalidade", "Performance", "Manter Forma"];

  const currentCategory = activeLayerTab ? categories.find(c => c.id === activeLayerTab) : undefined;
  const nextCategory = activeLayerTab ? categories.find(c => c.id === activeLayerTab + 1) : undefined;

  return (
    <div className="space-y-6 animate-fade-in" id="atleta-perfil-simplificado">

      {/* TOP HEADER: Clean Progress Bar & Level Tooltip */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-cyan-950/40 border border-cyan-500/20 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-visible">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none overflow-hidden" />
        
        <div className="relative z-10 max-w-xl">
          {/* Level Badge & Completion */}
          <div className="bg-black/60 border border-white/10 rounded-xl p-4 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="relative group/level-tooltip flex items-center gap-1.5 cursor-help">
                <span className="text-slate-200 font-bold flex items-center gap-1.5">
                  <span className="text-base">{level.icon}</span>
                  <span className="underline decoration-dotted decoration-cyan-400/50 underline-offset-4">{level.title}</span>
                </span>
                
                {/* Tooltip on Level Badge (Opening downwards) */}
                <div className="absolute top-full left-0 mt-2.5 hidden group-hover/level-tooltip:block w-64 p-3 bg-slate-900/98 border border-cyan-500/40 text-slate-200 text-xs rounded-xl shadow-2xl backdrop-blur-md z-50 pointer-events-none transition-all font-sans">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      Seu treinador aprende continuamente sobre você.
                    </p>
                  </div>
                  <div className="absolute -top-1 left-6 w-2 h-2 bg-slate-900 border-t border-l border-cyan-500/40 rotate-45"></div>
                </div>
              </div>

              <span className="text-cyan-400 font-bold text-sm">{maturityPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${level.color} transition-all duration-500 rounded-full`}
                style={{ width: `${maturityPercent}%` }}
              />
            </div>
            {level.subtitle && (
              <div className="pt-0.5 text-[11px]">
                <span className="text-slate-400 font-sans">{level.subtitle}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT: Cards Grid Sidebar + Form Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT CATEGORIES CARDS GRID (Prioridade 3) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5 space-y-2 shadow-md">
            <h3 className="text-xs font-mono uppercase font-bold text-slate-400 px-2 pb-2 border-b border-white/10 flex items-center justify-between">
              <span>Seções do Seu Perfil</span>
              <span className="text-cyan-400 font-bold">{activeLayerTab ? `${activeLayerTab}/${categories.length}` : `0/${categories.length}`}</span>
            </h3>

            <div className="space-y-1.5">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeLayerTab === cat.id;
                const status = cat.getStatus();
                const isCompleted = status === "Completo" || status === "Ativo";

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      handleSave();
                      setActiveLayerTab(activeLayerTab === cat.id ? null : cat.id);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                      isActive
                        ? "bg-cyan-500/15 border-cyan-500/40 text-white shadow-[0_0_12px_rgba(34,211,238,0.12)]"
                        : "bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isActive ? "bg-cyan-500/25 border-cyan-500 text-cyan-300" : "bg-white/5 border-white/10 text-slate-400"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate text-white">
                          {cat.title}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate font-sans">
                          {cat.desc}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                      isCompleted 
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                        : status === "Em andamento" || status === "Com lesão"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-white/5 text-slate-400 border-white/10"
                    }`}>
                      {isCompleted ? "✔ " + status : status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT FORM CONTENT */}
        <div className="lg:col-span-8">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl relative min-h-[540px]">

            {activeLayerTab === null ? (
              <div className="flex flex-col items-center justify-center min-h-[440px] text-center p-8 border border-dashed border-white/10 rounded-2xl bg-white/[0.02] space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
                  <User className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold font-mono text-white">Nenhum item do perfil selecionado</h3>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed font-sans">
                    Selecione uma das seções acima para visualizar e editar suas informações do perfil.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* SECTION 1: Perfil & Identidade */}
            {activeLayerTab === 1 && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-cyan-400" /> Perfil & Identidade
                    </h3>
                    <p className="text-xs text-slate-400">Dados cadastrais básicos para personalização de prescreções.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.firstName ?? (athleteProfile.name ? athleteProfile.name.split(" ")[0] : "")}
                      onChange={(e) => {
                        const fname = e.target.value;
                        const lname = athleteProfile.lastName ?? (athleteProfile.name ? athleteProfile.name.split(" ").slice(1).join(" ") : "");
                        const fullName = `${fname} ${lname}`.trim();
                        setAthleteProfile({
                          ...athleteProfile,
                          firstName: fname,
                          lastName: lname,
                          name: fullName
                        });
                        setProfileSaved(false);
                      }}
                      className={getInputClassName()}
                      placeholder="Ex: Helder"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Sobrenome
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.lastName ?? (athleteProfile.name ? athleteProfile.name.split(" ").slice(1).join(" ") : "")}
                      onChange={(e) => {
                        const lname = e.target.value;
                        const fname = athleteProfile.firstName ?? (athleteProfile.name ? athleteProfile.name.split(" ")[0] : "");
                        const fullName = `${fname} ${lname}`.trim();
                        setAthleteProfile({
                          ...athleteProfile,
                          firstName: fname,
                          lastName: lname,
                          name: fullName
                        });
                        setProfileSaved(false);
                      }}
                      className={getInputClassName()}
                      placeholder="Ex: Alex"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Gênero Biológico
                    </label>
                    <select
                      value={athleteProfile.gender || "Masculino"}
                      onChange={(e) => handleInputChange("gender", e.target.value)}
                      className={getSelectClassName()}
                    >
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Idade (anos)
                    </label>
                    <input
                      type="number"
                      value={athleteProfile.age || ""}
                      onChange={(e) => handleInputChange("age", parseInt(e.target.value) || 0)}
                      className={getInputClassName()}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Altura (cm)
                    </label>
                    <input
                      type="number"
                      value={athleteProfile.heightCm || athleteProfile.height || 180}
                      onChange={(e) => {
                        handleInputChange("heightCm", parseInt(e.target.value) || 0);
                        handleInputChange("height", parseInt(e.target.value) || 0);
                      }}
                      className={getInputClassName()}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Peso Atual (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={athleteProfile.weight || athleteProfile.weightCurrentKg || 80}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        handleInputChange("weight", val);
                        handleInputChange("weightCurrentKg", val);
                      }}
                      className={getInputClassName()}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Peso Alvo (opcional) (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={athleteProfile.targetWeightKg || athleteProfile.weightGoalKg || ""}
                      onChange={(e) => {
                        handleInputChange("targetWeightKg", e.target.value);
                        handleInputChange("weightGoalKg", e.target.value);
                      }}
                      className={getInputClassName()}
                      placeholder="Ex: 82"
                    />
                  </div>
                </div>

                {/* REORGANIZED GOALS (Prioridade 7): Esportivos vs Pessoais */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                      Objetivos Esportivos (Corridas e Provas)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {sportsGoalsList.map((obj) => {
                        const isSelected = isGoalSelected(obj);
                        return (
                          <button
                            key={obj}
                            type="button"
                            onClick={() => toggleGoalItem(obj)}
                            className={`p-2.5 rounded-xl text-xs font-mono font-bold transition-all border flex items-center justify-between ${
                              isSelected ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                            }`}
                          >
                            <span>{obj}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                      Objetivos Pessoais & Estilo de Vida
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {personalGoalsList.map((obj) => {
                        const isSelected = isGoalSelected(obj);
                        return (
                          <button
                            key={obj}
                            type="button"
                            onClick={() => toggleGoalItem(obj)}
                            className={`p-2.5 rounded-xl text-xs font-mono font-bold transition-all border flex items-center justify-between ${
                              isSelected ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                            }`}
                          >
                            <span>{obj}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Nível de Experiência na Corrida
                  </label>
                  <select
                    value={
                      athleteProfile.experienceLevel ||
                      (athleteProfile.fitnessLevel === "advanced" ? "avancado" : athleteProfile.fitnessLevel === "beginner" ? "iniciante" : "intermediario")
                    }
                    onChange={(e) => {
                      const val = e.target.value as "iniciante" | "intermediario" | "avancado";
                      handleInputChange("experienceLevel", val);
                      handleInputChange("fitnessLevel", val === "avancado" ? "advanced" : val === "iniciante" ? "beginner" : "intermediate");
                    }}
                    className={getSelectClassName()}
                  >
                    <option value="iniciante">Iniciante (menos de 1 ano de prática)</option>
                    <option value="intermediario">Intermediário (1 a 4 anos de prática)</option>
                    <option value="avancado">Avançado (mais de 4 anos de prática)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Histórico Esportivo Paralelo
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["Musculação", "Ciclismo", "Natação", "Futebol", "Crossfit", "Beach Tennis", "Pilates"].map((sport) => {
                      const isSelected = (athleteProfile.sportsHistoryList || []).includes(sport);
                      return (
                        <button
                          key={sport}
                          type="button"
                          onClick={() => toggleArrayItem("sportsHistoryList", sport)}
                          className={`p-2 rounded-xl text-xs font-mono transition-all border flex items-center justify-between ${
                            isSelected ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          <span>{sport}</span>
                          {isSelected && <Check className="w-3 h-3 text-purple-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: Saúde & Fisiologia */}
            {activeLayerTab === 2 && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Heart className="w-4 h-4 text-cyan-400" /> Saúde & Fisiologia
                    </h3>
                    <p className="text-xs text-slate-400">Frequência cardíaca, zonas de esforço e histórico de lesões.</p>
                  </div>
                </div>

                {/* Heart Rate Mode */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" /> Zonas de Frequência Cardíaca
                    </span>
                    <select
                      value={athleteProfile.hrZoneMode || "auto_garmin"}
                      onChange={(e) => handleInputChange("hrZoneMode", e.target.value)}
                      className="bg-neutral-900 border border-white/20 rounded-lg text-xs text-cyan-300 px-3 py-1 font-mono focus:outline-none"
                    >
                      <option value="auto_garmin">Automático Garmin (Karvonen)</option>
                      <option value="manual">Definição Manual de Zonas</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 uppercase">FC Máxima (bpm)</label>
                      <input
                        type="number"
                        value={athleteProfile.maxHeartRate || 190}
                        onChange={(e) => handleInputChange("maxHeartRate", parseInt(e.target.value) || 190)}
                        className={getInputClassName()}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 uppercase">FC Repouso (bpm)</label>
                      <input
                        type="number"
                        value={athleteProfile.restingHeartRate || 60}
                        onChange={(e) => handleInputChange("restingHeartRate", parseInt(e.target.value) || 60)}
                        className={getInputClassName()}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 uppercase">FC Limiar (bpm)</label>
                      <input
                        type="number"
                        value={athleteProfile.thresholdHR || 168}
                        onChange={(e) => handleInputChange("thresholdHR", parseInt(e.target.value) || 168)}
                        className={getInputClassName()}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-slate-400 uppercase">Pace Limiar (Formato hh:mm / min:seg)</label>
                      <input
                        type="text"
                        value={athleteProfile.thresholdPace || "00:05:46"}
                        placeholder="Ex: 00:05:46 ou 05:46"
                        onChange={(e) => handleInputChange("thresholdPace", e.target.value)}
                        className={getInputClassName()}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {getHeartRateZones().slice(0, 4).map((zone, idx) => (
                      <div key={idx} className={`p-2.5 rounded-lg border text-xs ${zone.color} flex items-center justify-between`}>
                        <span className="font-bold font-mono">{zone.name}</span>
                        <span className="font-mono font-bold text-[11px]">{zone.range}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Structured Injuries */}
                <div className="bg-rose-950/15 border border-rose-500/30 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-rose-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-400" /> Lesões & Limitações
                      </h4>
                      <p className="text-[10px] text-slate-300">Cadastro de lesões para ajuste automático dos treinos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewInjuryModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold hover:bg-rose-500/30 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Lesão
                    </button>
                  </div>

                  {showNewInjuryModal && (
                    <div className="p-3.5 bg-black/60 border border-rose-500/40 rounded-xl space-y-3 font-sans">
                      <span className="text-xs font-bold text-white block font-mono">Nova Lesão ou Região Sensível</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-1 font-mono">Tipo</label>
                          <select
                            value={newInjury.type}
                            onChange={(e) => setNewInjury({ ...newInjury, type: e.target.value })}
                            className="w-full bg-neutral-900 border border-white/20 rounded p-2 text-xs text-white"
                          >
                            <option value="Joelho">Joelho</option>
                            <option value="Tendão de Aquiles">Tendão de Aquiles</option>
                            <option value="Canelite">Canelite</option>
                            <option value="Fascite Plantar">Fascite Plantar</option>
                            <option value="Quadril / Glúteo">Quadril / Glúteo</option>
                            <option value="Panturrilha">Panturrilha</option>
                            <option value="Coluna / Tornozelo">Coluna / Tornozelo</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-1 font-mono">Status</label>
                          <select
                            value={newInjury.status}
                            onChange={(e) => setNewInjury({ ...newInjury, status: e.target.value as any })}
                            className="w-full bg-neutral-900 border border-white/20 rounded p-2 text-xs text-white"
                          >
                            <option value="em_tratamento">Em tratamento</option>
                            <option value="cronica">Crônica / Reincidente</option>
                            <option value="curada">Curada (Histórico)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-1 font-mono">Lado Afetado</label>
                          <select
                            value={newInjury.side}
                            onChange={(e) => setNewInjury({ ...newInjury, side: e.target.value as any })}
                            className="w-full bg-neutral-900 border border-white/20 rounded p-2 text-xs text-white"
                          >
                            <option value="direito">Lado Direito</option>
                            <option value="esquerdo">Lado Esquerdo</option>
                            <option value="ambos">Ambos os Lados</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-1 font-mono">Limitação (Ex: Evitar acelerações)</label>
                        <input
                          type="text"
                          value={newInjury.limitation || ""}
                          onChange={(e) => setNewInjury({ ...newInjury, limitation: e.target.value })}
                          className="w-full bg-white/5 border border-white/20 rounded p-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowNewInjuryModal(false)}
                          className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAddInjury}
                          className="px-3 py-1 bg-rose-500/30 text-rose-200 border border-rose-500/50 text-xs font-mono font-bold rounded hover:bg-rose-500/50"
                        >
                          Salvar Lesão
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {(athleteProfile.structuredInjuries || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhuma lesão ativa cadastrada.</p>
                    ) : (
                      athleteProfile.structuredInjuries?.map((inj) => (
                        <div key={inj.id} className="p-3 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white font-mono">{inj.type} ({inj.side})</span>
                            <span className={`ml-2 text-[9px] font-mono px-2 py-0.5 rounded ${
                              inj.status === "em_tratamento" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300"
                            }`}>
                              {inj.status === "em_tratamento" ? "Em tratamento" : inj.status === "cronica" ? "Crônica" : "Curada"}
                            </span>
                            <p className="text-[11px] text-slate-400 mt-0.5">{inj.limitation}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveInjury(inj.id)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Clinical Conditions */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Condições Clínicas de Acompanhamento
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["Hipertensão", "Diabetes", "Asma", "Arritmia", "Cirurgia Recente"].map((cond) => {
                      const isSelected = (athleteProfile.clinicalConditions || []).includes(cond);
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => toggleArrayItem("clinicalConditions", cond)}
                          className={`p-2 rounded-xl text-xs font-mono transition-all border flex items-center justify-between ${
                            isSelected ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          <span>{cond}</span>
                          {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: Restrições & Viabilidade ("O que é possível?") */}
            {activeLayerTab === 3 && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-white/10 pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-extrabold uppercase bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                        Camada 3 • Viabilidade Real
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" /> Restrições & Logística ("O que é possível?")
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      O treinador não pergunta apenas "O que você quer?". Ele mapeia sua rotina real para tornar o plano 100% EXECUTÁVEL.
                    </p>
                  </div>
                </div>

                {/* Infrastructure Access Cards (Academia, Esteira, Pista) */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Infraestrutura e Acesso a Locais de Treino
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Gym Access */}
                    <button
                      type="button"
                      onClick={() => handleInputChange("hasGymAccess", !athleteProfile.hasGymAccess)}
                      className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                        athleteProfile.hasGymAccess
                          ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40 shadow-glow-cyan"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                          <Dumbbell className="w-3.5 h-3.5 text-cyan-400" /> Academia
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">Aparelhos de musculação</div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        athleteProfile.hasGymAccess ? "bg-cyan-400 text-slate-950" : "bg-black/40 text-slate-500"
                      }`}>
                        {athleteProfile.hasGymAccess ? "SIM" : "NÃO"}
                      </span>
                    </button>

                    {/* Treadmill Access */}
                    <button
                      type="button"
                      onClick={() => {
                        const newVal = !athleteProfile.hasTreadmillAccess;
                        handleInputChange("hasTreadmillAccess", newVal);
                        if (newVal) {
                          const terrains = athleteProfile.preferredTerrain || [];
                          if (!terrains.includes("Esteira")) {
                            handleInputChange("preferredTerrain", [...terrains, "Esteira"]);
                          }
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                        athleteProfile.hasTreadmillAccess
                          ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-emerald-400" /> Esteira
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">Opção para dias chuvosos</div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        athleteProfile.hasTreadmillAccess ? "bg-emerald-400 text-slate-950" : "bg-black/40 text-slate-500"
                      }`}>
                        {athleteProfile.hasTreadmillAccess ? "SIM" : "NÃO"}
                      </span>
                    </button>

                    {/* Athletic Track Access */}
                    <button
                      type="button"
                      onClick={() => {
                        const newVal = !athleteProfile.hasTrackAccess;
                        handleInputChange("hasTrackAccess", newVal);
                        if (newVal) {
                          const terrains = athleteProfile.preferredTerrain || [];
                          if (!terrains.includes("Pista de Atletismo")) {
                            handleInputChange("preferredTerrain", [...terrains, "Pista de Atletismo"]);
                          }
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                        athleteProfile.hasTrackAccess
                          ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-amber-400" /> Pista de Atletismo
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">Precisão para tiros e ritmo</div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        athleteProfile.hasTrackAccess ? "bg-amber-400 text-slate-950" : "bg-black/40 text-slate-500"
                      }`}>
                        {athleteProfile.hasTrackAccess ? "SIM" : "NÃO"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Available Days */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Dias da Semana Disponíveis para Treino (Restrição de Rotina)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"].map((day) => {
                      const isAvailable = (athleteProfile.availableDays || []).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleArrayItem("availableDays", day)}
                          className={`p-2.5 rounded-xl text-xs font-mono font-bold transition-all border flex items-center justify-between ${
                            isAvailable ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-white/5 border-white/10 text-slate-500"
                          }`}
                        >
                          <span>{day.split("-")[0]}</span>
                          {isAvailable && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dia Preferencial do Longão */}
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Dia Preferencial do Longão (Logística)
                  </label>
                  <select
                    value={athleteProfile.longRunDay || "Domingo"}
                    onChange={(e) => handleInputChange("longRunDay", e.target.value)}
                    className={getSelectClassName()}
                  >
                    <option value="Sábado">Sábado</option>
                    <option value="Domingo">Domingo</option>
                    <option value="Sexta-feira">Sexta-feira</option>
                  </select>
                </div>

                {/* DOUBLE SESSIONS / TURNO 1 & TURNO 2 DISPONIBILIDADE */}
                <div className="bg-cyan-950/20 border border-cyan-500/30 p-4 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-cyan-400" /> Sessões por Dia (Estrutura de Turnos)
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        Defina se a rotina possui 1 sessão única ou 2 sessões divididas em Turno 1 e Turno 2 (ex: 50 min de manhã e 30 min à tarde).
                      </p>
                    </div>

                    {/* Campo: Sessões por Dia (1 ou 2) */}
                    <div className="flex items-center gap-2 bg-black/60 p-1.5 rounded-xl border border-white/10 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-300 px-2">Sessões por Dia:</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange("sessionsPerDay", 1);
                            handleInputChange("doubleSessionsAllowed", false);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                            (athleteProfile.sessionsPerDay || (athleteProfile.doubleSessionsAllowed ? 2 : 1)) === 1
                              ? "bg-cyan-400 text-slate-950 font-extrabold shadow-glow-cyan"
                              : "bg-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          1 Sessão
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange("sessionsPerDay", 2);
                            handleInputChange("doubleSessionsAllowed", true);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                            (athleteProfile.sessionsPerDay || (athleteProfile.doubleSessionsAllowed ? 2 : 1)) === 2
                              ? "bg-purple-500 text-white font-extrabold shadow-glow-purple"
                              : "bg-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          2 Sessões
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Configuração dos Turnos */}
                  <div className={`grid grid-cols-1 ${(athleteProfile.sessionsPerDay === 2 || athleteProfile.doubleSessionsAllowed) ? "sm:grid-cols-2" : "sm:grid-cols-1"} gap-3 pt-3 border-t border-cyan-500/20 animate-fade-in`}>
                    {/* Turno 1 */}
                    <div className="bg-black/40 border border-cyan-500/30 p-3 rounded-xl space-y-2">
                      <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5 border-b border-cyan-500/20 pb-1">
                        <Sun className="w-3.5 h-3.5 text-amber-400" /> Turno 1 (Principal / Manhã)
                      </span>
                      
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-200 uppercase tracking-wider mb-1">
                          Tempo para Turno 1 (minutos - de 5 em 5 min)
                        </label>
                        <select
                          value={athleteProfile.turno1TimeMinutes || athleteProfile.timePerShiftMinutes || 50}
                          onChange={(e) => {
                            const v = parseInt(e.target.value) || 50;
                            handleInputChange("turno1TimeMinutes", v);
                            handleInputChange("timePerShiftMinutes", v);
                          }}
                          className={getSelectClassName()}
                        >
                          {[15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 140, 150, 160, 170, 180].map((mins) => (
                            <option key={mins} value={mins}>{mins} minutos</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-200 uppercase tracking-wider mb-1">
                          Horário Preferido Turno 1
                        </label>
                        <select
                          value={athleteProfile.turno1PreferredTime || athleteProfile.preferredTimeOfDay || "Manhã"}
                          onChange={(e) => handleInputChange("turno1PreferredTime", e.target.value)}
                          className={getSelectClassName()}
                        >
                          <option value="Manhã">Manhã</option>
                          <option value="Almoço">Almoço</option>
                          <option value="Tarde">Tarde</option>
                          <option value="Noite">Noite</option>
                        </select>
                      </div>
                    </div>

                    {/* Turno 2 (Apenas se 2 Sessões selecionadas) */}
                    {(athleteProfile.sessionsPerDay === 2 || athleteProfile.doubleSessionsAllowed) && (
                      <div className="bg-black/40 border border-purple-500/30 p-3 rounded-xl space-y-2 animate-fade-in">
                        <span className="text-xs font-mono font-bold text-purple-300 flex items-center gap-1.5 border-b border-purple-500/20 pb-1">
                          <Moon className="w-3.5 h-3.5 text-purple-400" /> Turno 2 (Complementar / Tarde/Noite)
                        </span>

                        <div>
                          <label className="block text-[10px] font-mono text-purple-200 uppercase tracking-wider mb-1">
                            Tempo para Turno 2 (minutos - de 5 em 5 min)
                          </label>
                          <select
                            value={athleteProfile.turno2TimeMinutes || 30}
                            onChange={(e) => handleInputChange("turno2TimeMinutes", parseInt(e.target.value) || 30)}
                            className={getSelectClassName()}
                          >
                            {[15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120].map((mins) => (
                              <option key={mins} value={mins}>{mins} minutos</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-purple-200 uppercase tracking-wider mb-1">
                            Horário Preferido Turno 2
                          </label>
                          <select
                            value={athleteProfile.turno2PreferredTime || "Tarde"}
                            onChange={(e) => handleInputChange("turno2PreferredTime", e.target.value)}
                            className={getSelectClassName()}
                          >
                            <option value="Manhã">Manhã</option>
                            <option value="Almoço">Almoço</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Noite">Noite</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Terrenos Predominantes
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["Rua / Asfalto", "Esteira", "Trilha / Terra", "Pista de Atletismo"].map((terrain) => {
                      const isSelected = (athleteProfile.preferredTerrain || []).includes(terrain);
                      return (
                        <button
                          key={terrain}
                          type="button"
                          onClick={() => toggleArrayItem("preferredTerrain", terrain)}
                          className={`p-2 rounded-xl text-xs font-mono transition-all border flex items-center justify-between ${
                            isSelected ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          <span>{terrain}</span>
                          {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Equipamentos Disponíveis para Fortalecimento
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["Halteres", "Barra / Anilhas", "Kettlebell", "Mini Band", "Elástico de Resistência", "Bike Ergométrica", "Rolo de Liberação"].map((eq) => {
                      const isSelected = (athleteProfile.equipmentsList || []).includes(eq);
                      return (
                        <button
                          key={eq}
                          type="button"
                          onClick={() => toggleArrayItem("equipmentsList", eq)}
                          className={`p-2 rounded-xl text-xs font-mono transition-all border flex items-center justify-between ${
                            isSelected ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          <span>{eq}</span>
                          {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: Provas & Metas */}
            {activeLayerTab === 4 && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" /> Provas & Metas <span className="text-[10px] text-cyan-400/80 font-mono font-normal uppercase px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">(Opcional)</span>
                    </h3>
                    <p className="text-xs text-slate-400">Esta aba é opcional. Preencha apenas se tiver uma prova alvo planejada.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Nome da Prova Alvo
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.currentTargetRaceName || ""}
                      onChange={(e) => handleInputChange("currentTargetRaceName", e.target.value)}
                      className={getInputClassName()}
                      placeholder="Ex: Prova 5km (Opcional)"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Data da Prova Alvo (Opcional)
                    </label>
                    <input
                      type="date"
                      value={athleteProfile.currentTargetRaceDate || ""}
                      onChange={(e) => handleInputChange("currentTargetRaceDate", e.target.value)}
                      className={getInputClassName()}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Tempo ou Pace Alvo
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.targetTimeGoal || ""}
                      onChange={(e) => handleInputChange("targetTimeGoal", e.target.value)}
                      className={getInputClassName()}
                      placeholder="Ex: 28:50 ou 5:46/km"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: Estilo Mental & Foco */}
            {activeLayerTab === 5 && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-cyan-400" /> Estilo Mental & Foco
                    </h3>
                    <p className="text-xs text-slate-400">Como você lida com imprevistos e sua motivação principal.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Quando você perde um treino planejado, qual sua reação habitual?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: "recupero_depois", label: "Recupero com calma no próximo dia disponível", desc: "Ajuste equilibrado sem ansiedade" },
                      { key: "desanimo", label: "Fico desanimado e tendo a abandonar a semana", desc: "Necessita apoio e incentivo do treinador" },
                      { key: "treino_dobro", label: "Tento treinar em dobro no dia seguinte", desc: "Atenção: alto risco de sobrecarga" },
                      { key: "ignoro", label: "Aceito e sigo em frente sem remorso", desc: "Foco na consistência de longo prazo" }
                    ].map((item) => {
                      const isSelected = athleteProfile.missedWorkoutReaction === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleInputChange("missedWorkoutReaction", item.key)}
                          className={`p-3 rounded-xl text-left transition-all border ${
                            isSelected ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/50" : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          <span className="font-bold text-xs font-mono block text-white">{item.label}</span>
                          <span className="text-[10px] text-slate-400 font-sans">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Motivação Principal para Treinar
                  </label>
                  <select
                    value={athleteProfile.primaryMotivation || "performance"}
                    onChange={(e) => handleInputChange("primaryMotivation", e.target.value)}
                    className={getSelectClassName()}
                  >
                    <option value="saude">Saúde, Longevidade e Disposição Diária</option>
                    <option value="competicao">Superação de Marcas e Competição</option>
                    <option value="estetica">Composição Corporal e Estética</option>
                    <option value="prazer">Prazer, Desconexão e Saúde Mental</option>
                  </select>
                </div>
              </div>
            )}

            {/* SECTION 6: Histórico & Testes */}
            {activeLayerTab === 6 && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-cyan-400" /> Histórico & Testes de Referência
                    </h3>
                    <p className="text-xs text-slate-400">Pontos de partida numéricos para medir sua evolução ao longo dos meses.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Teste de Cooper (metros em 12 min)
                    </label>
                    <input
                      type="number"
                      value={athleteProfile.baselineCooperTestMeters ?? ""}
                      onChange={(e) => handleInputChange("baselineCooperTestMeters", e.target.value ? parseInt(e.target.value) : undefined)}
                      className={getInputClassName()}
                      placeholder="Ex: 2850"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Tempo de Referência em 5km
                    </label>
                    <input
                      type="text"
                      value={athleteProfile.baseline5kTime || ""}
                      onChange={(e) => handleInputChange("baseline5kTime", e.target.value)}
                      className={getInputClassName()}
                      placeholder="Ex: 20:10"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Distância em 30 min (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={athleteProfile.baseline30minDistanceKm ?? ""}
                      onChange={(e) => handleInputChange("baseline30minDistanceKm", e.target.value ? parseFloat(e.target.value) : undefined)}
                      className={getInputClassName()}
                      placeholder="Ex: 6.2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 7: Configurações do Treinador Virtual */}
            {activeLayerTab === 7 && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" /> Configurações do Treinador Virtual
                    </h3>
                    <p className="text-xs text-slate-400">Personalize o estilo de treino e o tom de comunicação do seu treinador.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Estilo de Prescrição do Treinador
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { key: "conservador", title: "Conservador", desc: "Prioriza regeneração e prevenção total de lesões" },
                      { key: "equilibrado", title: "Equilibrado (Recomendado)", desc: "Melhor relação ganho aeróbico vs segurança" },
                      { key: "agressivo", title: "Agressivo", desc: "Busca limite de performance e cargas mais elevadas" }
                    ].map((style) => {
                      const isSelected = (athleteProfile.coachStyle || "equilibrado") === style.key;
                      return (
                        <button
                          key={style.key}
                          type="button"
                          onClick={() => handleInputChange("coachStyle", style.key)}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            isSelected ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md" : "bg-white/5 border-white/10 text-slate-400"
                          }`}
                        >
                          <span className="font-bold text-xs font-mono block text-white">{style.title}</span>
                          <span className="text-[10px] text-slate-400 font-sans block mt-1">{style.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Tom de Comunicação
                    </label>
                    <select
                      value={athleteProfile.coachCommunication || "tecnica"}
                      onChange={(e) => handleInputChange("coachCommunication", e.target.value)}
                      className={getSelectClassName()}
                    >
                      <option value="tecnica">Técnica & Fisiológica (Termos de lactato e zonas)</option>
                      <option value="motivacional">Motivacional & Encorajadora</option>
                      <option value="minimalista">Minimalista & Direta ao ponto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Frequência das Explicações Detalhadas
                    </label>
                    <select
                      value={athleteProfile.explanationFrequency || "quando_muda"}
                      onChange={(e) => handleInputChange("explanationFrequency", e.target.value)}
                      className={getSelectClassName()}
                    >
                      <option value="sempre">Sempre explicar o porquê de cada treino</option>
                      <option value="quando_muda">Apenas quando houver ajuste de carga</option>
                      <option value="nunca">Modo resumo (sem explicações longas)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM ACTIONS BAR (Prioridade 5 & 11) */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 font-mono">
                {profileSaved ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Perfil Atualizado com Sucesso!
                  </span>
                ) : (
                  <span>Seu treinador virtual usa estas informações para personalizar suas prescrições.</span>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end">
                {activeLayerTab && activeLayerTab > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSave();
                      if (activeLayerTab) setActiveLayerTab(activeLayerTab - 1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-mono"
                  >
                    Anterior
                  </button>
                )}
                
                {nextCategory ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleSave();
                      if (activeLayerTab) setActiveLayerTab(activeLayerTab + 1);
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1.5"
                  >
                    <span>Salvar e Continuar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSave()}
                    className={`px-5 py-2.5 rounded-xl font-mono font-bold text-xs shadow-lg transition-all flex items-center gap-1.5 ${
                      profileSaved
                        ? "bg-emerald-400 text-black shadow-emerald-500/20 hover:bg-emerald-300"
                        : "bg-gradient-to-r from-cyan-500 to-emerald-400 text-black hover:brightness-110"
                    }`}
                  >
                    {profileSaved ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-black" /> Perfil Completo
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> Completar & Salvar Perfil
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
