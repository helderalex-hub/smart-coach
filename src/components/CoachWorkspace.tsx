import React, { useState, useEffect, useMemo } from "react";
import { 
  Dumbbell, 
  Heart, 
  Moon, 
  Brain, 
  Calendar, 
  Activity, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  Clock, 
  ShieldAlert, 
  ShieldCheck,
  Info,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  FileDown,
  Award,
  Zap,
  Send,
  Trash2,
  MessageSquare,
  User,
  History,
  TrendingDown,
  Upload,
  MapPin,
  Bike,
  Waves,
  Footprints,
  Compass,
  Layers,
  Flame,
  Search,
  Copy,
  Check,
  Database,
  Eye,
  FileText,
  ChevronDown,
  Calculator,
  Target
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  CartesianGrid, 
  Legend 
} from "recharts";
import { 
  AthleteProfile, 
  DailyMetrics, 
  ReadinessResult, 
  ReadinessStatus, 
  TrainingHistory, 
  TrainingLoad, 
  TrainingPlan, 
  ScheduledWorkout, 
  WorkoutPrescription, 
  TrainingIntent,
  WeeklyPlan
} from "../coach/types";
import { calculateReadiness, calculateTrainingLoad, calculateActivityLoad, compareLoad, adjustNextWorkout, heartRateFactor, calculateMonotonyAndStrain } from "../coach/coachEngine";
import { LIBRARY_CATEGORIES, LibraryCategory, LibraryItem } from "../data/workoutLibrary";
import GpsMap from "./GpsMap";
import TelemetryCharts from "./TelemetryCharts";
import { useLanguage } from "../i18n/LanguageContext";

export const SUBJECTIVE_FEELING_STAGES = [
  { id: "muito_bem", label: "Muito Bem", score: 100, color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30", dot: "bg-emerald-400", sub: "Energia total / Supercompensação" },
  { id: "bem", label: "Bem", score: 80, color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25", dot: "bg-emerald-300", sub: "Recuperado / Disposto" },
  { id: "normal", label: "Normal", score: 60, color: "text-sky-300 bg-sky-500/15 border-sky-500/30 hover:bg-sky-500/25", dot: "bg-sky-400", sub: "Neutro / Estado regular" },
  { id: "cansado", label: "Cansado", score: 40, color: "text-amber-300 bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30", dot: "bg-amber-400", sub: "Fadiga leve / Atentar à carga" },
  { id: "muito_cansado", label: "Muito Cansado", score: 20, color: "text-rose-300 bg-rose-500/20 border-rose-500/40 hover:bg-rose-500/30", dot: "bg-rose-400", sub: "Esgotamento / Reduzir estímulo" }
] as const;

const parseBoldText = (line: string) => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const formatMessageText = (text: string) => {
  return text.split("\n").map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
      const cleaned = trimmed.replace(/^[•-]\s*/, "");
      return (
        <li key={idx} className="ml-4 list-disc text-slate-300 my-1 font-sans text-xs">
          {parseBoldText(cleaned)}
        </li>
      );
    }
    return (
      <p key={idx} className="text-slate-300 my-1.5 leading-relaxed font-sans text-xs">
        {parseBoldText(line)}
      </p>
    );
  });
};

interface CoachWorkspaceProps {
  athleteProfile: AthleteProfile;
  setAthleteProfile: (profile: AthleteProfile) => void;
  getTrainingHistory: () => TrainingHistory;
  viewMode?: "athlete" | "advanced";
  activeTab: "profile" | "today" | "plan" | "state" | "adaptation" | "library";
  setActiveTab?: (tab: "profile" | "today" | "plan" | "state" | "adaptation" | "library") => void;
  handleFileUpload?: (file: File) => Promise<void>;
  isUploading?: boolean;
  uploadError?: string | null;
  activeActivity: any | null;
  setActiveActivity: (activity: any | null) => void;
  currentRpe: number;
  setCurrentRpe: (rpe: number) => void;
  plannedLoadInput: number;
  setPlannedLoadInput: (load: number) => void;
  isReanalyzing?: boolean;
  reanalyzeWorkout?: () => Promise<void>;
  loadDemoWorkout?: () => void;
  savedList?: Array<{
    id: string;
    filename: string;
    sport: string;
    startTime: string;
    distanceKm: number;
    durationSeconds: number;
    title: string;
    uploadedAt: string;
  }>;
  selectActivity?: (id: string) => void;
  deleteActivity?: (id: string, e?: React.MouseEvent) => void;
  refreshActivities?: () => Promise<boolean>;
}

export default function CoachWorkspace({ 
  athleteProfile, 
  setAthleteProfile, 
  getTrainingHistory,
  viewMode = "athlete",
  activeTab,
  setActiveTab,
  handleFileUpload,
  isUploading = false,
  uploadError = null,
  activeActivity,
  setActiveActivity,
  currentRpe,
  setCurrentRpe,
  plannedLoadInput,
  setPlannedLoadInput,
  isReanalyzing = false,
  reanalyzeWorkout,
  loadDemoWorkout,
  savedList = [],
  selectActivity,
  deleteActivity,
  refreshActivities
}: CoachWorkspaceProps) {
  const { t, language } = useLanguage();

  // Garmin Workout Exporter
  const handleExportToGarmin = (workout: WorkoutPrescription) => {
    const garminWorkout = {
      file_type: "workout",
      sport: "running",
      name: workout.name,
      intent: workout.intent,
      duration_minutes: workout.durationMinutes,
      description: workout.description,
      steps: workout.steps.map((step) => {
        const mins = Math.floor(step.durationSeconds / 60);
        const secs = step.durationSeconds % 60;
        const durationStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        
        return {
          name: step.name,
          type: step.stepType || "interval",
          duration: durationStr,
          duration_seconds: step.durationSeconds,
          intensity: step.intensity,
          repetitions: step.repetitions || null,
          sets: step.sets || null,
          recovery_seconds: step.recoverySeconds || null,
          instruction: step.instruction || step.description || ""
        };
      })
    };

    const blob = new Blob([JSON.stringify(garminWorkout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const formattedDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    link.href = url;
    link.download = `garmin_workout_${formattedDate}_${workout.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Get today's workout from the weekly plan, adapted dynamically based on readiness and profile limits
  const getTodayWorkout = () => {
    if (!trainingPlan) return null;
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const todayName = days[new Date().getDay()];
    
    // Find active week idx (from selectedWeekIdx, or default to the current active week)
    const activeWeekIdx = Math.min(selectedWeekIdx, (trainingPlan.cycles[0]?.weeks?.length || 1) - 1);
    const workouts = trainingPlan.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
    
    const sw = workouts.find((w: any) => w.day === todayName);
    if (!sw) return null;

    const baseWorkout = sw.workout;
    const isLongRunDay = todayName === (athleteProfile.longRunDay || "Domingo");

    // Parse maximum time per workout from athlete profile (default to 90 mins if invalid)
    const timeStr = athleteProfile.availableTimePerWorkout || "90 minutos";
    const maxTotalMinutes = parseInt(timeStr) || 90;

    // Define base overhead: Warmup (10 min) + Drills (5 min) + Cooldown (5 min) = 20 min
    const overhead = 20;

    // Determine the base main set duration
    let mainSetDuration = Number(baseWorkout.durationMinutes) || 40;

    // 1. Profile Limit check (with exception of the long run day "longão")
    if (!isLongRunDay) {
      if (mainSetDuration + overhead > maxTotalMinutes) {
        mainSetDuration = Math.max(10, maxTotalMinutes - overhead);
      }
    }

    // Determine heart rate zones locally
    const age = athleteProfile.age || 28;
    const coachMaxHr = Number(athleteProfile.maxHeartRate) || (220 - age);
    const coachRestHr = Number(athleteProfile.restingHeartRate) || 60;
    const coachHrR = coachMaxHr - coachRestHr;
    
    const coachZ1Min = Math.round(coachRestHr + coachHrR * 0.50);
    const coachZ1Max = Math.round(coachRestHr + coachHrR * 0.60);
    const coachZ2Min = Math.round(coachRestHr + coachHrR * 0.60);
    const coachZ2Max = Math.round(coachRestHr + coachHrR * 0.70);
    const coachZ3Min = Math.round(coachRestHr + coachHrR * 0.70);
    const coachZ3Max = Math.round(coachRestHr + coachHrR * 0.80);
    const coachZ4Min = Math.round(coachRestHr + coachHrR * 0.80);
    const coachZ4Max = Math.round(coachRestHr + coachHrR * 0.90);
    const coachZ5Min = Math.round(coachRestHr + coachHrR * 0.90);

    // Helper to calculate adjusted pace based on estimated base pace
    const getAdjustedPaceString = (basePaceStr: string, addSecsMin: number, addSecsMax: number): string => {
      try {
        const match = basePaceStr.match(/(\d+):(\d+)/);
        if (!match) return "6:15 - 6:45 min/km";
        const mins = parseInt(match[1]);
        const secs = parseInt(match[2]);
        const totalSeconds = mins * 60 + secs;
        
        const targetMinSecs = totalSeconds + addSecsMin;
        const targetMaxSecs = totalSeconds + addSecsMax;
        
        const format = (total: number) => {
          const m = Math.floor(total / 60);
          const s = total % 60;
          return `${m}:${s.toString().padStart(2, "0")}`;
        };
        
        return `${format(targetMinSecs)} - ${format(targetMaxSecs)} min/km`;
      } catch (e) {
        return "6:15 - 6:45 min/km";
      }
    };

    // Determine readiness status (READY, REDUCE, RECOVER)
    const currentReadiness = readiness || { status: ReadinessStatus.READY, score: 75 };
    const status = currentReadiness.status;

    let finalName = baseWorkout.name;
    let finalDescription = baseWorkout.description;
    let mainHrTarget = "";
    let mainPaceTarget = "";
    let mainDescription = "";
    let finalIntent = baseWorkout.intent;

    let warmupDuration = 10;
    let drillsDuration = 5;
    let cooldownDuration = 5;

    // 2. Adjust parameters based on readiness status (READY, REDUCE, RECOVER)
    const isAdvanced = athleteProfile.fitnessLevel === "advanced" || athleteProfile.fitnessLevel === "elite";

    if (status === ReadinessStatus.REDUCE) {
      // REDUCE: Executar com Ajuste (Score 60 - 80)
      if (isAdvanced) {
        // Advanced Athlete Exception: keep intensity, reduce volume/dosage of intervals
        mainSetDuration = Math.max(10, Math.round(mainSetDuration * 0.75)); // 25% interval reduction
        
        if (baseWorkout.intent === TrainingIntent.THRESHOLD) {
          finalName = `${baseWorkout.name} (Volume Ajustado - Elite)`;
          finalIntent = TrainingIntent.THRESHOLD;
          finalDescription = `Seu nível de prontidão parcial (${currentReadiness.score}/100) acionou a regra de exceção para atletas avançados. Mantivemos o estímulo de limiar planejado na Zona 4, mas reduzimos o volume total de intervalos em 25% para que você execute passadas com alta qualidade técnica sem acumular fadiga excessiva.`;
          mainHrTarget = `${coachZ4Min} - ${coachZ4Max} bpm (Z4)`;
          mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", -15, 5);
          mainDescription = `Mantemos a intensidade de Limiar Fisiológico hoje (Zona 4), porém com volume reduzido em 25% para proteger seu sistema musculoesquelético.`;
        } else if (baseWorkout.intent === TrainingIntent.VO2MAX) {
          finalName = `${baseWorkout.name} (Tiros Reduzidos - Elite)`;
          finalIntent = TrainingIntent.VO2MAX;
          finalDescription = `Atleta avançado em prontidão de ${currentReadiness.score}/100: exceção aplicada. Mantivemos os tiros de VO2 Máx na Zona 5 para manter o recrutamento neuromuscular, mas reduzimos a quantidade de tiros/volume em 25% mantendo o ritmo de qualidade previsto.`;
          mainHrTarget = `${coachZ5Min}+ bpm (Z5)`;
          mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", -35, -15);
          mainDescription = `Estímulo de VO2 Máx mantido (Zona 5), com dosagem reduzida em 25% para preservar sua capacidade fisiológica sem gerar sobrecarga residual.`;
        } else {
          finalName = `${baseWorkout.name} (Volume Adaptado)`;
          finalDescription = `Como atleta avançado em prontidão parcial de ${currentReadiness.score}/100, reduzimos o volume da sua rodagem na Zona 2 em 20% para poupar recursos metabólicos sem perder o ritmo aeróbico.`;
          mainHrTarget = `${coachZ2Min} - ${coachZ2Max} bpm (Z2)`;
          mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", 50, 90) + " (Siga FC Z2)";
          mainDescription = `Volume reduzido em 20% em Zona 2 para favorecer a restauração biológica.`;
        }
      } else {
        // Beginner/Intermediate: convert high-intensity to easy Z2
        mainSetDuration = Math.max(10, Math.round(mainSetDuration * 0.8)); // 20% volume reduction
        
        if (baseWorkout.intent === TrainingIntent.THRESHOLD || baseWorkout.intent === TrainingIntent.VO2MAX) {
          finalName = "Rodagem Aeróbica Controlada Z2";
          finalIntent = TrainingIntent.AEROBIC_BASE;
          finalDescription = `Seu organismo apresenta sinais de recuperação parcial (Prontidão: ${currentReadiness.score}/100). O objetivo de hoje não é gerar novos estímulos intensos, mas consolidar as adaptações dos últimos dias mantendo o sistema aeróbico ativo. Por isso reduzimos o volume e priorizamos uma rodagem confortável na Zona 2.`;
          mainHrTarget = `${coachZ2Min} - ${coachZ2Max} bpm (Z2)`;
          mainPaceTarget = "Pace leve/confortável (Siga FC Z2)";
          mainDescription = "Seu organismo apresenta sinais de recuperação parcial. O objetivo de hoje não é gerar novos estímulos intensos, mas consolidar as adaptações dos últimos dias mantendo o sistema aeróbico ativo. Por isso reduzimos o volume e priorizamos uma rodagem confortável em baixa intensidade.";
        } else {
          finalName = `${baseWorkout.name} (Volume Ajustado)`;
          finalDescription = `Seu organismo apresenta sinais de recuperação parcial (${currentReadiness.score}/100). Mantivemos o treino aeróbico em Zona 2 com volume ajustado para consolidar adaptações recentes e promover sustentabilidade ao ciclo.`;
          mainHrTarget = `${coachZ2Min} - ${coachZ2Max} bpm (Z2)`;
          mainPaceTarget = "Pace leve/confortável (Siga FC Z2)";
          mainDescription = "Seu organismo apresenta sinais de recuperação parcial. Mantemos a rodagem em Zona 2 com volume ajustado para consolidar adaptações e promover recuperação ativa sem sobrecarga.";
        }
      }
    } else if (status === ReadinessStatus.RECOVER) {
      // RECOVER: change workout to ultra-light active recovery
      mainSetDuration = Math.min(25, Math.max(15, mainSetDuration - 15));
      finalIntent = TrainingIntent.RECOVERY;
      finalName = "Rodagem Regenerativa Leve";
      finalDescription = `Seus indicadores fisiológicos de hoje (Prontidão: ${currentReadiness.score}/100) sugerem um dia focado em regeneração ativa. Executamos uma sessão leve para restabelecer a homeostase sem gerar desgaste.`;
      
      warmupDuration = 5;
      drillsDuration = 0; // omit active drills during deep recovery to protect tissues
      cooldownDuration = 5;

      mainHrTarget = `< ${coachZ1Max} bpm (Z1)`;
      mainPaceTarget = "Pace muito leve / Trote ou caminhada ativa";
      mainDescription = "Sessão direcionada para recuperação ativa em Zona 1/caminhada leve para restaurar a homeostase do organismo e assimilar os estímulos acumulados.";
    } else {
      // READY: standard workout
      mainSetDuration = mainSetDuration;
      finalName = baseWorkout.name;
      finalDescription = baseWorkout.description;
      finalIntent = baseWorkout.intent;

      if (baseWorkout.intent === TrainingIntent.THRESHOLD) {
        mainHrTarget = `${coachZ4Min} - ${coachZ4Max} bpm (Z4)`;
        mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", -15, 5);
        mainDescription = "Corra firme no ritmo do seu limiar de lactato. Esforço moderadamente difícil, mas sustentável de forma contínua.";
      } else if (baseWorkout.intent === TrainingIntent.VO2MAX) {
        mainHrTarget = `${coachZ5Min}+ bpm (Z5)`;
        mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", -35, -15);
        mainDescription = "Estímulo de VO2 Máx. Velocidade elevada, esforço difícil. Foco em manter cadência alta e amplitude de passada controlada.";
      } else if (baseWorkout.intent === TrainingIntent.LONG_RUN) {
        mainHrTarget = `${coachZ2Min} - ${coachZ2Max} bpm (Z2)`;
        mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", 50, 90) + " (Siga FC Z2 como prioridade)";
        mainDescription = "Ritmo confortável e consistente de base aeróbica para rodagem longa. Foco na consistência e resistência cardiopulmonar.";
      } else {
        mainHrTarget = `${coachZ2Min} - ${coachZ2Max} bpm (Z2)`;
        mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", 30, 70) + " (Siga FC Z2 como prioridade)";
        mainDescription = "Foco em correr no ritmo prescrito estável da Zona 2. Respiração controlada, permitindo falar frases completas.";
      }
    }

    // Build the dynamic steps array with explicit target pace and recommended HR included
    const steps = [];
    
    // Warmup step
    steps.push({
      id: "warmup",
      title: "1. Aquecimento Gradual (Warmup)",
      durationText: `${warmupDuration} min`,
      hrText: `FC: < ${coachZ1Max} bpm`,
      paceText: "Pace: Trote leve",
      description: "Trote leve e progressivo. Se necessário, inicie com caminhada ativa para elevar os batimentos e preparar o sistema cardiovascular gradualmente."
    });

    // Drills step (if not rest/deep recovery)
    if (drillsDuration > 0) {
      steps.push({
        id: "educational",
        title: "2. Educativos de Corrida (Drills)",
        durationText: `${drillsDuration} min`,
        hrText: "FC: Livre",
        paceText: "Pace: Livre",
        description: "Realize 2 séries de 50 metros de Skipping (elevação de joelhos) e Anfersen (calcanhar no glúteo) para ativar a propriocepção mecânica."
      });
    }

    // Main Set step
    steps.push({
      id: "main",
      title: `3. Bloco Principal (${finalName})`,
      durationText: `${mainSetDuration} min`,
      hrText: `FC Alvo: ${mainHrTarget}`,
      paceText: `Pace Alvo: ${mainPaceTarget}`,
      description: mainDescription
    });

    // Cooldown step
    steps.push({
      id: "cooldown",
      title: "4. Desaquecimento Ativo (Cooldown)",
      durationText: `${cooldownDuration} min`,
      hrText: `FC: < ${coachZ1Min} bpm`,
      paceText: "Pace: Caminhada leve",
      description: "Caminhada ou trote regenerativo extremamente leve para acelerar a remoção de metabólitos, acalmar o sistema cardiovascular e restabelecer a homeostase."
    });

    return {
      ...baseWorkout,
      name: finalName,
      intent: finalIntent,
      durationMinutes: mainSetDuration,
      description: finalDescription,
      steps: steps,
      day: sw.day
    };
  };
  
  // Map the elevated tab from props
  const coachTab = activeTab;
  const setCoachTab = (tab: any) => {};

  // Sub-tab selection for State tab
  const [activeStateSubTab, setActiveStateSubTab] = useState<"analysis" | "chat">("analysis");

  // Helper functions for active activity telemetry
  const formatDuration = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00:00";
    const roundSecs = Math.floor(seconds);
    const hrs = Math.floor(roundSecs / 3600);
    const mins = Math.floor((roundSecs % 3600) / 60);
    const secs = roundSecs % 60;
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const speedToPace = (speedKmh: number): string => {
    if (!speedKmh || speedKmh < 1.0) return "--:--";
    const decimal = 60 / speedKmh;
    const mins = Math.floor(decimal);
    const secs = Math.round((decimal - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")} /km`;
  };

  const getSportIcon = (sport: any, className = "w-4 h-4") => {
    const sportStr = typeof sport === "string" ? sport : String(sport || "");
    switch (sportStr.toLowerCase()) {
      case "running":
      case "run":
        return <Footprints className={className} />;
      case "cycling":
      case "biking":
      case "bike":
        return <Bike className={className} />;
      case "swimming":
      case "swim":
        return <Waves className={className} />;
      case "hiking":
      case "walking":
      case "walk":
        return <Compass className={className} />;
      default:
        return <Activity className={className} />;
    }
  };

  // 1. Daily Metrics State
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics>(() => {
    const saved = localStorage.getItem("fit_daily_metrics_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          hrvBaseline: 55,
          injurySeverity: "mild",
          ...parsed
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      sleepHours: 8.0,
      sleepScore: 82,
      fatigueScore: 3,
      stressScore: 2,
      bodyBattery: 85,
      hrv: 58,
      restingHeartRate: 54,
      muscleSoreness: 2,
      hasInjury: false,
      injurySeverity: "mild",
      hrvBaseline: 55,
      mood: "Bom",
      weight: 79.2,
      garminReadiness: 78,
      subjectiveFeeling: "bem",
      prepScore: 78
    };
  });

  // 2. Local physiological calculation states
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [trainingLoad, setTrainingLoad] = useState<TrainingLoad | null>(null);
  const [showHrvPopup, setShowHrvPopup] = useState(false);
  const [showSubjectivePopup, setShowSubjectivePopup] = useState(false);
  const [showHrvInfoModal, setShowHrvInfoModal] = useState(false);
  const [showReadinessAuditModal, setShowReadinessAuditModal] = useState(false);

  // 3. Training Plan generated state
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // 4. Detail view state for a single prescription
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPrescription | null>(null);

  // 5. Active week in the 4-week cycle
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [simulationSuccess, setSimulationSuccess] = useState<string | null>(null);

  // Centralized custom confirmation modal state to bypass iframe window.confirm blocks
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  // States for interactive Workout Library
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryActiveCategory, setLibraryActiveCategory] = useState<string>("all");
  const [copiedItemName, setCopiedItemName] = useState<string | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<LibraryItem | null>(null);

  const handleCopyText = (text: string, itemName: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedItemName(itemName);
      setTimeout(() => {
        setCopiedItemName(null);
      }, 2000);
    } catch (err) {
      console.error("Could not copy text: ", err);
    }
  };

  // 5b. Physiological Progress History State (Starts empty for new users and persists)
  const [progressHistory, setProgressHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem("fit_physiological_progress_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Failed to parse progress history:", e);
      }
    }
    // Default empty array for new users as requested
    return [];
  });

  const [listFilter, setListFilter] = useState<"last10" | "lastWeek" | "lastMonth" | "all">("last10");

  const [historyWeight, setHistoryWeight] = useState<string>("79.2");
  const [historyWeeklyKm, setHistoryWeeklyKm] = useState<string>("34.0");
  const [historyPace, setHistoryPace] = useState<string>("5:05");
  const [historyHeartRate, setHistoryHeartRate] = useState<string>("53");
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Sync back to localStorage when changed
  useEffect(() => {
    localStorage.setItem("fit_physiological_progress_history", JSON.stringify(progressHistory));
  }, [progressHistory]);

  const handleAddProgressPoint = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(historyWeight);
    const k = parseFloat(historyWeeklyKm);
    const hr = parseInt(historyHeartRate);
    if (isNaN(w) || isNaN(k) || isNaN(hr) || !historyPace.trim()) {
      alert("Por favor, preencha todos os campos com valores numéricos válidos.");
      return;
    }

    const newPoint = {
      date: historyDate,
      weight: w,
      weeklyKm: k,
      pace: historyPace.trim(),
      heartRate: hr
    };

    setProgressHistory(prev => {
      const filtered = prev.filter(p => p.date !== historyDate);
      const updated = [...filtered, newPoint].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return updated;
    });

    setSimulationSuccess("Sucesso! Novo ponto de evolução fisiológica registrado no histórico.");
    setTimeout(() => setSimulationSuccess(null), 3000);
  };

  const handleClearProgressHistory = () => {
    triggerConfirm(
      "Limpar Histórico Fisiológico",
      "Deseja realmente limpar seu histórico de evolução fisiológica? Esta ação removerá todos os registros inseridos.",
      () => {
        setProgressHistory([]);
        localStorage.removeItem("fit_physiological_progress_history");
      }
    );
  };

  // 5c. Custom Workout JSON Import and Physiological Analysis States
  // Local Upload states for FIT files
  const [localIsDragging, setLocalIsDragging] = useState(false);
  const localFileInputRef = React.useRef<HTMLInputElement>(null);

  const localHandleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setLocalIsDragging(true);
  };

  const localHandleDragLeave = () => {
    setLocalIsDragging(false);
  };

  const localHandleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLocalIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0] && handleFileUpload) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const localOnUploadClick = () => {
    localFileInputRef.current?.click();
  };

  const localOnFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && handleFileUpload) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const [customWorkoutJson, setCustomWorkoutJson] = useState<string>(() => {
    return JSON.stringify({
      name: "Fartlek adaptativo",
      steps: [
        { type: "warmup", duration: "15 min", description: "Aquecimento leve e gradual em zona 1/2" },
        { type: "interval", repeat: 6, duration: "3 min forte / 2 min leve", description: "Esforço submáximo alternado de corrida" },
        { type: "cooldown", duration: "10 min", description: "Desaquecimento ou trote regenerativo" }
      ]
    }, null, 2);
  });
  
  const [parsedCustomWorkout, setParsedCustomWorkout] = useState<any>(() => {
    return {
      name: "Fartlek adaptativo",
      steps: [
        { type: "warmup", duration: "15 min", description: "Aquecimento leve e gradual em zona 1/2" },
        { type: "interval", repeat: 6, duration: "3 min forte / 2 min leve", description: "Esforço submáximo alternado de corrida" },
        { type: "cooldown", duration: "10 min", description: "Desaquecimento ou trote regenerativo" }
      ]
    };
  });
  
  const [customWorkoutError, setCustomWorkoutError] = useState<string | null>(null);
  const [customWorkoutAnalysis, setCustomWorkoutAnalysis] = useState<string>("");
  const [isAnalyzingCustom, setIsAnalyzingCustom] = useState<boolean>(false);

  const handleApplyCustomJson = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.name) {
        throw new Error("O JSON precisa conter uma propriedade 'name'.");
      }
      if (!parsed.steps || !Array.isArray(parsed.steps)) {
        throw new Error("O JSON precisa conter um array 'steps' de passos do treino.");
      }
      setParsedCustomWorkout(parsed);
      setCustomWorkoutError(null);
      setCustomWorkoutJson(jsonStr);
      setCustomWorkoutAnalysis(""); // Reset previous AI feedback
      
      setSimulationSuccess("Treino customizado '" + parsed.name + "' importado com sucesso!");
      setTimeout(() => setSimulationSuccess(null), 3000);
    } catch (e: any) {
      setCustomWorkoutError(e.message || "Formato JSON inválido.");
    }
  };

  const handleAnalyzeCustomWorkout = async () => {
    if (!parsedCustomWorkout || isAnalyzingCustom) return;
    setIsAnalyzingCustom(true);
    setCustomWorkoutAnalysis("");

    try {
      const response = await fetch("/api/coach-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          athleteProfile,
          message: `Por favor, faça uma análise científica de fisiologia esportiva detalhada para o seguinte treino customizado que acabo de carregar/importar no aplicativo. Explique de forma clara o impacto metabólico no meu organismo, zonas de FC estimadas, e dê dicas baseadas no meu perfil atual (Idade: ${athleteProfile.age || "46"} anos, Peso atual: ${athleteProfile.weightCurrentKg || "80"} kg, Objetivo: ${athleteProfile.objective || "condicionamento geral"}).

Treino Carregado:
${JSON.stringify(parsedCustomWorkout, null, 2)}

Por favor, estruture a sua resposta em tópicos claros em Português do Brasil (PT-BR):
- 🎯 RESUMO DO ESTÍMULO (Objetivo principal)
- ⚡ IMPACTO FISIOLÓGICO (Vias energéticas predominantes, adaptações cardíacas)
- 📝 RECOMENDAÇÕES INDIVIDUAIS (Como eu devo executar este treino com segurança e máxima eficiência)`
        })
      });

      if (!response.ok) {
        let errMsg = "Erro na conexão com o servidor de inteligência esportiva.";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          }
        } catch {}
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("O servidor de inteligência esportiva retornou um formato inválido de resposta (esperado JSON, mas recebido HTML). Por favor, verifique se o servidor está ativo.");
      }

      const data = await response.json();
      if (data.success && data.reply) {
        setCustomWorkoutAnalysis(data.reply);
      } else {
        throw new Error("Resposta inesperada do servidor.");
      }
    } catch (err: any) {
      setCustomWorkoutAnalysis(`⚠️ Falha ao obter análise de fisiologia do exercício: ${err.message || "Erro desconhecido"}`);
    } finally {
      setIsAnalyzingCustom(false);
    }
  };

  // 6. Dynamic calculations update
  const history = getTrainingHistory();

  // 7. Interactive AI Coach Chat states
  const [chatMessages, setChatMessages] = useState<any[]>(() => {
    const saved = localStorage.getItem("fit_coach_chat_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
        }));
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        role: "model",
        text: `Olá, ${athleteProfile.name || "Atleta"}! Sou o seu Treinador Virtual Aetheris Fit. 🏃‍♂️🚴‍♂️\n\nEstou aqui para responder suas perguntas sobre fisiologia do exercício, periodização, nutrição esportiva e análise do seu desempenho físico. \n\nNo que posso ajudar na sua preparação esportiva hoje?`,
        timestamp: new Date()
      }
    ];
  });
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Auto-save chat history to localStorage
  useEffect(() => {
    localStorage.setItem("fit_coach_chat_history", JSON.stringify(chatMessages));
  }, [chatMessages]);

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessageText = chatInput.trim();
    setChatInput("");
    setIsChatLoading(true);

    const newUserMessage = {
      role: "user",
      text: userMessageText,
      timestamp: new Date()
    };

    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);

    try {
      // Prepare history formatted for API
      const historyPayload = chatMessages.map((m) => ({
        role: m.role,
        parts: m.text
      }));

      const response = await fetch("/api/coach-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          athleteProfile,
          chatHistory: historyPayload,
          message: userMessageText,
          readiness,
          trainingHistory: history
        })
      });

      if (!response.ok) {
        let errMsg = "Erro de rede ou conexão com o Treinador IA.";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          }
        } catch {}
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("O servidor de inteligência esportiva retornou um formato inválido de resposta (esperado JSON, mas recebido HTML). Por favor, verifique se o servidor está ativo.");
      }

      const data = await response.json();
      if (data.success && data.reply) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: data.reply,
            timestamp: new Date()
          }
        ]);
      } else {
        throw new Error("Erro ao receber resposta do Treinador.");
      }
    } catch (err: any) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: `⚠️ Desculpe, não consegui conectar ao servidor de inteligência esportiva. Verifique sua conexão. (Erro: ${err.message || "desconhecido"})`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChat = () => {
    triggerConfirm(
      "Limpar Conversa",
      "Deseja realmente limpar todo o histórico de conversa com o treinador?",
      () => {
        const initialMsg = [
          {
            role: "model",
            text: `Conversa reiniciada. Olá, ${athleteProfile.name || "Atleta"}! Como posso orientar seus treinos hoje?`,
            timestamp: new Date()
          }
        ];
        setChatMessages(initialMsg);
        localStorage.setItem("fit_coach_chat_history", JSON.stringify(initialMsg));
      }
    );
  };

  useEffect(() => {
    const tl = calculateTrainingLoad(history, athleteProfile.currentWeekKm || 0, dailyMetrics.daysWithoutTraining || 0);
    setTrainingLoad(tl);

    const r = calculateReadiness(dailyMetrics, tl.acuteChronicRatio);
    setReadiness(r);
    
    localStorage.setItem("fit_daily_metrics_v2", JSON.stringify(dailyMetrics));
  }, [dailyMetrics, athleteProfile.currentWeekKm, history.weekDistanceKm, history.monthDistanceKm]);

  // Load saved plan from localStorage if exists
  useEffect(() => {
    const savedPlan = localStorage.getItem("fit_coach_training_plan");
    if (savedPlan) {
      try {
        setTrainingPlan(JSON.parse(savedPlan));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Today's workout interactive completion and feedback states
  const [todayWorkoutCompleted, setTodayWorkoutCompleted] = useState<boolean>(() => {
    return localStorage.getItem("fit_today_completed") === "true";
  });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(() => {
    return localStorage.getItem("fit_today_feedback_submitted") === "true";
  });
  const [rpeScore, setRpeScore] = useState<number>(() => {
    return parseInt(localStorage.getItem("fit_today_rpe") || "5");
  });
  const [musclePain, setMusclePain] = useState<string>(() => {
    return localStorage.getItem("fit_today_pain") || "Nenhuma";
  });
  const [workoutComment, setWorkoutComment] = useState<string>(() => {
    return localStorage.getItem("fit_today_comment") || "";
  });
  const [coachFeedbackReply, setCoachFeedbackReply] = useState<string>(() => {
    return localStorage.getItem("fit_today_coach_reply") || "";
  });
  const [checklistItems, setChecklistItems] = useState<{[key: string]: boolean}>(() => {
    const saved = localStorage.getItem("fit_today_checklist");
    return saved ? JSON.parse(saved) : {};
  });
  const [blockTimes, setBlockTimes] = useState<{[key: string]: number}>(() => {
    const saved = localStorage.getItem("fit_today_block_times");
    return saved ? JSON.parse(saved) : {};
  });
  const [completedBlocksSummary, setCompletedBlocksSummary] = useState<any[]>(() => {
    const saved = localStorage.getItem("fit_today_completed_blocks");
    return saved ? JSON.parse(saved) : [];
  });
  const [isCoachThinking, setIsCoachThinking] = useState(false);
  const [showGarminToast, setShowGarminToast] = useState(false);

  // Sync today's interactive states to localStorage
  useEffect(() => {
    localStorage.setItem("fit_today_completed", todayWorkoutCompleted.toString());
    localStorage.setItem("fit_today_feedback_submitted", feedbackSubmitted.toString());
    localStorage.setItem("fit_today_rpe", rpeScore.toString());
    localStorage.setItem("fit_today_pain", musclePain);
    localStorage.setItem("fit_today_comment", workoutComment);
    localStorage.setItem("fit_today_coach_reply", coachFeedbackReply);
    localStorage.setItem("fit_today_checklist", JSON.stringify(checklistItems));
    localStorage.setItem("fit_today_block_times", JSON.stringify(blockTimes));
    localStorage.setItem("fit_today_completed_blocks", JSON.stringify(completedBlocksSummary));
  }, [todayWorkoutCompleted, feedbackSubmitted, rpeScore, musclePain, workoutComment, coachFeedbackReply, checklistItems, blockTimes, completedBlocksSummary]);

  // Calcula de forma dinâmica a Monotonia e Training Strain para a semana selecionada
  const monotonyData = useMemo(() => {
    if (!trainingPlan) return { monotony: 1.0, strain: 0, weeklyLoads: [] as number[] };
    
    const activeWeekIdx = Math.min(selectedWeekIdx, (trainingPlan.cycles[0]?.weeks?.length || 1) - 1);
    const workouts = trainingPlan.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
    
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    
    const loads = days.map(dayName => {
      const sw = workouts.find((w: any) => w.day === dayName);
      if (!sw || !sw.workout || sw.workout.intent === "rest" || sw.workout.intent === "rest_day") {
        return 0;
      }
      
      const duration = Number(sw.workout.durationMinutes) || 40;
      let estimatedRpe = 4;
      let estimatedHr = 135;
      if (sw.workout.intent === "threshold") {
        estimatedRpe = 7;
        estimatedHr = 165;
      } else if (sw.workout.intent === "vo2max") {
        estimatedRpe = 9;
        estimatedHr = 175;
      } else if (sw.workout.intent === "long_run") {
        estimatedRpe = 5;
        estimatedHr = 142;
      } else if (sw.workout.intent === "recovery") {
        estimatedRpe = 3;
        estimatedHr = 120;
      }
      
      return calculateActivityLoad(duration, estimatedRpe, estimatedHr);
    });

    const todayName = days[new Date().getDay()];
    if (todayWorkoutCompleted) {
      const todayIdx = new Date().getDay();
      const sw = workouts.find((w: any) => w.day === todayName);
      if (sw && sw.workout) {
        const duration = Number(sw.workout.durationMinutes) || 40;
        loads[todayIdx] = calculateActivityLoad(duration, rpeScore, 135);
      }
    }

    // Se houver dias consecutivos sem treino (descanso passivo/ausência), zera a carga dos últimos N dias na janela
    if (dailyMetrics.daysWithoutTraining && dailyMetrics.daysWithoutTraining > 0) {
      const restDays = Math.min(7, dailyMetrics.daysWithoutTraining);
      const todayIdx = new Date().getDay();
      for (let i = 0; i < restDays; i++) {
        const targetIdx = (todayIdx - i + 7) % 7;
        loads[targetIdx] = 0;
      }
    }
    
    const result = calculateMonotonyAndStrain(loads);
    
    return {
      monotony: result.monotony,
      strain: result.strain,
      weeklyLoads: loads
    };
  }, [trainingPlan, selectedWeekIdx, todayWorkoutCompleted, rpeScore, dailyMetrics.daysWithoutTraining]);

  const handleStateSubmit = () => {
    setIsCoachThinking(true);
    // Recalculate readiness using current training load ACWR (incorporating rest days)
    const tl = calculateTrainingLoad(history, athleteProfile.currentWeekKm || 0, dailyMetrics.daysWithoutTraining || 0);
    const r = calculateReadiness(dailyMetrics, tl.acuteChronicRatio);
    setReadiness(r);
    
    // Automatically transition to today's workout after the coach "thinks"
    setTimeout(() => {
      setIsCoachThinking(false);
      if (setActiveTab) {
        setActiveTab("today");
      }
    }, 1500);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate intelligent coaching feedback based on RPE and muscle soreness
    let responseText = "";
    const athleteName = athleteProfile.name || "Atleta";
    
    if (rpeScore <= 2) {
      responseText = `Excelente treino de rodagem regenerativa, ${athleteName}! Você manteve as batidas na zona certa para regeneração de substratos e limpeza de lactato. O objetivo era ser muito fácil, e você respeitou o plano com disciplina.`;
    } else if (rpeScore <= 4) {
      responseText = `Sessão aeróbica sólida concluída, ${athleteName}! Manter esse esforço sob controle é exatamente o que constrói sua base de capilarização mitocondrial e biogênese de novas mitocôndrias. Continue com essa disciplina de ritmo; correr devagar é o segredo para correr rápido no futuro.`;
    } else if (rpeScore <= 6) {
      responseText = `Belo treino, ${athleteName}! Esse ritmo moderado foi excelente para melhorar sua eficiência aeróbica e tolerância metabólica ao esforço prolongado. O volume foi perfeito e você soube gerenciar bem o ritmo de ponta a ponta.`;
    } else if (rpeScore <= 8) {
      responseText = `Trabalho duro e muito bem executado, ${athleteName}! Esse estímulo mais forte no limiar de lactato ensina seu corpo a tolerar e reciclar o ácido lático de forma muito mais eficiente. Capriche no consumo de proteínas e carboidratos, reidrate-se bem e priorize o descanso hoje.`;
    } else {
      responseText = `Estímulo máximo alcançado, ${athleteName}! Sessão intensa que trabalha seu VO2 máx e recrutamento de fibras do Tipo II. É normal sentir dor muscular ou cansaço acentuado nas próximas horas. Priorize gelo, ingestão adequada de micronutrientes e pelo menos 8 horas de sono de qualidade.`;
    }
    
    if (musclePain === "Forte" || musclePain === "Moderada") {
      responseText += ` Notei que você relatou dor muscular ${musclePain.toLowerCase()}. Fique de olho na rodagem de amanhã. Se a dor persistir ou se tornar articular, o motor de decisão do Running Coach irá ajustar seu próximo treino para regenerativo ou propor descanso ativo. A integridade física vem sempre em primeiro lugar.`;
    } else {
      responseText += " Sua integridade muscular parece excelente para a próxima sessão de treinamento.";
    }

    setCoachFeedbackReply(responseText);
    setFeedbackSubmitted(true);
  };

  const parseStepMinutes = (step: any): number => {
    if (step.durationSeconds) {
      return Math.max(1, Math.round(step.durationSeconds / 60));
    }
    if (step.durationText) {
      const match = step.durationText.match(/(\d+)\s*min/i);
      if (match) return parseInt(match[1]);
    }
    return 10;
  };

  const handleCompleteWorkoutWithBlocks = (targetWorkout?: any) => {
    const w = targetWorkout || getTodayWorkout();
    if (w && w.steps) {
      const blocksData = w.steps.map((step: any) => {
        const isSelected = checklistItems[step.id] !== false;
        const practicedMins = blockTimes[step.id] ?? parseStepMinutes(step);
        return {
          id: step.id,
          title: step.title || step.name,
          plannedDuration: step.durationText || `${parseStepMinutes(step)} min`,
          practicedMinutes: practicedMins,
          isSelected: isSelected
        };
      });
      setCompletedBlocksSummary(blocksData);
      localStorage.setItem("fit_today_completed_blocks", JSON.stringify(blocksData));
    }

    if (w && w.day) {
      localStorage.setItem(`fit_workout_completed_${w.day}_w${selectedWeekIdx + 1}`, "true");
    }
    localStorage.setItem("fit_today_completed", "true");
    setTodayWorkoutCompleted(true);
  };

  const resetTodayWorkout = () => {
    setTodayWorkoutCompleted(false);
    setFeedbackSubmitted(false);
    setRpeScore(5);
    setMusclePain("Nenhuma");
    setWorkoutComment("");
    setCoachFeedbackReply("");
    setChecklistItems({});
    setBlockTimes({});
    setCompletedBlocksSummary([]);
    localStorage.removeItem("fit_today_completed");
    localStorage.removeItem("fit_today_feedback_submitted");
    localStorage.removeItem("fit_today_rpe");
    localStorage.removeItem("fit_today_pain");
    localStorage.removeItem("fit_today_comment");
    localStorage.removeItem("fit_today_coach_reply");
    localStorage.removeItem("fit_today_checklist");
    localStorage.removeItem("fit_today_block_times");
    localStorage.removeItem("fit_today_completed_blocks");
    const currentTodayW = getTodayWorkout();
    if (currentTodayW && currentTodayW.day) {
      localStorage.removeItem(`fit_workout_completed_${currentTodayW.day}_w${selectedWeekIdx + 1}`);
    }
  };

  const exportToGarmin = (workout: any) => {
    // Generate Garmin-structured training steps
    const garminWorkout = {
      workoutName: workout.name,
      sport: "RUNNING",
      steps: [
        {
          stepType: "WARMUP",
          duration: "10:00",
          targetType: "HEART_RATE_ZONE",
          targetValue: "ZONE_1"
        },
        {
          stepType: "ACTIVE",
          duration: `${workout.durationMinutes}:00`,
          targetType: "HEART_RATE_ZONE",
          targetValue: "ZONE_2",
          targetBpmMax: coachZ2Max
        },
        {
          stepType: "COOLDOWN",
          duration: "5:00",
          targetType: "HEART_RATE_ZONE",
          targetValue: "ZONE_1"
        }
      ]
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(garminWorkout, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `garmin_workout_${workout.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setShowGarminToast(true);
    setTimeout(() => {
      setShowGarminToast(false);
    }, 4000);
  };

  // Load activities list from localStorage to calculate actual load for report
  const [localSavedList, setLocalSavedList] = useState<any[]>([]);
  useEffect(() => {
    const listStr = localStorage.getItem("fit_activity_list");
    if (listStr) {
      try {
        setLocalSavedList(JSON.parse(listStr));
      } catch (e) {
        console.error(e);
      }
    }
  }, [trainingPlan]); // update whenever plan updates

  // Periodize a 1-week plan into a complete 4-week physiological training cycle
  const enrichPlanWithCycle = (plan: TrainingPlan): TrainingPlan => {
    if (!plan.cycles || plan.cycles.length === 0) {
      plan.cycles = [{ cycleNumber: 1, weeks: [] }];
    }
    
    const cycle = plan.cycles[0];
    if (cycle.weeks && cycle.weeks.length >= 4) {
      return plan;
    }
    
    const baseWeek = cycle.weeks[0] || {
      weekNumber: 1,
      phase: "Construção de Base",
      workouts: []
    };
    
    const weeks: WeeklyPlan[] = [
      {
        ...baseWeek,
        weekNumber: 1,
        phase: "Construção de Base",
      }
    ];
    
    // Week 2: Volume Progression (+10% volume, more reps for intervals)
    const week2Workouts = baseWeek.workouts.map((sw: any) => {
      const originalW = sw.workout;
      const isQuality = originalW.intent === "vo2max" || originalW.intent === "threshold";
      const isEasyOrLong = originalW.intent === "aerobic_base" || originalW.intent === "long_run";
      
      let scale = 1.10;
      let durationMinutes = Math.round(originalW.durationMinutes * scale);
      let name = originalW.name;
      if (isEasyOrLong) {
        name = `${originalW.name} (Acúmulo de Volume)`;
      } else if (isQuality) {
        name = `${originalW.name} (+Intensidade)`;
      }
      
      const steps = originalW.steps ? originalW.steps.map((step: any) => {
        const stepCopy = { ...step };
        if (stepCopy.stepType === "main_set") {
          if (stepCopy.repetitions) {
            stepCopy.repetitions = stepCopy.repetitions + 1;
          } else {
            stepCopy.durationSeconds = Math.round(stepCopy.durationSeconds * scale);
          }
        } else {
          stepCopy.durationSeconds = Math.round(stepCopy.durationSeconds * 1.05);
        }
        return stepCopy;
      }) : [];
      
      return {
        day: sw.day,
        workout: {
          ...originalW,
          name,
          durationMinutes,
          steps
        }
      };
    });
    
    weeks.push({
      weekNumber: 2,
      phase: "Progressão de Volume",
      workouts: week2Workouts
    });
    
    // Week 3: Peak Intensity (Higher reps, reduced rest for intervals)
    const week3Workouts = baseWeek.workouts.map((sw: any) => {
      const originalW = sw.workout;
      const isQuality = originalW.intent === "vo2max" || originalW.intent === "threshold";
      const isLong = originalW.intent === "long_run";
      
      let scale = 1.15;
      let durationMinutes = Math.round(originalW.durationMinutes * scale);
      let name = originalW.name;
      if (isLong) {
        name = `${originalW.name} (Pico de Distância)`;
      } else if (isQuality) {
        name = `${originalW.name} (Pico de Intervalados)`;
      }
      
      const steps = originalW.steps ? originalW.steps.map((step: any) => {
        const stepCopy = { ...step };
        if (stepCopy.stepType === "main_set") {
          if (stepCopy.repetitions) {
            stepCopy.repetitions = stepCopy.repetitions + 2;
            if (stepCopy.recoverySeconds) {
               stepCopy.recoverySeconds = Math.max(45, Math.round(stepCopy.recoverySeconds * 0.85));
            }
          } else {
            stepCopy.durationSeconds = Math.round(stepCopy.durationSeconds * scale);
          }
        }
        return stepCopy;
      }) : [];
      
      return {
        day: sw.day,
        workout: {
          ...originalW,
          name,
          durationMinutes,
          steps
        }
      };
    });
    
    weeks.push({
      weekNumber: 3,
      phase: "Pico de Estímulo",
      workouts: week3Workouts
    });
    
    // Week 4: Taper & Recovery (-30% volume, cut reps, light intensity)
    const week4Workouts = baseWeek.workouts.map((sw: any) => {
      const originalW = sw.workout;
      const isQuality = originalW.intent === "vo2max" || originalW.intent === "threshold";
      const isRest = originalW.intent === "rest";
      
      let scale = 0.65;
      let durationMinutes = Math.round(originalW.durationMinutes * scale);
      let name = originalW.name;
      if (!isRest) {
        name = `${originalW.name} (Polimento e Descarga)`;
      }
      
      const steps = originalW.steps ? originalW.steps.map((step: any) => {
        const stepCopy = { ...step };
        if (stepCopy.stepType === "main_set") {
          if (stepCopy.repetitions) {
            stepCopy.repetitions = Math.max(2, Math.round(stepCopy.repetitions * 0.5));
          } else {
            stepCopy.durationSeconds = Math.round(stepCopy.durationSeconds * scale);
          }
        } else {
          stepCopy.durationSeconds = Math.round(stepCopy.durationSeconds * 0.8);
        }
        return stepCopy;
      }) : [];
      
      return {
        day: sw.day,
        workout: {
          ...originalW,
          name,
          durationMinutes,
          steps
        }
      };
    });
    
    weeks.push({
      weekNumber: 4,
      phase: "Polimento & Descarga",
      workouts: week4Workouts
    });
    
    return {
      ...plan,
      cycles: [
        {
          ...cycle,
          weeks
        }
      ]
    };
  };

  // Save plan helper
  const savePlan = (plan: TrainingPlan) => {
    const enriched = enrichPlanWithCycle(plan);
    setTrainingPlan(enriched);
    setSelectedWeekIdx(0); // Reset to week 1 on new plan
    localStorage.setItem("fit_coach_training_plan", JSON.stringify(enriched));
    
    // Auto-clear workout completion state when generating a new plan
    for (let w = 1; w <= 4; w++) {
      const days = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
      days.forEach(day => {
        localStorage.removeItem(`fit_workout_completed_${day}_w${w}`);
      });
    }
  };

  // Manual clear plan helper
  const clearPlan = () => {
    triggerConfirm(
      "Limpar Planilha",
      "Deseja realmente limpar a planilha atual? Todos os treinos concluídos e o planejamento atual serão apagados de forma irreversível.",
      () => {
        setTrainingPlan(null);
        localStorage.removeItem("fit_coach_training_plan");
        for (let w = 1; w <= 4; w++) {
          const days = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
          days.forEach(day => {
            localStorage.removeItem(`fit_workout_completed_${day}_w${w}`);
          });
        }
        setSelectedWorkout(null);
      }
    );
  };

  // Generate Plan via backend API
  const generatePlan = async () => {
    setIsGeneratingPlan(true);
    setPlanError(null);
    try {
      const response = await fetch("/api/generate-training-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          athleteProfile,
          dailyMetrics,
          trainingHistory: history,
          readiness
        })
      });

      if (!response.ok) {
        let errMsg = "Erro de conexão ao servidor de IA.";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          } else {
            const text = await response.text();
            if (text && text.trim().startsWith("{")) {
              const parsed = JSON.parse(text);
              errMsg = parsed.error || errMsg;
            } else if (text && text.length < 300 && !text.includes("<!DOCTYPE") && !text.includes("<!doctype")) {
              errMsg = text;
            }
          }
        } catch {}
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("O servidor de inteligência esportiva retornou um formato inválido de resposta (esperado JSON, mas recebido HTML). Por favor, verifique se o servidor está ativo.");
      }

      const data = await response.json();
      if (data.success && data.trainingPlan) {
        savePlan(data.trainingPlan);
      } else {
        throw new Error("Resposta inválida do assistente técnico.");
      }
    } catch (err: any) {
      console.error(err);
      setPlanError(err.message || "Não foi possível gerar a planilha de treinos.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Adjust a workout adaptively based on readiness score
  const handleAdaptiveAdjust = (workout: any) => {
    if (!trainingPlan) return;
    
    const updatedPlan = JSON.stringify(trainingPlan);
    const planCopy: TrainingPlan = JSON.parse(updatedPlan);
    
    const activeWeekIdx = Math.min(selectedWeekIdx, (planCopy.cycles[0]?.weeks?.length || 1) - 1);
    const week = planCopy.cycles[0]?.weeks[activeWeekIdx];
    if (!week) return;
    
    const sw = week.workouts.find((w: any) => w.workout.name === workout.name || (w.workout.name + " (Adaptado)") === workout.name || w.workout.name.startsWith(workout.name));
    if (!sw) return;
    
    const targetW = sw.workout;
    targetW.name = `${targetW.name} (Adaptado)`;
    targetW.isAdapted = true;
    
    const scale = readiness?.status === "RECOVER" ? 0.5 : 0.7;
    targetW.durationMinutes = Math.round(targetW.durationMinutes * scale);
    targetW.description = `${targetW.description} [Ajustado fisiologicamente devido à prontidão de ${readiness?.score}/100].`;
    
    targetW.steps = targetW.steps.map((step: any) => {
      const stepCopy = { ...step };
      if (stepCopy.stepType === "main_set") {
        if (stepCopy.repetitions) {
          stepCopy.repetitions = Math.max(1, Math.round(stepCopy.repetitions * scale));
        } else {
          stepCopy.durationSeconds = Math.round(stepCopy.durationSeconds * scale);
        }
      }
      return stepCopy;
    });
    
    setTrainingPlan(planCopy);
    localStorage.setItem("fit_coach_training_plan", JSON.stringify(planCopy));
    setSelectedWorkout({ ...targetW, day: sw.day });
  };

  // Simulate completion of a workout, generating highly realistic FIT file style telemetry
  const handleSimulateWorkout = (workout: any) => {
    const id = "sim_" + Date.now();
    const durationMinutes = workout.durationMinutes || 40;
    const durationSeconds = durationMinutes * 60;
    
    let paceMinPerKm = 5.5;
    let avgHeartRate = 142;
    let maxHeartRate = 158;
    let avgCadence = 172;
    let avgPower = 220;
    let calories = durationMinutes * 10;
    
    if (workout.intent === "recovery") {
      paceMinPerKm = 6.25;
      avgHeartRate = 122;
      maxHeartRate = 135;
      avgCadence = 168;
      avgPower = 180;
    } else if (workout.intent === "threshold") {
      paceMinPerKm = 4.5;
      avgHeartRate = 162;
      maxHeartRate = 175;
      avgCadence = 176;
      avgPower = 260;
    } else if (workout.intent === "vo2max") {
      paceMinPerKm = 3.8;
      avgHeartRate = 174;
      maxHeartRate = 188;
      avgCadence = 180;
      avgPower = 295;
    } else if (workout.intent === "long_run") {
      paceMinPerKm = 5.75;
      avgHeartRate = 145;
      maxHeartRate = 162;
      avgCadence = 170;
      avgPower = 215;
    }
    
    const distanceKm = Math.round((durationMinutes / paceMinPerKm) * 10) / 10;
    const avgSpeedKmh = Math.round((60 / paceMinPerKm) * 10) / 10;
    
    const pointsCount = Math.max(10, Math.round(durationMinutes / 2));
    const records: any[] = [];
    const gpsPath: [number, number][] = [];
    
    const startLat = 37.7749;
    const startLng = -122.4194;
    
    for (let i = 0; i < pointsCount; i++) {
      const pct = i / (pointsCount - 1);
      const secondsOffset = Math.round(pct * durationSeconds);
      const timeStr = new Date(Date.now() - (durationSeconds - secondsOffset) * 1000).toISOString();
      
      const angle = pct * Math.PI * 2;
      const latOffset = Math.sin(angle) * 0.005;
      const lngOffset = Math.cos(angle) * 0.005;
      
      const recordLat = startLat + latOffset;
      const recordLng = startLng + lngOffset;
      
      gpsPath.push([recordLat, recordLng]);
      
      const recordDist = pct * distanceKm;
      const recordAlt = 120 + Math.sin(pct * Math.PI * 3) * 15;
      const recordSpeed = avgSpeedKmh + Math.sin(i) * 0.4;
      const recordHR = Math.round(avgHeartRate + Math.sin(i / 1.5) * 6);
      
      records.push({
        id: i + 1,
        timestamp: timeStr,
        lat: recordLat,
        lng: recordLng,
        distance: recordDist,
        altitude: recordAlt,
        speed: recordSpeed,
        heartRate: recordHR,
        cadence: avgCadence + Math.round(Math.sin(i) * 3),
        power: avgPower + Math.round(Math.sin(i) * 10),
        temperature: 18
      });
    }
    
    const filename = `simulado_${workout.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.fit`;
    
    const summary = {
      distanceKm,
      durationSeconds,
      avgSpeedKmh,
      maxSpeedKmh: Math.round(avgSpeedKmh * 1.25 * 10) / 10,
      avgHeartRate,
      maxHeartRate,
      calories,
      ascentMeters: 35,
      descentMeters: 35,
      avgPower,
      maxPower: Math.round(avgPower * 1.3),
      avgCadence
    };
    
    const aiAnalysis = {
      title: workout.name,
      summary: `Excelente execução do treino prescrito para o dia (${workout.day}).`,
      coachingInsights: `Sessão completada com ótima regulação cardiovascular. Seu ritmo médio foi de ${paceToPaceString(avgSpeedKmh)}, mantendo a frequência cardíaca média em ${avgHeartRate} bpm. Isso demonstra excelente conformidade com o plano prescrito para a Fase ${trainingPlan?.cycles[0]?.weeks[selectedWeekIdx]?.phase}.`,
      suggestedRecovery: "14 horas de recuperação total sugeridas.",
      trainingEffect: "Consolidação cardiovascular e desenvolvimento da economia de corrida."
    };
    
    const simulatedActivity = {
      id,
      filename,
      sport: "running",
      startTime: new Date().toISOString(),
      summary,
      gpsPath,
      records,
      aiAnalysis,
      aiEnabled: true,
      uploadedAt: new Date().toISOString()
    };
    
    const listItem = {
      id,
      filename,
      sport: "running",
      startTime: simulatedActivity.startTime,
      distanceKm,
      durationSeconds,
      title: workout.name,
      uploadedAt: simulatedActivity.uploadedAt
    };
    
    const currentListStr = localStorage.getItem("fit_activity_list") || "[]";
    let list: any[] = [];
    try {
      list = JSON.parse(currentListStr);
    } catch (e) {
      list = [];
    }
    
    list.unshift(listItem);
    localStorage.setItem("fit_activity_list", JSON.stringify(list));
    localStorage.setItem(`fit_activity_data_${id}`, JSON.stringify(simulatedActivity));
    
    localStorage.setItem(`fit_workout_completed_${workout.day}_w${selectedWeekIdx + 1}`, "true");
    
    setSimulationSuccess(`Sucesso! Treino de ${workout.day} (${workout.name}) concluído com sucesso e sincronizado no Garmin / Uplink!`);
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };
  
  const paceToPaceString = (speedKmh: number): string => {
    if (!speedKmh || speedKmh < 1.0) return "--:-- /km";
    const decimal = 60 / speedKmh;
    const mins = Math.floor(decimal);
    const secs = Math.round((decimal - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")} /km`;
  };

  // Status Badge Helper
  const getReadinessBadge = (status: ReadinessStatus) => {
    switch (status) {
      case ReadinessStatus.READY:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            EXECUTAR NORMALMENTE
          </span>
        );
      case ReadinessStatus.REDUCE:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            EXECUTAR COM AJUSTE
          </span>
        );
      case ReadinessStatus.RECOVER:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            REDUZIR SIGNIFICATIVAMENTE
          </span>
        );
    }
  };

  // Training Intent Style Helper
  const getIntentBadge = (intent: TrainingIntent) => {
    const commonClasses = "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono";
    switch (intent) {
      case "recovery":
        return <span className={`${commonClasses} bg-teal-500/15 text-teal-400 border border-teal-500/25`}>Regenerativo</span>;
      case "aerobic_base":
        return <span className={`${commonClasses} bg-blue-500/15 text-blue-400 border border-blue-500/25`}>Base Aeróbica</span>;
      case "threshold":
        return <span className={`${commonClasses} bg-orange-500/15 text-orange-400 border border-orange-500/25`}>Limiar Z4</span>;
      case "vo2max":
        return <span className={`${commonClasses} bg-purple-500/15 text-purple-400 border border-purple-500/25`}>VO2 Máx</span>;
      case "long_run":
        return <span className={`${commonClasses} bg-indigo-500/15 text-indigo-400 border border-indigo-500/25`}>Longão</span>;
      case "strength":
        return <span className={`${commonClasses} bg-yellow-500/15 text-yellow-400 border border-yellow-500/25`}>Fortalecimento</span>;
      case "mobility":
        return <span className={`${commonClasses} bg-pink-500/15 text-pink-400 border border-pink-500/25`}>Alongamento</span>;
      case "rest":
        return <span className={`${commonClasses} bg-slate-500/25 text-slate-400 border border-slate-500/25`}>Descanso</span>;
      default:
        return <span className={`${commonClasses} bg-slate-500/15 text-slate-400`}>Outro</span>;
    }
  };

  // Calculate weekly performance report metrics
  const getWeeklyReportData = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const completedThisWeek = localSavedList.filter((item: any) => {
      if (!item.startTime) return false;
      const itemDate = new Date(item.startTime);
      return itemDate >= sevenDaysAgo;
    });

    let actualWeeklyLoad = 0;
    completedThisWeek.forEach((item: any) => {
      const storedRpe = localStorage.getItem(`fit_rpe_${item.id}`);
      const rpe = storedRpe ? parseInt(storedRpe) : 5;
      
      const detailStr = localStorage.getItem(`fit_activity_data_${item.id}`);
      let avgHeartRate = 140;
      if (detailStr) {
        try {
          const detail = JSON.parse(detailStr);
          avgHeartRate = detail.summary?.avgHeartRate || 140;
        } catch (e) {
          console.error(e);
        }
      }
      
      const durationMinutes = Math.round(item.durationSeconds / 60);
      const factor = avgHeartRate < 130 ? 0.9 : avgHeartRate < 150 ? 1.0 : avgHeartRate < 165 ? 1.15 : 1.30;
      const load = Math.round(durationMinutes * rpe * factor);
      actualWeeklyLoad += load;
    });

    let plannedWeeklyLoad = 0;
    let plannedWorkoutsCount = 0;
    if (trainingPlan) {
      const activeWeekIdx = Math.min(selectedWeekIdx, (trainingPlan.cycles[0]?.weeks?.length || 1) - 1);
      const workouts = trainingPlan.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
      workouts.forEach((sw: any) => {
        const p = sw.workout;
        if (p.intent !== "rest" && p.intent !== "strength" && p.intent !== "mobility") {
          plannedWorkoutsCount++;
          let rpe = 5;
          let hr = 140;
          if (p.intent === "recovery") { rpe = 3; hr = 120; }
          else if (p.intent === "aerobic_base") { rpe = 5; hr = 142; }
          else if (p.intent === "threshold") { rpe = 7; hr = 160; }
          else if (p.intent === "vo2max") { rpe = 9; hr = 175; }
          else if (p.intent === "long_run") { rpe = 6; hr = 145; }
          
          const factor = hr < 130 ? 0.9 : hr < 150 ? 1.0 : hr < 165 ? 1.15 : 1.30;
          const load = Math.round(p.durationMinutes * rpe * factor);
          plannedWeeklyLoad += load;
        }
      });
    }

    const loadDiffPercent = plannedWeeklyLoad > 0 
      ? Math.round(((actualWeeklyLoad - plannedWeeklyLoad) / plannedWeeklyLoad) * 100)
      : 0;

    let reportStatus = "Boa adaptação";
    let reportRecommendation = "Excelente trabalho esta semana! Você cumpriu a risca o planejamento e as adaptações fisiológicas já estão acontecendo. Continue ouvindo seu corpo e mantenha a mesma consistência na próxima semana. Estamos no caminho certo!";
    let statusColorClass = "text-emerald-400 bg-emerald-950/40 border-emerald-800";
    let statusTextColor = "text-emerald-300";
    
    if (plannedWeeklyLoad > 0) {
      if (loadDiffPercent > 20) {
        reportStatus = "Carga acima do esperado";
        reportRecommendation = "Cuidado com o entusiasmo excessivo! O corpo não evolui no treino, evolui no descanso. Como passamos da carga ideal, quero que você priorize o sono e a hidratação nesta transição. Na próxima semana, vamos segurar um pouco o ritmo nas rodagens para não queimar etapas.";
        statusColorClass = "text-amber-400 bg-amber-950/40 border-amber-800";
        statusTextColor = "text-amber-300";
      } else if (loadDiffPercent < -20) {
        reportStatus = "Carga abaixo do esperado";
        reportRecommendation = "Sem neuras por não ter completado tudo. A vida acontece e a flexibilidade faz parte da jornada de qualquer corredor. Para a próxima semana, se o tempo estiver curto, foque em realizar pelo menos a rodagem de base e o longão. O segredo é não perder o hábito!";
        statusColorClass = "text-blue-400 bg-blue-950/40 border-blue-800";
        statusTextColor = "text-blue-300";
      }
    }

    return {
      completedWorkoutsCount: completedThisWeek.length,
      plannedWorkoutsCount,
      actualWeeklyLoad,
      plannedWeeklyLoad,
      loadDiffPercent,
      reportStatus,
      reportRecommendation,
      statusColorClass,
      statusTextColor
    };
  };

  const getHeartRateZones = () => {
    const age = athleteProfile.age || 28;
    const maxHr = Number(athleteProfile.maxHeartRate) || (220 - age);
    const restHr = Number(athleteProfile.restingHeartRate) || 60;
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

    return [
      { name: "Zona 1 (Regenerativo)", range: `${z1Min} - ${z1Max} bpm`, desc: "Recuperação ativa, regeneração pós-treino e metabolismo de gorduras inicial.", color: "text-teal-400" },
      { name: "Zona 2 (Base Aeróbica / Lipólise)", range: `${z2Min} - ${z2Max} bpm`, desc: "Estímulo mitocondrial, aumento da capilarização e queima de gordura.", color: "text-blue-400" },
      { name: "Zona 3 (Tempo / Aeróbico Intensivo)", range: `${z3Min} - ${z3Max} bpm`, desc: "Resistência aeróbica geral, capilarização e ritmo confortável de prova.", color: "text-indigo-400" },
      { name: "Zona 4 (Limiar de Lactato)", range: `${z4Min} - ${z4Max} bpm`, desc: "Ponto de acúmulo de ácido lático, aumento da tolerância à fadiga muscular.", color: "text-orange-400" },
      { name: "Zona 5 (VO2 Máximo / Potência Anaeróbica)", range: `${z5Min} - ${z5Max} bpm`, desc: "Capacidade cardiorrespiratória máxima, velocidade e explosão.", color: "text-red-400" },
    ];
  };

  const reportData = getWeeklyReportData();

  // Precalculate Coach heart rate spectrum metrics for visual bar
  const coachAge = athleteProfile.age || 28;
  const coachMaxHr = Number(athleteProfile.maxHeartRate) || (220 - coachAge);
  const coachRestHr = Number(athleteProfile.restingHeartRate) || 60;
  const coachHrR = coachMaxHr - coachRestHr;
  
  const coachZ1Min = Math.round(coachRestHr + coachHrR * 0.50);
  const coachZ1Max = Math.round(coachRestHr + coachHrR * 0.60);
  const coachZ2Min = Math.round(coachRestHr + coachHrR * 0.60);
  const coachZ2Max = Math.round(coachRestHr + coachHrR * 0.70);
  const coachZ3Min = Math.round(coachRestHr + coachHrR * 0.70);
  const coachZ3Max = Math.round(coachRestHr + coachHrR * 0.80);
  const coachZ4Min = Math.round(coachRestHr + coachHrR * 0.80);
  const coachZ4Max = Math.round(coachRestHr + coachHrR * 0.90);
  const coachZ5Min = Math.round(coachRestHr + coachHrR * 0.90);
  const coachZ5Max = coachMaxHr;

  return (
    <div className="col-span-1 lg:col-span-12 flex flex-col gap-6">
      
      {/* Dynamic Overlay Notifications */}
      {isCoachThinking && (
        <div className="fixed inset-0 bg-brand-dark/95 z-50 flex flex-col items-center justify-center backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center max-w-sm text-center px-6">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-brand-neon/10 border-t-brand-neon animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-cyan-400/10 border-t-cyan-400 animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-brand-neon animate-pulse" />
              </div>
            </div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-100 font-mono">
              O Treinador está pensando...
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed mt-2 font-sans">
              Analisando seu score de sono, HRV, Body Battery, prontidão percebida e nível de fadiga para recalcular a carga perfeita do seu treino.
            </p>
          </div>
        </div>
      )}

      {showGarminToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-brand-dark/95 border-2 border-brand-neon/30 p-4 rounded-xl shadow-2xl flex items-start gap-3 max-w-sm animate-fade-in backdrop-blur-md">
          <CheckCircle2 className="w-5 h-5 text-brand-neon shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Exportado para Garmin Connect!</h4>
            <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
              O arquivo JSON estruturado foi baixado. Sincronize-o com o Garmin Connect para treinar diretamente com avisos estruturados e vibrações no seu relógio Garmin.
            </p>
          </div>
        </div>
      )}

      {/* 1. ABA CONHECENDO O ATLETA (PROFILE) */}
      {coachTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Form fields card (7 cols) */}
          <div className="lg:col-span-7 bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-sm flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-slate-200 tracking-wide uppercase flex items-center gap-2">
                <User className="w-4 h-4 text-brand-neon" />
                Configuração do Perfil do Atleta
              </h3>
              <p className="text-xs text-slate-400 mt-1">Configure seus parâmetros biológicos e metas para treinos ultra-personalizados.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Idade (anos)</label>
                <input
                  type="number"
                  value={athleteProfile.age || 28}
                  min="1"
                  max="120"
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, age: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none focus:ring-1 focus:ring-brand-neon/25"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Peso (kg)</label>
                <input
                  type="number"
                  value={athleteProfile.weightCurrentKg || athleteProfile.weight || 70}
                  min="1"
                  max="300"
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, weightCurrentKg: Math.max(1, parseFloat(e.target.value) || 0), weight: Math.max(1, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none focus:ring-1 focus:ring-brand-neon/25"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Altura (cm)</label>
                <input
                  type="number"
                  value={athleteProfile.heightCm || athleteProfile.height || 175}
                  min="50"
                  max="250"
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, heightCm: Math.max(50, parseInt(e.target.value) || 0), height: Math.max(50, parseInt(e.target.value) || 0) })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none focus:ring-1 focus:ring-brand-neon/25"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">FC Repouso (RHR)</label>
                <input
                  type="number"
                  value={athleteProfile.restingHeartRate || ""}
                  placeholder="Ex: 60"
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, restingHeartRate: e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">FC Máxima (MHR)</label>
                <input
                  type="number"
                  value={athleteProfile.maxHeartRate || ""}
                  placeholder="Ex: 190"
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, maxHeartRate: e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Nível de Experiência</label>
                <select
                  value={athleteProfile.fitnessLevel || "intermediate"}
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, fitnessLevel: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-brand-neon focus:outline-none cursor-pointer"
                >
                  <option value="beginner">Iniciante / Beginner</option>
                  <option value="intermediate">Intermediário / Intermediate</option>
                  <option value="advanced">Avançado / Advanced</option>
                  <option value="elite">Profissional / Elite</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Objetivo Principal</label>
                <select
                  value={athleteProfile.objective || athleteProfile.trainingGoal || "5k"}
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, objective: e.target.value, trainingGoal: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-brand-neon focus:outline-none cursor-pointer"
                >
                  <option value="weight_loss">Perda de Peso</option>
                  <option value="general_fitness">Condicionamento Geral</option>
                  <option value="5k">Meta: Corrida de 5k</option>
                  <option value="10k">Meta: Corrida de 10k</option>
                  <option value="half_marathon">Meta: Meia Maratona (21k)</option>
                  <option value="marathon">Meta: Maratona (42k)</option>
                  <option value="ultra">Meta: Ultramaratona (&gt;42k)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Treinos / Semana</label>
                <select
                  value={athleteProfile.weeklyTrainingDays || 4}
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, weeklyTrainingDays: parseInt(e.target.value) || 4 })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-brand-neon focus:outline-none cursor-pointer"
                >
                  <option value="3">3 dias (Mínimo)</option>
                  <option value="4">4 dias</option>
                  <option value="5">5 dias</option>
                  <option value="6">6 dias</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Dia de Descanso</label>
                <select
                  value={athleteProfile.restDay || "Segunda-feira"}
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, restDay: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-brand-neon focus:outline-none cursor-pointer"
                >
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Dia do Longão</label>
                <select
                  value={athleteProfile.longRunDay || "Domingo"}
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, longRunDay: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-brand-neon focus:outline-none cursor-pointer"
                >
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <span className="block text-[10px] uppercase tracking-wider text-brand-neon font-bold font-mono">Recordes Pessoais (PBs) e Ritmo Confortável</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] uppercase text-slate-400 mb-1 font-mono">PB 5k</label>
                  <input
                    type="text"
                    value={athleteProfile.best5k || ""}
                    placeholder="Ex: 25:00"
                    onChange={(e) => setAthleteProfile({ ...athleteProfile, best5k: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-slate-400 mb-1 font-mono">PB 10k</label>
                  <input
                    type="text"
                    value={athleteProfile.best10k || ""}
                    placeholder="Ex: 52:00"
                    onChange={(e) => setAthleteProfile({ ...athleteProfile, best10k: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-slate-400 mb-1 font-mono">PB Meia Maratona</label>
                  <input
                    type="text"
                    value={athleteProfile.bestHalfMarathon || ""}
                    placeholder="Ex: 1:58:00"
                    onChange={(e) => setAthleteProfile({ ...athleteProfile, bestHalfMarathon: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] uppercase text-slate-400 mb-1 font-mono">Ritmo Estimado Atual confortável (min/km)</label>
                <input
                  type="text"
                  value={athleteProfile.estimatedPaceCurrent || ""}
                  placeholder="Ex: 5:30"
                  onChange={(e) => setAthleteProfile({ ...athleteProfile, estimatedPaceCurrent: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs focus:border-brand-neon focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Limitações Físicas, Histórico de Lesões ou Dores</label>
              <input
                type="text"
                value={athleteProfile.limitations || ""}
                placeholder="Ex: Nenhuma dor, leve canelite antiga na tíbia direita, etc."
                onChange={(e) => setAthleteProfile({ ...athleteProfile, limitations: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-brand-neon focus:outline-none focus:ring-1 focus:ring-brand-neon/25"
              />
            </div>
          </div>

          {/* Sports Science Report Card (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-sm relative overflow-hidden flex-1 animate-fade-in">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <h3 className="text-sm uppercase font-bold text-slate-200 tracking-wider mb-2 flex items-center gap-2">
                <Heart className="w-5 h-5 text-brand-neon animate-pulse" style={{ animationDuration: "2s" }} />
                Definição Científica de Zonas Cardíacas
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed font-sans mb-5">
                Sua periodização baseia-se na metodologia <strong>Karvonen (Fórmula de Reserva Cardíaca)</strong>, utilizando sua frequência cardíaca basal de repouso (<span className="text-brand-neon font-bold font-mono">{coachRestHr} bpm</span>) e máxima (<span className="text-brand-neon font-bold font-mono">{coachMaxHr} bpm</span>).
              </p>

              {/* Continuous heart rate spectrum visual bar */}
              <div className="mb-6 bg-black/45 border border-white/5 p-4 rounded-xl">
                <div className="flex flex-col justify-between text-[10px] font-mono text-slate-400 mb-2 gap-1 sm:flex-row">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"></span>Repouso ({coachRestHr} bpm)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span>Limiar Lactato ({coachZ4Min} bpm)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>Máxima ({coachMaxHr} bpm)</span>
                </div>
                
                <div className="h-4 w-full rounded-lg flex overflow-hidden border border-white/10 shadow-lg">
                  <div className="h-full bg-teal-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90 border-r border-black/25" title={`Z1: ${coachZ1Min} - ${coachZ1Max} bpm`}>
                    <span>Z1</span>
                  </div>
                  <div className="h-full bg-blue-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90 border-r border-black/25" title={`Z2: ${coachZ2Min} - ${coachZ2Max} bpm`}>
                    <span>Z2</span>
                  </div>
                  <div className="h-full bg-indigo-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90 border-r border-black/25" title={`Z3: ${coachZ3Min} - ${coachZ3Max} bpm`}>
                    <span>Z3</span>
                  </div>
                  <div className="h-full bg-orange-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90 border-r border-black/25" title={`Z4: ${coachZ4Min} - ${coachZ4Max} bpm`}>
                    <span>Z4</span>
                  </div>
                  <div className="h-full bg-red-500/80 flex-1 relative flex items-center justify-center text-[9px] font-extrabold text-white/90" title={`Z5: ${coachZ5Min} - ${coachZ5Max} bpm`}>
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

              <div className="space-y-3.5">
                {getHeartRateZones().map((zone, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col gap-1.5 transition-all hover:translate-x-1 duration-200">
                    <div className="flex justify-between items-center text-xs font-mono font-bold">
                      <span className={`text-xs font-black uppercase tracking-wider font-mono ${zone.color}`}>{zone.name}</span>
                      <span className="text-white bg-white/10 px-2 py-0.5 rounded text-[10px]">{zone.range}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">{zone.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 p-4 bg-brand-neon/10 border border-brand-neon/20 rounded-xl text-xs text-brand-neon font-sans">
                <strong>💡 Orientação Científica:</strong> Dedique cerca de 80% do seu volume semanal às <strong>Zonas 1 e 2</strong> para expandir sua densidade mitocondrial e capilarização muscular sem sobrecarregar o sistema nervoso central. Isso é a base do treinamento polarizado!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2.5. ABA TREINO DE HOJE (TODAY) */}
      {coachTab === "today" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          
          {/* LEFT COLUMN: Briefing, Workout, and Feedback (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* A. Coach's Daily Greeting & Briefing */}
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-brand-neon/10 text-brand-neon mb-2">
                    <Sparkles className="w-3.5 h-3.5" /> Briefing Diário do Treinador
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold font-display tracking-tight text-white leading-tight">
                    Bom dia, {athleteProfile.name || "Atleta"}.
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Hoje é <span className="text-slate-200 font-semibold">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
                  </p>
                </div>
                
                {readiness && (
                  <button 
                    type="button"
                    onClick={() => setShowReadinessAuditModal(true)}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-neon/40 transition-all rounded-xl px-4 py-2 text-left cursor-pointer group"
                    title="Clique para ver os cálculos detalhados e explicabilidade do Índice de Preparação"
                  >
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 group-hover:text-brand-neon block font-mono uppercase tracking-wider font-bold transition-colors flex items-center justify-end gap-1">
                        <Calculator className="w-3 h-3 text-brand-neon" /> Preparação
                      </span>
                      <span className="text-lg font-black font-mono text-white leading-none">{readiness.score}<span className="text-xs text-slate-500">/100</span></span>
                    </div>
                    {getReadinessBadge(readiness.status)}
                  </button>
                )}
              </div>

              {/* Aetheris Quote Card */}
              <div className="mt-4 p-4 bg-white/5 border border-white/5 rounded-xl relative italic text-xs text-slate-300 leading-relaxed font-sans">
                <span className="absolute -top-2.5 left-3 text-3xl font-serif text-brand-neon/20 select-none">“</span>
                <p className="pl-3.5 pr-2.5">
                  O relógio mede sinais; o atleta sente o organismo. O histórico de carga mostra a tendência; o treino planejado mostra o objetivo. A decisão consciente e adaptativa do treinador nasce exatamente do cruzamento de todas essas informações.
                </p>
                <span className="block text-right text-[10px] font-mono uppercase tracking-wider text-slate-500 mt-2 font-bold">— Filosofia Aetheris Engine</span>
              </div>

              {/* Data Confidence Layer */}
              <div className="mt-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-neon" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">Nível de Confiança de Dados</span>
                  </div>
                  {(() => {
                    const confidence = 40 + 
                      (dailyMetrics.sleepScore > 0 ? 15 : 0) + 
                      ((dailyMetrics.hrv || 0) > 0 ? 15 : 0) + 
                      ((dailyMetrics.bodyBattery || 0) > 0 ? 15 : 0) + 
                      (activeActivity ? 15 : 0);
                    const label = confidence >= 85 ? "Alta" : confidence >= 60 ? "Média" : "Mínima";
                    const colorClass = confidence >= 85 ? "text-brand-neon" : confidence >= 60 ? "text-amber-400" : "text-red-400";
                    return (
                      <span className={`text-[10px] font-mono font-bold uppercase ${colorClass}`}>
                        {label} ({confidence}%)
                      </span>
                    );
                  })()}
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  {(() => {
                    const confidence = 40 + 
                      (dailyMetrics.sleepScore > 0 ? 15 : 0) + 
                      ((dailyMetrics.hrv || 0) > 0 ? 15 : 0) + 
                      ((dailyMetrics.bodyBattery || 0) > 0 ? 15 : 0) + 
                      (activeActivity ? 15 : 0);
                    const colorBg = confidence >= 85 ? "bg-brand-neon" : confidence >= 60 ? "bg-amber-400" : "bg-red-400";
                    return (
                      <div className={`${colorBg} h-full rounded-full transition-all duration-500`} style={{ width: `${confidence}%` }} />
                    );
                  })()}
                </div>
                <p className="text-[9px] text-slate-400 leading-normal mt-2">
                  {(() => {
                    const confidence = 40 + 
                      (dailyMetrics.sleepScore > 0 ? 15 : 0) + 
                      ((dailyMetrics.hrv || 0) > 0 ? 15 : 0) + 
                      ((dailyMetrics.bodyBattery || 0) > 0 ? 15 : 0) + 
                      (activeActivity ? 15 : 0);
                    if (confidence >= 85) {
                      return "Decisão respaldada por telemetria Garmin completa e dados subjetivos ativos. Risco de erro de prescrição reduzido.";
                    } else if (confidence >= 60) {
                      return "Sensores Garmin ativos, mas sem arquivo de treino recente (.fit) em anexo. Prescrição baseada em heurísticas híbridas.";
                    } else {
                      return "Métricas de HRV e Sono pendentes. Recomendamos registrar seu check-in diário completo para refinar a inteligência do motor.";
                    }
                  })()}
                </p>
              </div>

              {/* Physical Biometrics Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-white/5">
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Moon className="w-3 h-3 text-slate-500" /> Sono</span>
                  <span className="text-xs font-bold text-white mt-1.5">{dailyMetrics.sleepHours}h <span className="text-[10px] text-slate-400 font-normal">({dailyMetrics.sleepScore || 80} pts)</span></span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3 text-slate-500" /> Body Battery</span>
                  <span className="text-xs font-bold text-brand-neon mt-1.5">{dailyMetrics.bodyBattery !== undefined ? dailyMetrics.bodyBattery : 82}%</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Heart className="w-3 h-3 text-slate-500" /> HRV (VFC)</span>
                  <div className="flex items-center justify-between mt-1.5 gap-1">
                    <span className="text-xs font-bold text-brand-neon">{dailyMetrics.hrv || 58} ms</span>
                    {(() => {
                      const baseline = dailyMetrics.hrvBaseline || 55;
                      const currentHrv = dailyMetrics.hrv || 58;
                      const isBalanced = dailyMetrics.hrvStatus 
                        ? dailyMetrics.hrvStatus === "balanced" 
                        : currentHrv >= Math.round(baseline * 0.88);
                      return (
                        <span className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded border ${
                          isBalanced 
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        }`}>
                          {isBalanced ? "Equilibrado" : "Desequilibrado"}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Heart className="w-3 h-3 text-slate-500" /> FC Repouso</span>
                  <span className="text-xs font-bold text-white mt-1.5">{dailyMetrics.restingHeartRate || 54} bpm</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Sparkles className="w-3 h-3 text-cyan-400" /> Prep. Garmin</span>
                  <span className="text-xs font-bold text-cyan-300 mt-1.5">{dailyMetrics.garminReadiness !== undefined ? dailyMetrics.garminReadiness : (dailyMetrics.prepScore || 78)}/100</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3 text-amber-400" /> Sensação Atleta</span>
                  {(() => {
                    const stageId = dailyMetrics.subjectiveFeeling || "bem";
                    const stage = SUBJECTIVE_FEELING_STAGES.find(s => s.id === stageId) || SUBJECTIVE_FEELING_STAGES[1];
                    return (
                      <span className={`text-[10px] font-mono font-bold mt-1 px-1.5 py-0.5 rounded border w-fit ${stage.color}`}>
                        {stage.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Scientific Load & Monotony Grid */}
              {trainingLoad && (
                <div className="space-y-3 mt-3 pt-3 border-t border-white/5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1" title="ACWR é um indicador de contexto de carga (Carga Aguda 7d / Carga Crônica 28d), interpretado em conjunto com a resposta biológica.">
                        <TrendingUp className="w-3 h-3 text-cyan-400" /> Proporção ACWR
                      </span>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-xs font-bold text-white font-mono">{trainingLoad.acuteChronicRatio}</span>
                        <span className={`text-[8px] font-mono font-bold uppercase tracking-tight px-1 rounded ${
                          trainingLoad.acuteChronicRatio > 1.5 ? "bg-amber-500/15 text-amber-300" :
                          trainingLoad.acuteChronicRatio > 1.3 ? "bg-cyan-500/15 text-cyan-300" :
                          trainingLoad.acuteChronicRatio < 0.8 ? "bg-slate-500/15 text-slate-400" : "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {trainingLoad.acuteChronicRatio > 1.5 ? "Aumento Agressivo" :
                           trainingLoad.acuteChronicRatio > 1.3 ? "Carga Elevada" :
                           trainingLoad.acuteChronicRatio < 0.8 ? "Destreino" : "Variação Adequada"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1" title="Monotonia: Medida de variação do estresse diário (Foster). Menos de 1.5 indica boa variabilidade entre estímulo e descanso.">
                        <Layers className="w-3 h-3 text-cyan-400" /> Monotonia
                      </span>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-xs font-bold text-white font-mono">{monotonyData.monotony}</span>
                        <span className={`text-[8px] font-mono font-bold uppercase tracking-tight px-1 rounded ${
                          monotonyData.monotony >= 2.0 ? "bg-amber-500/15 text-amber-300" :
                          monotonyData.monotony >= 1.5 ? "bg-cyan-500/15 text-cyan-300" : "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {monotonyData.monotony >= 2.0 ? "Alta Monotonia" :
                           monotonyData.monotony >= 1.5 ? "Monotonia Elevada" : "Variação Adequada"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1" title="Training Strain: Carga Semanal x Monotonia. Medida composta do impacto do microciclo.">
                        <Flame className="w-3 h-3 text-cyan-400" /> Carga Estresse
                      </span>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-xs font-bold text-brand-neon font-mono">{monotonyData.strain} <span className="text-[8px] text-slate-500 font-sans font-normal">pts</span></span>
                        <span className={`text-[8px] font-mono font-bold uppercase tracking-tight px-1 rounded ${
                          monotonyData.strain > 1200 ? "bg-amber-500/15 text-amber-300" :
                          monotonyData.strain > 600 ? "bg-cyan-500/15 text-cyan-300" : "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {monotonyData.strain > 1200 ? "Estresse Elevado" :
                           monotonyData.strain > 600 ? "Estresse Moderado" : "Estresse Baixo"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assimilação da Carga (Balanço Carga Externa vs Resposta Interna) */}
                  {(() => {
                    const isExternalLoadHigh = trainingLoad.acuteChronicRatio > 1.3 || monotonyData.strain > 1200;
                    const baselineHrv = dailyMetrics.hrvBaseline || 55;
                    const currentHrv = dailyMetrics.hrv || 50;
                    const hrvDevPct = ((currentHrv - baselineHrv) / baselineHrv) * 100;
                    const isHrvOk = hrvDevPct >= -12;
                    const isSleepOk = (dailyMetrics.sleepScore || 70) >= 60 || (dailyMetrics.sleepHours || 7) >= 6;
                    const isFeelOk = (dailyMetrics.subjectiveFeeling || "bem") !== "muito_cansado";

                    let assimilationStatus: "excelente" | "parcial" | "sobrecarga" = "excelente";
                    let statusLabel = "Excelente Assimilação";
                    let statusBg = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
                    let message = "Seu organismo apresenta boa resiliência e está assimilando o estresse aplicado com eficiência.";

                    if (isExternalLoadHigh) {
                      if (isHrvOk && isSleepOk && isFeelOk) {
                        assimilationStatus = "excelente";
                        statusLabel = "Resiliência Fisiológica Alta";
                        statusBg = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
                        message = `Apesar do aumento recente de carga (ACWR: ${trainingLoad.acuteChronicRatio}), seus biomarcadores internos permanecem estáveis. Seu organismo está absorvendo o estímulo com boa resposta adaptativa.`;
                      } else {
                        assimilationStatus = "parcial";
                        statusLabel = "Assimilação Parcial";
                        statusBg = "bg-amber-500/10 border-amber-500/30 text-amber-300";
                        message = `O conjunto dos dados indica que seu organismo está absorvendo uma sequência de estímulos elevada (ACWR: ${trainingLoad.acuteChronicRatio}). Hoje o objetivo não é gerar adaptação adicional, mas permitir que a adaptação aconteça.`;
                      }
                    } else if (!isHrvOk || !isSleepOk) {
                      assimilationStatus = "parcial";
                      statusLabel = "Recuperação Parcial";
                      statusBg = "bg-amber-500/10 border-amber-500/30 text-amber-300";
                      message = "Seus biomarcadores indicam recuperação parcial em andamento. Mantivemos a rodagem em Zona 2 com volume ajustado para consolidar os ganhos.";
                    }

                    return (
                      <div className={`p-3 rounded-xl border text-xs font-sans space-y-1.5 ${statusBg}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-cyan-400" /> Índice de Assimilação da Carga
                          </span>
                          <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-black/40 border border-white/10">
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-90 font-medium">
                          {message}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* B. Today's Workout Block */}
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm">
              {getTodayWorkout() ? (
                (() => {
                  const workout = getTodayWorkout()!;
                  return (
                    <div className="space-y-5 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono bg-brand-neon/15 text-brand-neon">
                            {workout.intent === "aerobic_base" ? "Base Aeróbica Z2" : 
                             workout.intent === "recovery" ? "Regenerativo" : 
                             workout.intent === "threshold" ? "Limiar de Lactato" : 
                             workout.intent === "vo2max" ? "Tiros de VO2" : "Treino Planejado"}
                          </span>
                          <h3 className="text-base sm:text-lg font-bold font-display tracking-tight text-white mt-1">
                            {workout.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => exportToGarmin(workout)}
                            className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                            title="Exportar no formato estruturado para Garmin Connect"
                          >
                            <FileDown className="w-4 h-4 text-brand-neon" />
                            Exportar para Garmin
                          </button>
                        </div>
                      </div>

                      {/* Workout Prescription Details */}
                      <div className="space-y-4">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <h4 className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold mb-1">
                            Instrução Geral do Treinador
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium">
                            {workout.description}
                          </p>
                        </div>

                        {/* Decision Justification Card */}
                        {readiness && (
                          <div className="bg-brand-neon/5 border border-brand-neon/15 p-4 rounded-xl font-sans text-xs">
                            <h4 className="text-[10px] font-mono uppercase text-brand-neon tracking-wider font-extrabold mb-2.5 flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5" /> JUSTIFICATIVA FIZIOLÓGICA DA DECISÃO
                            </h4>
                            
                            <p className="text-slate-300 leading-relaxed font-medium mb-2.5">
                              {readiness.status === ReadinessStatus.READY ? (
                                <>
                                  Treinador IA liberou <strong>100% da carga programada</strong>. Seus biomarcadores indicam excelente capacidade de absorção do treino.
                                </>
                              ) : readiness.status === ReadinessStatus.REDUCE ? (
                                <>
                                  Treinador IA recomendou <strong>ajuste de volume e intensidade na Zona 2</strong>. Seu organismo apresenta sinais de recuperação parcial; o objetivo hoje é consolidar as adaptações dos últimos dias mantendo o sistema aeróbico ativo sem gerar sobrecarga.
                                </>
                              ) : (
                                <>
                                  Treinador IA recomendou <strong>recuperação ativa direcionada</strong>. Seus indicadores fisiológicos sinalizam a necessidade de priorizar a assimilação e a depuração metabólica antes de novos estímulos intensos.
                                </>
                              )}
                            </p>

                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-1.5 text-[11px] text-slate-400">
                              <span className="text-[9px] font-mono uppercase text-slate-500 font-bold block mb-1">Fatores de Decisão (Gatilhos Ativos):</span>
                              
                              {/* Dynamic bullets based on the actual metrics */}
                              {readiness.status === ReadinessStatus.READY ? (
                                <>
                                  <div className="flex items-start gap-1 text-emerald-400">
                                    <span className="shrink-0">•</span>
                                    <span>VFC (HRV) em equilíbrio ({dailyMetrics.hrv || 58}ms), indicando dominância saudável do sistema nervoso autônomo parassimpático.</span>
                                  </div>
                                  <div className="flex items-start gap-1 text-emerald-400">
                                    <span className="shrink-0">•</span>
                                    <span>Sono restaurador de {dailyMetrics.sleepHours}h (score: {dailyMetrics.sleepScore || 80} pts) propiciando excelente supercompensação.</span>
                                  </div>
                                  <div className="flex items-start gap-1 text-emerald-400">
                                    <span className="shrink-0">•</span>
                                    <span>Body Battery restabelecido em {dailyMetrics.bodyBattery !== undefined ? dailyMetrics.bodyBattery : 82}%, garantindo reservas de glicogênio suficientes.</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {/* List only the triggers that contributed to lower readiness */}
                                  {(Number(dailyMetrics.sleepScore) < 75 || Number(dailyMetrics.sleepHours) < 7) && (
                                    <div className="flex items-start gap-1 text-amber-300">
                                      <span className="shrink-0 text-amber-500 font-extrabold">•</span>
                                      <span>Sono insuficiente ou fragmentado: Score de sono de {dailyMetrics.sleepScore} pontos ({dailyMetrics.sleepHours}h de repouso), reduzindo a taxa ideal de recuperação celular e síntese proteica.</span>
                                    </div>
                                  )}
                                  {Number(dailyMetrics.bodyBattery) < 65 && (
                                    <div className="flex items-start gap-1 text-amber-300">
                                      <span className="shrink-0 text-amber-500 font-extrabold">•</span>
                                      <span>Body Battery moderado/baixo ({dailyMetrics.bodyBattery}%): indica que existe capacidade para treinar, mas sem margem ideal para esforços de altíssima intensidade.</span>
                                    </div>
                                  )}
                                  {(dailyMetrics.hrvStatus === "unbalanced" || ((dailyMetrics.hrv || 50) - (dailyMetrics.hrvBaseline || 55)) / (dailyMetrics.hrvBaseline || 55) <= -0.15) && (
                                    <div className="flex items-start gap-1 text-amber-300">
                                      <span className="shrink-0 text-amber-500 font-extrabold">•</span>
                                      <span>VFC (HRV) Desequilibrada (Garmin: {dailyMetrics.hrv || 50}ms vs baseline {dailyMetrics.hrvBaseline || 55}ms): Desvio relativo em relação à sua linha de base pessoal de 21 dias. O treinador interpreta esta oscilação junto ao seu sono e fadiga.</span>
                                    </div>
                                  )}
                                  {Number(dailyMetrics.restingHeartRate) > 60 && (
                                    <div className="flex items-start gap-1 text-amber-300">
                                      <span className="shrink-0 text-amber-500 font-extrabold">•</span>
                                      <span>FC Repouso ligeiramente acima do habitual ({dailyMetrics.restingHeartRate} bpm): variação normal considerada em conjunto com os demais indicadores para evitar fadiga residual.</span>
                                    </div>
                                  )}
                                  {Number(dailyMetrics.stressScore) > 6 && (
                                    <div className="flex items-start gap-1 text-amber-300">
                                      <span className="shrink-0 text-amber-500 font-extrabold">•</span>
                                      <span>Estresse diário elevado: Índice de estresse do sistema em {dailyMetrics.stressScore}/10, recomendando maior equilíbrio entre carga de treino e descanso.</span>
                                    </div>
                                  )}
                                  {Number(dailyMetrics.muscleSoreness) > 4 && (
                                    <div className="flex items-start gap-1 text-amber-300">
                                      <span className="shrink-0 text-amber-500 font-extrabold">•</span>
                                      <span>Sensibilidade muscular elevada: Dor reportada em {dailyMetrics.muscleSoreness}/10, sugerindo que os grupos musculares principais ainda estão assimilando treinos passados, sendo prudente evitar tiros de alta intensidade.</span>
                                    </div>
                                  )}
                                  {/* Fallback if no specific trigger is lower but overall score triggered it */}
                                  {!(Number(dailyMetrics.sleepScore) < 75) && !(Number(dailyMetrics.bodyBattery) < 65) && !(dailyMetrics.hrvStatus === "unbalanced") && !(Number(dailyMetrics.restingHeartRate) > 60) && !(Number(dailyMetrics.stressScore) > 6) && !(Number(dailyMetrics.muscleSoreness) > 4) && (
                                    <div className="flex items-start gap-1 text-amber-300">
                                      <span className="shrink-0 text-amber-500 font-extrabold">•</span>
                                      <span>Estresse fisiológico acumulado generalizado: O algoritmo integrado de prontidão ({readiness.score}/100) aponta necessidade de preservação tecidual adaptativa.</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Button to view detailed math & science audit */}
                            <button
                              type="button"
                              onClick={() => setShowReadinessAuditModal(true)}
                              className="w-full mt-3 py-2 px-3 rounded-lg bg-brand-neon/10 hover:bg-brand-neon/20 border border-brand-neon/30 text-brand-neon font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              Ver Cálculos e Explicabilidade Matemática (Score {readiness.score}/100)
                            </button>
                          </div>
                        )}

                        {/* Training Capacity by Workout Type Widget */}
                        {readiness && readiness.capacities && (
                          <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3 font-sans">
                            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-cyan-400" />
                                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                                  Capacidade de Treinamento por Modalidade (Score {readiness.score}/100)
                                </h4>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                Preparação {readiness.score}/100: orienta a intensidade, preserva a recuperação
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {/* 1. Mobilidade & Core */}
                              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-1 font-mono">
                                  <span className="text-xs font-bold text-emerald-300">Mobilidade & Core</span>
                                  <span className="text-xs font-black text-emerald-400">100% Capacidade</span>
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mb-1.5">
                                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: '100%' }}></div>
                                </div>
                                <p className="text-[10px] text-slate-300 leading-tight">
                                  {readiness.capacities.mobilityCore?.recommendation}
                                </p>
                              </div>

                              {/* 2. Rodagem Leve (Z2) */}
                              <div className={`p-3 rounded-xl border flex flex-col justify-between ${
                                readiness.capacities.lightZone2?.percentage >= 80 
                                  ? "bg-emerald-500/10 border-emerald-500/20" 
                                  : "bg-amber-500/10 border-amber-500/20"
                              }`}>
                                <div className="flex justify-between items-center mb-1 font-mono">
                                  <span className="text-xs font-bold text-slate-200">Rodagem Leve (Z2)</span>
                                  <span className={`text-xs font-black ${readiness.capacities.lightZone2?.percentage >= 80 ? "text-emerald-400" : "text-amber-400"}`}>
                                    {readiness.capacities.lightZone2?.percentage}% Capacidade
                                  </span>
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mb-1.5">
                                  <div className={`h-full rounded-full ${readiness.capacities.lightZone2?.percentage >= 80 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${readiness.capacities.lightZone2?.percentage}%` }}></div>
                                </div>
                                <p className="text-[10px] text-slate-300 leading-tight">
                                  {readiness.capacities.lightZone2?.recommendation}
                                </p>
                              </div>

                              {/* 3. Tempo Run / Limiar */}
                              <div className={`p-3 rounded-xl border flex flex-col justify-between ${
                                readiness.capacities.tempoThreshold?.percentage >= 70 
                                  ? "bg-emerald-500/10 border-emerald-500/20" 
                                  : readiness.capacities.tempoThreshold?.percentage >= 40 
                                  ? "bg-amber-500/10 border-amber-500/20" 
                                  : "bg-red-500/10 border-red-500/20"
                              }`}>
                                <div className="flex justify-between items-center mb-1 font-mono">
                                  <span className="text-xs font-bold text-slate-200">Tempo Run / Limiar</span>
                                  <span className={`text-xs font-black ${
                                    readiness.capacities.tempoThreshold?.percentage >= 70 
                                      ? "text-emerald-400" 
                                      : readiness.capacities.tempoThreshold?.percentage >= 40 
                                      ? "text-amber-400" 
                                      : "text-red-400"
                                  }`}>
                                    {readiness.capacities.tempoThreshold?.percentage}% Capacidade
                                  </span>
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mb-1.5">
                                  <div className={`h-full rounded-full ${
                                    readiness.capacities.tempoThreshold?.percentage >= 70 
                                      ? "bg-emerald-400" 
                                      : readiness.capacities.tempoThreshold?.percentage >= 40 
                                      ? "bg-amber-400" 
                                      : "bg-red-400"
                                  }`} style={{ width: `${readiness.capacities.tempoThreshold?.percentage}%` }}></div>
                                </div>
                                <p className="text-[10px] text-slate-300 leading-tight">
                                  {readiness.capacities.tempoThreshold?.recommendation}
                                </p>
                              </div>

                              {/* 4. Intervalado / Tiros */}
                              <div className={`p-3 rounded-xl border flex flex-col justify-between ${
                                readiness.capacities.intervalsVo2max?.percentage >= 70 
                                  ? "bg-emerald-500/10 border-emerald-500/20" 
                                  : readiness.capacities.intervalsVo2max?.percentage >= 30 
                                  ? "bg-amber-500/10 border-amber-500/20" 
                                  : "bg-red-500/10 border-red-500/20"
                              }`}>
                                <div className="flex justify-between items-center mb-1 font-mono">
                                  <span className="text-xs font-bold text-slate-200">Intervalado / Tiros (Z5)</span>
                                  <span className={`text-xs font-black ${
                                    readiness.capacities.intervalsVo2max?.percentage >= 70 
                                      ? "text-emerald-400" 
                                      : readiness.capacities.intervalsVo2max?.percentage >= 30 
                                      ? "text-amber-400" 
                                      : "text-red-400"
                                  }`}>
                                    {readiness.capacities.intervalsVo2max?.percentage}% Capacidade
                                  </span>
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mb-1.5">
                                  <div className={`h-full rounded-full ${
                                    readiness.capacities.intervalsVo2max?.percentage >= 70 
                                      ? "bg-emerald-400" 
                                      : readiness.capacities.intervalsVo2max?.percentage >= 30 
                                      ? "bg-amber-400" 
                                      : "bg-red-400"
                                  }`} style={{ width: `${readiness.capacities.intervalsVo2max?.percentage}%` }}></div>
                                </div>
                                <p className="text-[10px] text-slate-300 leading-tight">
                                  {readiness.capacities.intervalsVo2max?.recommendation}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Interactive Steps List (Block Selection & Practiced Time) */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <h4 className="text-[10px] font-mono uppercase text-slate-300 tracking-wider font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-brand-neon" /> Seleção de Blocos & Tempo Praticado
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">
                              Marque os blocos executados e ajuste o tempo
                            </span>
                          </div>

                          {workout.steps && workout.steps.length > 0 ? (
                            workout.steps.map((step: any) => {
                              const isSelected = checklistItems[step.id] !== false;
                              const defaultMins = parseStepMinutes(step);
                              const currentMins = blockTimes[step.id] ?? defaultMins;

                              return (
                                <div 
                                  key={step.id} 
                                  className={`bg-black/30 border transition-all p-3.5 rounded-xl ${
                                    isSelected ? "border-brand-neon/40 bg-brand-neon/5" : "border-white/5 opacity-60 bg-black/10"
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <input 
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => setChecklistItems({ ...checklistItems, [step.id]: e.target.checked })}
                                      className="accent-brand-neon cursor-pointer w-4 h-4 rounded mt-0.5 shrink-0"
                                    />
                                    <div className="flex-1">
                                      <div className="flex justify-between items-start text-xs font-bold text-slate-200 flex-wrap gap-1.5">
                                        <span className={isSelected ? "text-white font-display" : "text-slate-500 line-through font-display"}>
                                          {step.title}
                                        </span>
                                        <div className="flex items-center gap-1 flex-wrap font-mono">
                                          <span className="text-[10px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-slate-300">
                                            Previsto: {step.durationText}
                                          </span>
                                          <span className="text-[10px] bg-brand-neon/10 border border-brand-neon/20 px-2 py-0.5 rounded text-brand-neon font-bold">
                                            {step.hrText}
                                          </span>
                                          <span className="text-[10px] bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded text-cyan-400 font-bold">
                                            {step.paceText}
                                          </span>
                                        </div>
                                      </div>
                                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1.5 font-sans">
                                        {step.description}
                                      </p>

                                      {/* Block duration input field */}
                                      {isSelected && (
                                        <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg font-mono">
                                          <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                            Tempo Praticado neste Bloco:
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="number"
                                              min="0"
                                              max="300"
                                              value={currentMins}
                                              onChange={(e) => {
                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                const updatedTimes = { ...blockTimes, [step.id]: val };
                                                setBlockTimes(updatedTimes);
                                                localStorage.setItem("fit_today_block_times", JSON.stringify(updatedTimes));
                                              }}
                                              className="w-16 bg-black/80 border border-brand-neon/40 text-brand-neon font-mono font-bold text-xs text-center py-1 px-1.5 rounded focus:outline-none focus:border-brand-neon"
                                            />
                                            <span className="text-[10px] text-slate-300 font-bold">minutos</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-500 italic">Nenhum passo estruturado disponível.</p>
                          )}
                        </div>

                        {/* Complete Workout CTA with Live Block Time Calculations */}
                        {!todayWorkoutCompleted && (() => {
                          const totalMins = workout.steps && workout.steps.length > 0
                            ? workout.steps.reduce((sum: number, s: any) => {
                                const isSelected = checklistItems[s.id] !== false;
                                return isSelected ? sum + (blockTimes[s.id] ?? parseStepMinutes(s)) : sum;
                              }, 0)
                            : 0;
                          const activeCount = workout.steps && workout.steps.length > 0
                            ? workout.steps.filter((s: any) => checklistItems[s.id] !== false).length
                            : 0;

                          return (
                            <div className="pt-3 space-y-3">
                              {workout.steps && workout.steps.length > 0 && (
                                <div className="bg-brand-dark border border-brand-neon/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-mono">
                                  <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-brand-neon shrink-0" />
                                    <span className="text-slate-200">
                                      Blocos Selecionados: <strong className="text-brand-neon font-bold">{activeCount} de {workout.steps.length}</strong>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 bg-brand-neon/10 border border-brand-neon/20 px-3 py-1 rounded-lg">
                                    <span className="text-slate-300 text-[11px]">Tempo Total Praticado:</span>
                                    <strong className="text-brand-neon font-black text-sm">{totalMins} min</strong>
                                  </div>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleCompleteWorkoutWithBlocks(workout)}
                                className="w-full py-3.5 rounded-xl bg-brand-neon hover:bg-cyan-300 text-brand-dark font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-glow-cyan font-sans"
                              >
                                <CheckCircle2 className="w-4 h-4 fill-current" />
                                Concluir Treino de Hoje ({totalMins} min)
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Rest Day View */
                <div className="text-center py-8 px-4 flex flex-col items-center max-w-md mx-auto animate-fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-brand-neon/10 border border-brand-neon/25 flex items-center justify-center mb-4 text-brand-neon shrink-0 shadow-lg shadow-brand-neon/5">
                    <Moon className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono bg-white/5 text-slate-400 mb-2">
                    Descanso Regenerativo
                  </span>
                  <h3 className="text-base font-bold text-white font-display">
                    Hoje é seu dia de Descanso Regulamentar!
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2 font-sans">
                    Sua planilha não prevê treinos de corrida hoje. O descanso é a parte mais negligenciada do treinamento — é agora que o seu corpo se reconstrói mais forte. Aproveite para fazer mobilidade leve, alongamentos passivos ou foque no repouso físico e mental.
                  </p>
                  
                  <div className="flex gap-3 mt-6 w-full">
                    <button
                      type="button"
                      onClick={() => setTodayWorkoutCompleted(true)}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Marcar Descanso como Concluído
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* C. Post-Workout Checklist & Feedback Form (Only visible when completed and feedback not yet submitted) */}
            {todayWorkoutCompleted && !feedbackSubmitted && (
              <div className="bg-gradient-to-r from-brand-neon/5 to-cyan-500/5 border border-brand-neon/20 rounded-2xl p-5 shadow-sm animate-fade-in space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest font-mono bg-brand-neon/10 text-brand-neon">
                    <Award className="w-3.5 h-3.5 text-brand-neon" /> Treino Concluído!
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Registrado no Sistema
                  </span>
                </div>

                {/* Executed Blocks & Practiced Time Summary Box */}
                <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-4 space-y-3 font-sans">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                        Blocos Executados & Tempo Praticado
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-black text-brand-neon bg-brand-neon/10 border border-brand-neon/20 px-2.5 py-0.5 rounded-full">
                      Total: {completedBlocksSummary.reduce((sum: number, b: any) => sum + (b.isSelected ? (b.practicedMinutes || 0) : 0), 0)} min
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {completedBlocksSummary.length > 0 ? (
                      completedBlocksSummary.map((b: any, idx: number) => (
                        <div 
                          key={idx} 
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                            b.isSelected 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-slate-200" 
                              : "bg-white/5 border-white/5 text-slate-500 line-through"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {b.isSelected ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0 flex items-center justify-center text-[8px] text-slate-600">✕</span>
                            )}
                            <span className="truncate font-medium">{b.title}</span>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-cyan-300 ml-2 shrink-0">
                            {b.isSelected ? `${b.practicedMinutes} min` : "Não realizado"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">Treino concluído com sucesso.</p>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Como foi a sessão? Conte-nos sua percepção de esforço
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-5">
                  Preencha este rápido checklist pós-treino para que o treinador IA possa analisar os ritmos, fadiga e adaptar a carga das próximas sessões.
                </p>

                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  {/* Perceived Effort (RPE Score) */}
                  <div>
                    <label className="block text-[10px] text-slate-300 uppercase tracking-wider mb-2 font-mono font-bold">
                      Esforço Percebido (RPE: 1 a 10)
                    </label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setRpeScore(num)}
                          className={`py-2 rounded-lg border text-xs font-mono font-bold transition-all text-center cursor-pointer ${
                            rpeScore === num
                              ? "bg-brand-neon text-brand-dark border-brand-neon shadow-glow-cyan"
                              : "bg-black/30 border-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1 px-1">
                      <span>Muito Leve (Z1)</span>
                      <span>Moderado (Z2/Z3)</span>
                      <span>Exaustão (Z5)</span>
                    </div>
                  </div>

                  {/* Muscle Pain Selector */}
                  <div>
                    <label className="block text-[10px] text-slate-300 uppercase tracking-wider mb-1.5 font-mono font-bold">
                      Sentiu Dor Muscular Pós-Treino?
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {["Nenhuma", "Leve", "Moderada", "Forte"].map((pain) => (
                        <button
                          key={pain}
                          type="button"
                          onClick={() => setMusclePain(pain)}
                          className={`py-1.5 rounded-lg border text-[10px] transition-all font-sans font-semibold uppercase tracking-wider text-center cursor-pointer ${
                            musclePain === pain
                              ? "bg-brand-neon/15 text-brand-neon border-brand-neon"
                              : "bg-black/30 border-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          {pain}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="block text-[10px] text-slate-300 uppercase tracking-wider mb-1 font-mono font-bold">
                      Comentários do Atleta (Opcional)
                    </label>
                    <textarea
                      placeholder="Como você se sentiu? Alguma dor articular, desconforto mecânico ou facilidade nos ritmos?"
                      rows={3}
                      value={workoutComment}
                      onChange={(e) => setWorkoutComment(e.target.value)}
                      className="w-full bg-black/45 border border-white/10 rounded-xl p-3 text-slate-200 text-xs font-sans placeholder-slate-600 focus:border-brand-neon focus:outline-none"
                    ></textarea>
                  </div>

                  {/* Submit Feedback Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-brand-neon hover:bg-cyan-300 text-brand-dark font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-glow-cyan font-sans"
                    >
                      <Send className="w-4 h-4 fill-current" />
                      Enviar Feedback ao Treinador
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* D. Trainer Interactive Response Box */}
            {feedbackSubmitted && (
              <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                  <div className="w-9 h-9 rounded-full bg-brand-neon/15 border border-brand-neon/20 flex items-center justify-center text-brand-neon shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">
                      Feedback do Treinador Virtual
                    </h4>
                    <span className="text-[9px] text-slate-500 font-sans block lowercase">/ real-time physical analysis response</span>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-brand-neon/5 border border-brand-neon/10 rounded-xl relative text-xs text-slate-300 leading-relaxed font-sans">
                  <span className="absolute -top-2.5 left-3 text-3xl font-serif text-brand-neon/20 select-none">“</span>
                  <p className="pl-3.5 pr-2.5">
                    {coachFeedbackReply}
                  </p>
                  <p className="pl-3.5 pr-2.5 mt-2.5 font-bold text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                    👉 Prioridade para hoje: Hidratação pesada, ingestão de proteínas de qualidade, e pelo menos 8h de sono reparador.
                  </p>
                </div>

                {/* Reset Interactive Flow Button */}
                <div className="mt-5 pt-3 border-t border-white/5 flex justify-end">
                  <button
                    type="button"
                    onClick={resetTodayWorkout}
                    className="py-2 px-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Resetar Registro do Dia
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Coach Adaptation and Schedule Progress (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* A. Coach's Adaptive Decision Card */}
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <h3 className="text-xs uppercase font-bold text-slate-300 tracking-widest mb-4 flex items-center gap-2 font-mono">
                <Award className="w-4 h-4 text-brand-neon animate-soft-pulse" />
                Decisão do Treinador IA
              </h3>

              {readiness ? (
                <div className="space-y-4">
                  {readiness.status === ReadinessStatus.READY ? (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400 font-mono">Executar sem ajuste</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                        Sua recuperação está excelente. Os biomarcadores de fadiga aguda e crônica encontram-se na faixa ideal de supercompensação. Pronto para o treino planejado!
                      </p>
                      <div className="text-[10px] text-slate-400">
                        <span className="font-bold text-slate-300">Objetivo:</span> consolidar o estímulo prescrito e evoluir a base fisiológica.
                      </div>
                    </div>
                  ) : readiness.status === ReadinessStatus.REDUCE ? (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                        <span className="text-xs font-black uppercase tracking-wider text-amber-400 font-mono">Executar com ajuste</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                        Sua recuperação permite treinar hoje, porém a carga recente está elevada. O estímulo de intensidade foi convertido para uma sessão aeróbica controlada.
                      </p>
                      <div className="text-[10px] text-slate-400">
                        <span className="font-bold text-slate-300">Objetivo:</span> manter consistência sem acumular fadiga desnecessária.
                      </div>
                      <div className="border-t border-white/5 pt-2 space-y-1">
                        <span className="text-[9px] font-mono uppercase text-amber-400 font-bold block">Ajuste aplicado:</span>
                        <ul className="list-disc pl-4 text-[10px] text-slate-300 space-y-0.5">
                          <li>Intensidade reduzida</li>
                          <li>Volume principal reduzido em aproximadamente 20%</li>
                          <li>Zona alvo mantida em Z2</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping"></span>
                        <span className="text-xs font-black uppercase tracking-wider text-red-400 font-mono">Foco em Regeneração</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                        Indicadores de prontidão sugerem necessidade imediata de descanso ou regeneração para evitar acúmulo de fadiga residual crônica.
                      </p>
                      <div className="text-[10px] text-slate-400">
                        <span className="font-bold text-slate-300">Objetivo:</span> restabelecer a homeostase e acalmar o sistema nervoso autônomo.
                      </div>
                      <div className="border-t border-white/5 pt-2 space-y-1">
                        <span className="text-[9px] font-mono uppercase text-red-400 font-bold block">Ajuste aplicado:</span>
                        <ul className="list-disc pl-4 text-[10px] text-slate-300 space-y-0.5">
                          <li>Sessão aeróbica convertida para regenerativa</li>
                          <li>Foco na Zona 1 (Z1) ou repouso total</li>
                          <li>Proteção total contra sobrecarga neuromuscular</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Adaptive Prescription Numbers */}
                  {(() => {
                    const todayW = getTodayWorkout();
                    const mainStep = todayW?.steps?.find((s: any) => s.id === "main");
                    
                    const displayPace = mainStep ? mainStep.paceText.replace("Pace Alvo: ", "").replace("Pace: ", "") : 
                      (readiness.status === ReadinessStatus.READY ? (athleteProfile.estimatedPaceCurrent || "5:30 - 6:00 min/km") : 
                       readiness.status === ReadinessStatus.REDUCE ? "6:40 - 7:20 min/km" : "7:00+ min/km");
                    
                    const displayHR = mainStep ? mainStep.hrText.replace("FC Alvo: ", "").replace("FC: ", "") : 
                      (readiness.status === ReadinessStatus.READY ? `${coachZ2Min} - ${coachZ2Max} bpm` : 
                       readiness.status === ReadinessStatus.REDUCE ? `${coachZ2Min} - ${coachZ2Max} bpm` : `< ${coachZ1Max} bpm`);

                    return (
                      <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-white/5">
                          <span className="text-slate-400 text-[10px] uppercase font-mono">Pace Alvo Estimado</span>
                          <span className="font-mono font-bold text-white text-right max-w-[170px] truncate" title={displayPace}>
                            {displayPace}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/5">
                          <span className="text-slate-400 text-[10px] uppercase font-mono">FC Alvo Recomendada</span>
                          <span className="font-mono font-bold text-white text-right max-w-[170px] truncate" title={displayHR}>
                            {displayHR}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                  Faça o seu Check-in Diário na aba correspondente para que o motor de decisão do treinador IA possa calcular a prontidão fisiológica ideal do seu dia.
                </p>
              )}
            </div>

            {/* B. Calendário Semanal Quick Status */}
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <h3 className="text-xs uppercase font-bold text-slate-300 tracking-widest mb-4 flex items-center gap-2 font-mono">
                <Calendar className="w-4 h-4 text-brand-neon" />
                Estrutura Semanal
              </h3>

              <div className="space-y-2 text-xs">
                {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day, idx) => {
                  const todayIdx = new Date().getDay();
                  const isToday = (todayIdx === 0 ? 6 : todayIdx - 1) === idx; // convert Sunday=0 to Seg=0 index match
                  const isPast = (todayIdx === 0 ? 6 : todayIdx - 1) > idx;
                  
                  // Map day index to the Portuguese full day names in trainingPlan
                  const fullDays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
                  const targetDayFull = fullDays[idx];
                  
                  let displayWorkoutName = "";
                  if (trainingPlan) {
                    const activeWeekIdx = Math.min(selectedWeekIdx, (trainingPlan.cycles[0]?.weeks?.length || 1) - 1);
                    const weekWorkouts = trainingPlan.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
                    const foundW = weekWorkouts.find((w: any) => w.day === targetDayFull);
                    if (foundW) {
                      displayWorkoutName = foundW.workout.name;
                    }
                  }
                  
                  if (!displayWorkoutName) {
                    displayWorkoutName = idx === 0 ? "Força Z3" :
                                         idx === 1 ? "Rodagem Z2" :
                                         idx === 2 ? "Rodagem Base Z2" :
                                         idx === 3 ? "Regenerativo" :
                                         idx === 4 ? "Tiros Limiar Z4" :
                                         idx === 5 ? "Descanso" : "Longão Base Z2";
                  }

                  return (
                    <div 
                      key={day} 
                      className={`flex justify-between items-center p-2.5 rounded-lg border transition-all ${
                        isToday 
                          ? "bg-brand-neon/10 border-brand-neon text-brand-neon font-bold" 
                          : "bg-white/5 border-white/5 text-slate-400"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {(() => {
                          const isCompleted = (isToday && todayWorkoutCompleted) || localStorage.getItem(`fit_workout_completed_${targetDayFull}_w${selectedWeekIdx + 1}`) === "true";
                          if (isCompleted) {
                            return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-500/10 shrink-0" />;
                          } else if (isToday) {
                            return <Clock className="w-3.5 h-3.5 text-brand-neon shrink-0 animate-spin" style={{ animationDuration: '3s' }} />;
                          } else if (isPast) {
                            return <div className="w-3.5 h-3.5 rounded-full border border-slate-700 bg-black/40 text-[9px] font-mono text-slate-500 flex items-center justify-center shrink-0" title="Treino não concluído">—</div>;
                          } else {
                            return <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0"></div>;
                          }
                        })()}
                        <span>{day}</span>
                      </span>
                      
                      <span className="text-[10px] font-mono text-right max-w-[150px] truncate" title={displayWorkoutName}>
                        {displayWorkoutName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* C. Orientação Científica Card */}
            <div className="p-4 bg-brand-neon/5 border border-brand-neon/10 rounded-2xl text-[10px] text-slate-400 leading-relaxed font-sans">
              <strong>💡 Orientação Base:</strong> "Corra devagar para correr rápido no futuro." Manter-se na <strong>Zona 2 (Rodagem)</strong> desenvolve o sistema de capilarização periférica e aumenta a densidade de mitocôndrias musculares sem gerar fadiga excessiva no sistema nervoso central. Paciência é a maior virtude de um maratonista!
            </div>

          </div>

        </div>
      )}

      {/* 3. ABA ATUALIZAÇÃO DE ESTADO (STATE) */}
      {coachTab === "state" && (
        <div className={`grid grid-cols-1 ${activeActivity ? "lg:grid-cols-12" : "max-w-3xl mx-auto w-full"} gap-6 animate-fade-in`}>
          
          {/* LEFT COLUMN: Check-in Diário & Physical Models */}
          <div className={`${activeActivity ? "lg:col-span-5" : "col-span-1"} flex flex-col gap-6`}>
            
            {/* A. Check-in Diário Form */}
            <div id="check-in-form" className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest font-mono bg-brand-neon/10 text-brand-neon mb-1.5">
                    <Sparkles className="w-2.5 h-2.5 animate-pulse" /> Consulta do Dia
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-brand-neon" />
                    Check-in Diário de Preparação
                  </h3>
                </div>
                {readiness && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono uppercase">Score Atual</span>
                    <span className="text-lg font-black font-mono text-brand-neon">{readiness.score}/100</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 font-sans leading-relaxed mb-5 border-b border-white/5 pb-4">
                Informe como seu corpo e mente estão se sentindo hoje. O treinador adaptará o treino planejado com base nestas respostas.
              </p>

              <div className="space-y-4">
                
                {/* --- SEÇÃO 1: SONO E RECUPERAÇÃO --- */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-l-2 border-cyan-500 pl-2">
                    Recuperação Fisiológica
                  </h4>
                  
                  {/* Horas de Sono & Score do Sono (Lado a Lado - Metade do Espaço Cada) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Horas de Sono (Começando em 2h) */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <span className="flex items-center gap-1"><Moon className="w-3.5 h-3.5 text-slate-500" /> Sono (Horas)</span>
                        <span className="font-mono font-bold text-white">{dailyMetrics.sleepHours}h</span>
                      </div>
                      <input 
                        type="range" 
                        min="2" 
                        max="12" 
                        step="0.5"
                        value={dailyMetrics.sleepHours}
                        onChange={(e) => setDailyMetrics({ ...dailyMetrics, sleepHours: parseFloat(e.target.value) })}
                        className="w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Sleep Score Slider */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Score do Sono</span>
                        <span className="font-mono font-bold text-white">{dailyMetrics.sleepScore} pts</span>
                      </div>
                      <input 
                        type="range" 
                        min="30" 
                        max="100" 
                        value={dailyMetrics.sleepScore}
                        onChange={(e) => setDailyMetrics({ ...dailyMetrics, sleepScore: parseInt(e.target.value) })}
                        className="w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                      />
                    </div>
                  </div>

                  {/* Body Battery & Carga de Treinamento Garmin (Lado a Lado - Metade do Espaço Cada) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Body Battery Slider */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-slate-500" /> Body Battery</span>
                        <span className="font-mono font-bold text-brand-neon">{dailyMetrics.bodyBattery !== undefined ? dailyMetrics.bodyBattery : 75} pts</span>
                      </div>
                      <input 
                        type="range" 
                        min="5" 
                        max="100" 
                        value={dailyMetrics.bodyBattery !== undefined ? dailyMetrics.bodyBattery : 75}
                        onChange={(e) => setDailyMetrics({ ...dailyMetrics, bodyBattery: parseInt(e.target.value) })}
                        className="w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Carga de Treinamento Garmin (Campo Numérico sem Limite Fixo) */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <span className="flex items-center gap-1 text-[11px] font-medium" title="Carga aguda de treino do relógio Garmin (7 dias)">
                          <Flame className="w-3.5 h-3.5 text-amber-400" /> Carga Garmin
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Input Numérico</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="10"
                          placeholder="Ex: 350"
                          value={dailyMetrics.garminTrainingLoad || ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                            setDailyMetrics({ ...dailyMetrics, garminTrainingLoad: val });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                        />
                        <span className="text-[10px] font-mono text-slate-500">pts</span>
                      </div>
                    </div>
                  </div>

                  {/* HRV Slider & Garmin Status Popup */}
                  <div>
                    <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5">
                      <span className="flex items-center gap-1.5 font-sans font-medium">
                        <Heart className="w-3.5 h-3.5 text-red-400" /> Variabilidade de FC (HRV / VFC)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowHrvInfoModal(true)}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 text-[10px] cursor-pointer"
                          title="Entenda a VFC e o Baseline"
                        >
                          <Info className="w-3 h-3" />
                          <span className="hidden sm:inline">Entenda a VFC</span>
                        </button>
                        <span className="font-mono font-bold text-brand-neon">{dailyMetrics.hrv || 50} ms</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Cursor com metade do tamanho (w-1/2) */}
                      <input 
                        type="range" 
                        min="20" 
                        max="120" 
                        value={dailyMetrics.hrv || 50}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setDailyMetrics({ ...dailyMetrics, hrv: val });
                        }}
                        className="w-1/2 accent-brand-neon cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                      />

                      {/* Botão Pop-up na frente: Equilibrado (verde) / Desequilibrado (laranja) */}
                      <div className="relative w-1/2">
                        {(() => {
                          const baseline = dailyMetrics.hrvBaseline || 55;
                          const currentHrv = dailyMetrics.hrv || 50;
                          const isBalanced = dailyMetrics.hrvStatus 
                            ? dailyMetrics.hrvStatus === "balanced" 
                            : true;

                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowHrvPopup(!showHrvPopup)}
                                className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-between gap-1 transition-all border cursor-pointer ${
                                  isBalanced 
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                                    : "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                                }`}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${isBalanced ? "bg-emerald-400" : "bg-amber-400"}`} />
                                  <span className="truncate">{isBalanced ? "Equilibrado" : "Desequilibrado"}</span>
                                </span>
                                <ChevronDown className={`w-3.5 h-3.5 opacity-80 flex-shrink-0 transition-transform ${showHrvPopup ? "rotate-180" : ""}`} />
                              </button>

                              {showHrvPopup && (
                                <div className="absolute top-full right-0 mt-1.5 w-56 bg-slate-900/98 border border-white/20 rounded-xl shadow-2xl z-50 p-2 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                                  <div className="text-[9px] font-mono uppercase text-slate-400 px-2 py-1 border-b border-white/10 mb-1">
                                    Status VFC (Garmin)
                                  </div>
                                  
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDailyMetrics({ ...dailyMetrics, hrvStatus: "balanced" });
                                      setShowHrvPopup(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                                      isBalanced ? "bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/30" : "text-slate-300 hover:bg-white/10"
                                    }`}
                                  >
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                                    <div className="flex flex-col">
                                      <span>Equilibrado (Verde)</span>
                                      <span className="text-[9px] text-slate-400 font-sans">Faixa normal vs baseline ({baseline}ms)</span>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDailyMetrics({ ...dailyMetrics, hrvStatus: "unbalanced" });
                                      setShowHrvPopup(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer mt-1 ${
                                      !isBalanced ? "bg-amber-500/25 text-amber-300 font-bold border border-amber-500/30" : "text-slate-300 hover:bg-white/10"
                                    }`}
                                  >
                                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                    <div className="flex flex-col">
                                      <span>Desequilibrado (Laranja)</span>
                                      <span className="text-[9px] text-slate-400 font-sans">Alteração autonômica temporária</span>
                                    </div>
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {(() => {
                      const currentHrv = dailyMetrics.hrv || 50;
                      const baseline = dailyMetrics.hrvBaseline || 55;
                      const diffPct = Math.round(((currentHrv - baseline) / baseline) * 100);
                      const diffStr = diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`;

                      return (
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span className="font-sans">Baseline 21 dias:</span>
                            <span className={`font-mono font-bold ${diffPct < -15 ? "text-amber-400" : diffPct > 10 ? "text-emerald-400" : "text-slate-300"}`}>
                              ({diffStr} relativo)
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="20"
                              max="120"
                              value={dailyMetrics.hrvBaseline || 55}
                              onChange={(e) => setDailyMetrics({ ...dailyMetrics, hrvBaseline: parseInt(e.target.value) || 55 })}
                              className="w-12 bg-black/40 border border-white/10 rounded text-center py-0.5 text-slate-200 font-mono focus:border-brand-neon focus:outline-none"
                            />
                            <span className="font-mono">ms</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Resting Heart Rate */}
                  <div>
                    <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                      <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-slate-500" /> Freq. Cardíaca em Repouso (RHR)</span>
                      <span className="font-mono font-bold text-white">{dailyMetrics.restingHeartRate || 54} bpm</span>
                    </div>
                    <input 
                      type="range" 
                      min="35" 
                      max="90" 
                      value={dailyMetrics.restingHeartRate || 54}
                      onChange={(e) => setDailyMetrics({ ...dailyMetrics, restingHeartRate: parseInt(e.target.value) })}
                      className="w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                    />
                  </div>
                </div>

                {/* --- SEÇÃO 2: PREPARAÇÃO E SINTOMAS --- */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-l-2 border-cyan-500 pl-2">
                    Preparação & Sintomas
                  </h4>

                  {/* Garmin Training Readiness (Preparação para Treino) */}
                  <div>
                    <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                      <span className="flex items-center gap-1.5 font-sans font-medium">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Preparação para Treino (Garmin)
                      </span>
                      <span className="font-mono font-bold text-cyan-300">
                        {dailyMetrics.garminReadiness !== undefined ? dailyMetrics.garminReadiness : (dailyMetrics.prepScore || 78)}/100
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={dailyMetrics.garminReadiness !== undefined ? dailyMetrics.garminReadiness : (dailyMetrics.prepScore || 78)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setDailyMetrics({ ...dailyMetrics, garminReadiness: val, prepScore: val });
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Sensação Subjetiva do Atleta (5 Etapas) */}
                  <div>
                    <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5">
                      <span className="flex items-center gap-1.5 font-sans font-medium">
                        <Activity className="w-3.5 h-3.5 text-amber-400" /> Percepção do Atleta (5 Etapas)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Sensação Subjetiva</span>
                    </div>

                    <div className="relative">
                      {(() => {
                        const currentStageId = dailyMetrics.subjectiveFeeling || "bem";
                        const currentStage = SUBJECTIVE_FEELING_STAGES.find(s => s.id === currentStageId) || SUBJECTIVE_FEELING_STAGES[1];

                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => setShowSubjectivePopup(!showSubjectivePopup)}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-between gap-2 transition-all border cursor-pointer ${currentStage.color} shadow-lg`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse ${currentStage.dot}`} />
                                <span className="font-bold">{currentStage.label}</span>
                                <span className="text-[10px] font-sans font-normal opacity-80 truncate hidden sm:inline">
                                  — {currentStage.sub}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[10px] opacity-75 font-mono">{currentStage.score} pts</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${showSubjectivePopup ? "rotate-180" : ""}`} />
                              </div>
                            </button>

                            {showSubjectivePopup && (
                              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/98 border border-white/20 rounded-xl shadow-2xl z-50 p-2 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                                <div className="text-[9px] font-mono uppercase text-slate-400 px-2 py-1 border-b border-white/10 mb-1 flex justify-between items-center">
                                  <span>Como você se sente hoje?</span>
                                  <span className="text-[8px] text-slate-500 font-mono">5 Estágios</span>
                                </div>
                                <div className="space-y-1">
                                  {SUBJECTIVE_FEELING_STAGES.map((stage) => {
                                    const isSelected = currentStageId === stage.id;
                                    return (
                                      <button
                                        key={stage.id}
                                        type="button"
                                        onClick={() => {
                                          setDailyMetrics({ ...dailyMetrics, subjectiveFeeling: stage.id as any });
                                          setShowSubjectivePopup(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono text-left transition-all cursor-pointer border ${
                                          isSelected
                                            ? stage.color + " font-bold shadow-md"
                                            : "text-slate-300 hover:bg-white/10 border-transparent"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                                          <div>
                                            <div className="font-bold text-white">{stage.label}</div>
                                            <div className="text-[9px] text-slate-400 font-sans">{stage.sub}</div>
                                          </div>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400">{stage.score} pts</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Muscle Soreness (Dor Muscular) */}
                  <div>
                    <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                      <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-slate-500" /> Dor Muscular</span>
                      <span className="font-mono font-bold text-white">
                        {dailyMetrics.muscleSoreness || 2}/10 
                        <span className="text-[10px] text-slate-400 font-sans font-normal ml-1.5">
                          ({(dailyMetrics.muscleSoreness || 2) <= 3 ? "Nenhuma/Leve" : (dailyMetrics.muscleSoreness || 2) <= 6 ? "Moderada" : "Forte"})
                        </span>
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={dailyMetrics.muscleSoreness || 2}
                      onChange={(e) => setDailyMetrics({ ...dailyMetrics, muscleSoreness: parseInt(e.target.value) })}
                      className="w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Dias Consecutivos Sem Treino / Descanso */}
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                      <span>Dias Consecutivos Sem Treino</span>
                      <span className="text-cyan-400 font-bold">{dailyMetrics.daysWithoutTraining || 0} dia(s)</span>
                    </label>
                    <div className="grid grid-cols-6 gap-1">
                      {[0, 1, 2, 3, 4, 5].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDailyMetrics({ ...dailyMetrics, daysWithoutTraining: d })}
                          className={`py-1 rounded border text-[10px] font-mono font-bold transition-all ${
                            (dailyMetrics.daysWithoutTraining || 0) === d
                              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                              : "bg-black/30 text-slate-400 border-white/5 hover:text-white"
                          }`}
                        >
                          {d === 5 ? "5+" : `${d}d`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weight and Injury Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Peso Corporal (Opcional, kg)</label>
                      <input 
                        type="number"
                        step="0.1"
                        placeholder="79.2"
                        value={dailyMetrics.weight !== undefined ? dailyMetrics.weight : ""}
                        onChange={(e) => setDailyMetrics({ ...dailyMetrics, weight: parseFloat(e.target.value) || undefined })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-brand-neon focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer select-none bg-black/25 border border-white/5 rounded-lg px-2.5 py-1.5 h-[34px] hover:border-white/10">
                        <input 
                          type="checkbox"
                          checked={!!dailyMetrics.hasInjury}
                          onChange={(e) => setDailyMetrics({ ...dailyMetrics, hasInjury: e.target.checked, injurySeverity: e.target.checked ? (dailyMetrics.injurySeverity || "mild") : undefined })}
                          className="accent-brand-neon cursor-pointer w-3.5 h-3.5 rounded"
                        />
                        <span className="text-[10px] text-slate-300 font-sans font-semibold uppercase tracking-tight">Lesão / Dor Articular?</span>
                      </label>
                    </div>
                  </div>

                  {/* Seleção de Gravidade da Dor/Lesão */}
                  {!!dailyMetrics.hasInjury && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2 mt-2">
                      <label className="block text-[10px] text-red-400 uppercase tracking-wider font-mono font-bold">Gravidade da Dor / Limitação</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDailyMetrics({ ...dailyMetrics, injurySeverity: "mild" })}
                          className={`py-1.5 px-2 rounded-lg border text-[10px] transition-all font-sans font-semibold text-center cursor-pointer flex flex-col items-center justify-center min-h-[50px] ${
                            dailyMetrics.injurySeverity === "mild"
                              ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                              : "bg-black/45 border-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          <span>⚠️ Restrição de Treino</span>
                          <span className="text-[8px] font-normal text-slate-400 normal-case mt-0.5 leading-tight">Rigidez / Desconforto localizado leve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDailyMetrics({ ...dailyMetrics, injurySeverity: "clinical" })}
                          className={`py-1.5 px-2 rounded-lg border text-[10px] transition-all font-sans font-semibold text-center cursor-pointer flex flex-col items-center justify-center min-h-[50px] ${
                            dailyMetrics.injurySeverity === "clinical" || !dailyMetrics.injurySeverity
                              ? "bg-red-500/20 border-red-500/50 text-red-300 animate-pulse"
                              : "bg-black/45 border-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          <span>🛑 Restrição Clínica</span>
                          <span className="text-[8px] font-normal text-slate-400 normal-case mt-0.5 leading-tight">Dor forte / Limitação de movimento</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>

              </div>

              {/* ACTION BUTTON */}
              <div className="mt-6 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={handleStateSubmit}
                  className="w-full py-3 px-4 rounded-xl bg-brand-neon hover:bg-cyan-300 text-brand-dark font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-glow-cyan font-sans"
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                  Atualizar Estado & Consultar Treinador
                </button>
              </div>

            </div>

        {/* FIT Telemetry Upload Box */}
        <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs uppercase font-bold text-slate-300 tracking-widest mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4 text-brand-neon" />
            Upload de Telemetria FIT (Opcional)
          </h3>

          {/* Drag and drop zone */}
          <div
            onDragOver={localHandleDragOver}
            onDragLeave={localHandleDragLeave}
            onDrop={localHandleDrop}
            onClick={localOnUploadClick}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              localIsDragging
                ? "border-brand-neon bg-brand-neon/5 scale-[1.01]"
                : "border-white/10 hover:border-brand-neon/40 bg-white/5"
            }`}
          >
            <input
              type="file"
              ref={localFileInputRef}
              onChange={localOnFileChange}
              accept=".fit"
              className="hidden"
            />

            {isUploading ? (
              <div className="flex flex-col items-center py-4">
                <div className="w-8 h-8 rounded-full border-2 border-brand-neon/30 border-t-brand-neon animate-spin mb-3"></div>
                <p className="text-xs font-mono text-brand-neon animate-soft-pulse">
                  PARSING FIT STREAM...
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  Extracting GPS & biometric charts
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-3">
                <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center mb-3 border border-white/5 group-hover:scale-110 transition-transform">
                  <FileDown className="w-5 h-5 text-slate-400 group-hover:text-brand-neon" />
                </div>
                <p className="text-xs font-medium text-slate-300">
                  Arraste ou selecione seu arquivo <span className="text-brand-neon font-mono">.fit</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  Importe do Garmin, Wahoo ou Strava para **refinar** seu plano de treino com dados reais (Opcional)
                </p>
              </div>
            )}
          </div>

          {/* Explanatory text about optionability */}
          <p className="text-[10px] text-slate-400 font-sans leading-relaxed mt-3 bg-brand-neon/5 border border-brand-neon/10 p-2.5 rounded-lg">
            💡 <strong>O .fit não é obrigatório!</strong> O envio de arquivos .fit é usado para um refinamento cirúrgico da planilha (como ritmos precisos e zonas cardíacas reais) no seu histórico.
          </p>

          {!activeActivity && loadDemoWorkout && (
            <button
              type="button"
              onClick={loadDemoWorkout}
              className="w-full mt-3 bg-brand-neon/15 hover:bg-brand-neon/25 text-brand-neon border border-brand-neon/20 font-bold text-[10px] py-2 px-3 rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Carregar Treino Demonstrativo FIT
            </button>
          )}

          {/* Error Message if present */}
          {uploadError && (
            <div className="mt-3 p-3 bg-red-950/40 border border-red-900/60 rounded-lg flex gap-2 items-start">
              <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-300 font-sans leading-relaxed">
                {uploadError}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Tab 3 Right Column: AI Coach Workspace (Telemetry Analysis) */}
      {activeActivity && (
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="space-y-6 animate-fade-in">
            {/* Dashboard header card */}
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-neon/15 text-brand-neon flex items-center justify-center border border-brand-neon/25 shadow-lg shadow-brand-neon/5 shrink-0">
                    {getSportIcon(activeActivity.sport, "w-5 h-5")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-bold font-display tracking-tight text-white leading-tight">
                        {activeActivity.aiAnalysis.title}
                      </h2>
                      <span className="text-[9px] font-semibold bg-brand-neon/10 border border-brand-neon/20 px-2 py-0.2 rounded-full text-brand-neon uppercase font-mono tracking-wider shrink-0">
                        {activeActivity.sport === "run" || activeActivity.sport === "running" ? "Corrida" : activeActivity.sport}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      Iniciado em {new Date(activeActivity.startTime).toLocaleString("pt-BR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end font-mono shrink-0 gap-1.5">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-sans font-medium">Origem</p>
                    <p className="text-[10px] text-slate-300 font-semibold truncate max-w-[150px]" title={activeActivity.filename}>
                      {activeActivity.filename}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveActivity(null)}
                    className="text-[9px] uppercase font-bold tracking-wider text-slate-400 hover:text-red-400 border border-white/5 hover:border-red-500/20 bg-white/5 hover:bg-red-500/5 px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer font-sans w-fit"
                    title="Remover análise do treino ativo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Fechar Análise
                  </button>
                </div>
              </div>

                {/* AI Coaching Insights Area */}
                <div className="mt-4 p-4 bg-gradient-to-br from-cyan-950/20 via-black/40 to-slate-900/10 rounded-2xl border border-cyan-500/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-950/20 rounded-full blur-2xl"></div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-black border border-brand-neon flex items-center justify-center shrink-0 shadow-glow-cyan">
                      <Award className="w-5 h-5 text-brand-neon stroke-[1.5]" />
                    </div>
                    <div className="flex-1 space-y-3 min-w-0">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest font-mono text-brand-neon">
                            Análise do Treinador de Elite
                          </h4>
                          <span className="text-[8px] font-mono bg-black border border-white/5 px-1.5 py-0.2 rounded text-cyan-400">
                            {activeActivity.aiEnabled ? "Gemini 3.5 Flash" : "Motor de Heurísticas Local"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-100 mt-0.5">
                          Efeito do Treino: <span className="text-brand-neon font-display">{activeActivity.aiAnalysis.trainingEffect}</span>
                        </p>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans italic">
                        "{activeActivity.aiAnalysis.summary}"
                      </p>

                      <div className="space-y-1.5 pt-1">
                        {activeActivity.aiAnalysis.coachingInsights.split("\n").map((line: string, idx: number) => {
                          const cleanLine = line.replace(/^\s*•\s*/, "");
                          if (!cleanLine.trim()) return null;
                          return (
                            <div key={idx} className="flex gap-2 items-start text-xs text-slate-300 font-sans leading-relaxed">
                              <span className="text-brand-neon mt-1 shrink-0">•</span>
                              <p dangerouslySetInnerHTML={{ __html: cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong class="text-brand-neon font-semibold">$1</strong>') }} />
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-white/5 text-[11px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400 font-sans">Tempo de Recuperação Recomendado:</span>
                          <span className="font-mono font-semibold text-brand-neon bg-black/50 px-2 py-0.5 rounded border border-white/5">
                            {activeActivity.aiAnalysis.suggestedRecovery}
                          </span>
                        </div>
                        
                        {!activeActivity.aiEnabled && (
                          <span className="text-[9px] text-slate-500 flex items-center gap-1">
                            <Info className="w-3 h-3 text-amber-500 shrink-0" />
                            modo de contingência
                          </span>
                        )}
                      </div>

                      {/* Athlete profile analysis context footer */}
                      <div className="mt-3 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[10px] font-mono text-slate-400 bg-white/5 -mx-4 -mb-4 px-4 py-2.5 rounded-b-2xl">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse shrink-0"></span>
                          <span>
                            Para: <strong className="text-slate-200">{athleteProfile.age} anos ({athleteProfile.weight}kg)</strong> | Objetivo: <strong className="text-brand-neon uppercase font-bold">
                              {athleteProfile.trainingGoal === "weight_loss" ? "Perda de Peso" :
                               athleteProfile.trainingGoal === "general" ? "Condic. Geral" :
                               athleteProfile.trainingGoal === "5k" ? "Meta: 5k" :
                               athleteProfile.trainingGoal === "10k" ? "Meta: 10k" :
                               athleteProfile.trainingGoal === "half_marathon" ? "Meta: Meia" :
                               athleteProfile.trainingGoal === "marathon" ? "Meta: Maratona" :
                               athleteProfile.trainingGoal === "ultra" ? "Meta: Ultramaratona" : "Geral"}
                            </strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={reanalyzeWorkout}
                          disabled={isReanalyzing}
                          className="text-brand-neon hover:text-cyan-300 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                        >
                          {isReanalyzing ? (
                            <>
                              <span className="w-3 h-3 rounded-full border border-brand-neon/30 border-t-brand-neon animate-spin inline-block"></span>
                              Processando...
                            </>
                          ) : (
                            <>
                              <span>↺ Atualizar Análise</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Physiological Load & AI Coach Adaptive Decision Panel */}
              {(() => {
                const durationMins = Math.round(activeActivity.summary.durationSeconds / 60);
                const avgHrVal = activeActivity.summary.avgHeartRate || 140;
                const hrFactorValue = heartRateFactor(avgHrVal);
                const calculatedLoad = calculateActivityLoad(durationMins, currentRpe, avgHrVal);
                const compResult = compareLoad(plannedLoadInput, calculatedLoad);
                const coachDecision = adjustNextWorkout(plannedLoadInput, calculatedLoad, currentRpe, 0);

                const getRpeDescription = (r: number) => {
                  if (r <= 2) return "Muito Fácil / Regenerativo";
                  if (r <= 4) return "Fácil / Ritmo de Base (Z2)";
                  if (r <= 6) return "Moderado / Ritmo Tempo (Z3)";
                  if (r <= 8) return "Difícil / Limiar de Lactato (Z4)";
                  return "Esforço Máximo / Tiros de VO2 (Z5)";
                };

                return (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm">
                    <h3 className="text-[10px] uppercase font-bold text-slate-200 tracking-widest mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-neon" />
                      Modelo de Carga Fisiológica & Ajuste Adaptativo <span className="text-[8px] text-slate-400 font-normal lowercase font-sans">/ real-time telemetry analytics</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Left: Interactive RPE Input */}
                      <div className="space-y-2.5 bg-white/5 border border-white/5 rounded-xl p-3.5">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block">
                          Percepção de Esforço (RPE)
                        </span>
                        
                        <div className="flex justify-between items-baseline">
                          <span className="text-2xl font-extrabold font-mono text-white">
                            {currentRpe} <span className="text-xs text-slate-500">/ 10</span>
                          </span>
                          <span className="text-[8px] font-semibold text-brand-neon font-mono bg-black/40 px-1.5 py-0.2 rounded border border-white/5">
                            Borg Adaptada
                          </span>
                        </div>

                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          step="1"
                          value={currentRpe}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setCurrentRpe(val);
                            localStorage.setItem(`fit_rpe_${activeActivity.id}`, val.toString());
                          }}
                          className="w-full accent-brand-neon cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none mt-1"
                        />

                        <p className="text-[10px] text-slate-300 font-sans mt-1.5 font-medium bg-brand-dark/40 py-1 px-2 rounded border border-white/5">
                          {getRpeDescription(currentRpe)}
                        </p>
                      </div>

                      {/* Middle: Calculated Load details */}
                      <div className="space-y-2.5 bg-white/5 border border-white/5 rounded-xl p-3.5">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block">
                          Carga Realizada (Garmin Load)
                        </span>

                        <div className="flex justify-between items-baseline">
                          <span className="text-2xl font-extrabold font-mono text-cyan-400">
                            {calculatedLoad} <span className="text-xs text-slate-500">tss</span>
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            Fator: {hrFactorValue.toFixed(2)}x
                          </span>
                        </div>

                        <div className="text-[9px] space-y-1 text-slate-400 font-mono leading-relaxed pt-1 border-t border-white/5">
                          <div>Fórmula TRIMP Aplicada:</div>
                          <div className="text-slate-300">
                            {durationMins}m × {currentRpe} rpe × {hrFactorValue.toFixed(2)} factor
                          </div>
                          <div className="text-[8px] text-slate-500">
                            FC média registrada: {avgHrVal} bpm
                          </div>
                        </div>
                      </div>

                      {/* Right: Planned vs Actual Comparison */}
                      <div className="space-y-2.5 bg-white/5 border border-white/5 rounded-xl p-3.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                            Carga Planejada Alvo
                          </span>
                          <span className={`text-[8px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                            compResult.status === "dentro do esperado" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                            compResult.status === "acima do planejado" ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-blue-950 text-blue-300 border border-blue-800"
                          }`}>
                            {compResult.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="10" 
                            max="1000" 
                            step="10"
                            value={plannedLoadInput}
                            onChange={(e) => setPlannedLoadInput(Math.max(10, parseInt(e.target.value) || 0))}
                            className="bg-brand-dark/60 border border-white/10 text-white font-mono font-bold text-base rounded-lg p-1 w-16 text-center focus:outline-none focus:border-brand-neon"
                          />
                          <div className="text-[9px] font-mono text-slate-400 flex-1 leading-tight">
                            <div>Diferença: <strong className={compResult.differencePercent > 20 ? "text-amber-400" : "text-emerald-400"}>{compResult.differencePercent > 0 ? `+${compResult.differencePercent}%` : `${compResult.differencePercent}%`}</strong></div>
                            <div className="text-[8px] text-slate-500">Clique para ajustar</div>
                          </div>
                        </div>

                        <div className="flex gap-1 mt-1.5">
                          <button type="button" onClick={() => setPlannedLoadInput(100)} className="text-[8px] font-mono bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded text-slate-300 border border-white/5 cursor-pointer flex-1">100</button>
                          <button type="button" onClick={() => setPlannedLoadInput(180)} className="text-[8px] font-mono bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded text-slate-300 border border-white/5 cursor-pointer flex-1">180</button>
                          <button type="button" onClick={() => setPlannedLoadInput(280)} className="text-[8px] font-mono bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded text-slate-300 border border-white/5 cursor-pointer flex-1">280</button>
                        </div>
                      </div>
                    </div>

                    {/* Adaptive Decision Alert box */}
                    <div className={`mt-4 p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      coachDecision.action === "reduce" ? "bg-amber-950/25 border-amber-500/20 text-amber-300" :
                      coachDecision.action === "progress" ? "bg-purple-950/25 border-purple-500/20 text-purple-300" :
                      "bg-emerald-950/20 border-emerald-500/10 text-emerald-300"
                    }`}>
                      <div className="flex gap-2.5 items-start sm:items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
                          coachDecision.action === "reduce" ? "bg-amber-950 border-amber-500/40" : "bg-emerald-950 border-emerald-500/30"
                        }`}>
                          <Award className="w-5 h-5 text-brand-neon" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400">Decisão do Treinador</span>
                            <span className={`text-[8px] font-extrabold uppercase px-1 py-0.2 rounded ${
                              coachDecision.action === "reduce" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                            }`}>
                              {coachDecision.action === "reduce" ? "Reduzir Carga" : "Manter & Progredir"}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white mt-0.5">{coachDecision.message}</h4>
                          <p className="text-[10px] text-slate-400 font-sans mt-0.5">{coachDecision.reason}</p>
                        </div>
                      </div>
                      
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[9px] text-slate-500 font-mono block">Feedback Fisiológico</span>
                        <strong className="text-xs font-bold text-white font-mono uppercase">{coachDecision.action === "reduce" ? "Fadiga Excessiva" : "Adaptação Saudável"}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Bento Grid: Core Telemetry Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {/* 1. Distance */}
                <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-sans font-medium">Distance</span>
                    <Compass className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono tracking-tight text-white">
                      {activeActivity.summary.distanceKm}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">km</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 mt-1">
                    GPS Tracked
                  </span>
                </div>

                {/* 2. Duration */}
                <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-sans font-medium">Timer Time</span>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono tracking-tight text-white">
                      {formatDuration(activeActivity.summary.durationSeconds)}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 mt-1">
                    Moving Time
                  </span>
                </div>

                {/* 3. Speed / Pace */}
                <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-sans font-medium">
                      {activeActivity.sport === "running" ? "Average Pace" : "Average Speed"}
                    </span>
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono tracking-tight text-white">
                      {activeActivity.sport === "running"
                        ? speedToPace(activeActivity.summary.avgSpeedKmh).split(" ")[0]
                        : activeActivity.summary.avgSpeedKmh}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activeActivity.sport === "running" ? "/km" : "km/h"}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 mt-1">
                    Max: {activeActivity.sport === "running" 
                      ? speedToPace(activeActivity.summary.maxSpeedKmh) 
                      : `${activeActivity.summary.maxSpeedKmh} km/h`}
                  </span>
                </div>

                {/* 4. Heart Rate */}
                <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-sans font-medium">Heart Rate</span>
                    <Heart className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono tracking-tight text-white">
                      {activeActivity.summary.avgHeartRate || "---"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">bpm</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 mt-1">
                    Max: {activeActivity.summary.maxHeartRate || "---"} bpm
                  </span>
                </div>

                {/* Row 2 of Bento Grid */}
                {activeActivity.summary.calories !== null && (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-sans font-medium">Energy</span>
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono tracking-tight text-white">
                        {activeActivity.summary.calories}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">kcal</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 mt-1">
                      Caloric Exertion
                    </span>
                  </div>
                )}

                {activeActivity.summary.ascentMeters !== null && (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-sans font-medium">Elevation Climb</span>
                      <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono tracking-tight text-white">
                        +{activeActivity.summary.ascentMeters}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">m</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 mt-1">
                      Loss: -{activeActivity.summary.descentMeters || 0}m
                    </span>
                  </div>
                )}

                {activeActivity.summary.avgPower !== null && (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-sans font-medium">Avg Power</span>
                      <Zap className="w-3.5 h-3.5 text-yellow-500" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono tracking-tight text-white">
                        {activeActivity.summary.avgPower}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">W</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 mt-1">
                      Max: {activeActivity.summary.maxPower || "---"} W
                    </span>
                  </div>
                )}

                {activeActivity.summary.avgCadence !== null && (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-sans font-medium">Cadence</span>
                      <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono tracking-tight text-white">
                        {activeActivity.summary.avgCadence}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {activeActivity.sport === "running" ? "spm" : "rpm"}
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 mt-1">
                      Consistente
                    </span>
                  </div>
                )}
              </div>

              {/* Interactive Route Map with Pace / HR / Power variations & Telemetry Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                {/* Route Map with Physiological Color Variations */}
                <div className="lg:col-span-7">
                  <GpsMap
                    gpsPath={activeActivity.gpsPath || []}
                    records={activeActivity.records || []}
                    sport={activeActivity.sport || "running"}
                  />
                </div>

                {/* Telemetry Time-Series Chart */}
                <div className="lg:col-span-5">
                  {activeActivity.records && activeActivity.records.length > 0 ? (
                    <TelemetryCharts records={activeActivity.records} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full min-h-[350px] bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 text-center text-slate-400 text-xs font-mono">
                      <Activity className="w-8 h-8 text-slate-600 mb-2" />
                      <p>Sem dados de série temporal gravados para esta atividade.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

  {/* 2. ABA GERAR PLANO DE TREINO (PLAN) */}
  {coachTab === "plan" && (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
      {/* RIGHT COLUMN: AI Periodized Coach & Interactive Weekly Plan */}
      <div className="lg:col-span-12 flex flex-col gap-6">
        
        {/* Plan Actions & IA Generator */}
        <div id="ia-gerador" className="bg-gradient-to-r from-cyan-950/30 to-indigo-950/20 border border-brand-neon/20 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-brand-neon/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-brand-neon/10 text-brand-neon mb-2">
                <Sparkles className="w-3 h-3 animate-pulse" /> IA Virtual Running Coach
              </span>
              <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
                Periodização Inteligente de Treinos
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-md mt-1 font-sans">
                O treinador analisa seu <strong>histórico real</strong>, perfil fisiológico e <strong>prontidão atual</strong> para estruturar e prescrever uma rotina semanal equilibrada.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 self-start md:self-auto">
              <button
                onClick={generatePlan}
                disabled={isGeneratingPlan}
                className="px-4 py-2.5 rounded-xl bg-brand-neon text-brand-dark font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-glow-cyan hover:bg-cyan-300 disabled:opacity-50 transition-all"
              >
                {isGeneratingPlan ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Calculando Planilha...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-brand-dark fill-current" />
                    Gerar Planilha IA
                  </>
                )}
              </button>

              {trainingPlan && (
                <button
                  onClick={clearPlan}
                  className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
                  title="Limpar a planilha atual e reiniciar o progresso"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar Planilha
                </button>
              )}
            </div>
          </div>

          {planError && (
            <div className="mt-3 p-3 bg-red-950/30 border border-red-900/40 rounded-xl flex gap-2 text-xs text-red-300 font-sans">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p>{planError}</p>
            </div>
          )}
        </div>

        {/* C. Weekly Plan Calendar */}
        <div id="planilha-semanal" className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm flex-1 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-white/5 mb-4 gap-3">
            <h3 className="text-xs uppercase font-bold text-slate-200 tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-neon" />
              Planilha de Treinos Semanal <span className="text-[9px] text-slate-400 font-normal lowercase font-sans">/ cycle layout</span>
            </h3>
            {trainingPlan && (
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2.5 py-0.5 rounded border border-white/5">
                Fase: <strong className="text-brand-neon">{trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.phase || "Construção"}</strong>
              </span>
            )}
          </div>

          {/* 4-Week Periodized Cycle Week Switcher */}
          {trainingPlan && trainingPlan.cycles[0]?.weeks?.length > 1 && (
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 mb-4 self-start">
              {trainingPlan.cycles[0].weeks.map((wk: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedWeekIdx(idx)}
                  className={`text-[10px] font-mono px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all cursor-pointer font-bold ${
                    selectedWeekIdx === idx 
                      ? "bg-brand-neon text-brand-dark shadow-sm" 
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Semana {idx + 1}
                </button>
              ))}
            </div>
          )}

          {trainingPlan ? (
            <div className="space-y-3 flex-1 flex flex-col justify-start">
              
              {/* Weekly Overview Section */}
              {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.overview ? (
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-xs text-slate-300 space-y-3">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono block">Foco da Semana</span>
                      <h4 className="text-sm font-bold text-brand-neon mt-0.5">
                        {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.phase || trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.overview.title}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono block">Carga Estimada</span>
                      <span className="text-[10px] font-mono text-white bg-white/10 px-2 py-0.5 rounded-full inline-block mt-0.5 font-bold">
                        {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.overview.predictedLoad}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono block font-bold">Intenção da Semana</span>
                      <p className="text-slate-200 leading-relaxed font-sans text-[11px]">
                        {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.overview.objective}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono block font-bold">Treino Chave</span>
                      <p className="text-slate-200 leading-relaxed font-sans text-[11px]">
                        {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.overview.keyWorkout}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono block font-bold">Atenção do Treinador</span>
                      <p className="text-slate-200 leading-relaxed font-sans text-[11px]">
                        {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.overview.attentionPoint}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 text-xs text-slate-300">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono block mb-1">Meta Foco do Atleta</span>
                  <p className="font-sans text-slate-200 leading-relaxed font-semibold">
                    {trainingPlan.goal.description}
                  </p>
                  {trainingPlan.goal.targetPace && (
                    <span className="text-[10px] font-mono text-brand-neon mt-1.5 inline-block bg-brand-neon/5 border border-brand-neon/10 px-2 py-0.5 rounded">
                      Ritmo Alvo: {trainingPlan.goal.targetPace}
                    </span>
                  )}
                </div>
              )}

              {/* Weekly Calendar Rows */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.workouts.map((sw: any, idx: number) => {
                  const hasSteps = sw.workout.steps && sw.workout.steps.length > 0;
                  const currentTodayW = getTodayWorkout();
                  const isCompleted = (sw.day === currentTodayW?.day && todayWorkoutCompleted) || localStorage.getItem(`fit_workout_completed_${sw.day}_w${selectedWeekIdx + 1}`) === "true";
                  
                  return (
                    <div 
                      key={idx}
                      onClick={() => {
                        if (hasSteps) {
                          setSelectedWorkout({ ...sw.workout, day: sw.day });
                        }
                      }}
                      className={`border border-white/5 bg-black/40 hover:bg-white/5 transition-all p-3.5 rounded-xl cursor-pointer flex flex-col justify-between group ${
                        hasSteps ? "hover:border-brand-neon/30" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-brand-neon">
                            {sw.day}
                          </span>
                          {isCompleted && (
                            <span className="text-[8px] bg-emerald-500/15 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider border border-emerald-500/20">
                              Concluído
                            </span>
                          )}
                        </div>
                        {getIntentBadge(sw.workout.intent)}
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-white group-hover:text-brand-neon transition-colors">
                          {sw.workout.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {sw.workout.description}
                        </p>
                        
                        {/* Dynamic drills and strength attributes displayed directly on the card */}
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {sw.workout.intent === "strength" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                              <Dumbbell className="w-3 h-3 shrink-0" />
                              Fortalecimento / Força
                            </span>
                          )}
                          {sw.workout.intent === "mobility" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-pink-400 bg-pink-400/10 px-2 py-0.5 rounded border border-pink-400/20">
                              <Activity className="w-3 h-3 shrink-0" />
                              Mobilidade & Prevenção
                            </span>
                          )}
                          {sw.workout.steps && sw.workout.steps.some((s: any) => s.name?.toLowerCase().includes("educativ") || s.description?.toLowerCase().includes("educativ")) && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                              <Footprints className="w-3 h-3 shrink-0 text-cyan-400" />
                              Inclui Educativos de Corrida
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5 text-[10px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" /> {sw.workout.durationMinutes} min
                        </span>
                        {hasSteps && (
                          <span className="text-brand-neon group-hover:underline flex items-center gap-0.5">
                            Ver Intervalos <ChevronRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Relatório de Desempenho Semanal (Physiological Weekly Performance Report) */}
              <div className="mt-5 p-5 border border-white/5 bg-white/5 backdrop-blur-md rounded-xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <h4 className="text-xs uppercase font-bold text-slate-200 tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-neon" />
                    Relatório Fisiológico de Desempenho Semanal <span className="text-[9px] text-slate-500 font-normal lowercase font-sans">/ performance report feedback</span>
                  </h4>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold uppercase border ${reportData.statusColorClass}`}>
                    {reportData.reportStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Metric 1: Consistência de Treinos */}
                  <div className="space-y-2 bg-black/25 p-3 rounded-lg border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400 block">Consistência de Treinos</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-extrabold font-mono text-white">
                        {reportData.completedWorkoutsCount} <span className="text-xs text-slate-500">de {reportData.plannedWorkoutsCount || 4} treinos</span>
                      </span>
                      <span className="text-[10px] font-semibold text-brand-neon font-mono bg-black/40 px-1.5 py-0.5 rounded">
                        {reportData.plannedWorkoutsCount > 0 ? Math.round((reportData.completedWorkoutsCount / reportData.plannedWorkoutsCount) * 100) : 0}% meta
                      </span>
                    </div>
                    {/* Tiny Progress Bar */}
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-brand-neon h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, reportData.plannedWorkoutsCount > 0 ? (reportData.completedWorkoutsCount / reportData.plannedWorkoutsCount) * 100 : 0)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Metric 2: Carga de Treino Acumulada */}
                  <div className="space-y-2 bg-black/25 p-3 rounded-lg border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400 block">Carga Estimada (TSS)</span>
                    <div className="flex items-baseline justify-between">
                      <div className="flex gap-1 items-baseline">
                        <span className="text-xl font-extrabold font-mono text-cyan-400">{reportData.actualWeeklyLoad}</span>
                        <span className="text-[10px] text-slate-500 font-mono">realizado</span>
                      </div>
                      <div className="flex gap-1 items-baseline text-xs text-slate-400 font-mono">
                        <span>{reportData.plannedWeeklyLoad}</span>
                        <span className="text-[9px] text-slate-500">meta</span>
                      </div>
                    </div>
                    {/* Tiny visual side-by-side scale */}
                    <div className="flex gap-1 items-center h-1.5 pt-0.5">
                      <div className="bg-cyan-500/30 flex-1 h-full rounded-full relative overflow-hidden">
                        <div 
                          className="bg-cyan-400 h-full" 
                          style={{ width: `${Math.min(100, reportData.plannedWeeklyLoad > 0 ? (reportData.actualWeeklyLoad / reportData.plannedWeeklyLoad) * 100 : 0)}%` }}
                        ></div>
                      </div>
                      <span className="text-[8px] font-mono text-slate-500">tss</span>
                    </div>
                  </div>

                  {/* Metric 3: Desvio de Estresse Cardíaco */}
                  <div className="space-y-2 bg-black/25 p-3 rounded-lg border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400 block">Desvio do Estresse Cardíaco</span>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-xl font-extrabold font-mono ${reportData.loadDiffPercent > 20 ? "text-amber-400" : reportData.loadDiffPercent < -20 ? "text-blue-400" : "text-emerald-400"}`}>
                        {reportData.loadDiffPercent > 0 ? `+${reportData.loadDiffPercent}%` : `${reportData.loadDiffPercent}%`}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">vs plano prescrito</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-sans leading-relaxed">
                      {reportData.loadDiffPercent > 20 ? "Estresse agudo acima do limite sugerido." : reportData.loadDiffPercent < -20 ? "Volume agudo abaixo da resposta adaptativa." : "Estresse ideal para adaptação fisiológica."}
                    </p>
                  </div>
                </div>

                {/* Relatório/Parecer Card text */}
                <div className="p-3.5 bg-brand-dark/40 border border-white/5 rounded-xl text-[11px] leading-relaxed font-sans text-slate-300">
                  <strong className={`${reportData.statusTextColor} font-bold font-mono block mb-1 uppercase tracking-wider text-[10px]`}>
                    Parecer do Treinador IA:
                  </strong>
                  <p>{reportData.reportRecommendation}</p>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-white/10 rounded-2xl bg-white/5">
              <Calendar className="w-10 h-10 text-slate-600 mb-3" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Planilha em Branco</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 font-sans">
                Seu perfil está configurado! Clique no botão <strong>"Gerar Planilha IA"</strong> acima para o Treinador IA estruturar seu primeiro ciclo de treinos baseado na sua prontidão e histórico de quilômetros.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )}

  {/* 4. ABA ADAPTANDO O PLANO / HISTÓRICO (ADAPTATION) */}
  {coachTab === "adaptation" && (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
      <div className="lg:col-span-12 flex flex-col gap-6">
        <>
          {/* C1. Physiological Progress Tracker Dashboard (MOVED TO TOP) */}
          <div id="progresso-fisiologico" className="col-span-1 lg:col-span-12 bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-36 h-36 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Panel Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-white/5 mb-4 gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-emerald-500/10 text-emerald-400 mb-1">
                  <History className="w-3.5 h-3.5" /> Evolução de Parâmetros Fisiológicos
                </span>
                <h3 className="text-sm font-bold text-slate-200 tracking-wide uppercase flex items-center gap-2">
                  Histórico de Adaptação Fisiológica <span className="text-[10px] text-slate-400 font-mono font-normal tracking-normal lowercase">/ longitudinal tracking</span>
                </h3>
              </div>

              <button 
                onClick={handleClearProgressHistory}
                className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 border border-white/10"
                title="Limpar histórico fisiológico"
              >
                <Trash2 className="w-3.5 h-3.5" /> Limpar Histórico
              </button>
            </div>

            {/* Bio Highlights / Summary stats of progress */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 text-xs">
              <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 block mb-1">Perda de Peso Recorrente</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {progressHistory.length > 0 
                      ? `-${Math.round((90.0 - (progressHistory[progressHistory.length - 1]?.weight || 90.0)) * 10) / 10} kg`
                      : "---"}
                  </span>
                  <span className="text-[9px] text-slate-400">acumulado</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 font-sans">
                  {progressHistory.length > 0
                    ? `Meta de ${athleteProfile.weightGoalKg || 78}kg (atual: ${progressHistory[progressHistory.length - 1]?.weight}kg)`
                    : "Sem dados inseridos"}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 block mb-1">Volume de Treino Semanal</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold font-mono text-cyan-400">
                    {progressHistory.length > 0 
                      ? `${progressHistory[progressHistory.length - 1]?.weeklyKm || 0} km`
                      : "---"}
                  </span>
                  <span className="text-[9px] text-slate-400">semana</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 font-sans">
                  {progressHistory.length > 0 ? "Último registro de base semanal" : "Sem dados inseridos"}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 block mb-1">Batimento de Repouso (RHR)</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold font-mono text-indigo-400">
                    {progressHistory.length > 0 
                      ? `${progressHistory[progressHistory.length - 1]?.heartRate} bpm`
                      : "---"}
                  </span>
                  <span className="text-[9px] text-slate-400">repouso</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 font-sans">
                  {progressHistory.length > 0 ? "Frequência cardíaca matinal" : "Sem dados inseridos"}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 block mb-1">Melhor Ritmo Estimado</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold font-mono text-brand-neon">
                    {progressHistory.length > 0 
                      ? `${progressHistory[progressHistory.length - 1]?.pace} /km`
                      : "---"}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 font-sans">
                  {progressHistory.length > 0 ? "Evolução do ritmo aeróbico" : "Sem dados inseridos"}
                </p>
              </div>
            </div>

            {/* Interactive Recharts Line Plot or Empty State */}
            <div className="bg-black/20 border border-white/5 rounded-xl p-4 mb-5">
              {progressHistory.length === 0 ? (
                <div className="py-8 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center">
                  <Activity className="w-8 h-8 text-slate-600 mb-2" />
                  <h5 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Nenhum Registro de Evolução Fisiológica</h5>
                  <p className="text-xs text-slate-400 max-w-md mt-1 font-sans">
                    Histórico fisiológico inicial zerado para novos usuários. Preencha o formulário abaixo para começar a registrar e acompanhar seu peso corporal, volume de treino, ritmo e FC de repouso!
                  </p>
                </div>
              ) : (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressHistory} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={10} 
                        tickLine={false} 
                        tickFormatter={(val) => {
                          const parts = val.split("-");
                          return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                        }}
                      />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                      <ChartTooltip
                        contentStyle={{ backgroundColor: "#0b0f19", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                        labelStyle={{ color: "#94a3b8", fontSize: "10px", fontWeight: "bold" }}
                        itemStyle={{ fontSize: "11px" }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", color: "#94a3b8", paddingTop: "5px" }} />
                      <Line 
                        name="Peso Corporal (kg)" 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={{ r: 3, strokeWidth: 1 }} 
                        activeDot={{ r: 5 }} 
                      />
                      <Line 
                        name="Volume Semanal (km)" 
                        type="monotone" 
                        dataKey="weeklyKm" 
                        stroke="#38bdf8" 
                        strokeWidth={2} 
                        dot={{ r: 3, strokeWidth: 1 }} 
                        activeDot={{ r: 5 }} 
                      />
                      <Line 
                        name="FC Repouso (bpm)" 
                        type="monotone" 
                        dataKey="heartRate" 
                        stroke="#6366f1" 
                        strokeWidth={2} 
                        dot={{ r: 3, strokeWidth: 1 }} 
                        activeDot={{ r: 5 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Input Form to record new progression metric point */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-mono">
                <PlusCircle className="w-4 h-4 text-emerald-400" /> Registrar Novo Ponto no Histórico Fisiológico
              </h4>
              <form onSubmit={handleAddProgressPoint} className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 items-end">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Data do Registro</label>
                  <input 
                    type="date" 
                    value={historyDate}
                    onChange={(e) => setHistoryDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-brand-neon focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Peso Corporal (kg)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={historyWeight}
                    onChange={(e) => setHistoryWeight(e.target.value)}
                    placeholder="79.5"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-brand-neon focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Quilometragem (km)</label>
                  <input 
                    type="number" 
                    step="0.5"
                    value={historyWeeklyKm}
                    onChange={(e) => setHistoryWeeklyKm(e.target.value)}
                    placeholder="34"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-brand-neon focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">FC Repouso (bpm)</label>
                  <input 
                    type="number" 
                    value={historyHeartRate}
                    onChange={(e) => setHistoryHeartRate(e.target.value)}
                    placeholder="53"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-brand-neon focus:outline-none"
                  />
                </div>
                <div>
                  <button 
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-brand-dark font-extrabold text-xs py-2 px-3 rounded-lg uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-glow-cyan"
                  >
                    <PlusCircle className="w-4 h-4 text-brand-dark fill-current" /> Salvar Ponto
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* C2. FIT Uploaded Activities Database Panel */}
          <div id="historico-fit-banco" className="col-span-1 lg:col-span-12 bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-neon/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Panel Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-white/5 mb-5 gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-cyan-500/10 text-cyan-400 mb-1 border border-cyan-500/20">
                  <Database className="w-3.5 h-3.5 text-cyan-400" /> Banco de Dados de Treinos .FIT Uploaded
                </span>
                <h3 className="text-base font-bold text-slate-100 tracking-wide uppercase flex items-center gap-2">
                  Histórico de Atividades .FIT Armazenadas <span className="text-[10px] text-emerald-400 font-mono font-normal tracking-normal lowercase border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">● sincronizado no banco</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Cada arquivo .FIT enviado é gravado permanentemente no banco de dados e indexado para consulta e telemetria.
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                {refreshActivities && (
                  <button
                    onClick={() => refreshActivities()}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Atualizar lista do banco de dados"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Atualizar Banco
                  </button>
                )}

                <label className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold text-brand-dark bg-brand-neon hover:bg-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-glow-cyan">
                  <Upload className="w-3.5 h-3.5" /> Enviar Novo .FIT
                  <input
                    type="file"
                    accept=".fit"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && handleFileUpload) {
                        handleFileUpload(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Quick Upload Indicator */}
            {isUploading && (
              <div className="mb-5 p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-center gap-3 animate-pulse">
                <span className="w-5 h-5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin"></span>
                <div>
                  <h5 className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider">Processando e Gravando .FIT no Banco...</h5>
                  <p className="text-[11px] text-slate-400 font-sans">Extraindo métricas de potência, frequência cardíaca, altimetria e gerando análise com o Treinador IA.</p>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mb-5 p-3.5 bg-red-950/30 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-xs text-red-300 font-mono">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Summary KPI Cards for LAST WEEK specifically as requested */}
            {(() => {
              const cutoffWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              const lastWeekActivities = savedList.filter((item) => {
                if (!item.startTime) return false;
                return new Date(item.startTime) >= cutoffWeek;
              });
              const lwCount = lastWeekActivities.length;
              const lwDist = Math.round(lastWeekActivities.reduce((acc, item) => acc + (item.distanceKm || 0), 0) * 10) / 10;
              const lwSecs = lastWeekActivities.reduce((acc, item) => acc + (item.durationSeconds || 0), 0);
              const lastUpload = savedList.length > 0 && savedList[0].uploadedAt 
                ? new Date(savedList[0].uploadedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                : "Sem registros";

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      Treinos (Última Semana) <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono text-cyan-400">{lwCount}</span>
                      <span className="text-[10px] text-slate-500 font-mono">treinos</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-sans">últimos 7 dias</span>
                  </div>

                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      Distância (Última Semana) <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono text-emerald-400">{lwDist}</span>
                      <span className="text-[10px] text-slate-500 font-mono">km</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-sans">soma da última semana</span>
                  </div>

                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      Tempo Total (Última Semana) <Clock className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono text-amber-400">
                        {formatDuration(lwSecs)}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-sans">formato H:MM:SS</span>
                  </div>

                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      Último Upload <History className="w-3.5 h-3.5 text-brand-neon" />
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-xs font-bold font-mono text-slate-200 truncate">
                        {lastUpload}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 font-sans">data do último arquivo</span>
                  </div>
                </div>
              );
            })()}

            {/* List / Table of FIT Uploaded Activities with Filters and Scrollbar */}
            {savedList.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-black/20">
                <FileText className="w-10 h-10 text-slate-600 mb-3" />
                <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">Nenhum Arquivo .FIT no Banco de Dados</h4>
                <p className="text-xs text-slate-400 max-w-md mt-1.5 font-sans leading-relaxed">
                  Envie seu arquivo de treino Garmin (.FIT) para salvar permanentemente no banco de dados e visualizar métricas detalhadas de cadência, ritmo, altimetria e inteligência de recuperação.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <label className="px-4 py-2 bg-brand-neon hover:bg-cyan-300 text-brand-dark font-extrabold text-xs rounded-xl uppercase font-mono tracking-wider flex items-center gap-2 cursor-pointer shadow-glow-cyan transition-all">
                    <Upload className="w-4 h-4" /> Enviar Arquivo .FIT
                    <input
                      type="file"
                      accept=".fit"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && handleFileUpload) {
                          handleFileUpload(file);
                        }
                      }}
                    />
                  </label>
                  {loadDemoWorkout && (
                    <button
                      onClick={loadDemoWorkout}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-bold text-xs rounded-xl font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-brand-neon" /> Carregar Demonstração .FIT
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Filters and List Counter */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Filtro por Data:</span>
                    <button
                      onClick={() => setListFilter("last10")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                        listFilter === "last10"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Últimas 10 Atividades
                    </button>
                    <button
                      onClick={() => setListFilter("lastWeek")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                        listFilter === "lastWeek"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Última Semana (7 dias)
                    </button>
                    <button
                      onClick={() => setListFilter("lastMonth")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                        listFilter === "lastMonth"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Último Mês (30 dias)
                    </button>
                    <button
                      onClick={() => setListFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                        listFilter === "all"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Todas ({savedList.length})
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Exibindo {(() => {
                      if (listFilter === "last10") return Math.min(10, savedList.length);
                      if (listFilter === "lastWeek") {
                        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                        return savedList.filter(i => new Date(i.startTime) >= cutoff).length;
                      }
                      if (listFilter === "lastMonth") {
                        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                        return savedList.filter(i => new Date(i.startTime) >= cutoff).length;
                      }
                      return savedList.length;
                    })()} de {savedList.length} salvas
                  </span>
                </div>

                {/* Scrollable Container with Custom Scrollbar */}
                <div className="overflow-x-auto overflow-y-auto max-h-[380px] rounded-xl border border-white/5 bg-black/20 scrollbar-thin scrollbar-thumb-white/10">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-white/10 bg-slate-900/90 backdrop-blur-md text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Esporte / Título</th>
                        <th className="py-3 px-4">Arquivo .FIT</th>
                        <th className="py-3 px-4">Distância</th>
                        <th className="py-3 px-4">Duração (H:MM:SS)</th>
                        <th className="py-3 px-4">Status Banco</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {(() => {
                        let filtered = [...savedList];
                        if (listFilter === "last10") {
                          filtered = filtered.slice(0, 10);
                        } else if (listFilter === "lastWeek") {
                          const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                          filtered = filtered.filter(item => new Date(item.startTime) >= cutoff);
                        } else if (listFilter === "lastMonth") {
                          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                          filtered = filtered.filter(item => new Date(item.startTime) >= cutoff);
                        }

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-500 font-mono text-xs">
                                Nenhuma atividade encontrada para o filtro selecionado.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((item) => {
                          const isSelected = activeActivity?.id === item.id;
                          const durationFormatted = formatDuration(item.durationSeconds || 0);

                          const dateFormatted = item.startTime
                            ? new Date(item.startTime).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Data não especificada";

                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors hover:bg-white/5 cursor-pointer ${
                                isSelected ? "bg-cyan-500/10 border-l-2 border-l-brand-neon" : ""
                              }`}
                              onClick={() => selectActivity && selectActivity(item.id)}
                            >
                              <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px] whitespace-nowrap">
                                {dateFormatted}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider bg-brand-neon/10 text-brand-neon border border-brand-neon/20">
                                    {item.sport || "Corrida"}
                                  </span>
                                  <span className="font-bold text-slate-200 text-xs truncate max-w-[200px]">
                                    {item.title || "Treino .FIT"}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[150px]">
                                {item.filename || `${item.id}.fit`}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                                {item.distanceKm ? `${item.distanceKm.toFixed(2)} km` : "---"}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-amber-300 font-bold">
                                {durationFormatted}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  No Banco DB
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => selectActivity && selectActivity(item.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 border cursor-pointer ${
                                      isSelected
                                        ? "bg-brand-neon text-brand-dark border-brand-neon shadow-glow-cyan"
                                        : "bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border-white/10"
                                    }`}
                                  >
                                    <Eye className="w-3 h-3" /> {isSelected ? "Ativo" : "Analisar"}
                                  </button>

                                  <button
                                    onClick={(e) => deleteActivity && deleteActivity(item.id, e)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                                    title="Excluir do Banco de Dados"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Active Telemetry Highlight Box & Maps/Charts if an activity is selected */}
            {activeActivity && (
              <div className="mt-5 p-4 sm:p-5 bg-black/40 border border-cyan-500/20 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h5 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                      Atividade Selecionada no Banco: <span className="text-brand-neon">{activeActivity.aiAnalysis?.title || activeActivity.filename}</span>
                    </h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      ID DB: {activeActivity.id}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">{t("distance", "Distância")}</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">{activeActivity.summary?.distanceKm || 0} km</span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">{t("duration", "Duração (H:MM:SS)")}</span>
                    <span className="text-sm font-bold font-mono text-amber-400">
                      {formatDuration(activeActivity.summary?.durationSeconds || 0)}
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">{t("speed", "Velocidade Média")}</span>
                    <span className="text-sm font-bold font-mono text-cyan-400">{activeActivity.summary?.avgSpeedKmh || 0} km/h</span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">{t("heartRate", "FC Média")}</span>
                    <span className="text-sm font-bold font-mono text-red-400">{activeActivity.summary?.avgHeartRate || "---"} bpm</span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">Efeito Fisiológico</span>
                    <span className="text-xs font-bold font-mono text-brand-neon truncate block">
                      {activeActivity.aiAnalysis?.trainingEffect || "Manutenção Aeróbica"}
                    </span>
                  </div>
                </div>

                {activeActivity.aiAnalysis?.summary && (
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed pt-1">
                    <strong className="text-cyan-400 font-mono text-[10px] uppercase tracking-wider block mb-0.5">Parecer da IA sobre a Atividade:</strong>
                    {activeActivity.aiAnalysis.summary}
                  </p>
                )}

                {/* Telemetry Visualizations: Route Map & Time Series Charts directly in Histórico */}
                <div className="pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                      Mapa de Percurso GPS & Série Temporal da Atividade
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Route Map */}
                    <div className="lg:col-span-7">
                      <GpsMap
                        gpsPath={activeActivity.gpsPath || []}
                        records={activeActivity.records || []}
                        sport={activeActivity.sport || "running"}
                      />
                    </div>

                    {/* Telemetry Time-Series Chart */}
                    <div className="lg:col-span-5">
                      {activeActivity.records && activeActivity.records.length > 0 ? (
                        <TelemetryCharts records={activeActivity.records} />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full min-h-[350px] bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 text-center text-slate-400 text-xs font-mono">
                          <Activity className="w-8 h-8 text-slate-600 mb-2" />
                          <p>Sem dados de série temporal gravados para esta atividade.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      </div>
    </div>
  )}

  {/* 5. ABA BIBLIOTECA DE TREINOS (LIBRARY) */}
  {coachTab === "library" && (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in font-sans">
      
      {/* Header Panel */}
      <div className="lg:col-span-12 bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 left-0 w-36 h-36 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-cyan-500/10 text-cyan-400 mb-1">
            <Layers className="w-3.5 h-3.5" /> Material do Treinador de Corrida
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-white font-display tracking-tight uppercase">
            Biblioteca de Prescrições & Exercícios de Elite
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed mt-1">
            O guia definitivo de corrida contínua, treinos de intensidade, educativos biomecânicos, força específica, core, pliometria, mobilidade, recuperação e testes de campo.
          </p>
        </div>
        <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl shrink-0 flex items-center gap-3">
          <div className="text-center border-r border-white/5 pr-3">
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">Categorias</span>
            <span className="text-base font-extrabold font-mono text-cyan-400">10</span>
          </div>
          <div className="text-center pl-1">
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">Prescrições</span>
            <span className="text-base font-extrabold font-mono text-brand-neon">54</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="lg:col-span-12 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por objetivo, nome do exercício, intensidade ou RPE..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="w-full bg-black/45 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-sans text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
            {librarySearch && (
              <button
                onClick={() => setLibrarySearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[10px] font-mono hover:bg-white/5 px-1.5 py-0.5 rounded"
              >
                Limpar
              </button>
            )}
          </div>
          
          {/* Quick Clear Filter */}
          {(librarySearch || libraryActiveCategory !== "all") && (
            <button
              onClick={() => {
                setLibrarySearch("");
                setLibraryActiveCategory("all");
              }}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer text-center"
            >
              LIMPAR FILTROS
            </button>
          )}
        </div>

        {/* Category horizontal scroller */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/5">
          <button
            onClick={() => setLibraryActiveCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider shrink-0 transition-all border ${
              libraryActiveCategory === "all"
                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                : "bg-white/5 border-transparent text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            Ver Tudo ({LIBRARY_CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0)})
          </button>
          {LIBRARY_CATEGORIES.map((cat) => {
            const isSelected = libraryActiveCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setLibraryActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider shrink-0 transition-all border ${
                  isSelected
                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 shadow-sm"
                    : "bg-white/5 border-transparent text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {cat.title.replace(/^\d+\.\s*/, "")} ({cat.items.length})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid / Layout */}
      <div className="lg:col-span-12 space-y-8">
        {LIBRARY_CATEGORIES.filter(cat => libraryActiveCategory === "all" || libraryActiveCategory === cat.id).map((category) => {
          
          // Filter items based on search query
          const filteredItems = category.items.filter(item => {
            if (!librarySearch) return true;
            const searchLower = librarySearch.toLowerCase();
            return (
              item.name.toLowerCase().includes(searchLower) ||
              (item.objective && item.objective.toLowerCase().includes(searchLower)) ||
              (item.intensity && item.intensity.toLowerCase().includes(searchLower)) ||
              (item.rpe && item.rpe.toLowerCase().includes(searchLower)) ||
              (item.details && item.details.toLowerCase().includes(searchLower)) ||
              (item.execution && item.execution.toLowerCase().includes(searchLower)) ||
              (item.example && item.example.toLowerCase().includes(searchLower))
            );
          });

          if (filteredItems.length === 0) return null;

          return (
            <div key={category.id} className="space-y-3.5">
              {/* Category Header */}
              <div className="pb-1.5 border-b border-white/5">
                <h3 className="text-sm font-extrabold text-cyan-400 font-mono tracking-wider uppercase flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-cyan-400 rounded-sm"></span>
                  {category.title}
                </h3>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">{category.description}</p>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item, idx) => {
                  const isCopied = copiedItemName === item.name;
                  
                  // Construct printable/copyable version of prescription
                  let copyText = `--- PRESCRIÇÃO DE CORRIDA: ${item.name} ---\n`;
                  if (item.objective) copyText += `Objetivo: ${item.objective}\n`;
                  if (item.intensity) copyText += `Intensidade: ${item.intensity}\n`;
                  if (item.rpe) copyText += `Esforço Percebido: ${item.rpe}\n`;
                  if (item.conversation) copyText += `Conversação: ${item.conversation}\n`;
                  if (item.duration) copyText += `Duração/Volume: ${item.duration}\n`;
                  if (item.usage) copyText += `Aplicação/Uso: ${item.usage}\n`;
                  if (item.details) copyText += `Detalhes de Execução: ${item.details}\n`;
                  if (item.execution) copyText += `Como Fazer: ${item.execution}\n`;
                  if (item.sets) copyText += `Séries/Ajuste: ${item.sets}\n`;
                  if (item.example) copyText += `Exemplo Prático:\n   ${item.example}\n`;
                  if (item.points) {
                    copyText += `Manual de Detalhes:\n`;
                    item.points.forEach(p => { copyText += ` - ${p}\n`; });
                  }
                  if (item.fallbacks) {
                    copyText += `Diretrizes de Substituição:\n`;
                    item.fallbacks.situations.forEach(s => { copyText += ` * Se ${s.cond} -> Fazer: ${s.sol}\n`; });
                  }
                  
                  return (
                    <div 
                      key={idx}
                      className="bg-black/30 hover:bg-black/45 border border-white/5 hover:border-white/10 rounded-xl p-4 flex flex-col justify-between gap-4 transition-all hover:translate-y-[-1px]"
                    >
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-slate-200 font-display leading-tight">{item.name}</h4>
                          {item.rpe && (
                            <span className="text-[9px] font-mono font-bold bg-cyan-950/55 text-cyan-300 px-2 py-0.5 rounded border border-cyan-900/40 whitespace-nowrap">
                              {item.rpe.replace(" / 10", "")}
                            </span>
                          )}
                        </div>

                        {item.objective && (
                          <p className="text-[11px] text-slate-400 font-sans leading-relaxed line-clamp-3">
                            {item.objective}
                          </p>
                        )}

                        {item.details && (
                          <p className="text-[11px] text-slate-400 font-sans leading-relaxed line-clamp-3">
                            <strong className="text-slate-300 font-mono text-[10px] block mb-0.5">Execução Técnica:</strong>
                            {item.details}
                          </p>
                        )}

                        {item.execution && (
                          <p className="text-[11px] text-slate-400 font-sans leading-relaxed line-clamp-3">
                            <strong className="text-slate-300 font-mono text-[10px] block mb-0.5">Como Fazer:</strong>
                            {item.execution}
                          </p>
                        )}

                        {/* Quick parameters list in pill-box style */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {item.intensity && (
                            <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                              Intensidade: <strong className="text-slate-300 font-bold">{item.intensity}</strong>
                            </span>
                          )}
                          {item.duration && (
                            <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                              Duração: <strong className="text-slate-300 font-bold">{item.duration}</strong>
                            </span>
                          )}
                          {item.sets && (
                            <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                              Séries: <strong className="text-slate-300 font-bold">{item.sets}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons on card footer */}
                      <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2.5">
                        <button
                          onClick={() => handleCopyText(copyText, item.name)}
                          className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
                            isCopied
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                              : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                          title="Copiar texto da prescrição para usar"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {isCopied ? "Copiado!" : "Copiar"}
                        </button>
                        
                        <button
                          onClick={() => setSelectedLibraryItem(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 text-cyan-300 hover:text-cyan-200 text-[10px] font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-1"
                        >
                          Visualizar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAILED LIBRARY ITEM MODAL / DRAWER */}
      {selectedLibraryItem && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in font-sans">
          <div className="bg-brand-dark border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-black/40 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Manual de Prescrição</span>
                <h3 className="text-base font-bold text-white font-display mt-1 leading-tight">{selectedLibraryItem.name}</h3>
              </div>
              <button
                onClick={() => setSelectedLibraryItem(null)}
                className="text-slate-400 hover:text-white font-mono text-xs border border-white/10 rounded bg-white/5 hover:bg-white/10 px-2 py-1 transition-all cursor-pointer"
              >
                Fechar ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              
              {selectedLibraryItem.objective && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Objetivo Fisiológico</span>
                  <p className="text-slate-200 leading-relaxed font-sans font-medium">{selectedLibraryItem.objective}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5 bg-white/5 p-3.5 rounded-xl border border-white/5 font-mono text-[11px]">
                {selectedLibraryItem.intensity && (
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Intensidade</span>
                    <strong className="text-slate-300 font-bold">{selectedLibraryItem.intensity}</strong>
                  </div>
                )}
                {selectedLibraryItem.rpe && (
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Esforço Sugerido (RPE)</span>
                    <strong className="text-cyan-400 font-bold">{selectedLibraryItem.rpe}</strong>
                  </div>
                )}
                {selectedLibraryItem.conversation && (
                  <div className="col-span-2 border-t border-white/5 pt-2">
                    <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Nível de Conversação</span>
                    <span className="text-slate-300">{selectedLibraryItem.conversation}</span>
                  </div>
                )}
                {selectedLibraryItem.duration && (
                  <div className="col-span-2 border-t border-white/5 pt-2">
                    <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Duração Recomendada</span>
                    <span className="text-brand-neon font-bold">{selectedLibraryItem.duration}</span>
                  </div>
                )}
              </div>

              {selectedLibraryItem.usage && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Quando Prescrever</span>
                  <p className="text-slate-300 leading-relaxed font-sans bg-white/5 px-3 py-2 rounded-lg border border-white/5">{selectedLibraryItem.usage}</p>
                </div>
              )}

              {selectedLibraryItem.example && (
                <div className="bg-cyan-950/30 border border-cyan-500/20 p-4 rounded-xl space-y-1.5">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 font-bold block">Estrutura de Exemplo</span>
                  <p className="text-slate-200 leading-relaxed font-mono text-xs">{selectedLibraryItem.example}</p>
                </div>
              )}

              {selectedLibraryItem.details && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Execução Técnica Detalhada</span>
                  <p className="text-slate-300 leading-relaxed font-sans">{selectedLibraryItem.details}</p>
                </div>
              )}

              {selectedLibraryItem.execution && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Como Fazer / Execução</span>
                  <p className="text-slate-300 leading-relaxed font-sans">{selectedLibraryItem.execution}</p>
                </div>
              )}

              {selectedLibraryItem.sets && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Volume de Séries / Carga</span>
                  <p className="text-slate-300 leading-relaxed font-mono">{selectedLibraryItem.sets}</p>
                </div>
              )}

              {selectedLibraryItem.alternatives && (
                <div className="bg-amber-500/5 border border-amber-500/15 p-3 rounded-lg text-amber-300">
                  <strong className="text-[9px] font-mono uppercase tracking-widest text-amber-400 block mb-0.5">Substituições / Alternativas</strong>
                  <p className="font-sans leading-relaxed">{selectedLibraryItem.alternatives}</p>
                </div>
              )}

              {selectedLibraryItem.variations && (
                <div className="bg-white/5 border border-white/5 p-3 rounded-lg text-slate-300">
                  <strong className="text-[9px] font-mono uppercase tracking-widest text-slate-400 block mb-1">Variações Sugeridas</strong>
                  <p className="font-sans leading-relaxed">{selectedLibraryItem.variations}</p>
                </div>
              )}

              {selectedLibraryItem.caution && (
                <div className="bg-red-500/5 border border-red-500/15 p-3 rounded-lg text-red-300">
                  <strong className="text-[9px] font-mono uppercase tracking-widest text-red-400 block mb-1">⚠️ Precauções e Cuidados</strong>
                  <p className="font-sans leading-relaxed">{selectedLibraryItem.caution}</p>
                </div>
              )}

              {selectedLibraryItem.tips && (
                <div className="bg-cyan-500/5 border border-cyan-500/15 p-3 rounded-lg text-cyan-300">
                  <strong className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 block mb-1">💡 Dicas do Treinador</strong>
                  <p className="font-sans leading-relaxed">{selectedLibraryItem.tips}</p>
                </div>
              )}

              {selectedLibraryItem.principles && (
                <div className="bg-purple-500/5 border border-purple-500/15 p-3 rounded-lg text-purple-300">
                  <strong className="text-[9px] font-mono uppercase tracking-widest text-purple-400 block mb-1">⚙️ Princípios de Carga</strong>
                  <p className="font-sans leading-relaxed">{selectedLibraryItem.principles}</p>
                </div>
              )}

              {selectedLibraryItem.metrics && (
                <div className="bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-lg text-emerald-300">
                  <strong className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 block mb-1">📈 Métricas e Indicadores de Sucesso</strong>
                  <p className="font-sans leading-relaxed">{selectedLibraryItem.metrics}</p>
                </div>
              )}

              {selectedLibraryItem.points && (
                <div className="space-y-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block">Os 15 Pontos de Prescrição Perfeita</span>
                  <div className="bg-black/45 border border-white/5 rounded-xl p-4 space-y-1.5 font-sans leading-relaxed text-slate-300 max-h-[250px] overflow-y-auto">
                    {selectedLibraryItem.points.map((p, pIdx) => (
                      <p key={pIdx} className="text-xs pl-2 border-l border-cyan-500/30">{p}</p>
                    ))}
                  </div>
                </div>
              )}

              {selectedLibraryItem.fallbacks && (
                <div className="space-y-2.5">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block">{selectedLibraryItem.fallbacks.title}</span>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedLibraryItem.fallbacks.situations.map((s, sIdx) => (
                      <div key={sIdx} className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-amber-400 font-mono block">⚠️ Se: {s.cond}</span>
                        <span className="text-xs text-slate-300 block font-sans">✔️ Fazer: {s.sol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-end">
              <button
                onClick={() => setSelectedLibraryItem(null)}
                className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-brand-dark font-extrabold text-xs py-2 px-6 rounded-xl uppercase transition-all cursor-pointer text-center"
              >
                Fechar Manual
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )}

  {/* WORKOUT prescription drawer / modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-black/40 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Prescrição Detalhada</span>
                  {getIntentBadge(selectedWorkout.intent)}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white font-display leading-tight">{selectedWorkout.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedWorkout(null)}
                className="text-slate-400 hover:text-white font-mono text-xs border border-white/10 rounded bg-white/5 hover:bg-white/10 px-2 py-1 transition-all cursor-pointer"
              >
                Fechar ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto font-sans">
              
              {simulationSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex gap-2.5 items-start text-xs text-emerald-300 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="font-semibold">{simulationSuccess}</p>
                </div>
              )}

              {/* Adaptability Banner */}
              {readiness && (readiness.status === "REDUCE" || readiness.status === "RECOVER") && !selectedWorkout.isAdapted && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                      <Zap className="w-4 h-4 fill-current text-amber-400 shrink-0" />
                      <span>Sinal de Fadiga Coletado</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                      Seu índice de prontidão física está em <strong className="text-amber-400 font-mono">{readiness.score}/100</strong> ({readiness.status === "RECOVER" ? "Recuperar Necessário" : "Reduzir Volume"}). 
                      Deseja que o treinador faça o ajuste adaptativo fisiológico deste treino automaticamente?
                    </p>
                  </div>
                  <button
                    onClick={() => handleAdaptiveAdjust(selectedWorkout)}
                    className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] uppercase font-mono px-3 py-2 rounded-xl transition-all cursor-pointer shadow-glow-amber text-center"
                  >
                    Ajustar Treino
                  </button>
                </div>
              )}

              {selectedWorkout.isAdapted && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 animate-fade-in text-xs font-sans text-emerald-300">
                  <Award className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-emerald-400">Ajuste Fisiológico Aplicado!</span>
                    <span>O volume e a intensidade de passos foram ajustados para corresponder ao seu estado de fadiga de {readiness?.score}/100.</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Instrução Geral</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedWorkout.description}</p>
                </div>
                {selectedWorkout.objective && (
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Objetivo do Treino</span>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedWorkout.objective}</p>
                  </div>
                )}
              </div>

              {selectedWorkout.observations && selectedWorkout.observations.length > 0 && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1.5">Dicas de Execução</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWorkout.observations.map((obs: string, idx: number) => (
                      <span key={idx} className="text-[10px] font-sans text-slate-300 bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full">
                        ✓ {obs}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedWorkout.ifTired && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-xs text-slate-300">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500/70 block mb-1 font-bold">Caso esteja muito cansado...</span>
                  <p className="font-sans leading-relaxed text-[11px] text-slate-300">
                    {selectedWorkout.ifTired}
                  </p>
                </div>
              )}

              {/* Steps */}
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-3">Passos Estruturados (Steps)</span>
                <div className="space-y-2">
                  {selectedWorkout.steps.map((step, sIdx) => {
                    const stepMins = Math.floor(step.durationSeconds / 60);
                    const stepSecs = step.durationSeconds % 60;
                    const instructionText = step.instruction || step.description;
                    const hasComplexInterval = step.sets || step.repetitions || step.recoverySeconds;
                    
                    return (
                      <div key={sIdx} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-1.5 font-bold text-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                            <span>{step.name}</span>
                            {step.stepType && (
                              <span className="text-[9px] font-normal uppercase px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                                {step.stepType === "warmup" ? "Aquecimento" :
                                 step.stepType === "main_set" ? "Principal" :
                                 step.stepType === "cooldown" ? "Desaquecimento" : step.stepType}
                              </span>
                            )}
                          </div>
                          
                          {instructionText && (
                            <p className="text-[10px] text-slate-400 font-sans leading-relaxed">{instructionText}</p>
                          )}

                          {hasComplexInterval && (
                            <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 mt-1 font-mono">
                              {step.sets && (
                                <span className="bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/30">
                                  Séries: <strong className="text-indigo-300">{step.sets}</strong>
                                </span>
                              )}
                              {step.repetitions && (
                                <span className="bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/30">
                                  Repetições: <strong className="text-indigo-300">{step.repetitions}</strong>
                                </span>
                              )}
                              {step.recoverySeconds && (
                                <span className="bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-900/30">
                                  Recuperação: <strong className="text-teal-300">{step.recoverySeconds}s</strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                          <span className="block font-bold text-brand-neon">{stepMins > 0 ? `${stepMins}m` : ""}{stepSecs > 0 ? `${stepSecs}s` : ""}</span>
                          <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-slate-300 uppercase font-bold tracking-wider">{step.intensity}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-brand-neon/10 border border-brand-neon/20 px-3 py-2.5 rounded-xl text-[10px] text-brand-neon font-mono">
                <Dumbbell className="w-4 h-4 shrink-0" />
                <span>Mantenha as intensidades prescritas (zonas de esforço). Executar treinos regenerativos de forma muito intensa atrasa o progresso.</span>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => handleExportToGarmin(selectedWorkout)}
                  className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-slate-100 border border-white/10 font-bold text-xs py-2 px-3 rounded-xl uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileDown className="w-4 h-4 text-brand-neon" />
                  Garmin JSON
                </button>
                
                {selectedWorkout.intent !== "rest" && (
                  <>
                    <button 
                      onClick={() => handleSimulateWorkout(selectedWorkout)}
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs py-2 px-3.5 rounded-xl uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-glow-cyan"
                    >
                      <Award className="w-4 h-4 text-emerald-100" />
                      Simular .FIT
                    </button>
                    <button 
                      onClick={() => {
                        handleCompleteWorkoutWithBlocks(selectedWorkout);
                        setSelectedWorkout(null);
                      }}
                      className="w-full sm:w-auto bg-brand-neon hover:bg-cyan-300 text-brand-dark font-black text-xs py-2 px-3.5 rounded-xl uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-glow-cyan"
                    >
                      <CheckCircle2 className="w-4 h-4 fill-current" />
                      Concluir Treino
                    </button>
                  </>
                )}
              </div>
              
              <button 
                onClick={() => setSelectedWorkout(null)}
                className="w-full sm:w-auto bg-brand-neon hover:bg-cyan-300 text-brand-dark font-extrabold text-xs py-2 px-4 rounded-xl uppercase transition-all cursor-pointer text-center"
              >
                Confirmar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Educational Modal for HRV / VFC Physiology */}
      {showHrvInfoModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-8 text-slate-200 space-y-5">
            <button
              type="button"
              onClick={() => setShowHrvInfoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
                <Heart className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase font-display tracking-wider flex items-center gap-2">
                  Ciência da Variabilidade da Frequência Cardíaca (VFC / HRV)
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Por que o Aetheris avalia a linha de base individual (21 dias) e não números absolutos fixos.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-sans text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* O que é a VFC? */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-2">
                <h4 className="font-bold text-cyan-300 flex items-center gap-2 text-sm font-mono uppercase">
                  <Activity className="w-4 h-4 text-cyan-400" /> 1. O que é a VFC?
                </h4>
                <p>
                  Um coração saudável <strong>não funciona como um metrônomo</strong>. Se você está a 60 bpm, os batimentos não ocorrem exatamente a cada 1,00s. Na realidade, os intervalos variam milissegundo a milissegundo (ex: 920 ms, 1010 ms, 955 ms, 980 ms).
                </p>
                <p className="text-slate-400 italic">
                  Quanto maior a variação natural (dentro do seu padrão), maior tende a ser a capacidade do seu sistema nervoso autônomo de se adaptar ao estresse.
                </p>
              </div>

              {/* Quem controla isso? */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-2">
                <h4 className="font-bold text-amber-300 flex items-center gap-2 text-sm font-mono uppercase">
                  <Brain className="w-4 h-4 text-amber-400" /> 2. O Pedais Autônomos: Simpático vs. Parassimpático
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <span className="font-bold text-rose-300 block font-mono">Simpático (Acelerador)</span>
                    <span className="text-[11px] text-slate-300 block mt-1">
                      Eleva FC, pressão e adrenalina. Dominante em treinos intensos, estresse profissional e ansiedade. Trava os batimentos (VFC cai).
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="font-bold text-emerald-300 block font-mono">Parassimpático (Freio)</span>
                    <span className="text-[11px] text-slate-300 block mt-1">
                      Reduz FC e cortisol. Dominante no sono profundo e na recuperação tecidual. Faz os batimentos variarem (VFC sobe).
                    </span>
                  </div>
                </div>
              </div>

              {/* Por que comparar atletas não faz sentido? */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-2">
                <h4 className="font-bold text-indigo-300 flex items-center gap-2 text-sm font-mono uppercase">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> 3. Linha de Base Individual (21 dias)
                </h4>
                <p>
                  A VFC é extremamente individual. Um atleta saudável pode ter baseline constante de <strong>35 ms</strong> (excelente estado para ele), enquanto outro opera em <strong>78 ms</strong>.
                </p>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 font-mono text-[11px] space-y-1">
                  <p className="text-amber-300">
                    • Atleta A (Baseline 35ms) registra 34ms → <strong>Ótimo (desvio desprezível)</strong>
                  </p>
                  <p className="text-rose-400">
                    • Atleta B (Baseline 78ms) registra 56ms → <strong>Queda severa (-28%)</strong>, apesar de estar numericamente &gt; 50ms!
                  </p>
                </div>
              </div>

              {/* A VFC no Quebra-Cabeça */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-2">
                <h4 className="font-bold text-emerald-300 flex items-center gap-2 text-sm font-mono uppercase">
                  <Zap className="w-4 h-4 text-emerald-400" /> 4. A VFC é uma Peça do Quebra-Cabeça
                </h4>
                <p>
                  No Aetheris, a VFC <strong>nunca toma decisões isoladamente</strong>. Ela é cruzada com Sono, Body Battery, Dor Muscular, Sensação Subjetiva do Atleta e ACWR (carga aguda). Se a VFC cai mas o sono e sensação são ótimos, mantém-se o treino com cautela. Se a VFC cai junto com sono ruim e dor, reduz-se o volume/intensidade.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHrvInfoModal(false)}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Readiness Audit & Science Explanation Modal */}
      {showReadinessAuditModal && readiness && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-brand-dark border border-brand-neon/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto relative font-sans">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-brand-neon/10 border border-brand-neon/30 text-brand-neon text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold">
                    Aetheris Engine v2.0
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    Modelo Fisiológico Auditável
                  </span>
                </div>
                <h3 className="text-lg font-black text-white font-display mt-1 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-brand-neon" />
                  Cálculos Auditáveis do Índice de Preparação ({readiness.score}/100)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Transparência matemática dos pilares fisiológicos, pesagem científica e capacidade por modalidade.
                </p>
              </div>
              <button
                onClick={() => setShowReadinessAuditModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-bold font-mono"
              >
                ✕
              </button>
            </div>

            {/* Summary Formula & Confidence Score */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 bg-brand-neon/10 border border-brand-neon/20 p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-brand-neon font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Equação Final Integrada
                </h4>
                <p className="text-xs text-slate-200 font-mono leading-relaxed bg-black/40 p-3 rounded-lg border border-white/5">
                  {readiness.formulaSummary}
                </p>
                {readiness.temporalTrendMessage && (
                  <p className="text-[11px] text-amber-300 italic font-mono">
                    • {readiness.temporalTrendMessage}
                  </p>
                )}
              </div>

              {/* Score de Confiança da Decisão */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                      Confiança da Decisão
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-2xl font-black font-mono text-emerald-300 block mt-1">
                    {readiness.confidenceScore || 100}%
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {readiness.dataInputs?.filter(d => d.present).length} de {readiness.dataInputs?.length} fontes ativas
                  </span>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-2 gap-1 text-[9px] font-mono text-slate-300">
                  {readiness.dataInputs?.map((input, idx) => (
                    <div key={idx} className="flex items-center gap-1 truncate" title={`${input.name}: ${input.source}`}>
                      <span className={input.present ? "text-emerald-400" : "text-slate-600"}>
                        {input.present ? "✓" : "○"}
                      </span>
                      <span className={input.present ? "text-slate-200 truncate" : "text-slate-500 line-through truncate"}>
                        {input.name.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ACWR & Training Load Calculation Audit Card */}
            {trainingLoad && (
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-cyan-400" /> Cálculo da Razão de Carga ACWR ({trainingLoad.acuteChronicRatio})
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                    ATL: {trainingLoad.atl} Training Load / CTL: {trainingLoad.ctl} Training Load = {trainingLoad.acuteChronicRatio}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono leading-relaxed bg-black/40 p-2.5 rounded-lg border border-white/5">
                  <strong>Fórmula:</strong> ACWR = Carga Aguda (ATL: Fadiga dos últimos 7 dias) ÷ Carga Crônica (CTL: Aptidão base de 28 dias).
                  <br />
                  <span className="text-slate-400 text-[10px]">
                    • <strong>CTL (Crônica):</strong> {trainingLoad.ctl} Training Load (Base de volume de 28 dias)
                    <br />
                    • <strong>ATL (Aguda):</strong> {trainingLoad.atl} Training Load (Dissipação fisiológica via EWMA com α = 0.20 para {dailyMetrics.daysWithoutTraining || 0} dias de descanso: (1 - 0.20)<sup>{dailyMetrics.daysWithoutTraining || 0}</sup>)
                    <br />
                    • <strong>Razão Final:</strong> {trainingLoad.atl} / {trainingLoad.ctl} = <strong>{trainingLoad.acuteChronicRatio}</strong> ({trainingLoad.acuteChronicRatio < 0.8 ? 'Faixa de Recuperação / Destreino Relativo' : trainingLoad.acuteChronicRatio <= 1.3 ? 'Faixa Ótima de Carga' : 'Carga Elevada / Sobrecarga'})
                  </span>
                </p>
              </div>
            )}

            {/* Daily Physiological Objectives */}
            {readiness.dailyPhysiologicalObjectives && readiness.dailyPhysiologicalObjectives.length > 0 && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-cyan-400" /> Objetivo Fisiológico do Treino de Hoje
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
                  {readiness.dailyPhysiologicalObjectives.map((obj, idx) => (
                    <div key={idx} className="bg-black/40 border border-white/5 p-2.5 rounded-lg text-slate-200 text-[11px] flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modulators Step Breakdown */}
            {readiness.modulatorsBreakdown && readiness.modulatorsBreakdown.length > 0 && (
              <div className="bg-black/30 border border-white/10 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-amber-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-400" /> Modulators Subjetivos & Ajustes Proporcionais
                </h4>
                <div className="space-y-1.5">
                  {readiness.modulatorsBreakdown.map((mod, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${mod.type === 'bonus' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        <span className="text-white font-bold">{mod.label}</span>
                        <span className="text-[10px] text-slate-400">({mod.reason})</span>
                      </div>
                      <span className={`font-black px-2 py-0.5 rounded ${mod.points > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                        {mod.points > 0 ? `+${mod.points}` : mod.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Breakdown Table/Cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-cyan-400" /> Breakdown por Pilar Fisiológico & Pesos Base (100%)
              </h4>

              <div className="space-y-2">
                {readiness.breakdown && readiness.breakdown.map((pillar, idx) => (
                  <div key={idx} className="bg-black/30 border border-white/5 p-3.5 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-neon"></span>
                        {pillar.name}
                        {pillar.weightPercent > 0 && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            (Peso: {pillar.weightPercent}%)
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-brand-neon bg-brand-neon/10 px-2 py-0.5 rounded border border-brand-neon/20">
                        {pillar.pointsEarned > 0 ? `+${pillar.pointsEarned}` : pillar.pointsEarned} {pillar.maxPoints > 0 ? `/ ${pillar.maxPoints} pts` : "pts (Ajuste)"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {pillar.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Capacidade de Treinamento por Tipo de Sessão */}
            {readiness.capacities && (
              <div className="bg-black/40 border border-white/10 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" /> Distinção entre Índice de Preparação e Capacidade de Treinar
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                    Direcionamento Prático
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  A <strong>Preparação de hoje em {readiness.score}/100</strong> indica a capacidade para absorver estímulos intensos, <strong>não uma proibição de treino</strong>. A recuperação ativa e a mobilidade continuam preservadas para acelerar a restauração homeostática. Abaixo está sua capacidade por modalidade:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-xs font-mono font-bold text-emerald-300">
                      <span>Mobilidade / Core</span>
                      <span>100% Capacidade</span>
                    </div>
                    <p className="text-[10px] text-slate-300">{readiness.capacities.mobilityCore?.recommendation}</p>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-xs font-mono font-bold text-emerald-300">
                      <span>Rodagem Leve (Z2)</span>
                      <span>{readiness.capacities.lightZone2?.percentage}% Capacidade</span>
                    </div>
                    <p className="text-[10px] text-slate-300">{readiness.capacities.lightZone2?.recommendation}</p>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-1 ${readiness.capacities.tempoThreshold?.percentage >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                    <div className={`flex justify-between items-center text-xs font-mono font-bold ${readiness.capacities.tempoThreshold?.percentage >= 50 ? "text-amber-300" : "text-red-400"}`}>
                      <span>Tempo Run / Limiar</span>
                      <span>{readiness.capacities.tempoThreshold?.percentage}% Capacidade</span>
                    </div>
                    <p className="text-[10px] text-slate-300">{readiness.capacities.tempoThreshold?.recommendation}</p>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-1 ${readiness.capacities.intervalsVo2max?.percentage >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                    <div className={`flex justify-between items-center text-xs font-mono font-bold ${readiness.capacities.intervalsVo2max?.percentage >= 50 ? "text-amber-300" : "text-red-400"}`}>
                      <span>Intervalados (Z5)</span>
                      <span>{readiness.capacities.intervalsVo2max?.percentage}% Capacidade</span>
                    </div>
                    <p className="text-[10px] text-slate-300">{readiness.capacities.intervalsVo2max?.recommendation}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Racional Científico das Mudanças */}
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <h4 className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Brain className="w-4 h-4" /> Fundamentação Baseada em Evidências
              </h4>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                <li><strong>Sono Total (40% Peso Base - 20% Qtd + 20% Qualidade):</strong> Pilar central da reparação tecidual e restauração imunológica.</li>
                <li><strong>Percepção Subjetiva (20% Peso Base):</strong> Valoriza a percepção direta do atleta sobre o seu estado interno.</li>
                <li><strong>VFC (15% Peso Base):</strong> Avalia a modulação parassimpática comparada à linha de base individual de 21 dias.</li>
                <li><strong>Body Battery (15% Peso Base):</strong> Calibrado em 15% para eliminar a redundância de dados com VFC, Sono e Estresse.</li>
                <li><strong>Dor Muscular (10% Peso Base):</strong> Mede o estresse mecânico e a integridade tecidual.</li>
                <li><strong>Teto de Penalização Protegido (-25 pts):</strong> Evita superpenalização quando múltiplos estressores coincidem.</li>
              </ul>
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReadinessAuditModal(false)}
                className="px-5 py-2.5 rounded-xl bg-brand-neon hover:bg-cyan-300 text-brand-dark font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-glow-cyan"
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Centralized confirmation modal for bypassing iframe sandbox window.confirm blocks */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-brand-dark border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed mb-6">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-mono text-[11px] uppercase transition-all cursor-pointer border border-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-mono font-bold text-[11px] uppercase transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
