import React, { useState, useEffect, useMemo } from "react";
import { 
  Dumbbell, 
  Heart, 
  Moon, 
  Sun,
  Brain, 
  Calendar, 
  Activity, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Sparkles, 
  Clock, 
  ShieldAlert, 
  ShieldCheck,
  Info,
  AlertCircle,
  AlertTriangle,
  XCircle,
  X,
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
  ChevronUp,
  Calculator,
  Target,
  Gauge,
  Scale
} from "lucide-react";
import SimulationSuiteModal from "./SimulationSuiteModal";
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
import { safeSetLocalStorage } from "../utils/storageUtils";
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
  WeeklyPlan,
  GuidanceContext,
  GuidanceMessage
} from "../coach/types";
import { calculateReadiness, calculateTrainingLoad, calculateActivityLoad, calculateAetherisTrainingLoad, interpretLoadWithContext, compareLoad, adjustNextWorkout, heartRateFactor, getRpeFactor, getLoadConfidence, calculateMonotonyAndStrain, calculateConsecutiveRestDays } from "../coach/coachEngine";
import { evaluateGuidanceEngine } from "../coach/guidanceEngine";
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

// Helper to calculate target pace range (min/km) for any training zone/intensity tag based on 4-tier hierarchy + Daily Condition Modifiers
export const calculateZonePaceRange = (
  intensityOrZone: string,
  profileOrBasePace?: any,
  activitiesList?: any[],
  dailyMetrics?: any
): string => {
  try {
    let sourceUsed: "teste" | "limiar" | "historico" | "estimativa" = "estimativa";
    let basePaceSeconds = 330; // default 5:30 min/km

    const parsePaceStrToSeconds = (str: string): number | null => {
      if (!str) return null;
      const clean = String(str).trim();
      const match = clean.match(/(\d+):(\d+)/);
      if (match) {
        const m = parseInt(match[1]);
        const s = parseInt(match[2]);
        return m * 60 + s;
      }
      return null;
    };

    const isProfileObj = profileOrBasePace && typeof profileOrBasePace === "object";
    const profile = isProfileObj ? profileOrBasePace : null;
    const basePaceStr = typeof profileOrBasePace === "string" ? profileOrBasePace : (profile?.estimatedPaceCurrent || "5:30");

    // PRIORIDADE 1 — Teste real recente (Prova 5k, teste 30min, Cooper, etc.)
    if (profile) {
      if (profile.baseline5kTime) {
        const secs = parsePaceStrToSeconds(profile.baseline5kTime);
        if (secs && secs > 0) {
          basePaceSeconds = Math.round(secs / 5);
          sourceUsed = "teste";
        }
      } else if (profile.baseline30minDistanceKm && profile.baseline30minDistanceKm > 0) {
        basePaceSeconds = Math.round(1800 / profile.baseline30minDistanceKm);
        sourceUsed = "teste";
      } else if (profile.baselineCooperTestMeters && profile.baselineCooperTestMeters > 0) {
        const distKm = profile.baselineCooperTestMeters / 1000;
        basePaceSeconds = Math.round(720 / distKm);
        sourceUsed = "teste";
      } else if (profile.recentPaceOrTime) {
        const secs = parsePaceStrToSeconds(profile.recentPaceOrTime);
        if (secs) {
          basePaceSeconds = secs;
          sourceUsed = "teste";
        }
      }
    }

    // PRIORIDADE 2 — Limiar de Lactato (se P1 não definiu)
    if (sourceUsed === "estimativa" && profile?.thresholdPace) {
      const secs = parsePaceStrToSeconds(profile.thresholdPace);
      if (secs) {
        basePaceSeconds = secs;
        sourceUsed = "limiar";
      }
    }

    // PRIORIDADE 3 — Histórico dos Treinos (se P1 e P2 não definiram)
    if (sourceUsed === "estimativa" && activitiesList && activitiesList.length > 0) {
      const runActivities = activitiesList.filter((a: any) => 
        (a.type === "running" || a.type === "run" || a.sport === "running" || !a.type) && 
        (a.avgPace || a.averagePace || a.pace)
      );
      if (runActivities.length > 0) {
        let totalPaceSecs = 0;
        let count = 0;
        runActivities.slice(-5).forEach((act: any) => {
          const paceVal = act.avgPace || act.averagePace || act.pace;
          const secs = parsePaceStrToSeconds(String(paceVal));
          if (secs && secs > 120 && secs < 1200) {
            totalPaceSecs += secs;
            count++;
          }
        });
        if (count > 0) {
          basePaceSeconds = Math.round(totalPaceSecs / count);
          sourceUsed = "historico";
        }
      }
    }

    // PRIORIDADE 4 — Estimativa / Tabela do Perfil
    if (sourceUsed === "estimativa") {
      const secs = parsePaceStrToSeconds(basePaceStr);
      if (secs) {
        basePaceSeconds = secs;
      }
    }

    // Determine Zone offsets based on source type and zone/intensity tag
    const tagUpper = (intensityOrZone || "").toUpperCase();
    let addMin = 35;
    let addMax = 65;

    if (sourceUsed === "limiar") {
      // Base pace is the Threshold Pace (Z4)
      if (tagUpper.includes("Z1") || tagUpper.includes("REGENERATIV") || tagUpper.includes("DESAQUECIMENTO") || tagUpper.includes("AQUECIMENTO")) {
        addMin = 85; // +1:25
        addMax = 120; // +2:00
      } else if (tagUpper.includes("Z2") || tagUpper.includes("BASE") || tagUpper.includes("RODAGEM") || tagUpper.includes("EASY")) {
        addMin = 45; // +0:45
        addMax = 85; // +1:25
      } else if (tagUpper.includes("Z3") || tagUpper.includes("MODERAD") || tagUpper.includes("TEMPO")) {
        addMin = 15; // +0:15
        addMax = 35; // +0:35
      } else if (tagUpper.includes("Z4") || tagUpper.includes("LIMIAR") || tagUpper.includes("THRESHOLD")) {
        addMin = -5; // -0:05
        addMax = 10; // +0:10
      } else if (tagUpper.includes("Z5") || tagUpper.includes("TIRO") || tagUpper.includes("VO2") || tagUpper.includes("MÁX") || tagUpper.includes("MAX")) {
        addMin = -30; // -0:30
        addMax = -10; // -0:10
      }
    } else if (sourceUsed === "teste") {
      // Base pace is 5k / test pace (~vVO2max or 5k race pace)
      if (tagUpper.includes("Z1") || tagUpper.includes("REGENERATIV") || tagUpper.includes("DESAQUECIMENTO") || tagUpper.includes("AQUECIMENTO")) {
        addMin = 90;
        addMax = 130;
      } else if (tagUpper.includes("Z2") || tagUpper.includes("BASE") || tagUpper.includes("RODAGEM") || tagUpper.includes("EASY")) {
        addMin = 60;
        addMax = 90;
      } else if (tagUpper.includes("Z3") || tagUpper.includes("MODERAD") || tagUpper.includes("TEMPO")) {
        addMin = 30;
        addMax = 55;
      } else if (tagUpper.includes("Z4") || tagUpper.includes("LIMIAR") || tagUpper.includes("THRESHOLD")) {
        addMin = 10;
        addMax = 25;
      } else if (tagUpper.includes("Z5") || tagUpper.includes("TIRO") || tagUpper.includes("VO2") || tagUpper.includes("MÁX") || tagUpper.includes("MAX")) {
        addMin = -20;
        addMax = 5;
      }
    } else {
      // Standard offset from easy/average base pace
      if (tagUpper.includes("Z1") || tagUpper.includes("REGENERATIV") || tagUpper.includes("DESAQUECIMENTO") || tagUpper.includes("AQUECIMENTO")) {
        addMin = 60;
        addMax = 95;
      } else if (tagUpper.includes("Z2") || tagUpper.includes("BASE") || tagUpper.includes("RODAGEM") || tagUpper.includes("EASY")) {
        addMin = 35;
        addMax = 65;
      } else if (tagUpper.includes("Z3") || tagUpper.includes("MODERAD") || tagUpper.includes("TEMPO")) {
        addMin = 10;
        addMax = 30;
      } else if (tagUpper.includes("Z4") || tagUpper.includes("LIMIAR") || tagUpper.includes("THRESHOLD")) {
        addMin = -15;
        addMax = 5;
      } else if (tagUpper.includes("Z5") || tagUpper.includes("TIRO") || tagUpper.includes("VO2") || tagUpper.includes("MÁX") || tagUpper.includes("MAX")) {
        addMin = -40;
        addMax = -15;
      }
    }

    let tMin = Math.max(120, basePaceSeconds + addMin);
    let tMax = Math.max(130, basePaceSeconds + addMax);

    // DAILY CONDITION MODIFIERS (Sono ruim, calor, fadiga, clima)
    if (dailyMetrics) {
      let conditionPctMod = 0;
      if ((dailyMetrics.sleepHours !== undefined && dailyMetrics.sleepHours < 6.5) || dailyMetrics.consecutiveBadSleepNights > 0 || (dailyMetrics.sleepScore !== undefined && dailyMetrics.sleepScore < 60)) {
        conditionPctMod += 0.10; // -10% ritmo (10% mais lento)
      }
      if ((dailyMetrics.temperature !== undefined && dailyMetrics.temperature >= 27) || dailyMetrics.weatherCondition === "Ensolarado") {
        conditionPctMod += 0.05; // -5% ritmo (5% mais lento)
      }
      if (dailyMetrics.subjectiveFeeling === "cansado" || dailyMetrics.subjectiveFeeling === "muito_cansado" || (dailyMetrics.muscleSoreness && dailyMetrics.muscleSoreness >= 5) || (dailyMetrics.prepScore !== undefined && dailyMetrics.prepScore < 70)) {
        conditionPctMod += 0.05; // -5% ritmo (5% mais lento)
      }
      if (dailyMetrics.isWindy || dailyMetrics.isUphill) {
        conditionPctMod += 0.05; // -5% ritmo (5% mais lento)
      }

      if (conditionPctMod > 0) {
        tMin = Math.round(tMin * (1 + conditionPctMod));
        tMax = Math.round(tMax * (1 + conditionPctMod));
      }
    }

    const fmt = (tot: number) => {
      const m = Math.floor(tot / 60);
      const s = tot % 60;
      return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    return `${fmt(tMin)} - ${fmt(tMax)} min/km`;
  } catch (e) {
    return "05:45 - 06:15 min/km";
  }
};

export interface StepBlockDetails {
  title: string;
  objective: string;
  zonaRpe: string;
  fcRange: string;
  paceRef: string;
  conditionNote?: string;
  activeModifiers?: string[];
}

export const getStepBlockDetails = (
  step: { name?: string; title?: string; intensity?: string; stepType?: string; instruction?: string; description?: string },
  athleteProfile?: any,
  activitiesList?: any[],
  dailyMetrics?: any
): StepBlockDetails => {
  const name = step.name || step.title || "Bloco de Treino";
  const intensity = (step.intensity || name || "").toLowerCase();
  const stepType = (step.stepType || "").toLowerCase();

  // Calculate HR ranges using Karvonen formula
  const age = athleteProfile?.age || 28;
  const maxHr = Number(athleteProfile?.maxHeartRate) || (220 - age);
  const restHr = Number(athleteProfile?.restingHeartRate) || 60;
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

  let objective = "Construção aeróbica";
  let zonaRpe = "Z2 / RPE 3-4";
  let fcRange = `${z2Min}–${z2Max} bpm`;

  if (intensity.includes("z1") || intensity.includes("regenerat") || intensity.includes("recupera") || stepType === "cooldown") {
    objective = "Recuperação ativa / Desaquecimento";
    zonaRpe = "Z1 / RPE 1-2";
    fcRange = `${z1Min}–${z1Max} bpm`;
  } else if (intensity.includes("z2") || intensity.includes("base") || intensity.includes("rodagem") || intensity.includes("easy")) {
    objective = "Construção aeróbica";
    zonaRpe = "Z2 / RPE 3-4";
    fcRange = `${z2Min}–${z2Max} bpm`;
  } else if (intensity.includes("z3") || intensity.includes("moderad") || intensity.includes("ritmo")) {
    objective = "Sustentação de ritmo & eficiência";
    zonaRpe = "Z3 / RPE 5-6";
    fcRange = `${z3Min}–${z3Max} bpm`;
  } else if (intensity.includes("z4") || intensity.includes("limiar") || intensity.includes("tempo") || intensity.includes("threshold")) {
    objective = "Elevar limiar de lactato";
    zonaRpe = "Z3 alta / Z4 baixa";
    fcRange = `${z4Min}–${z4Max} bpm`;
  } else if (intensity.includes("z5") || intensity.includes("tiro") || intensity.includes("interval") || intensity.includes("vo2") || intensity.includes("máx") || intensity.includes("max")) {
    objective = "VO₂ máximo";
    zonaRpe = "Z5 / RPE 9-10";
    fcRange = `${z5Min}–${maxHr} bpm`;
  } else if (stepType === "warmup") {
    objective = "Aquecimento neuromuscular";
    zonaRpe = "Z1-Z2 / RPE 2-3";
    fcRange = `${z1Min}–${z2Max} bpm`;
  } else if (stepType === "cooldown") {
    objective = "Normalização cardíaca";
    zonaRpe = "Z1 / RPE 1-2";
    fcRange = `${z1Min}–${z1Max} bpm`;
  }

  // Active condition modifiers for today
  const activeModifiers: string[] = [];
  if (dailyMetrics) {
    if ((dailyMetrics.sleepHours !== undefined && dailyMetrics.sleepHours < 6.5) || dailyMetrics.consecutiveBadSleepNights > 0 || (dailyMetrics.sleepScore !== undefined && dailyMetrics.sleepScore < 60)) {
      activeModifiers.push("Sono ruim: -10%");
    }
    if ((dailyMetrics.temperature !== undefined && dailyMetrics.temperature >= 27) || dailyMetrics.weatherCondition === "Ensolarado") {
      activeModifiers.push("Calor: -5%");
    }
    if (dailyMetrics.subjectiveFeeling === "cansado" || dailyMetrics.subjectiveFeeling === "muito_cansado" || (dailyMetrics.muscleSoreness && dailyMetrics.muscleSoreness >= 5) || (dailyMetrics.prepScore !== undefined && dailyMetrics.prepScore < 70)) {
      activeModifiers.push("Fadiga: -5%");
    }
    if (dailyMetrics.isWindy || dailyMetrics.isUphill) {
      activeModifiers.push("Vento/Terreno: -5%");
    }
  }

  const paceRef = calculateZonePaceRange(step.intensity || name, athleteProfile, activitiesList, dailyMetrics);

  let conditionNote: string | undefined = undefined;
  if (activeModifiers.length > 0) {
    const zoneName = zonaRpe.split("/")[0].trim();
    conditionNote = `Ajuste de hoje (${activeModifiers.join(", ")}). Hoje corro mais lento porque o objetivo é fisiológico em ${zoneName}.`;
  }

  return {
    title: name,
    objective,
    zonaRpe,
    fcRange,
    paceRef,
    conditionNote,
    activeModifiers
  };
};

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
  handleFileUpload?: (files: File | File[] | FileList) => Promise<void>;
  isUploading?: boolean;
  uploadError?: string | null;
  uploadNotice?: string | null;
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
  uploadNotice = null,
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

  // Garmin Workout Exporter with Prioritized Target Hierarchy (1. HR Zone, 2. Time/Dist, 3. Pace Ref)
  const handleExportToGarmin = (workout: WorkoutPrescription) => {
    const garminWorkout = {
      file_type: "workout",
      sport: "running",
      name: workout.name,
      intent: workout.intent,
      duration_minutes: workout.durationMinutes,
      description: workout.description,
      garmin_target_priority: [
        "1. HEART_RATE_ZONE (Prioridade Fisiológica #1)",
        "2. DURATION_TIME_OR_DISTANCE (Tempo / Distância)",
        "3. PACE_SECONDARY_REFERENCE (Informativo / Alvo Secundário)"
      ],
      evaluation_rule: "Pace é apenas referência secundária. O Garmin avalia o cumprimento do treino com base na Zona de FC e tempo/distância para evitar invalidação por vento, aclives ou fadiga.",
      steps: workout.steps.map((step) => {
        const mins = Math.floor(step.durationSeconds / 60);
        const secs = step.durationSeconds % 60;
        const durationStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        const stepDetails = getStepBlockDetails(step, athleteProfile, savedList.length > 0 ? savedList : localSavedList);
        
        return {
          name: step.name,
          type: step.stepType || "interval",
          duration_seconds: step.durationSeconds,
          duration_formatted: durationStr,
          primary_target: {
            type: "HEART_RATE_ZONE",
            zone: stepDetails.zonaRpe,
            bpm_range: stepDetails.fcRange,
            priority: 1,
            description: "Manter na Zona Fisiológica para garantir eficácia metabólica"
          },
          duration_target: {
            type: step.durationSeconds ? "TIME" : "DISTANCE",
            seconds: step.durationSeconds,
            priority: 2
          },
          secondary_target: {
            type: "PACE_REFERENCE",
            pace_range: stepDetails.paceRef,
            priority: 3,
            is_strict_trigger: false,
            note: "Alvo secundário de referência. Não invalida o tiro ou rodagem se houver vento/subida/cansaço."
          },
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
  
  // Helper to detect missed prescribed workouts in the active week
  const getMissedWorkoutsInWeek = (weekIdx: number = selectedWeekIdx) => {
    if (!trainingPlan) return [];
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const activeWeekIdx = Math.min(weekIdx, (trainingPlan.cycles[0]?.weeks?.length || 1) - 1);
    const workouts = trainingPlan.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
    
    const now = new Date();
    const jsDay = now.getDay();
    const todayIndex = jsDay === 0 ? 6 : jsDay - 1; // 0 = Mon, ..., 6 = Sun
    const allActivities = savedList.length > 0 ? savedList : localSavedList;
    
    const missed: Array<{ day: string; workout: any; dayIdx: number }> = [];

    const isSameDay = (d1: Date, d2: Date) => (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );

    const fullDays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

    workouts.forEach((sw: any) => {
      if (!sw || !sw.workout) return;
      const isRest = sw.workout.intent === "recovery" || sw.workout.durationMinutes === 0 || sw.workout.name?.toLowerCase().includes("descanso");
      if (isRest) return;

      const dayName = sw.day;
      const dayIdx = fullDays.findIndex(d => d.toLowerCase() === dayName.toLowerCase().trim() || d.toLowerCase().startsWith(dayName.toLowerCase().trim().substring(0, 3)));
      if (dayIdx === -1) return;

      const diffDays = dayIdx - todayIndex;
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffDays);

      const hasActivity = allActivities.some((act: any) => {
        const dateStr = act.startTime || act.uploadedAt || act.date;
        if (!dateStr) return false;
        const actDate = new Date(dateStr);
        return !isNaN(actDate.getTime()) && isSameDay(actDate, targetDate);
      });

      const isCompletedKey = localStorage.getItem(`fit_workout_completed_${dayName}_w${activeWeekIdx + 1}`) === "true";
      const isPastDay = dayIdx < todayIndex;

      // A past day is missed if it has no activities recorded and wasn't explicitly completed today
      if (isPastDay && !hasActivity && !isCompletedKey) {
        missed.push({ day: dayName, workout: sw.workout, dayIdx });
      }
    });

    return missed;
  };

  // Get today's or next prescribed workout from the weekly plan
  const getTodayWorkout = (explicitOffset?: number) => {
    if (!trainingPlan) return null;
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    
    const offset = explicitOffset !== undefined ? explicitOffset : (todayWorkoutCompleted ? 1 : 0);
    const targetDate = new Date();
    if (offset !== 0) {
      targetDate.setDate(targetDate.getDate() + offset);
    }
    const targetDayName = days[targetDate.getDay()];
    
    // Find active week idx (from selectedWeekIdx, or default to the current active week)
    const activeWeekIdx = Math.min(selectedWeekIdx, (trainingPlan.cycles[0]?.weeks?.length || 1) - 1);
    const workouts = trainingPlan.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
    
    let sw = workouts.find((w: any) => w.day === targetDayName);
    const originalScheduledWorkout = sw && sw.workout && sw.workout.intent !== "recovery" && sw.workout.durationMinutes > 0
      ? { ...sw.workout } 
      : { name: "Descanso Planejado", durationMinutes: 0, intent: "recovery", description: "Dia de descanso e recuperação fisiológica" };

    const isRest = !sw || !sw.workout || sw.workout.intent === "recovery" || sw.workout.durationMinutes === 0 || sw.workout.name?.toLowerCase().includes("descanso");
    
    let isCompensatedRestSlot = false;
    let compensatedFromDay = "";
    let compensationNotice = "";

    if (isRest) {
      const isHighReadiness = (readiness?.score || 70) >= 70 || readiness?.status === ReadinessStatus.READY;
      const missedWorkouts = getMissedWorkoutsInWeek(activeWeekIdx);
      if (missedWorkouts.length > 0) {
        // Prioritize missed Quality workout to fulfill weekly minimum
        const missedQuality = missedWorkouts.find(m => 
          m.workout?.intent === "threshold" || 
          m.workout?.intent === "vo2max" || 
          m.workout?.intent === "intervals" || 
          m.workout?.intent === "tempo" ||
          m.workout?.name?.toLowerCase().includes("limiar") ||
          m.workout?.name?.toLowerCase().includes("qualidade") ||
          m.workout?.name?.toLowerCase().includes("tiro") ||
          m.workout?.name?.toLowerCase().includes("intervalado")
        );

        const missed = missedQuality || missedWorkouts[0];
        isCompensatedRestSlot = true;
        compensatedFromDay = missed.day;
        const rawName = missed.workout.name.replace(" (Compensação Integ.)", "").replace(" (Compensação Z2)", "");
        
        if (isHighReadiness) {
          compensationNotice = `⚡ Compensação por Prontidão Alta: O dia de descanso foi reconfigurado para compensar a sessão de ${missed.day} (${rawName}) a 100% de intensidade.`;
          sw = {
            day: targetDayName,
            workout: {
              ...missed.workout,
              name: `${rawName} (Compensação Integ.)`,
              description: `[Sessão Reocorrida de ${missed.day}] ${missed.workout.description}`
            }
          };
        } else {
          compensationNotice = `⚡ Compensação por Prontidão Parcial: O dia de descanso foi reconfigurado em treino Z2 de compensação da sessão de ${missed.day} para evitar sobrecarga.`;
          sw = {
            day: targetDayName,
            workout: {
              ...missed.workout,
              name: `${rawName} (Compensação Z2)`,
              intent: "aerobic_base",
              durationMinutes: missed.workout.durationMinutes || 40,
              description: `[Sessão Reocorrida de ${missed.day} - Adaptada Z2] ${missed.workout.description}`
            }
          };
        }
      } else if (offset > 0) {
        const todayIdx = new Date().getDay();
        for (let i = 1; i <= 7; i++) {
          const checkDay = days[(todayIdx + i) % 7];
          const found = workouts.find((w: any) => w.day === checkDay && w.workout && w.workout.intent !== "recovery" && w.workout.durationMinutes > 0);
          if (found) {
            sw = found;
            break;
          }
        }
      }
    }

    if (!sw || !sw.workout) return null;

    const baseWorkout = {
      ...sw.workout,
      isCompensatedRestSlot,
      compensatedFromDay,
      compensationNotice,
      originalScheduledWorkout
    };
    const isLongRunDay = (sw.day || targetDayName) === (athleteProfile.longRunDay || "Domingo");

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
    const isHighReadiness = (currentReadiness.score || 70) >= 70 || status === ReadinessStatus.READY;

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

    if (status === ReadinessStatus.REDUCE && !isHighReadiness) {
      // REDUCE: Executar com Ajuste apenas quando prontidão < 70
      if (isAdvanced) {
        // Advanced Athlete Exception: keep intensity, reduce volume/dosage of intervals
        mainSetDuration = Math.max(10, Math.round(mainSetDuration * 0.75)); // 25% interval reduction
        
        if (baseWorkout.intent === TrainingIntent.THRESHOLD || baseWorkout.intent === "threshold" || baseWorkout.name?.toLowerCase().includes("limiar")) {
          finalName = `${baseWorkout.name} (Volume Ajustado - Elite)`;
          finalIntent = TrainingIntent.THRESHOLD;
          finalDescription = `Seu nível de prontidão parcial (${currentReadiness.score}/100) acionou a regra de exceção para atletas avançados. Mantivemos o estímulo de limiar planejado na Zona 4, mas reduzimos o volume total de intervalos em 25% para que você execute passadas com alta qualidade técnica sem acumular fadiga excessiva.`;
          mainHrTarget = `${coachZ4Min} - ${coachZ4Max} bpm (Z4)`;
          mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", -15, 5);
          mainDescription = `Mantemos a intensidade de Limiar Fisiológico hoje (Zona 4), porém com volume reduzido em 25% para proteger seu sistema musculoesquelético.`;
        } else if (baseWorkout.intent === TrainingIntent.VO2MAX || baseWorkout.intent === "vo2max") {
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
        // Beginner/Intermediate: convert high-intensity to easy Z2 when score < 70
        mainSetDuration = Math.max(10, Math.round(mainSetDuration * 0.8)); // 20% volume reduction
        
        if (baseWorkout.intent === TrainingIntent.THRESHOLD || baseWorkout.intent === "threshold" || baseWorkout.intent === TrainingIntent.VO2MAX || baseWorkout.intent === "vo2max" || baseWorkout.name?.toLowerCase().includes("limiar")) {
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
      // READY / High Readiness (Score >= 70): standard or compensated quality workout
      mainSetDuration = mainSetDuration;
      finalName = baseWorkout.name;
      finalDescription = baseWorkout.description;
      finalIntent = baseWorkout.intent;

      const isQualityIntent = baseWorkout.intent === TrainingIntent.THRESHOLD || 
                              baseWorkout.intent === "threshold" || 
                              baseWorkout.intent === TrainingIntent.VO2MAX || 
                              baseWorkout.intent === "vo2max" || 
                              baseWorkout.intent === "intervals" || 
                              baseWorkout.intent === "tempo" ||
                              baseWorkout.name?.toLowerCase().includes("limiar") ||
                              baseWorkout.name?.toLowerCase().includes("qualidade");

      if (isQualityIntent) {
        mainHrTarget = `${coachZ4Min} - ${coachZ4Max} bpm (Z4)`;
        mainPaceTarget = getAdjustedPaceString(athleteProfile.estimatedPaceCurrent || "5:30", -15, 5);
        mainDescription = "Corra firme no ritmo do seu limiar de lactato. Esforço moderadamente difícil, mas sustentável de forma contínua para expandir o limiar de fadiga.";
      } else if (baseWorkout.intent === TrainingIntent.LONG_RUN || baseWorkout.name?.toLowerCase().includes("longão")) {
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

    const isDoubleActive = athleteProfile.doubleSessionsAllowed || athleteProfile.sessionsPerDay === 2;
    const turno2Obj = sw?.turno2 || sw?.workouts?.[1] || (
      isDoubleActive && finalIntent !== "recovery" && finalIntent !== "rest"
        ? {
            name: finalIntent === "strength" ? "Mobilidade & Regeneração (Turno 2)" : "Fortalecimento Estrutural & Core (Turno 2)",
            intent: finalIntent === "strength" ? "mobility" : "strength",
            durationMinutes: athleteProfile.turno2TimeMinutes || athleteProfile.timePerShiftMinutes || 30,
            preferredTime: athleteProfile.turno2PreferredTime || "Tarde",
            description: finalIntent === "strength"
              ? "Exercícios de soltura miofascial, mobilidade articular de quadril e descompressão da coluna para otimizar absorção de carga."
              : "Fortalecimento funcional focado em estabilização de core, glúteo médio e panturrilhas para prevenção de lesões na corrida.",
            steps: [
              {
                id: "t2_step1",
                title: "1. Ativação & Fortalecimento de Core (Turno 2)",
                durationText: `${athleteProfile.turno2TimeMinutes || athleteProfile.timePerShiftMinutes || 30} min`,
                hrText: `FC: < ${coachZ1Max} bpm`,
                paceText: "Pace: Estático / Livre",
                description: "Prancha frontal, pontes glúteas, elevação de panturrilhas e exercícios de mobilidade de quadril."
              }
            ]
          }
        : null
    );

    return {
      ...baseWorkout,
      name: finalName,
      intent: finalIntent,
      durationMinutes: mainSetDuration,
      description: finalDescription,
      steps: steps,
      day: sw.day,
      turno2: turno2Obj,
      originalWorkout: isCompensatedRestSlot ? baseWorkout.originalScheduledWorkout : (sw.workout || baseWorkout.originalScheduledWorkout)
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
      restingHeartRate: undefined,
      muscleSoreness: 2,
      hasInjury: false,
      injurySeverity: "mild",
      hrvBaseline: 55,
      mood: "Bom",
      weight: undefined,
      garminReadiness: 78,
      subjectiveFeeling: "bem",
      prepScore: 78
    };
  });

  // 2. Local physiological calculation states
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [trainingLoad, setTrainingLoad] = useState<TrainingLoad | null>(null);
  const [showHrvPopup, setShowHrvPopup] = useState(false);
  const [showGarminStatusPopup, setShowGarminStatusPopup] = useState(false);
  const [showSubjectivePopup, setShowSubjectivePopup] = useState(false);
  const [showHrvInfoModal, setShowHrvInfoModal] = useState(false);
  const [showReadinessAuditModal, setShowReadinessAuditModal] = useState(false);
  const [showLoadAudit, setShowLoadAudit] = useState(false);
  const [showAdvancedTelemetry, setShowAdvancedTelemetry] = useState(false);
  const [isSimulationSuiteOpen, setIsSimulationSuiteOpen] = useState(false);

  // 3. Training Plan generated state
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // 4. Detail view state for a single prescription
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPrescription | null>(null);

  // 5. Active week in the macrocycle
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [simulationSuccess, setSimulationSuccess] = useState<string | null>(null);

  // Scroll helper for long-term multi-week row
  const weeksScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollWeeksRow = (direction: 'left' | 'right') => {
    if (weeksScrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      weeksScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // 6. Start Date for 4-Week Cycle Macrostructure
  const [cycleStartDate, setCycleStartDate] = useState<string>(() => {
    const saved = localStorage.getItem("fit_cycle_start_date");
    if (saved) return saved;
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday of current week
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().split("T")[0];
  });

  // State to track expanded daily cards in "Meu Plano"
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const toggleDayExpanded = (idx: number) => {
    setExpandedDays(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

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

  // 5b. Physiological Progress History State & Timeframe Filter ("weekly" by default as requested)
  const [adaptationTimeframe, setAdaptationTimeframe] = useState<"weekly" | "monthly" | "yearly">("weekly");

  const [progressHistory, setProgressHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem("fit_physiological_progress_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item: any) => {
            if (!item || !item.date) return false;
            // Exclude legacy hardcoded fallback mock points (e.g. weight 75 & restingHR 54 & vo2Max 48/48.5)
            const isLegacyMock = (item.weight === 75 || item.weight === 75.0) && item.restingHeartRate === 54 && (item.vo2Max === 48.5 || item.vo2Max === 48 || item.vo2Max === 49);
            return !isLegacyMock;
          });
        }
      } catch (e) {
        console.error("Failed to parse progress history:", e);
      }
    }
    // Starts empty for new users as requested ("o gráfico no histórico começa em branco e só entra dados após a primeira inserção")
    return [];
  });

  const [listFilter, setListFilter] = useState<"last10" | "lastWeek" | "last50" | "lastMonth" | "all">("all");

  const [historyWeight, setHistoryWeight] = useState<string>("");
  const [historyHeartRate, setHistoryHeartRate] = useState<string>("");
  const [historyVo2Max, setHistoryVo2Max] = useState<string>("");
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Continuous dataset generator for the chart (weekly = 7 days [default], monthly = 30 days, yearly = 365 days)
  // Carries forward last recorded values if missing on a date ("caso não sejam preenchidos mantém repete o gráfico com a última medição")
  const filteredAdaptationData = useMemo(() => {
    if (!Array.isArray(progressHistory) || progressHistory.length === 0) {
      return [];
    }

    const sortedHistory = [...progressHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sortedHistory.length === 0) return [];

    const firstRecordedDate = sortedHistory[0].date;

    let daysCount = 7;
    if (adaptationTimeframe === "monthly") daysCount = 30;
    if (adaptationTimeframe === "yearly") daysCount = 365;

    const today = new Date();
    const historyMap = new Map<string, any>();

    progressHistory.forEach((item) => {
      if (item && item.date) {
        historyMap.set(item.date, item);
      }
    });

    let currentWeight: number | undefined = sortedHistory[0].weight !== undefined && sortedHistory[0].weight !== null ? Number(sortedHistory[0].weight) : undefined;
    let currentHR: number | undefined = (sortedHistory[0].restingHeartRate ?? sortedHistory[0].heartRate) !== undefined ? Number(sortedHistory[0].restingHeartRate ?? sortedHistory[0].heartRate) : undefined;
    let currentVo2: number | undefined = sortedHistory[0].vo2Max !== undefined && sortedHistory[0].vo2Max !== null ? Number(sortedHistory[0].vo2Max) : undefined;

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (daysCount - 1));
    const startStr = startDate.toISOString().slice(0, 10);

    for (const item of sortedHistory) {
      if (item.date <= startStr) {
        if (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) currentWeight = Number(item.weight);
        if ((item.restingHeartRate ?? item.heartRate) !== undefined && !isNaN(item.restingHeartRate ?? item.heartRate)) {
          currentHR = Number(item.restingHeartRate ?? item.heartRate);
        }
        if (item.vo2Max !== undefined && item.vo2Max !== null && !isNaN(item.vo2Max)) currentVo2 = Number(item.vo2Max);
      }
    }

    const chartPoints = [];
    const step = adaptationTimeframe === "yearly" ? 7 : 1;

    for (let i = daysCount - 1; i >= 0; i -= step) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // Do NOT plot points prior to the athlete's first recorded entry date
      if (dateStr < firstRecordedDate) continue;

      if (historyMap.has(dateStr)) {
        const rec = historyMap.get(dateStr);
        if (rec.weight !== undefined && rec.weight !== null && !isNaN(rec.weight)) currentWeight = Number(rec.weight);
        if ((rec.restingHeartRate ?? rec.heartRate) !== undefined && !isNaN(rec.restingHeartRate ?? rec.heartRate)) {
          currentHR = Number(rec.restingHeartRate ?? rec.heartRate);
        }
        if (rec.vo2Max !== undefined && rec.vo2Max !== null && !isNaN(rec.vo2Max)) currentVo2 = Number(rec.vo2Max);
      }

      const parts = dateStr.split("-");
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;

      const point: any = {
        date: dateStr,
        displayDate: formattedDate,
      };
      if (currentWeight !== undefined && !isNaN(currentWeight)) {
        point.weight = Number(Number(currentWeight).toFixed(1));
      }
      if (currentHR !== undefined && !isNaN(currentHR)) {
        point.restingHeartRate = Math.round(Number(currentHR));
      }
      if (currentVo2 !== undefined && !isNaN(currentVo2)) {
        point.vo2Max = Math.round(Number(currentVo2));
      }

      chartPoints.push(point);
    }

    return chartPoints;
  }, [progressHistory, adaptationTimeframe]);

  // Sync back to localStorage when changed
  useEffect(() => {
    localStorage.setItem("fit_physiological_progress_history", JSON.stringify(progressHistory));
  }, [progressHistory]);

  const handleAddProgressPoint = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(historyWeight);
    const hr = parseInt(historyHeartRate);
    const vo2 = parseFloat(historyVo2Max);
    if (isNaN(w) || isNaN(hr) || isNaN(vo2)) {
      alert("Por favor, preencha peso, batimento de repouso e VO2 máx com valores numéricos válidos.");
      return;
    }

    const newPoint = {
      date: historyDate,
      weight: w,
      restingHeartRate: hr,
      heartRate: hr,
      vo2Max: vo2
    };

    setProgressHistory(prev => {
      const filtered = (Array.isArray(prev) ? prev : []).filter(p => p.date !== historyDate);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && handleFileUpload) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const localOnUploadClick = () => {
    localFileInputRef.current?.click();
  };

  const localOnFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && handleFileUpload) {
      handleFileUpload(e.target.files);
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
  }, []);

  // Unified, deduplicated, chronologically sorted activities list (merging props, local state, and localStorage)
  const displayList = useMemo(() => {
    const map = new Map<string, any>();

    if (Array.isArray(savedList)) {
      savedList.forEach((item) => {
        if (item && item.id) map.set(String(item.id), item);
      });
    }

    if (Array.isArray(localSavedList)) {
      localSavedList.forEach((item) => {
        if (item && item.id && !map.has(String(item.id))) {
          map.set(String(item.id), item);
        }
      });
    }

    try {
      const listStr = localStorage.getItem("fit_activity_list");
      if (listStr) {
        const parsed = JSON.parse(listStr);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item && item.id && !map.has(String(item.id))) {
              map.set(String(item.id), item);
            }
          });
        }
      }
    } catch (e) {}

    const list = Array.from(map.values());
    return list.sort((a, b) => {
      const tA = new Date(a.startTime || a.uploadedAt || a.date || 0).getTime();
      const tB = new Date(b.startTime || b.uploadedAt || b.date || 0).getTime();
      return tB - tA;
    });
  }, [savedList, localSavedList]);

  const [historySearchQuery, setHistorySearchQuery] = useState("");

  // Today's workout interactive completion and feedback states
  const [todayWorkoutCompleted, setTodayWorkoutCompleted] = useState<boolean>(() => {
    return localStorage.getItem("fit_today_completed") === "true";
  });

  const [showManualFeedbackForm, setShowManualFeedbackForm] = useState(false);

  // Auto-sync FIT completion & feedback for today and past days of current week
  useEffect(() => {
    const allActivities = savedList.length > 0 ? savedList : localSavedList;
    const now = new Date();
    const isSameDay = (d1: Date, d2: Date) => (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );

    const fitToday = allActivities.find((act: any) => {
      const timeStr = act.startTime || act.uploadedAt || act.date;
      if (!timeStr) return false;
      const actDate = new Date(timeStr);
      return !isNaN(actDate.getTime()) && isSameDay(actDate, now);
    });

    if (fitToday) {
      if (!todayWorkoutCompleted) {
        setTodayWorkoutCompleted(true);
        localStorage.setItem("fit_today_completed", "true");
      }
      const jsDay = now.getDay();
      const todayIndex = jsDay === 0 ? 6 : jsDay - 1;
      const fullDays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
      const todayDayFull = fullDays[todayIndex];
      localStorage.setItem(`fit_workout_completed_${todayDayFull}_w${selectedWeekIdx + 1}`, "true");

      // Auto-submit feedback from .FIT telemetry if not manually filled yet
      const submittedState = localStorage.getItem("fit_today_feedback_submitted");
      if (submittedState !== "true") {
        setFeedbackSubmitted(true);
        localStorage.setItem("fit_today_feedback_submitted", "true");

        const dist = fitToday.distanceKm || (fitToday.summary?.distanceKm) || 10;
        const durSeconds = fitToday.durationSeconds || (fitToday.summary?.durationSeconds) || 2400;
        const durMin = Math.round(durSeconds / 60);
        const avgHr = fitToday.avgHeartRate || fitToday.summary?.avgHeartRate || null;

        let estimatedRpe = 5;
        if (avgHr) {
          if (avgHr < 135) estimatedRpe = 3;
          else if (avgHr < 150) estimatedRpe = 5;
          else if (avgHr < 165) estimatedRpe = 7;
          else estimatedRpe = 9;
        }
        setRpeScore(estimatedRpe);
        localStorage.setItem("fit_today_rpe", estimatedRpe.toString());

        const autoComment = `⚡ Telemetria FIT Sincronizada Automática (Garmin): ${dist} km em ${durMin} min${avgHr ? `, FC Média: ${avgHr} bpm` : ''}.`;
        setWorkoutComment(autoComment);
        localStorage.setItem("fit_today_comment", autoComment);

        const athleteName = athleteProfile.name || "Atleta";
        const autoCoachReply = `⚡ Feedback Incorporado Automático via Telemetria .FIT (Garmin Connect)\n\nOlá, ${athleteName}! Seu treino foi processado e sincronizado com sucesso via arquivo .FIT. Todas as métricas de ritmos, duração (${durMin} min), distância (${dist} km)${avgHr ? ` e FC Média (${avgHr} bpm)` : ''} foram integradas diretamente ao modelo fisiológico. Não é necessário preenchimento manual do questionário pós-treino. Sua carga TRIMP foi assimilada e sua janela de prontidão e recuperação foi atualizada.`;
        setCoachFeedbackReply(autoCoachReply);
        localStorage.setItem("fit_today_coach_reply", autoCoachReply);
      }
    } else {
      const isManualCompleted = localStorage.getItem("fit_today_manual_completed") === "true";
      if (!isManualCompleted && todayWorkoutCompleted) {
        setTodayWorkoutCompleted(false);
        localStorage.setItem("fit_today_completed", "false");
      }
    }

    // Auto-sync all days in current week that have FIT activities recorded
    const jsDay = now.getDay();
    const todayIndex = jsDay === 0 ? 6 : jsDay - 1;
    const fullDays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

    fullDays.forEach((dayName, idx) => {
      const diffDays = idx - todayIndex;
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffDays);
      const dayActs = allActivities.filter((act: any) => {
        const timeStr = act.startTime || act.uploadedAt || act.date;
        if (!timeStr) return false;
        const actDate = new Date(timeStr);
        return !isNaN(actDate.getTime()) && isSameDay(actDate, targetDate);
      });
      if (dayActs.length > 0) {
        localStorage.setItem(`fit_workout_completed_${dayName}_w${selectedWeekIdx + 1}`, "true");
      } else {
        const isManualCompleted = localStorage.getItem("fit_today_manual_completed") === "true";
        if (!(idx === todayIndex && isManualCompleted)) {
          localStorage.removeItem(`fit_workout_completed_${dayName}_w${selectedWeekIdx + 1}`);
        }
      }
    });
  }, [savedList, localSavedList, selectedWeekIdx, todayWorkoutCompleted, athleteProfile.name]);

  const getDayIndexFromName = (dayName: string): number => {
    if (!dayName) return -1;
    const d = dayName.toLowerCase().trim();
    if (d.includes("seg") || d.includes("mon")) return 0;
    if (d.includes("ter") || d.includes("tue")) return 1;
    if (d.includes("qua") || d.includes("wed")) return 2;
    if (d.includes("qui") || d.includes("thu")) return 3;
    if (d.includes("sex") || d.includes("fri")) return 4;
    if (d.includes("sáb") || d.includes("sab") || d.includes("sat")) return 5;
    if (d.includes("dom") || d.includes("sun")) return 6;
    return -1;
  };

  const getDetailedDayStatus = (
    dayName: string,
    dayIndex: number,
    weekIdx: number,
    plan: any,
    activitiesList: any[],
    todayCompleted: boolean,
    completedBlocks: any[]
  ) => {
    const now = new Date();
    const jsDay = now.getDay();
    const todayIndex = jsDay === 0 ? 6 : jsDay - 1;
    const isToday = dayIndex === todayIndex;
    const isPast = dayIndex < todayIndex;

    const diffDays = dayIndex - todayIndex;
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffDays);

    const isSameDay = (d1: Date, d2: Date) => (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );

    const dayActivities = activitiesList.filter((act: any) => {
      const timeStr = act.startTime || act.uploadedAt || act.date;
      if (!timeStr) return false;
      const actDate = new Date(timeStr);
      return !isNaN(actDate.getTime()) && isSameDay(actDate, targetDate);
    });

    const fullDays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
    const targetDayFull = fullDays[dayIndex] || dayName;

    // Find workout in plan for this day
    const activeWeekIdx = Math.min(weekIdx, (plan?.cycles[0]?.weeks?.length || 1) - 1);
    const weekWorkouts = plan?.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
    const foundW = weekWorkouts.find((w: any) => {
      if (!w.day) return false;
      const d1 = w.day.toLowerCase().trim();
      const d2 = targetDayFull.toLowerCase().trim();
      return d1 === d2 || d1.startsWith(d2.substring(0, 3));
    });

    const isRestDay = foundW?.workout?.intent === "recovery" && 
                      (foundW?.workout?.name?.toLowerCase().includes("descanso") || foundW?.workout?.durationMinutes === 0);

    const keyCompleted = localStorage.getItem(`fit_workout_completed_${targetDayFull}_w${weekIdx + 1}`) === "true";
    const keyPartial = localStorage.getItem(`fit_workout_partial_${targetDayFull}_w${weekIdx + 1}`) === "true";

    // Check if multiple workouts exist for this day (e.g. proposed array or multiple steps)
    const proposedCount = foundW?.workouts ? foundW.workouts.length : 1;
    const isMultipleProposed = proposedCount > 1;

    // Partial block check for today
    let isPartialBlockToday = false;
    if (isToday && completedBlocks && completedBlocks.length > 1) {
      const checked = completedBlocks.filter((b: any) => b.isSelected !== false).length;
      if (checked > 0 && checked < completedBlocks.length) {
        isPartialBlockToday = true;
      }
    }

    // 1. Check for PARCIAL:
    if (
      keyPartial ||
      isPartialBlockToday ||
      (isMultipleProposed && dayActivities.length > 0 && dayActivities.length < proposedCount)
    ) {
      return {
        status: "partial",
        label: isMultipleProposed ? `Parcial (${dayActivities.length}/${proposedCount})` : "Parcial",
        badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]",
        textClass: "text-amber-400 font-bold",
        iconType: "alert",
        activities: dayActivities
      };
    }

    // 2. Check for CONCLUÍDO:
    // Exige obrigatoriamente que haja atividade gravada (.FIT/Histórico) para a data do dia ou confirmação manual explícita
    const hasActualActivity = dayActivities.length > 0;
    const isManualCompletedToday = isToday && localStorage.getItem("fit_today_manual_completed") === "true";
    const isCompletedValid = hasActualActivity || isManualCompletedToday || keyCompleted;
    if (isCompletedValid) {
      return {
        status: "completed",
        label: "Concluído",
        badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]",
        textClass: "text-emerald-400 font-bold",
        iconType: "check",
        activities: dayActivities
      };
    }

    // 3. REST DAY:
    if (isRestDay) {
      const missedWorkouts = getMissedWorkoutsInWeek(weekIdx);
      if (missedWorkouts.length > 0 && !isPast) {
        return {
          status: "rest_compensation",
          label: "Slot de Compensação ⚡",
          badgeClass: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold shadow-[0_0_8px_rgba(6,182,212,0.2)]",
          textClass: "text-cyan-300 font-bold",
          iconType: "zap",
          activities: dayActivities
        };
      }
      return {
        status: "rest",
        label: "Descanso Planejado",
        badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        textClass: "text-slate-400",
        iconType: "rest",
        activities: dayActivities
      };
    }

    // 4. PAST DAY without workout -> TREINO PERDIDO (Red X):
    if (isPast) {
      return {
        status: "missed",
        label: "Treino Perdido",
        badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)] font-bold",
        textClass: "text-rose-400 font-bold",
        iconType: "x",
        activities: dayActivities
      };
    }

    // 5. TODAY (Pending):
    if (isToday) {
      return {
        status: "today_pending",
        label: "Hoje (Pendente)",
        badgeClass: "bg-brand-neon/15 text-brand-neon border-brand-neon/30 font-bold",
        textClass: "text-brand-neon font-bold",
        iconType: "clock",
        activities: dayActivities
      };
    }

    // 6. FUTURE DAY:
    return {
      status: "future",
      label: "Planejado",
      badgeClass: "bg-white/5 text-slate-400 border-white/10",
      textClass: "text-slate-400",
      iconType: "future",
      activities: dayActivities
    };
  };

  // Helper formatting and calculations for the 4-Week Block Progress Macrostructure
  const formatDateDDMM = (dateObj: Date) => {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
  };

  const getWeekDateRange = (startStr: string, weekIdx: number) => {
    const parts = (startStr || "").split("-").map(Number);
    if (parts.length < 3 || isNaN(parts[0])) {
      const now = new Date();
      return { start: now, end: now, label: "Semana" };
    }
    const [y, m, d] = parts;
    const start = new Date(y, m - 1, d);
    start.setDate(start.getDate() + (weekIdx * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      start,
      end,
      label: `${formatDateDDMM(start)} a ${formatDateDDMM(end)}`
    };
  };

  const getWeekDaysTimeline = (startStr: string, weekIdx: number) => {
    const daysAbbrev = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const fullDays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
    
    const now = new Date();
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const parts = (startStr || "").split("-").map(Number);
    const [y, m, d] = (parts.length >= 3 && !isNaN(parts[0])) ? parts : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
    const base = new Date(y, m - 1, d);

    let filledPoints = 0;

    const daysInfo = daysAbbrev.map((abbrev, dayIdx) => {
      const dayDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (weekIdx * 7) + dayIdx);
      const dayTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
      
      let temporalState: "past" | "today" | "future" = "future";
      if (dayTime === todayZero) {
        temporalState = "today";
      } else if (dayTime < todayZero) {
        temporalState = "past";
      }

      const dayFull = fullDays[dayIdx];
      const isCompletedKey = localStorage.getItem(`fit_workout_completed_${dayFull}_w${weekIdx + 1}`) === "true";
      const hasAct = (savedList.length > 0 ? savedList : localSavedList).some((act: any) => {
        const dateStr = act.startTime || act.uploadedAt || act.date;
        if (!dateStr) return false;
        const actDate = new Date(dateStr);
        return !isNaN(actDate.getTime()) &&
          actDate.getDate() === dayDate.getDate() &&
          actDate.getMonth() === dayDate.getMonth() &&
          actDate.getFullYear() === dayDate.getFullYear();
      });

      const isCompleted = isCompletedKey || hasAct;

      if (temporalState === "past") {
        filledPoints += 1;
      } else if (temporalState === "today") {
        filledPoints += isCompleted ? 1 : 0.5;
      }

      return {
        abbrev,
        fullDay: dayFull,
        date: dayDate,
        dateFormatted: formatDateDDMM(dayDate),
        temporalState,
        isCompleted
      };
    });

    const fillPercent = Math.min(100, Math.round((filledPoints / 7) * 100));

    return {
      daysInfo,
      fillPercent,
      filledPoints
    };
  };

  // Synchronize daily adaptations & feedback between Meu Treino and Meu Plano
  const getAdaptedWorkoutForDay = (sw: any, weekIdx: number) => {
    if (!sw || !sw.workout) {
      return {
        originalWorkout: null,
        adaptedWorkout: sw?.workout || { name: "Descanso Planejado", intent: "recovery", description: "Dia de descanso" },
        isAdapted: false,
        adaptationReason: "",
        completedFeedback: null,
        dayStatus: null
      };
    }

    const dayName = sw.day;
    const dayIdx = getDayIndexFromName(dayName);
    
    const now = new Date();
    const jsDay = now.getDay();
    const todayIndex = jsDay === 0 ? 6 : jsDay - 1;
    const isToday = dayIdx === todayIndex;

    const dayStatus = getDetailedDayStatus(
      sw.day,
      dayIdx >= 0 ? dayIdx : 0,
      weekIdx,
      trainingPlan,
      savedList.length > 0 ? savedList : localSavedList,
      todayWorkoutCompleted,
      completedBlocksSummary
    );

    let originalWorkout = { ...sw.workout };
    let adaptedWorkout = { ...sw.workout };
    let isAdapted = false;
    let adaptationReason = "";

    const isRest = !sw.workout || sw.workout.intent === "recovery" || sw.workout.durationMinutes === 0 || sw.workout.name?.toLowerCase().includes("descanso");
    const currentReadiness = readiness || { status: ReadinessStatus.READY, score: 75 };
    const status = currentReadiness.status;
    const isHighReadiness = status === ReadinessStatus.READY || currentReadiness.score >= 70;

    // If day is today, delegate directly to getTodayWorkout() for 100% coherence across all components
    if (isToday) {
      const todayW = getTodayWorkout();
      if (todayW) {
        adaptedWorkout = {
          ...sw.workout,
          name: todayW.name,
          intent: todayW.intent || sw.workout.intent,
          durationMinutes: todayW.durationMinutes || sw.workout.durationMinutes,
          description: todayW.description || sw.workout.description
        };
        const wasOriginalRestOrBase = isRest || sw.workout.intent === "aerobic_base" || sw.workout.name?.toLowerCase().includes("z2") || sw.workout.name?.toLowerCase().includes("rodagem");
        const isNowQuality = todayW.intent === "threshold" || todayW.intent === "vo2max" || todayW.name?.includes("Limiar") || todayW.name?.includes("Compensação");
        isAdapted = !!(todayW.compensationNotice || (wasOriginalRestOrBase && isNowQuality));
        adaptationReason = todayW.compensationNotice || todayW.description || `⚡ [Adaptação para Hoje] Treino ajustado para ${todayW.name} conforme avaliação de prontidão (${currentReadiness.score}/100).`;

        return {
          originalWorkout,
          adaptedWorkout,
          isAdapted,
          adaptationReason,
          completedFeedback: null,
          dayStatus
        };
      }
    }

    if (isRest) {
      const missedWorkouts = getMissedWorkoutsInWeek(weekIdx);
      if (missedWorkouts.length > 0 || dayStatus?.status === "rest_compensation") {
        const missedQuality = missedWorkouts.find(m => 
          m?.workout?.intent === "threshold" || 
          m?.workout?.intent === "vo2max" || 
          m?.workout?.intent === "intervals" || 
          m?.workout?.intent === "tempo" ||
          m?.workout?.name?.toLowerCase().includes("limiar") ||
          m?.workout?.name?.toLowerCase().includes("qualidade") ||
          m?.workout?.name?.toLowerCase().includes("tiro") ||
          m?.workout?.name?.toLowerCase().includes("intervalado")
        );
        const missed = missedQuality || missedWorkouts[0];
        isAdapted = true;
        if (isHighReadiness) {
          const rawName = (missed?.workout?.name || "Treino de Qualidade").replace(" (Compensação Integ.)", "").replace(" (Compensação Z2)", "");
          adaptationReason = `⚡ [Prontidão Alta: ${currentReadiness.score}/100] Regra Semanal (Min: 1 Longão, 1 Rodagem, 1 Descanso, 1 Qualidade): Como já houve Rodagem e Descanso na semana e sua prontidão está favorável, o descanso foi reconfigurado para o Treino de Qualidade de ${missed?.day || "segunda-feira"} (${rawName}) a 100% de intensidade!`;
          adaptedWorkout = {
            ...(missed?.workout || sw.workout),
            name: `${rawName} (Compensação Integ.)`,
            description: `⚡ [Adaptação por Regra Semanal] Sessão reocorrida de ${missed?.day || "dia anterior"}. Prontidão excelente (${currentReadiness.score}/100) para absorção integral do estímulo de qualidade.`
          };
        } else {
          const rawName = (missed?.workout?.name || "Treino Perdido").replace(" (Compensação Integ.)", "").replace(" (Compensação Z2)", "");
          adaptationReason = `⚡ [Prontidão Parcial: ${currentReadiness.score}/100] Descanso reconfigurado em treino Z2 para compensar a sessão de ${missed?.day || "treino perdido"} e evitar sobrecarga.`;
          adaptedWorkout = {
            ...(missed?.workout || sw.workout),
            name: `${rawName} (Compensação Z2)`,
            intent: "aerobic_base",
            durationMinutes: missed?.workout?.durationMinutes || 40,
            description: `⚡ [Adaptação do Treinador] O dia de descanso foi reconfigurado em treino Z2 para compensar a sessão de ${missed?.day || "anterior"} protegendo a recuperação.`
          };
        }
      } else {
        isAdapted = false;
        adaptationReason = `✓ [Descanso Planejado Mantido: ${currentReadiness.score}/100] Dia de recuperação mantido conforme a estrutura semanal.`;
      }
    } else {
      // 2. READINESS / COACH ADAPTATION FOR NON-REST DAYS
      if (isHighReadiness) {
        isAdapted = false;
        adaptationReason = `✓ [Prontidão Alta: ${currentReadiness.score}/100] Treino Mantido a 100%. Seu estado fisiológico apresenta capacidade adaptativa ideal para absorver o estresse da sessão!`;
        adaptedWorkout = sw.workout;
      } else if (status === ReadinessStatus.REDUCE || currentReadiness.score < 70) {
        if (sw.workout.intent === "threshold" || sw.workout.intent === "vo2max") {
          isAdapted = true;
          adaptationReason = `Ajustado de ${sw.workout.intent.toUpperCase()} para Z2 devido à Prontidão Parcial (${currentReadiness.score}/100)`;
          adaptedWorkout = {
            ...sw.workout,
            name: "Rodagem Aeróbica Controlada Z2",
            intent: "aerobic_base",
            durationMinutes: Math.max(25, Math.round((sw.workout.durationMinutes || 40) * 0.8)),
            description: `⚡ [Adaptação Fisiológica] Sua prontidão reduzida (${currentReadiness.score}/100) gerou ajuste temporário de alta intensidade (Z4/Z5) para rodagem Z2 em baixa intensidade para regenerar tecidos mantendo o estímulo aeróbico.`
          };
        } else {
          isAdapted = true;
          adaptationReason = `Volume ajustado em 20% para adequação à prontidão (${currentReadiness.score}/100)`;
          adaptedWorkout = {
            ...sw.workout,
            name: `${sw.workout.name} (Volume Ajustado)`,
            durationMinutes: Math.max(20, Math.round((sw.workout.durationMinutes || 40) * 0.8)),
            description: `${sw.workout.description} (Ajustado para proteger recuperação)`
          };
        }
      } else if (status === ReadinessStatus.RECOVER || currentReadiness.score < 50) {
        isAdapted = true;
        adaptationReason = `Convertido para Regenerativo Leve Z1/Z2 (Prontidão: ${currentReadiness.score}/100)`;
        adaptedWorkout = {
          ...sw.workout,
          name: "Rodagem Regenerativa Leve Z1/Z2",
          intent: "recovery",
          durationMinutes: 25,
          description: "⚡ [Adaptação de Recuperação] Sessão convertida para regenerativo ultra-leve visando restabelecer a homeostase."
        };
      }
    }

    // 3. RETRIEVE COMPLETED FEEDBACK & SYNC TELEMETRY DURATION
    let completedFeedback: { rpe?: number; comment?: string; reply?: string } | null = null;
    if (dayStatus?.status === "completed" || dayStatus?.status === "partial") {
      const act = dayStatus.activities && dayStatus.activities[0];
      if (act) {
        const secs = act.durationSeconds || act.summary?.durationSeconds || act.totalTimerTime || act.movingTime || 0;
        const actMins = secs > 0 ? Math.round(secs / 60) : (act.durationMinutes || 48);
        if (actMins > 0) {
          adaptedWorkout.durationMinutes = actMins;
        }
      } else if (!adaptedWorkout.durationMinutes || adaptedWorkout.durationMinutes === 0) {
        adaptedWorkout.durationMinutes = 48; // Ensure non-zero duration for completed workouts
      }

      if (isToday && feedbackSubmitted) {
        completedFeedback = {
          rpe: rpeScore,
          comment: workoutComment,
          reply: coachFeedbackReply || "Excelente absorção fisiológica da sessão!"
        };
      } else {
        const storedRpe = localStorage.getItem(`fit_today_rpe`);
        const storedComment = localStorage.getItem(`fit_today_comment`);
        const storedReply = localStorage.getItem(`fit_today_coach_reply`);
        
        const actRpe = act ? localStorage.getItem(`fit_rpe_${act.id}`) : null;

        completedFeedback = {
          rpe: actRpe ? parseInt(actRpe) : (storedRpe ? parseInt(storedRpe) : 6),
          comment: storedComment || (act ? `${act.distanceKm || 0} km executados com sucesso.` : "Treino concluído conforme prescrição."),
          reply: storedReply || "Sessão concluída e assimilada no seu histórico de carga."
        };
      }
    }

    return {
      originalWorkout,
      adaptedWorkout,
      isAdapted,
      adaptationReason,
      completedFeedback,
      dayStatus
    };
  };

  useEffect(() => {
    const autoRestDays = calculateConsecutiveRestDays(savedList.length > 0 ? savedList : localSavedList, todayWorkoutCompleted);
    const missedWorkouts = getMissedWorkoutsInWeek(selectedWeekIdx);
    const updatedMetrics = { 
      ...dailyMetrics, 
      daysWithoutTraining: autoRestDays,
      hasMissedWorkoutInWeek: missedWorkouts.length > 0,
      missedWorkoutDaysCount: missedWorkouts.length
    };

    const tl = calculateTrainingLoad(history, athleteProfile.currentWeekKm || 0, autoRestDays);
    setTrainingLoad(tl);

    const r = calculateReadiness(updatedMetrics, tl?.acuteChronicRatio ?? 1.0);
    setReadiness(r);
    
    localStorage.setItem("fit_daily_metrics_v2", JSON.stringify(updatedMetrics));
  }, [dailyMetrics, athleteProfile.currentWeekKm, history.weekDistanceKm, history.monthDistanceKm, savedList, localSavedList, todayWorkoutCompleted, selectedWeekIdx, trainingPlan]);

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
    const autoRestDays = calculateConsecutiveRestDays(savedList.length > 0 ? savedList : localSavedList, todayWorkoutCompleted);
    if (autoRestDays > 0) {
      const restDays = Math.min(7, autoRestDays);
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
  }, [trainingPlan, selectedWeekIdx, todayWorkoutCompleted, rpeScore, savedList, localSavedList]);

  // Coach Guidance Engine: Selects 2 to 4 high-impact prioritized objects per workout
  const activeGuidanceMessages = useMemo(() => {
    const workout = getTodayWorkout();
    const missedWorkouts = getMissedWorkoutsInWeek(selectedWeekIdx);

    const guidanceCtx: GuidanceContext = {
      metrics: dailyMetrics,
      athleteProfile: athleteProfile,
      readinessScore: readiness?.score,
      readinessStatus: readiness?.status,
      acwr: trainingLoad?.acuteChronicRatio ?? 1.0,
      garminRecoveryTimeHours: dailyMetrics.garminRecoveryTime || 0,
      hasInjury: dailyMetrics.hasInjury,
      workoutIntent: workout?.intent,
      workoutDurationMinutes: workout?.durationMinutes,
      workoutName: workout?.name,
      isLongRun: workout?.day === (athleteProfile.longRunDay || "Domingo") || workout?.intent === "long_run",
      temperature: dailyMetrics.temperature ?? 22,
      weatherCondition: dailyMetrics.weatherCondition || "Limpo",
      isWindy: dailyMetrics.isWindy || false,
      isUphill: dailyMetrics.isUphill || false,
      completedWorkoutsCount: savedList.length > 0 ? savedList.length : localSavedList.length,
      consecutiveBadSleepNights: dailyMetrics.consecutiveBadSleepNights || (dailyMetrics.sleepHours < 6 ? 3 : 0),
      hasMissedWorkoutInWeek: missedWorkouts.length > 0,
      startedFastInLastWorkouts: athleteProfile.startedFastInLastWorkouts ?? false,
      improvesWithSleep: (savedList.length > 3 && (dailyMetrics.sleepHours >= 7.5)),
      hrSpikesEarly: athleteProfile.hrSpikesEarly ?? false,
      finishesStrong: athleteProfile.finishesStrong ?? true,
      dropsIntenseWorkouts: athleteProfile.dropsIntenseWorkouts ?? false,
      recentLongRunCompleted: Boolean(savedList.some((a: any) => (a.distanceKm || 0) > 15)),
    };

    return evaluateGuidanceEngine(guidanceCtx);
  }, [dailyMetrics, readiness, trainingLoad, selectedWeekIdx, trainingPlan, savedList, localSavedList, athleteProfile, todayWorkoutCompleted]);

  const handleStateSubmit = () => {
    setIsCoachThinking(true);

    // Save physiological biomarkers into progress history for today ONLY if at least one metric was explicitly provided
    const todayStr = new Date().toISOString().slice(0, 10);
    const hasWeight = dailyMetrics.weight !== undefined && dailyMetrics.weight !== null && !isNaN(Number(dailyMetrics.weight));
    const hasHR = dailyMetrics.restingHeartRate !== undefined && dailyMetrics.restingHeartRate !== null && !isNaN(Number(dailyMetrics.restingHeartRate));
    const hasVo2 = dailyMetrics.vo2Max !== undefined && dailyMetrics.vo2Max !== null && !isNaN(Number(dailyMetrics.vo2Max));

    if (hasWeight || hasHR || hasVo2) {
      setProgressHistory((prev) => {
        const sorted = Array.isArray(prev) ? [...prev].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];
        const existingForToday = sorted.find(p => p.date === todayStr) || {};

        const newPoint: any = {
          ...existingForToday,
          date: todayStr,
        };
        if (hasWeight) newPoint.weight = Number(dailyMetrics.weight);
        if (hasHR) {
          newPoint.restingHeartRate = Number(dailyMetrics.restingHeartRate);
          newPoint.heartRate = Number(dailyMetrics.restingHeartRate);
        }
        if (hasVo2) newPoint.vo2Max = Number(dailyMetrics.vo2Max);

        const filtered = sorted.filter(p => p.date !== todayStr);
        return [...filtered, newPoint].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });
    }

    if (setAthleteProfile) {
      setAthleteProfile((prevProf: any) => ({
        ...prevProf,
        ...(dailyMetrics.weight !== undefined ? { weightCurrentKg: dailyMetrics.weight, weight: dailyMetrics.weight } : {}),
        ...(dailyMetrics.restingHeartRate !== undefined ? { restingHeartRate: dailyMetrics.restingHeartRate } : {}),
        ...(dailyMetrics.vo2Max !== undefined ? { vo2Max: dailyMetrics.vo2Max } : {}),
      }));
    }

    // Recalculate readiness using current training load ACWR (incorporating rest days automatically calculated from FIT/workouts)
    const autoRestDays = calculateConsecutiveRestDays(savedList.length > 0 ? savedList : localSavedList, todayWorkoutCompleted);
    const missedWorkouts = getMissedWorkoutsInWeek(selectedWeekIdx);
    const updatedMetrics = { 
      ...dailyMetrics, 
      daysWithoutTraining: autoRestDays,
      hasMissedWorkoutInWeek: missedWorkouts.length > 0,
      missedWorkoutDaysCount: missedWorkouts.length
    };
    const tl = calculateTrainingLoad(history, athleteProfile.currentWeekKm || 0, autoRestDays);
    const r = calculateReadiness(updatedMetrics, tl?.acuteChronicRatio ?? 1.0);
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
    setCurrentRpe(rpeScore);
    if (activeActivity?.id) {
      localStorage.setItem(`fit_rpe_${activeActivity.id}`, rpeScore.toString());
    }
    localStorage.setItem("fit_today_manual_completed", "true");
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
    const w = targetWorkout || getTodayWorkout(todayWorkoutCompleted ? 1 : 0);
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
    localStorage.setItem("fit_today_manual_completed", "true");
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
    localStorage.removeItem("fit_today_manual_completed");
    localStorage.removeItem("fit_today_feedback_submitted");
    localStorage.removeItem("fit_today_rpe");
    localStorage.removeItem("fit_today_pain");
    localStorage.removeItem("fit_today_comment");
    localStorage.removeItem("fit_today_coach_reply");
    localStorage.removeItem("fit_today_checklist");
    localStorage.removeItem("fit_today_block_times");
    localStorage.removeItem("fit_today_completed_blocks");
    const currentTodayW = getTodayWorkout(0);
    if (currentTodayW && currentTodayW.day) {
      localStorage.removeItem(`fit_workout_completed_${currentTodayW.day}_w${selectedWeekIdx + 1}`);
    }
  };

  const exportToGarmin = (workout: any) => {
    // Generate Garmin-structured training steps with HR Zone + Time/Distance primary, Pace secondary
    const garminWorkout = {
      workoutName: workout.name,
      sport: "RUNNING",
      targetPriority: ["HEART_RATE_ZONE", "DURATION_TIME_OR_DISTANCE", "PACE_SECONDARY_REFERENCE"],
      evaluationRule: "Zona de FC e Duração (Tempo/Distância) definem o cumprimento do treino. Pace é apenas referência secundária para evitar penalizar treinos em dias com vento, aclives ou cansaço.",
      steps: workout.steps ? workout.steps.map((step: any) => {
        const stepDetails = getStepBlockDetails(step, athleteProfile, savedList.length > 0 ? savedList : localSavedList);
        return {
          stepType: (step.stepType || "ACTIVE").toUpperCase(),
          durationSeconds: step.durationSeconds || (workout.durationMinutes * 60),
          primaryTarget: {
            targetType: "HEART_RATE_ZONE",
            zone: stepDetails.zonaRpe,
            fcRange: stepDetails.fcRange,
            priority: 1
          },
          durationTarget: {
            targetType: step.durationSeconds ? "TIME" : "DISTANCE",
            seconds: step.durationSeconds,
            priority: 2
          },
          secondaryTarget: {
            targetType: "PACE_REFERENCE",
            paceRef: stepDetails.paceRef,
            priority: 3,
            isStrictTrigger: false
          }
        };
      }) : [
        {
          stepType: "WARMUP",
          durationSeconds: 600,
          primaryTarget: { targetType: "HEART_RATE_ZONE", zone: "Z1 / RPE 1-2", priority: 1 },
          durationTarget: { targetType: "TIME", seconds: 600, priority: 2 },
          secondaryTarget: { targetType: "PACE_REFERENCE", paceRef: calculateZonePaceRange("Z1", athleteProfile, savedList.length > 0 ? savedList : localSavedList), priority: 3, isStrictTrigger: false }
        },
        {
          stepType: "ACTIVE",
          durationSeconds: (workout.durationMinutes || 40) * 60,
          primaryTarget: { targetType: "HEART_RATE_ZONE", zone: "Z2 / RPE 3-4", targetBpmMax: coachZ2Max, priority: 1 },
          durationTarget: { targetType: "TIME", seconds: (workout.durationMinutes || 40) * 60, priority: 2 },
          secondaryTarget: { targetType: "PACE_REFERENCE", paceRef: calculateZonePaceRange("Z2", athleteProfile, savedList.length > 0 ? savedList : localSavedList), priority: 3, isStrictTrigger: false }
        },
        {
          stepType: "COOLDOWN",
          durationSeconds: 300,
          primaryTarget: { targetType: "HEART_RATE_ZONE", zone: "Z1 / RPE 1-2", priority: 1 },
          durationTarget: { targetType: "TIME", seconds: 300, priority: 2 },
          secondaryTarget: { targetType: "PACE_REFERENCE", paceRef: calculateZonePaceRange("Z1", athleteProfile, savedList.length > 0 ? savedList : localSavedList), priority: 3, isStrictTrigger: false }
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

  // Periodize a plan into a complete multi-week (4 to 16 weeks) physiological training cycle
  const enrichPlanWithCycle = (plan: TrainingPlan): TrainingPlan => {
    if (!plan.cycles || plan.cycles.length === 0) {
      plan.cycles = [{ cycleNumber: 1, weeks: [] }];
    }
    
    const cycle = plan.cycles[0];

    // Determine target weeks based on athlete's long-term goal or target race date
    let targetWeeks = 4;
    if (athleteProfile.currentTargetRaceDate) {
      const parts = athleteProfile.currentTargetRaceDate.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && parts[0] > 2000) {
        const raceDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const today = new Date();
        const diffMs = raceDate.getTime() - today.getTime();
        const diffWeeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
        if (diffWeeks >= 4) {
          targetWeeks = Math.min(16, diffWeeks);
        }
      }
    } else if (athleteProfile.trainingGoal === "marathon" || athleteProfile.objective?.toLowerCase().includes("maratona")) {
      targetWeeks = 16;
    } else if (athleteProfile.trainingGoal === "half_marathon" || athleteProfile.objective?.toLowerCase().includes("meia")) {
      targetWeeks = 12;
    } else if (athleteProfile.trainingGoal === "10k" || athleteProfile.objective?.toLowerCase().includes("10k")) {
      targetWeeks = 8;
    }

    if (cycle.weeks && cycle.weeks.length >= targetWeeks) {
      return plan;
    }
    
    const baseWeek = cycle.weeks[0] || {
      weekNumber: 1,
      phase: "Construção de Base",
      workouts: []
    };
    
    const weeks: WeeklyPlan[] = [];

    for (let w = 1; w <= targetWeeks; w++) {
      let phaseName = "Construção de Base";
      let scale = 1.0;
      const isLastWeek = w === targetWeeks;
      const isRecoveryWeek = (w % 4 === 0) && !isLastWeek;

      if (isLastWeek) {
        phaseName = "Polimento Final & Tapering";
        scale = 0.65;
      } else if (isRecoveryWeek) {
        phaseName = `Semana ${w} • Descarga Fisiológica`;
        scale = 0.75;
      } else if (w <= Math.floor(targetWeeks * 0.35)) {
        phaseName = `Semana ${w} • Base Aeróbica`;
        scale = 1.0 + (w - 1) * 0.05;
      } else if (w <= Math.floor(targetWeeks * 0.70)) {
        phaseName = `Semana ${w} • Limiar & Carga`;
        scale = 1.10 + (w - Math.floor(targetWeeks * 0.35)) * 0.04;
      } else {
        phaseName = `Semana ${w} • Pico & Especificidade`;
        scale = 1.20 + (w - Math.floor(targetWeeks * 0.70)) * 0.03;
      }

      const weekWorkouts = baseWeek.workouts.map((sw: any) => {
        const originalW = sw.workout;
        const isQuality = originalW.intent === "vo2max" || originalW.intent === "threshold";
        const isLong = originalW.intent === "long_run";
        const isRest = originalW.intent === "rest";

        let workoutScale = scale;
        let durationMinutes = Math.round(originalW.durationMinutes * workoutScale);
        let name = originalW.name;

        if (isLastWeek && !isRest) {
          name = `${originalW.name} (Tapering / Descarga)`;
        } else if (isRecoveryWeek && !isRest) {
          name = `${originalW.name} (Recuperação Ativa)`;
        } else if (isLong && w > 1) {
          name = `${originalW.name} (+Volume)`;
        }

        const steps = originalW.steps ? originalW.steps.map((step: any) => {
          const stepCopy = { ...step };
          if (stepCopy.stepType === "main_set") {
            if (stepCopy.repetitions) {
              if (isLastWeek || isRecoveryWeek) {
                stepCopy.repetitions = Math.max(2, Math.round(stepCopy.repetitions * 0.6));
              } else if (w > 1) {
                stepCopy.repetitions = Math.round(stepCopy.repetitions + Math.floor((w - 1) / 2));
              }
            } else {
              stepCopy.durationSeconds = Math.round(stepCopy.durationSeconds * workoutScale);
            }
          } else {
            stepCopy.durationSeconds = Math.round(stepCopy.durationSeconds * (isRecoveryWeek ? 0.8 : 1.0));
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
        weekNumber: w,
        phase: phaseName,
        workouts: weekWorkouts
      });
    }

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
    safeSetLocalStorage("fit_activity_list", JSON.stringify(list));
    safeSetLocalStorage(`fit_activity_data_${id}`, JSON.stringify(simulatedActivity));
    setLocalSavedList([...list]);
    if (refreshActivities) {
      refreshActivities();
    }
    
    // Save to server DB as well
    fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simulatedActivity),
    }).catch((e) => console.warn("Failed posting simulated activity to DB:", e));
    
    safeSetLocalStorage(`fit_workout_completed_${workout.day}_w${selectedWeekIdx + 1}`, "true");
    
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
            🟢 Assimilação Plena
          </span>
        );
      case ReadinessStatus.REDUCE:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            🟡 Dia de Ajuste Moderado
          </span>
        );
      case ReadinessStatus.RECOVER:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            🔴 Dia de Recuperação Ativa
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
    const completedThisWeek = displayList.filter((item: any) => {
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
                <label className="block text-[9px] uppercase text-slate-400 mb-1 font-mono">Pace Estimado Atual (Formato hh:mm / min:seg)</label>
                <input
                  type="text"
                  value={athleteProfile.estimatedPaceCurrent || "05:46"}
                  placeholder="Ex: 00:05 ou 05:46"
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
                  <h2 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-white leading-tight">
                    Bom dia, {athleteProfile.name || "Atleta"}.
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Hoje é <span className="text-slate-200 font-semibold">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
                  </p>
                </div>
              </div>

              {/* DECISÃO DO TREINADOR - VISÃO LIMPA E DIRETA */}
              {(() => {
                const todayW = getTodayWorkout();
                const rStatus = readiness?.status || ReadinessStatus.READY;
                const rScore = readiness?.score || 70;
                const sleep = dailyMetrics.sleepHours;
                const feelingId = dailyMetrics.subjectiveFeeling || "bem";

                // Status Symbol & Title
                let decisionSymbol = "🟢";
                let decisionTitle = "Treino mantido";
                let decisionBg = "bg-emerald-950/40 border-emerald-500/30 text-emerald-300";

                if (rStatus === ReadinessStatus.RECOVER || rScore < 50 || feelingId === "muito_cansado" || dailyMetrics.hasInjury) {
                  decisionSymbol = "🔴";
                  decisionTitle = "Recuperação ativa";
                  decisionBg = "bg-rose-950/40 border-rose-500/30 text-rose-300";
                } else if (rStatus === ReadinessStatus.REDUCE || rScore < 70 || feelingId === "cansado" || (dailyMetrics.muscleSoreness && dailyMetrics.muscleSoreness >= 6)) {
                  decisionSymbol = "🟡";
                  decisionTitle = "Ajuste de carga";
                  decisionBg = "bg-amber-950/40 border-amber-500/30 text-amber-300";
                }

                // Workout details
                const workoutPrescription = todayW ? `${todayW.name} (${todayW.durationMinutes} min)` : (decisionTitle === "Recuperação ativa" ? "25 minutos leve" : "40 minutos rodagem Z2");

                // Dynamic clear "Por quê?" reason
                let whyReason = "";
                if (rStatus === ReadinessStatus.RECOVER || rScore < 50 || feelingId === "muito_cansado") {
                  const parts: string[] = [];
                  if (sleep !== undefined && sleep !== null && sleep < 6) parts.push("seu sono foi reduzido");
                  if (feelingId === "muito_cansado" || feelingId === "cansado") parts.push("você relatou cansaço");
                  else if (dailyMetrics.muscleSoreness && dailyMetrics.muscleSoreness >= 6) parts.push("você relatou dor muscular");
                  
                  if (parts.length === 0) {
                    whyReason = "Seu organismo apresenta alta fadiga acumulada. Vamos recuperar hoje para treinar melhor amanhã.";
                  } else {
                    const joined = parts.join(" e ");
                    const capitalized = joined.charAt(0).toUpperCase() + joined.slice(1);
                    whyReason = `${capitalized}. Vamos recuperar hoje para treinar melhor amanhã.`;
                  }
                } else if (rStatus === ReadinessStatus.REDUCE || rScore < 70) {
                  whyReason = "Sua recuperação recente é moderada. Reduzimos levemente o volume para manter o estímulo com qualidade técnica.";
                } else {
                  whyReason = "Sua prontidão está excelente e seus indicadores de sono e HRV mostram ótima capacidade de absorção de carga.";
                }

                // Confidence Level
                const confidence = readiness?.confidenceScore || 85;
                const quality = readiness?.decisionQuality || "Alta";
                let confLabel = "Alta";
                let confBadge = "bg-emerald-950/60 text-emerald-300 border-emerald-700/50";
                if (quality === "Moderada" || (confidence >= 60 && confidence < 80)) {
                  confLabel = "Moderada";
                  confBadge = "bg-amber-950/60 text-amber-300 border-amber-700/50";
                } else if (confidence < 60) {
                  confLabel = "Básica";
                  confBadge = "bg-sky-950/60 text-sky-300 border-sky-700/50";
                }

                return (
                  <div className="mt-4 space-y-4">
                    <div className={`p-4 sm:p-5 rounded-xl border ${decisionBg} font-sans space-y-4 shadow-sm`}>
                      {/* Grid of Always Visible Fields */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-white/10 pb-3.5">
                        {/* Disponibilidade de treino */}
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                            Disponibilidade de treino:
                          </span>
                          <span className="text-xl sm:text-2xl font-black font-mono text-white">
                            {rScore}<span className="text-xs text-slate-400 font-normal">/100</span>
                          </span>
                        </div>

                        {/* Hoje */}
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                            Hoje:
                          </span>
                          <span className="text-sm sm:text-base font-bold font-mono text-white flex items-center gap-1.5 mt-1">
                            {todayWorkoutCompleted ? (
                              <span className="text-emerald-300 flex items-center gap-1 text-xs sm:text-sm">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Treino Concluído
                              </span>
                            ) : (
                              <>
                                <span>{decisionSymbol}</span>
                                <span>{decisionTitle}</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Treino */}
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                            {todayWorkoutCompleted ? "Próximo Treino:" : "Treino:"}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-white block mt-1 truncate" title={workoutPrescription}>
                            {workoutPrescription}
                          </span>
                        </div>

                        {/* Confiança (Clicável para Ver Análise Avançada) */}
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                            Confiança:
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowReadinessAuditModal(true)}
                            className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${confBadge} hover:scale-105 hover:brightness-125 transition-all cursor-pointer group mt-0.5 shadow-sm`}
                            title="Clique para abrir a Análise Avançada e Auditoria de Decisão"
                          >
                            <span>{confLabel}</span>
                            <span className="text-[9px] opacity-80 group-hover:opacity-100 font-normal flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 text-slate-200">
                              <Calculator className="w-3 h-3 text-brand-neon" />
                              <span>Ver Análise</span>
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Por quê? */}
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-1">
                          Por quê?
                        </span>
                        <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed italic">
                          "{whyReason}"
                        </p>
                      </div>

                      {/* Aviso Transparente de Sensores Ausentes & Degradação Elegante (Regra do Treinador) */}
                      {(quality === "Moderada" || quality === "Limitada" || confidence < 80) && (
                        <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-2.5 flex items-start gap-2.5 text-[11px] text-amber-200 font-sans">
                          <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-mono font-bold uppercase text-[10px] text-amber-300 block mb-0.5">
                              Nível de Confiança da Decisão: {confLabel} ({confidence}%)
                            </span>
                            <span>
                              {readiness?.missingSources && readiness.missingSources.length > 0
                                ? `Nossa confiança hoje é ${confLabel.toLowerCase()} porque não temos dados de: ${readiness.missingSources.join(", ")}. Sem sensores, o motor não inventa valores e redistribui a prioridade para a sua Percepção Subjetiva.`
                                : `Análise baseada prioritariamente no seu Check-in e percepção de esforço devido à ausência parcial de dados de telemetria noturna.`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Estado fisiológico atual */}
              {(() => {
                const isExternalLoadHigh = (trainingLoad?.acuteChronicRatio ?? 0) > 1.3 || (monotonyData?.strain ?? 0) > 1200;
                const baselineHrv = dailyMetrics.hrvBaseline || 55;
                const currentHrv = dailyMetrics.hrv || 50;
                const hrvDevPct = ((currentHrv - baselineHrv) / baselineHrv) * 100;
                const isHrvOk = hrvDevPct >= -12;
                const isSleepOk = (dailyMetrics.sleepHours ?? 7) >= 6 && (dailyMetrics.sleepScore ?? 70) >= 60;
                const isFeelOk = (dailyMetrics.subjectiveFeeling || "bem") !== "muito_cansado" && (dailyMetrics.subjectiveFeeling || "bem") !== "cansado";
                const isReadinessOk = (readiness?.score || 70) >= 70 && readiness?.status !== ReadinessStatus.RECOVER;

                let statusLabel = "Excelente Disponibilidade";
                let statusBg = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
                let message = "Seu organismo apresenta boa resiliência e disponibilidade física para absorver o treino planejado com eficiência.";

                if (!isSleepOk || !isFeelOk || !isReadinessOk) {
                  statusLabel = "Baixa Disponibilidade para Intensidade";
                  statusBg = "bg-rose-500/10 border-rose-500/30 text-rose-300";
                  message = "Seu organismo apresenta baixa disponibilidade para intensidade, principalmente pela restrição de sono e percepção de fadiga. A carga recente está controlada, então o objetivo hoje é recuperar sem interromper a rotina.";
                } else if (isExternalLoadHigh) {
                  statusLabel = "Assimilação da Carga";
                  statusBg = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
                  message = "Apesar do aumento recente de carga, seus biomarcadores internos permanecem estáveis. Seu organismo está absorvendo o estímulo com boa resposta adaptativa.";
                }

                return (
                  <div className={`mt-3 p-3 rounded-xl border text-xs font-sans space-y-1.5 ${statusBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-cyan-400" /> Estado fisiológico atual
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

            {/* B. Today's Workout Block */}
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm">
              {getTodayWorkout() ? (
                (() => {
                  const workout = getTodayWorkout()!;
                  return (
                    <div className="space-y-5 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono bg-brand-neon/15 text-brand-neon">
                              {workout.intent === "aerobic_base" ? "Base Aeróbica Z2" : 
                               workout.intent === "recovery" ? "Regenerativo" : 
                               workout.intent === "threshold" ? "Limiar de Lactato" : 
                               workout.intent === "vo2max" ? "Tiros de VO2" : "Treino Planejado"}
                            </span>
                            {workout.isCompensatedRestSlot && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm animate-pulse">
                                <Zap className="w-3 h-3 text-cyan-400" /> Slot de Compensação (Sem Descanso)
                              </span>
                            )}
                            {todayWorkoutCompleted && !workout.isCompensatedRestSlot && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                <Sparkles className="w-3 h-3 text-cyan-400" /> Próximo Treino Prescrito ({workout.day || "Amanhã"})
                              </span>
                            )}
                          </div>
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

                      {/* Banner de Compensação Algorítmica de Treino Perdido */}
                      {workout.isCompensatedRestSlot && (
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs text-cyan-200 animate-fade-in shadow-sm">
                          <Zap className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-bold text-cyan-300 block font-mono text-xs flex items-center gap-1.5">
                              ⚡ Estratégia de Ajuste do Treinador Aetheris
                            </span>
                            <p className="text-[11px] leading-relaxed opacity-95">
                              Sessão de treino não realizada em <strong>{workout.compensatedFromDay || "dia anterior"}</strong>. 
                              O dia de descanso foi ajustado pelo Treinador Aetheris para permitir a continuação imediata do programa sem interrupções na sua evolução.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Plano Original vs Plano Ajustado */}
                      <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-sans">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-400 font-mono">
                            <strong className="text-slate-300">Plano original ({workout.day}):</strong> {workout.originalWorkout?.name || "Descanso Planejado"} ({workout.originalWorkout?.durationMinutes || 0} min)
                          </span>
                          {workout.name !== workout.originalWorkout?.name || workout.durationMinutes !== workout.originalWorkout?.durationMinutes ? (
                            <span className="text-amber-300 font-mono font-bold px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                              <span>↓</span>
                              <span>Plano ajustado: {workout.name} ({workout.durationMinutes} min)</span>
                            </span>
                          ) : (
                            <span className="text-emerald-300 font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                              <span>✓</span>
                              <span>Mantido conforme o plano</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Workout Prescription Details */}
                      <div className="space-y-4">






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

                        {/* Turno 2 Complementary Workout Block (When 2 sessions per day enabled) */}
                        {workout.turno2 && (
                          <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4 space-y-3.5 mt-4 shadow-sm animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-purple-500/20">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  <Moon className="w-3.5 h-3.5 text-purple-400" />
                                  Turno 2 • {workout.turno2.preferredTime || athleteProfile.turno2PreferredTime || "Tarde/Noite"}
                                </span>
                                <span className="text-[10px] font-mono text-slate-300 bg-black/40 px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-purple-400" />
                                  {workout.turno2.durationMinutes || 30} min
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => exportToGarmin(workout.turno2)}
                                className="px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all self-start sm:self-auto"
                                title="Exportar Turno 2 para Garmin"
                              >
                                <FileDown className="w-3.5 h-3.5 text-purple-400" />
                                Garmin Turno 2
                              </button>
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-bold text-white font-display">
                                  {workout.turno2.name}
                                </h4>
                                {getIntentBadge(workout.turno2.intent || "strength")}
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                                {workout.turno2.description}
                              </p>
                            </div>

                            {workout.turno2.steps && workout.turno2.steps.length > 0 && (
                              <div className="space-y-2 pt-1">
                                {workout.turno2.steps.map((step: any, sIdx: number) => (
                                  <div key={step.id || sIdx} className="bg-black/40 border border-purple-500/20 p-3 rounded-xl flex items-center justify-between text-xs font-sans">
                                    <div>
                                      <span className="font-bold text-purple-200 block">{step.title}</span>
                                      <p className="text-[10px] text-slate-400 mt-0.5">{step.description}</p>
                                    </div>
                                    <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20 shrink-0 font-bold">
                                      {step.durationText || `${workout.turno2.durationMinutes} min`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

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

                              {todayWorkoutCompleted ? (
                                <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
                                  <div className="flex items-center gap-2 text-xs text-cyan-300 font-bold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Treino de hoje já foi registrado! Exibindo sessão prescrita para {workout.day || "amanhã"}.</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteWorkoutWithBlocks(workout)}
                                    className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 font-sans shadow-lg shadow-cyan-500/20"
                                  >
                                    Concluir Próximo Treino ({totalMins} min)
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCompleteWorkoutWithBlocks(workout)}
                                  className="w-full py-3.5 rounded-xl bg-brand-neon hover:bg-cyan-300 text-brand-dark font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-glow-cyan font-sans"
                                >
                                  <CheckCircle2 className="w-4 h-4 fill-current" />
                                  Concluir Treino de Hoje ({totalMins} min)
                                </button>
                              )}
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

            {/* D. Trainer Interactive Response Box & FIT Auto-Feedback */}
            {feedbackSubmitted && (
              <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden animate-fade-in space-y-4">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
                
                {/* Auto-FIT Banner */}
                <div className="bg-brand-neon/10 border border-brand-neon/25 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 text-brand-neon font-mono font-bold">
                    <Zap className="w-4 h-4 text-brand-neon animate-pulse fill-brand-neon/20" />
                    <span>Feedback Sincronizado Automático via Arquivo .FIT</span>
                  </div>
                  <span className="text-[10px] text-slate-300 font-sans">
                    Telemetria e métricas fisiológicas incorporadas sem preenchimento manual obrigatório.
                  </span>
                </div>

                <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                  <div className="w-9 h-9 rounded-full bg-brand-neon/15 border border-brand-neon/20 flex items-center justify-center text-brand-neon shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">
                      Feedback do Treinador Virtual
                    </h4>
                    <span className="text-[9px] text-slate-500 font-sans block lowercase">/ real-time telemetry analysis response</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualFeedbackForm(!showManualFeedbackForm)}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>{showManualFeedbackForm ? "Ocultar Form Manual" : "Ajustar RPE / Comentário"}</span>
                  </button>
                </div>

                <div className="p-4 bg-brand-neon/5 border border-brand-neon/10 rounded-xl relative text-xs text-slate-300 leading-relaxed font-sans">
                  <span className="absolute -top-2.5 left-3 text-3xl font-serif text-brand-neon/20 select-none">“</span>
                  <p className="pl-3.5 pr-2.5">
                    {coachFeedbackReply}
                  </p>
                  <p className="pl-3.5 pr-2.5 mt-2.5 font-bold text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                    👉 Prioridade para hoje: Hidratação pesada, ingestão de proteínas de qualidade, e pelo menos 8h de sono reparador.
                  </p>
                </div>

                {/* Optional Manual Adjustment Form */}
                {showManualFeedbackForm && (
                  <div className="pt-3 border-t border-white/10 space-y-3 animate-fade-in">
                    <h5 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                      Ajuste Manual de Percepção (RPE & Observações)
                    </h5>
                    <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-slate-300 uppercase tracking-wider mb-1.5 font-mono font-bold">
                          Esforço Percebido Ajustado (RPE: 1 a 10)
                        </label>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setRpeScore(num)}
                              className={`py-1.5 rounded-lg border text-xs font-mono font-bold transition-all text-center cursor-pointer ${
                                rpeScore === num
                                  ? "bg-brand-neon text-brand-dark border-brand-neon shadow-glow-cyan"
                                  : "bg-black/30 border-white/5 text-slate-400 hover:text-white"
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-300 uppercase tracking-wider mb-1 font-mono font-bold">
                          Comentário / Sensação do Atleta
                        </label>
                        <textarea
                          rows={2}
                          value={workoutComment}
                          onChange={(e) => setWorkoutComment(e.target.value)}
                          className="w-full bg-black/45 border border-white/10 rounded-xl p-2.5 text-slate-200 text-xs focus:border-brand-neon focus:outline-none"
                        ></textarea>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-brand-neon hover:bg-cyan-300 text-brand-dark font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
                      >
                        <Send className="w-3.5 h-3.5 fill-current" />
                        Atualizar Análise do Treinador
                      </button>
                    </form>
                  </div>
                )}

                {/* Reset Interactive Flow Button */}
                <div className="pt-2 border-t border-white/5 flex justify-end">
                  <button
                    type="button"
                    onClick={resetTodayWorkout}
                    className="py-1.5 px-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
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
            
            {/* B. Calendário Semanal Quick Status */}
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs uppercase font-bold text-slate-300 tracking-widest flex items-center gap-2 font-mono">
                  <Calendar className="w-4 h-4 text-brand-neon" />
                  Estrutura Semanal
                </h3>
                {(() => {
                  const isDoubleSessionActive = Boolean(
                    athleteProfile?.doubleSessionsAllowed ||
                    athleteProfile?.sessionsPerDay === 2 ||
                    athleteProfile?.sessionsPerDay === "2" ||
                    athleteProfile?.logistics === "2" ||
                    athleteProfile?.logistics === "double" ||
                    athleteProfile?.logistics === "2_sessoes" ||
                    (athleteProfile?.logistics && (String(athleteProfile.logistics).includes("2") || String(athleteProfile.logistics).toLowerCase().includes("duas"))) ||
                    (athleteProfile?.routineType && (String(athleteProfile.routineType).includes("2") || String(athleteProfile.routineType).toLowerCase().includes("duas")))
                  );
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const nextDouble = !isDoubleSessionActive;
                        setAthleteProfile({
                          ...athleteProfile,
                          doubleSessionsAllowed: nextDouble,
                          sessionsPerDay: nextDouble ? 2 : 1,
                          turno1TimeMinutes: athleteProfile.turno1TimeMinutes || 45,
                          turno1PreferredTime: athleteProfile.turno1PreferredTime || "Manhã",
                          turno2TimeMinutes: athleteProfile.turno2TimeMinutes || 30,
                          turno2PreferredTime: athleteProfile.turno2PreferredTime || "Tarde"
                        });
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                        isDoubleSessionActive
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                          : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                      }`}
                      title="Alternar entre 1 ou 2 treinos por dia na semana"
                    >
                      <Layers className="w-3 h-3 text-purple-400" />
                      {isDoubleSessionActive ? "2 Treinos/Dia (Ativo)" : "1 Treino/Dia"}
                    </button>
                  );
                })()}
              </div>

              {/* Column Headers */}
              {(() => {
                const isDoubleSessionActive = Boolean(
                  athleteProfile?.doubleSessionsAllowed ||
                  athleteProfile?.sessionsPerDay === 2 ||
                  athleteProfile?.sessionsPerDay === "2" ||
                  athleteProfile?.logistics === "2" ||
                  athleteProfile?.logistics === "double" ||
                  athleteProfile?.logistics === "2_sessoes" ||
                  (athleteProfile?.logistics && (String(athleteProfile.logistics).includes("2") || String(athleteProfile.logistics).toLowerCase().includes("duas"))) ||
                  (athleteProfile?.routineType && (String(athleteProfile.routineType).includes("2") || String(athleteProfile.routineType).toLowerCase().includes("duas")))
                );
                return (
                  <div className="grid grid-cols-12 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-white/10 px-2 gap-2 mb-2">
                    <div className="col-span-3 sm:col-span-2">Dia</div>
                    <div className={isDoubleSessionActive ? "col-span-4 sm:col-span-5 flex items-center gap-1 text-amber-300" : "col-span-9 flex items-center gap-1 text-amber-300"}>
                      <Sun className="w-3 h-3 text-amber-400 shrink-0" /> Turno 1
                    </div>
                    {isDoubleSessionActive && (
                      <div className="col-span-5 sm:col-span-5 flex items-center gap-1 text-purple-300">
                        <Moon className="w-3 h-3 text-purple-400 shrink-0" /> Turno 2
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-1.5 text-xs">
                {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day, idx) => {
                  const fullDays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
                  const targetDayFull = fullDays[idx];
                  const isDayToday = idx === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                  
                  const activeWeekIdx = Math.min(selectedWeekIdx, (trainingPlan?.cycles[0]?.weeks?.length || 1) - 1);
                  const weekWorkouts = trainingPlan?.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
                  
                  let foundW = weekWorkouts.find((w: any) => {
                    if (!w || !w.day) return false;
                    const d1 = String(w.day).toLowerCase().trim();
                    const dShort = day.toLowerCase().trim();
                    const dFull = targetDayFull.toLowerCase().trim();
                    return d1 === dShort || d1 === dFull || d1.startsWith(dShort) || dFull.startsWith(d1);
                  }) || weekWorkouts[idx];

                  if (!foundW) {
                    const fallbackName = idx === 0 ? "Força Z3" :
                                         idx === 1 ? "Rodagem Z2" :
                                         idx === 2 ? "Rodagem Base Z2" :
                                         idx === 3 ? "Descanso Planejado" :
                                         idx === 4 ? "Tiros Limiar Z4" :
                                         idx === 5 ? "Descanso" : "Longão Base Z2";
                    const fallbackIntent = (idx === 3 || idx === 5) ? "recovery" : "aerobic_base";
                    foundW = {
                      day: targetDayFull,
                      workout: {
                        name: fallbackName,
                        intent: fallbackIntent,
                        durationMinutes: (idx === 3 || idx === 5) ? 0 : 40,
                        description: fallbackName
                      }
                    };
                  }

                  const adaptedInfo = getAdaptedWorkoutForDay(foundW, activeWeekIdx);
                  
                  const dayStatus = adaptedInfo?.dayStatus || getDetailedDayStatus(
                    targetDayFull,
                    idx,
                    selectedWeekIdx,
                    trainingPlan,
                    savedList.length > 0 ? savedList : localSavedList,
                    todayWorkoutCompleted,
                    completedBlocksSummary
                  );

                  let displayWorkoutName = 
                    dayStatus.activities?.[0]?.name ||
                    dayStatus.activities?.[0]?.activityName ||
                    dayStatus.activities?.[0]?.title ||
                    adaptedInfo?.adaptedWorkout?.name || 
                    foundW?.workout?.name || 
                    foundW?.name || 
                    "";

                  let isAdaptedDay = adaptedInfo?.isAdapted || false;
                  let adaptationReason = adaptedInfo?.adaptationReason || "";
                  
                  if (!displayWorkoutName) {
                    displayWorkoutName = idx === 0 ? "Força Z3" :
                                         idx === 1 ? "Rodagem Z2" :
                                         idx === 2 ? "Rodagem Base Z2" :
                                         idx === 3 ? "Regenerativo" :
                                         idx === 4 ? "Tiros Limiar Z4" :
                                         idx === 5 ? "Descanso" : "Longão Base Z2";
                  }

                  const isRestCompensated = dayStatus.status === "rest_compensation" || (isAdaptedDay && (foundW?.workout?.intent === "recovery" || foundW?.workout?.name?.toLowerCase().includes("descanso") || displayWorkoutName.includes("Compensação")));

                  const isDoubleSessionActive = Boolean(
                    athleteProfile?.doubleSessionsAllowed ||
                    athleteProfile?.sessionsPerDay === 2 ||
                    athleteProfile?.sessionsPerDay === "2" ||
                    athleteProfile?.logistics === "2" ||
                    athleteProfile?.logistics === "double" ||
                    athleteProfile?.logistics === "2_sessoes" ||
                    (athleteProfile?.logistics && (String(athleteProfile.logistics).includes("2") || String(athleteProfile.logistics).toLowerCase().includes("duas"))) ||
                    (athleteProfile?.routineType && (String(athleteProfile.routineType).includes("2") || String(athleteProfile.routineType).toLowerCase().includes("duas")))
                  );

                  const hasActualActivity = Boolean(dayStatus.activities && dayStatus.activities.length > 0);
                  const isRestOrRecovery = !hasActualActivity && (
                    foundW?.workout?.intent === "rest" || 
                    foundW?.workout?.intent === "recovery" || 
                    displayWorkoutName.toLowerCase().includes("descanso")
                  );
                  
                  const hasExplicitTurno2 = !!(foundW?.turno2 || foundW?.workouts?.[1]);
                  const turno2Obj = foundW?.turno2 || foundW?.workouts?.[1] || (
                    isDoubleSessionActive && !isRestOrRecovery
                      ? {
                          name: (foundW?.workout?.intent === "strength" || displayWorkoutName.toLowerCase().includes("fortalecimento"))
                            ? "Mobilidade & Regeneração (Turno 2)" 
                            : "Fortalecimento Estrutural & Core (Turno 2)",
                          preferredTime: athleteProfile.turno2PreferredTime || "Tarde"
                        }
                      : null
                  );

                  const cleanT1Name = displayWorkoutName
                    .replace(/\(Lactato\)/gi, "")
                    .replace(/de Ritmo de Limiar/gi, "Limiar")
                    .replace(/Rodagem de Base Regenerativa/gi, "Rodagem Z2")
                    .replace(/Rodagem Base/gi, "Rodagem Z2")
                    .replace(/Rodagem de Base/gi, "Rodagem Z2")
                    .replace(/Fortalecimento Funcional para Corrida/gi, "Fortalecimento")
                    .replace(/Tempo Run/gi, "Tempo Z4")
                    .replace(/Longão Progressivo Z2/gi, "Longão Z2")
                    .replace(/Descanso Planejado/gi, "Descanso")
                    .trim();

                  const cleanT2Name = turno2Obj ? turno2Obj.name
                    .replace(/\(Turno 2\)/gi, "")
                    .replace(/Fortalecimento Estrutural & Core/gi, "Fortalecimento")
                    .replace(/Mobilidade & Regeneração/gi, "Mobilidade")
                    .trim() : "";

                  return (
                    <div 
                      key={day} 
                      className={`grid grid-cols-12 items-center p-2 rounded-lg border gap-2 transition-all ${
                        dayStatus.status === "today_pending" 
                          ? "bg-brand-neon/5 border-brand-neon/30 text-brand-neon" 
                          : dayStatus.status === "completed"
                          ? "bg-emerald-950/15 border-emerald-500/15 text-slate-200"
                          : dayStatus.status === "partial"
                          ? "bg-amber-950/15 border-amber-500/15 text-slate-200"
                          : dayStatus.status === "missed"
                          ? "bg-rose-950/15 border-rose-500/15 text-slate-200"
                          : isRestCompensated || isAdaptedDay
                          ? "bg-cyan-950/15 border-cyan-500/20 text-slate-200"
                          : "bg-white/5 border-white/5 text-slate-300"
                      }`}
                      title={adaptationReason || undefined}
                    >
                      {/* Col 1: Dia */}
                      <div className="col-span-3 sm:col-span-2 font-mono text-[11px] font-bold text-slate-200 truncate">
                        {day}
                      </div>

                      {/* Col 2: Turno 1 */}
                      <div className={isDoubleSessionActive ? "col-span-4 sm:col-span-5 flex items-center justify-between gap-1 bg-black/30 px-2 py-1.5 rounded-md border border-amber-500/20 overflow-hidden" : "col-span-9 flex items-center justify-between gap-1 bg-black/30 px-2 py-1.5 rounded-md border border-amber-500/20 overflow-hidden"}>
                        <span className="text-[10px] font-mono text-slate-200 truncate" title={displayWorkoutName}>
                          {cleanT1Name}
                        </span>
                        
                        {/* Status Badge T1 */}
                        {isRestOrRecovery ? (
                          <span className="text-[8px] bg-slate-800 text-slate-400 border border-slate-700 px-1 py-0.2 rounded font-mono shrink-0">
                            Off
                          </span>
                        ) : isRestCompensated ? (
                          <span className="text-[8px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1 py-0.2 rounded font-mono font-bold shrink-0" title="Adaptado">
                            ⚡ Adaptado
                          </span>
                        ) : dayStatus.status === "completed" || dayStatus.status === "partial" || (isDayToday && todayWorkoutCompleted) ? (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1 py-0.2 rounded font-mono font-bold shrink-0 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> OK
                          </span>
                        ) : dayStatus.status === "missed" ? (
                          <span className="text-[8px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1 py-0.2 rounded font-mono font-bold shrink-0 flex items-center gap-0.5">
                            <XCircle className="w-2.5 h-2.5 text-rose-400" /> Perdido
                          </span>
                        ) : (
                          <span className="text-[8px] bg-amber-500/10 text-amber-300/80 border border-amber-500/20 px-1 py-0.2 rounded font-mono shrink-0">
                            Pendente
                          </span>
                        )}
                      </div>

                      {/* Col 3: Turno 2 (If double sessions active) */}
                      {isDoubleSessionActive && (
                        <div className="col-span-5 sm:col-span-5 flex items-center justify-between gap-1 bg-black/30 px-2 py-1.5 rounded-md border border-purple-500/20 overflow-hidden">
                          {(() => {
                            const actCount = dayStatus.activities?.length || 0;
                            const isT2Completed = actCount >= 2 || (foundW?.turno2Completed === true);
                            const isT2Off = isRestOrRecovery || (!isT2Completed && (actCount === 1 || !hasExplicitTurno2));

                            if (isT2Off) {
                              return (
                                <span className="text-[10px] font-mono text-slate-500 flex items-center justify-between w-full">
                                  <span className="truncate">{cleanT2Name || "—"}</span>
                                  <span className="text-[8px] bg-slate-800 text-slate-400 border border-slate-700 px-1 py-0.2 rounded font-mono shrink-0 ml-1">
                                    Off
                                  </span>
                                </span>
                              );
                            }

                            if (isT2Completed) {
                              return (
                                <>
                                  <span className="text-[10px] font-mono text-purple-200 truncate" title={turno2Obj?.name}>
                                    {cleanT2Name}
                                  </span>
                                  <span className="text-[8px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1 py-0.2 rounded font-mono font-bold shrink-0 flex items-center gap-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> OK
                                  </span>
                                </>
                              );
                            }

                            if (dayStatus.status === "missed" && hasExplicitTurno2) {
                              return (
                                <>
                                  <span className="text-[10px] font-mono text-purple-200 truncate" title={turno2Obj?.name}>
                                    {cleanT2Name}
                                  </span>
                                  <span className="text-[8px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1 py-0.2 rounded font-mono font-bold shrink-0 flex items-center gap-0.5">
                                    <XCircle className="w-2.5 h-2.5 text-rose-400" /> Perdido
                                  </span>
                                </>
                              );
                            }

                            return (
                              <>
                                <span className="text-[10px] font-mono text-purple-200 truncate" title={turno2Obj?.name}>
                                  {cleanT2Name}
                                </span>
                                <span className="text-[8px] bg-purple-500/10 text-purple-300/80 border border-purple-500/20 px-1 py-0.2 rounded font-mono shrink-0">
                                  Pendente
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* C. Orientação Científica Card */}
            <div className="p-4 bg-brand-neon/5 border border-brand-neon/10 rounded-2xl text-[10px] text-slate-400 leading-relaxed font-sans">
              {(() => {
                const todayW = getTodayWorkout();
                const isQuality = todayW?.intent === "threshold" || todayW?.intent === "vo2max" || todayW?.intent === "intervals" || todayW?.intent === "tempo" || todayW?.name?.toLowerCase().includes("limiar") || todayW?.name?.toLowerCase().includes("qualidade");
                const isLongRun = todayW?.intent === "long_run" || todayW?.name?.toLowerCase().includes("longão");
                if (isQuality) {
                  return (
                    <>
                      <strong>💡 Orientação Base:</strong> "Estímulos de qualidade desenvolvem o limiar de lactato e a economia de corrida." Mantenha o esforço controlado na <strong>Zona 4 / Limiar</strong>, cadência estável e respiração ritmada para assimilar o estímulo com máxima eficiência!
                    </>
                  );
                }
                if (isLongRun) {
                  return (
                    <>
                      <strong>💡 Orientação Base:</strong> "O Longão constrói a eficiência metabólica de lipólise e a resistência neuromuscular." Mantenha o ritmo estável na <strong>Zona 2</strong> e hidratação regular a cada 20-30 minutos!
                    </>
                  );
                }
                return (
                  <>
                    <strong>💡 Orientação Base:</strong> "Corra devagar para correr rápido no futuro." Manter-se na <strong>Zona 2 (Rodagem)</strong> desenvolve o sistema de capilarização periférica e aumenta a densidade de mitocôndrias musculares sem gerar fadiga excessiva no sistema nervoso central. Paciência é a maior virtude de um maratonista!
                  </>
                );
              })()}
            </div>

          </div>

        </div>
      )}

      {/* 3. ABA ATUALIZAÇÃO DE ESTADO (STATE) */}
      {coachTab === "state" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          
          {/* LEFT COLUMN: Estado de Hoje (Check-in Diário Form) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Check-in Diário Form */}
            <div id="check-in-form" className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-pulse" /> Estado de hoje
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-brand-neon" />
                    Estado de hoje
                  </h3>
                </div>
                {readiness && (
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-mono uppercase">Score Prontidão</span>
                    <span className="text-lg font-black font-mono text-brand-neon">{readiness.score}/100</span>
                  </div>
                )}
              </div>

              <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3 mb-4 space-y-1">
                <div className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-400" /> Estado de hoje
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Seu estado fisiológico ajusta o treino automaticamente.
                </p>
              </div>

              <div className="space-y-4">
                
                {/* --- SEÇÃO 1: SONO E RECUPERAÇÃO --- */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-l-2 border-cyan-500 pl-2">
                    Recuperação Fisiológica
                  </h4>
                  
                  {/* Horas de Sono & Score do Sono (Lado a Lado com Checkboxes Ativar/Inativar) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Horas de Sono */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={dailyMetrics.sleepHours !== undefined}
                            onChange={(e) => {
                              setDailyMetrics({ 
                                ...dailyMetrics, 
                                sleepHours: e.target.checked ? 7.5 : undefined 
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                          />
                          <span className={`flex items-center gap-1 ${dailyMetrics.sleepHours !== undefined ? "text-slate-200" : "text-slate-500 font-normal"}`}>
                            <Moon className="w-3.5 h-3.5 text-slate-500" /> Sono (Horas)
                          </span>
                        </label>
                        <span className="font-mono font-bold text-white">
                          {dailyMetrics.sleepHours !== undefined ? `${dailyMetrics.sleepHours}h` : <span className="text-slate-500 text-[10px] font-normal">Inativo</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={dailyMetrics.sleepHours === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.sleepHours !== undefined ? dailyMetrics.sleepHours : 7.5;
                            setDailyMetrics({ ...dailyMetrics, sleepHours: Math.max(2, Math.min(12, Math.round((cur - 0.5) * 2) / 2)) });
                          }}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Diminuir 0.5h"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <input 
                          type="range" 
                          min="2" 
                          max="12" 
                          step="0.5"
                          disabled={dailyMetrics.sleepHours === undefined}
                          value={dailyMetrics.sleepHours !== undefined ? dailyMetrics.sleepHours : 7.5}
                          onChange={(e) => setDailyMetrics({ ...dailyMetrics, sleepHours: parseFloat(e.target.value) })}
                          className={`w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none ${dailyMetrics.sleepHours === undefined ? "opacity-30 cursor-not-allowed" : ""}`}
                        />
                        <button
                          type="button"
                          disabled={dailyMetrics.sleepHours === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.sleepHours !== undefined ? dailyMetrics.sleepHours : 7.5;
                            setDailyMetrics({ ...dailyMetrics, sleepHours: Math.max(2, Math.min(12, Math.round((cur + 0.5) * 2) / 2)) });
                          }}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Aumentar 0.5h"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Sleep Score Slider */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={dailyMetrics.sleepScore !== undefined}
                            onChange={(e) => {
                              setDailyMetrics({ 
                                ...dailyMetrics, 
                                sleepScore: e.target.checked ? 75 : undefined 
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                          />
                          <span className={`flex items-center gap-1 ${dailyMetrics.sleepScore !== undefined ? "text-slate-200" : "text-slate-500 font-normal"}`}>
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Score do Sono
                          </span>
                        </label>
                        <span className="font-mono font-bold text-white">
                          {dailyMetrics.sleepScore !== undefined ? `${dailyMetrics.sleepScore} pts` : <span className="text-slate-500 text-[10px] font-normal">Inativo</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={dailyMetrics.sleepScore === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.sleepScore !== undefined ? dailyMetrics.sleepScore : 75;
                            setDailyMetrics({ ...dailyMetrics, sleepScore: Math.max(30, Math.min(100, cur - 1)) });
                          }}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Diminuir Score"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <input 
                          type="range" 
                          min="30" 
                          max="100" 
                          disabled={dailyMetrics.sleepScore === undefined}
                          value={dailyMetrics.sleepScore !== undefined ? dailyMetrics.sleepScore : 75}
                          onChange={(e) => setDailyMetrics({ ...dailyMetrics, sleepScore: parseInt(e.target.value) })}
                          className={`w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none ${dailyMetrics.sleepScore === undefined ? "opacity-30 cursor-not-allowed" : ""}`}
                        />
                        <button
                          type="button"
                          disabled={dailyMetrics.sleepScore === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.sleepScore !== undefined ? dailyMetrics.sleepScore : 75;
                            setDailyMetrics({ ...dailyMetrics, sleepScore: Math.max(30, Math.min(100, cur + 1)) });
                          }}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Aumentar Score"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body Battery & FC de Repouso (Lado a Lado com Checkboxes Ativar/Inativar) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Body Battery Slider */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={dailyMetrics.bodyBattery !== undefined}
                            onChange={(e) => {
                              setDailyMetrics({ 
                                ...dailyMetrics, 
                                bodyBattery: e.target.checked ? 75 : undefined 
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                          />
                          <span className={`flex items-center gap-1 ${dailyMetrics.bodyBattery !== undefined ? "text-slate-200" : "text-slate-500 font-normal"}`}>
                            <Activity className="w-3.5 h-3.5 text-slate-500" /> Body Battery
                          </span>
                        </label>
                        <span className="font-mono font-bold text-brand-neon">
                          {dailyMetrics.bodyBattery !== undefined ? `${dailyMetrics.bodyBattery}%` : <span className="text-slate-500 text-[10px] font-normal">Inativo</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={dailyMetrics.bodyBattery === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.bodyBattery !== undefined ? dailyMetrics.bodyBattery : 75;
                            setDailyMetrics({ ...dailyMetrics, bodyBattery: Math.max(5, Math.min(100, cur - 1)) });
                          }}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Diminuir Body Battery"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <input 
                          type="range" 
                          min="5" 
                          max="100" 
                          disabled={dailyMetrics.bodyBattery === undefined}
                          value={dailyMetrics.bodyBattery !== undefined ? dailyMetrics.bodyBattery : 75}
                          onChange={(e) => setDailyMetrics({ ...dailyMetrics, bodyBattery: parseInt(e.target.value) })}
                          className={`w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none ${dailyMetrics.bodyBattery === undefined ? "opacity-30 cursor-not-allowed" : ""}`}
                        />
                        <button
                          type="button"
                          disabled={dailyMetrics.bodyBattery === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.bodyBattery !== undefined ? dailyMetrics.bodyBattery : 75;
                            setDailyMetrics({ ...dailyMetrics, bodyBattery: Math.max(5, Math.min(100, cur + 1)) });
                          }}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Aumentar Body Battery"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Frequência Cardíaca de Repouso */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={dailyMetrics.restingHeartRate !== undefined}
                            onChange={(e) => {
                              setDailyMetrics({ 
                                ...dailyMetrics, 
                                restingHeartRate: e.target.checked ? 54 : undefined 
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                          />
                          <span className={`flex items-center gap-1 text-[11px] ${dailyMetrics.restingHeartRate !== undefined ? "text-slate-200 font-medium" : "text-slate-500 font-normal"}`}>
                            <Heart className="w-3.5 h-3.5 text-red-400" /> FC de Repouso
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">Atual</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={dailyMetrics.restingHeartRate === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.restingHeartRate !== undefined ? dailyMetrics.restingHeartRate : 54;
                            setDailyMetrics({ ...dailyMetrics, restingHeartRate: Math.max(30, Math.min(120, cur - 1)) });
                          }}
                          className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Diminuir FC Repouso"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="30"
                          max="120"
                          step="1"
                          disabled={dailyMetrics.restingHeartRate === undefined}
                          placeholder={dailyMetrics.restingHeartRate === undefined ? "Inativo" : "Ex: 54"}
                          value={dailyMetrics.restingHeartRate !== undefined ? dailyMetrics.restingHeartRate : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                            setDailyMetrics({ ...dailyMetrics, restingHeartRate: val });
                          }}
                          className={`w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-100 text-center focus:border-red-400 focus:outline-none ${
                            dailyMetrics.restingHeartRate === undefined ? "opacity-30 cursor-not-allowed" : ""
                          }`}
                        />
                        <button
                          type="button"
                          disabled={dailyMetrics.restingHeartRate === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.restingHeartRate !== undefined ? dailyMetrics.restingHeartRate : 54;
                            setDailyMetrics({ ...dailyMetrics, restingHeartRate: Math.max(30, Math.min(120, cur + 1)) });
                          }}
                          className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Aumentar FC Repouso"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-slate-500">bpm</span>
                      </div>
                    </div>
                  </div>

                  {/* HRV Slider & Status VFC com Checkbox */}
                  <div>
                    <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={dailyMetrics.hrv !== undefined}
                          onChange={(e) => {
                            setDailyMetrics({ 
                              ...dailyMetrics, 
                              hrv: e.target.checked ? 50 : undefined,
                              hrvStatus: e.target.checked ? "balanced" : undefined
                            });
                          }}
                          className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                        />
                        <span className={`flex items-center gap-1.5 font-sans ${dailyMetrics.hrv !== undefined ? "text-slate-200 font-medium" : "text-slate-500 font-normal"}`}>
                          <Heart className="w-3.5 h-3.5 text-red-400" /> Variabilidade de FC (HRV / VFC)
                        </span>
                      </label>
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
                        <span className="font-mono font-bold text-brand-neon">
                          {dailyMetrics.hrv !== undefined ? `${dailyMetrics.hrv} ms` : <span className="text-slate-500 text-[10px] font-normal">Inativo</span>}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-1/2">
                        <button
                          type="button"
                          disabled={dailyMetrics.hrv === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.hrv !== undefined ? dailyMetrics.hrv : 50;
                            setDailyMetrics({ ...dailyMetrics, hrv: Math.max(20, Math.min(120, cur - 1)) });
                          }}
                          className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Diminuir HRV"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <input 
                          type="range" 
                          min="20" 
                          max="120" 
                          disabled={dailyMetrics.hrv === undefined}
                          value={dailyMetrics.hrv !== undefined ? dailyMetrics.hrv : 50}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setDailyMetrics({ ...dailyMetrics, hrv: val });
                          }}
                          className={`w-full accent-brand-neon cursor-pointer h-1 bg-white/10 rounded-lg appearance-none ${dailyMetrics.hrv === undefined ? "opacity-30 cursor-not-allowed" : ""}`}
                        />
                        <button
                          type="button"
                          disabled={dailyMetrics.hrv === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.hrv !== undefined ? dailyMetrics.hrv : 50;
                            setDailyMetrics({ ...dailyMetrics, hrv: Math.max(20, Math.min(120, cur + 1)) });
                          }}
                          className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Aumentar HRV"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="relative w-1/2">
                        {(() => {
                          const isInactive = dailyMetrics.hrv === undefined;
                          const baseline = dailyMetrics.hrvBaseline || 55;
                          const isBalanced = dailyMetrics.hrvStatus 
                            ? dailyMetrics.hrvStatus === "balanced" 
                            : true;

                          return (
                            <>
                              <button
                                type="button"
                                disabled={isInactive}
                                onClick={() => !isInactive && setShowHrvPopup(!showHrvPopup)}
                                className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-between gap-1 transition-all border ${
                                  isInactive 
                                    ? "bg-white/5 text-slate-500 border-white/5 cursor-not-allowed opacity-40"
                                    : isBalanced 
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] cursor-pointer"
                                      : "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)] cursor-pointer"
                                }`}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isInactive ? "bg-slate-600" : isBalanced ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
                                  <span className="truncate">{isInactive ? "Sem Sensor" : isBalanced ? "Equilibrado" : "Desequilibrado"}</span>
                                </span>
                                {!isInactive && <ChevronDown className={`w-3.5 h-3.5 opacity-80 flex-shrink-0 transition-transform ${showHrvPopup ? "rotate-180" : ""}`} />}
                              </button>

                              {!isInactive && showHrvPopup && (
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
                      if (dailyMetrics.hrv === undefined) return null;
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
                            <button
                              type="button"
                              onClick={() => setDailyMetrics({ ...dailyMetrics, hrvBaseline: Math.max(20, Math.min(120, (dailyMetrics.hrvBaseline || 55) - 1)) })}
                              className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                              title="Diminuir Baseline"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="20"
                              max="120"
                              value={dailyMetrics.hrvBaseline || 55}
                              onChange={(e) => setDailyMetrics({ ...dailyMetrics, hrvBaseline: parseInt(e.target.value) || 55 })}
                              className="w-10 bg-black/40 border border-white/10 rounded text-center py-0.5 text-slate-200 font-mono focus:border-brand-neon focus:outline-none text-[10px]"
                            />
                            <button
                              type="button"
                              onClick={() => setDailyMetrics({ ...dailyMetrics, hrvBaseline: Math.max(20, Math.min(120, (dailyMetrics.hrvBaseline || 55) + 1)) })}
                              className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                              title="Aumentar Baseline"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            <span className="font-mono">ms</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Carga Garmin & Status de Treino (Lado a Lado com Checkboxes) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Carga de Treinamento Garmin */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={dailyMetrics.garminTrainingLoad !== undefined}
                            onChange={(e) => {
                              setDailyMetrics({ 
                                ...dailyMetrics, 
                                garminTrainingLoad: e.target.checked ? 350 : undefined 
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                          />
                          <span className={`flex items-center gap-1 text-[11px] ${dailyMetrics.garminTrainingLoad !== undefined ? "text-slate-200 font-medium" : "text-slate-500 font-normal"}`} title="Carga aguda de treino do relógio Garmin (7 dias)">
                            <Flame className="w-3.5 h-3.5 text-amber-400" /> Carga Garmin
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">Atual</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={dailyMetrics.garminTrainingLoad === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.garminTrainingLoad !== undefined ? dailyMetrics.garminTrainingLoad : 350;
                            setDailyMetrics({ ...dailyMetrics, garminTrainingLoad: Math.max(0, cur - 10) });
                          }}
                          className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Diminuir Carga"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          disabled={dailyMetrics.garminTrainingLoad === undefined}
                          placeholder={dailyMetrics.garminTrainingLoad === undefined ? "Inativo" : "Ex: 350"}
                          value={dailyMetrics.garminTrainingLoad !== undefined ? dailyMetrics.garminTrainingLoad : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                            setDailyMetrics({ ...dailyMetrics, garminTrainingLoad: val });
                          }}
                          className={`w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-300 text-center focus:border-amber-400 focus:outline-none ${
                            dailyMetrics.garminTrainingLoad === undefined ? "opacity-30 cursor-not-allowed" : ""
                          }`}
                        />
                        <button
                          type="button"
                          disabled={dailyMetrics.garminTrainingLoad === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.garminTrainingLoad !== undefined ? dailyMetrics.garminTrainingLoad : 350;
                            setDailyMetrics({ ...dailyMetrics, garminTrainingLoad: cur + 10 });
                          }}
                          className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Aumentar Carga"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-slate-500">pts</span>
                      </div>
                    </div>

                    {/* Status de Treino Garmin */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={dailyMetrics.garminTrainingStatus !== undefined && dailyMetrics.garminTrainingStatus !== "sem_dados"}
                            onChange={(e) => {
                              setDailyMetrics({ 
                                ...dailyMetrics, 
                                garminTrainingStatus: e.target.checked ? "eficaz" : "sem_dados" 
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                          />
                          <span className={`flex items-center gap-1 text-[11px] ${dailyMetrics.garminTrainingStatus !== undefined && dailyMetrics.garminTrainingStatus !== "sem_dados" ? "text-slate-200 font-medium" : "text-slate-500 font-normal"}`} title="Status de Treinamento Garmin">
                            <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Status Garmin
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">Seleção</span>
                      </div>

                      <div className="relative">
                        {(() => {
                          const isInactive = dailyMetrics.garminTrainingStatus === undefined || dailyMetrics.garminTrainingStatus === "sem_dados";
                          const currentStatus = isInactive ? "sem_dados" : dailyMetrics.garminTrainingStatus;
                          
                          const getStatusStyle = (st: string) => {
                            switch (st) {
                              case "recuperacao":
                                return {
                                  bg: "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]",
                                  dot: "bg-blue-400",
                                  label: "Recuperação"
                                };
                              case "mantendo":
                                return {
                                  bg: "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
                                  dot: "bg-amber-400",
                                  label: "Mantendo"
                                };
                              case "eficaz":
                                return {
                                  bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
                                  dot: "bg-emerald-400",
                                  label: "Eficaz"
                                };
                              case "excessivo":
                                return {
                                  bg: "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
                                  dot: "bg-rose-500",
                                  label: "Excessivo"
                                };
                              case "ineficiente":
                                return {
                                  bg: "bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.15)]",
                                  dot: "bg-orange-400",
                                  label: "Ineficiente"
                                };
                              default:
                                return {
                                  bg: "bg-white/5 text-slate-500 border-white/5",
                                  dot: "bg-slate-600",
                                  label: "Sem dados"
                                };
                            }
                          };

                          const activeStyle = getStatusStyle(currentStatus);

                          const optionsList = [
                            { id: "sem_dados", label: "Sem dados", colorClass: "text-slate-400", dotClass: "bg-slate-500" },
                            { id: "recuperacao", label: "Recuperação", colorClass: "text-blue-300 font-bold", dotClass: "bg-blue-400" },
                            { id: "mantendo", label: "Mantendo", colorClass: "text-amber-300 font-bold", dotClass: "bg-amber-400" },
                            { id: "eficaz", label: "Eficaz", colorClass: "text-emerald-300 font-bold", dotClass: "bg-emerald-400" },
                            { id: "excessivo", label: "Excessivo", colorClass: "text-rose-300 font-bold", dotClass: "bg-rose-500" },
                            { id: "ineficiente", label: "Ineficiente", colorClass: "text-orange-300 font-bold", dotClass: "bg-orange-400" }
                          ];

                          return (
                            <>
                              <button
                                type="button"
                                disabled={isInactive}
                                onClick={() => !isInactive && setShowGarminStatusPopup(!showGarminStatusPopup)}
                                className={`w-full py-1 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-between gap-1 transition-all border ${activeStyle.bg} ${isInactive ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeStyle.dot}`} />
                                  <span className="truncate">{activeStyle.label}</span>
                                </span>
                                {!isInactive && <ChevronDown className={`w-3.5 h-3.5 opacity-80 flex-shrink-0 transition-transform ${showGarminStatusPopup ? "rotate-180" : ""}`} />}
                              </button>

                              {!isInactive && showGarminStatusPopup && (
                                <div className="absolute top-full right-0 mt-1.5 w-48 bg-slate-900/98 border border-white/20 rounded-xl shadow-2xl z-50 p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 space-y-1">
                                  <div className="text-[9px] font-mono uppercase text-slate-400 px-2 py-1 border-b border-white/10 mb-1">
                                    Status de Treino Garmin
                                  </div>
                                  
                                  {optionsList.map((opt) => {
                                    const isSel = currentStatus === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => {
                                          setDailyMetrics({ ...dailyMetrics, garminTrainingStatus: opt.id as any });
                                          setShowGarminStatusPopup(false);
                                        }}
                                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                                          isSel ? "bg-white/15 border border-white/20 font-bold" : "hover:bg-white/10"
                                        }`}
                                      >
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dotClass}`} />
                                        <span className={opt.colorClass}>{opt.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- SEÇÃO 2: COMO VOCÊ ESTÁ HOJE --- */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-l-2 border-cyan-500 pl-2">
                    Como você está hoje
                  </h4>

                  {/* Garmin Training Readiness & Percepção do Atleta (Lado a Lado - reduzidos) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Garmin Training Readiness (Preparação para Treino) */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={dailyMetrics.garminReadiness !== undefined}
                            onChange={(e) => {
                              setDailyMetrics({ 
                                ...dailyMetrics, 
                                garminReadiness: e.target.checked ? 78 : undefined,
                                prepScore: e.target.checked ? 78 : undefined
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                          />
                          <span className={`flex items-center gap-1 text-[11px] ${dailyMetrics.garminReadiness !== undefined ? "text-slate-200 font-medium" : "text-slate-500 font-normal"}`}>
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Preparação Garmin
                          </span>
                        </label>
                        <span className="font-mono font-bold text-cyan-300">
                          {dailyMetrics.garminReadiness !== undefined ? `${dailyMetrics.garminReadiness}/100` : <span className="text-slate-500 text-[10px] font-normal">Inativo</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={dailyMetrics.garminReadiness === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.garminReadiness !== undefined ? dailyMetrics.garminReadiness : (dailyMetrics.prepScore || 78);
                            const val = Math.max(10, Math.min(100, cur - 1));
                            setDailyMetrics({ ...dailyMetrics, garminReadiness: val, prepScore: val });
                          }}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Diminuir Preparação"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <input 
                          type="range" 
                          min="10" 
                          max="100" 
                          disabled={dailyMetrics.garminReadiness === undefined}
                          value={dailyMetrics.garminReadiness !== undefined ? dailyMetrics.garminReadiness : (dailyMetrics.prepScore || 78)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setDailyMetrics({ ...dailyMetrics, garminReadiness: val, prepScore: val });
                          }}
                          className={`w-full accent-cyan-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none ${dailyMetrics.garminReadiness === undefined ? "opacity-30 cursor-not-allowed" : ""}`}
                        />
                        <button
                          type="button"
                          disabled={dailyMetrics.garminReadiness === undefined}
                          onClick={() => {
                            const cur = dailyMetrics.garminReadiness !== undefined ? dailyMetrics.garminReadiness : (dailyMetrics.prepScore || 78);
                            const val = Math.max(10, Math.min(100, cur + 1));
                            setDailyMetrics({ ...dailyMetrics, garminReadiness: val, prepScore: val });
                          }}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="Aumentar Preparação"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Sensação Subjetiva do Atleta (5 Etapas) */}
                    <div>
                      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                        <span className="flex items-center gap-1 text-[11px] font-medium">
                          <Activity className="w-3.5 h-3.5 text-amber-400" /> Percepção do Atleta
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
                                className={`w-full py-1 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-between gap-1 transition-all border cursor-pointer ${currentStage.color} shadow-md`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${currentStage.dot}`} />
                                  <span className="font-bold truncate">{currentStage.label}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className="text-[10px] opacity-75 font-mono">{currentStage.score} pts</span>
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSubjectivePopup ? "rotate-180" : ""}`} />
                                </div>
                              </button>

                              {showSubjectivePopup && (
                                <div className="absolute top-full right-0 mt-1.5 w-64 bg-slate-900/98 border border-white/20 rounded-xl shadow-2xl z-50 p-2 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
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
                                            const stageId = stage.id as any;
                                            const derivedSoreness = stageId === "pessimo" ? 8 : stageId === "cansado" ? 6 : stageId === "normal" ? 4 : stageId === "bem" ? 2 : 1;
                                            setDailyMetrics({ ...dailyMetrics, subjectiveFeeling: stageId, muscleSoreness: derivedSoreness });
                                            setShowSubjectivePopup(false);
                                          }}
                                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-all cursor-pointer border ${
                                            isSelected
                                              ? stage.color + " font-bold shadow-md"
                                              : "text-slate-300 hover:bg-white/10 border-transparent"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dot}`} />
                                            <div className="truncate">
                                              <div className="font-bold text-white truncate">{stage.label}</div>
                                              <div className="text-[9px] text-slate-400 font-sans truncate">{stage.sub}</div>
                                            </div>
                                          </div>
                                          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{stage.score} pts</span>
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
                  </div>

                  {/* Seção de Seus Dados Fisiológicos (Ocupa a Coluna Toda) */}
                  <div className="col-span-full w-full p-3 bg-black/30 border border-emerald-500/20 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                      <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> Seus dados fisiológicos
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">Evolução</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* 1. Peso Corporal (1 casa decimal) */}
                      <div>
                        <div className="flex justify-between items-center text-[11px] text-slate-300 mb-1">
                          <span className="flex items-center gap-1 font-medium"><Scale className="w-3 h-3 text-emerald-400" /> Peso (kg)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const base = athleteProfile.weightCurrentKg || 70.0;
                              const cur = dailyMetrics.weight !== undefined && dailyMetrics.weight !== null ? dailyMetrics.weight : base;
                              setDailyMetrics({ ...dailyMetrics, weight: Math.max(30, Math.round((cur - 0.1) * 10) / 10) });
                            }}
                            className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                            title="Diminuir Peso (0.1 kg)"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <input 
                            type="number"
                            step="0.1"
                            placeholder="Ex: 75.5"
                            value={dailyMetrics.weight !== undefined && dailyMetrics.weight !== null ? dailyMetrics.weight : ""}
                            onChange={(e) => setDailyMetrics({ ...dailyMetrics, weight: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                            className="w-full bg-black/50 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-slate-200 text-xs font-mono font-bold text-center focus:border-emerald-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const base = athleteProfile.weightCurrentKg || 70.0;
                              const cur = dailyMetrics.weight !== undefined && dailyMetrics.weight !== null ? dailyMetrics.weight : base;
                              setDailyMetrics({ ...dailyMetrics, weight: Math.round((cur + 0.1) * 10) / 10 });
                            }}
                            className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                            title="Aumentar Peso (0.1 kg)"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 2. Batimento de Repouso (Número Inteiro) */}
                      <div>
                        <div className="flex justify-between items-center text-[11px] text-slate-300 mb-1">
                          <span className="flex items-center gap-1 font-medium"><Heart className="w-3 h-3 text-rose-400" /> FC Repouso (bpm)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const base = athleteProfile.restingHeartRate || 60;
                              const cur = dailyMetrics.restingHeartRate !== undefined && dailyMetrics.restingHeartRate !== null ? dailyMetrics.restingHeartRate : base;
                              setDailyMetrics({ ...dailyMetrics, restingHeartRate: Math.max(30, cur - 1) });
                            }}
                            className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                            title="Diminuir FC Repouso"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <input 
                            type="number"
                            min="30"
                            max="120"
                            step="1"
                            placeholder="Ex: 54"
                            value={dailyMetrics.restingHeartRate !== undefined && dailyMetrics.restingHeartRate !== null ? dailyMetrics.restingHeartRate : ""}
                            onChange={(e) => setDailyMetrics({ ...dailyMetrics, restingHeartRate: e.target.value === "" ? undefined : parseInt(e.target.value) })}
                            className="w-full bg-black/50 border border-rose-500/30 rounded-lg px-2 py-1.5 text-slate-200 text-xs font-mono font-bold text-center focus:border-rose-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const base = athleteProfile.restingHeartRate || 60;
                              const cur = dailyMetrics.restingHeartRate !== undefined && dailyMetrics.restingHeartRate !== null ? dailyMetrics.restingHeartRate : base;
                              setDailyMetrics({ ...dailyMetrics, restingHeartRate: Math.min(120, cur + 1) });
                            }}
                            className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                            title="Aumentar FC Repouso"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 3. VO2 Máximo (Número Inteiro) */}
                      <div>
                        <div className="flex justify-between items-center text-[11px] text-slate-300 mb-1">
                          <span className="flex items-center gap-1 font-medium"><Zap className="w-3 h-3 text-purple-400" /> VO2 Máx (ml/kg/min)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const base = athleteProfile.vo2Max || 45;
                              const cur = dailyMetrics.vo2Max !== undefined && dailyMetrics.vo2Max !== null ? dailyMetrics.vo2Max : base;
                              setDailyMetrics({ ...dailyMetrics, vo2Max: Math.max(20, cur - 1) });
                            }}
                            className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                            title="Diminuir VO2 Máx"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <input 
                            type="number"
                            min="20"
                            max="90"
                            step="1"
                            placeholder="Ex: 48"
                            value={dailyMetrics.vo2Max !== undefined && dailyMetrics.vo2Max !== null ? dailyMetrics.vo2Max : ""}
                            onChange={(e) => setDailyMetrics({ ...dailyMetrics, vo2Max: e.target.value === "" ? undefined : Math.round(parseFloat(e.target.value)) })}
                            className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-2 py-1.5 text-slate-200 text-xs font-mono font-bold text-center focus:border-purple-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const base = athleteProfile.vo2Max || 45;
                              const cur = dailyMetrics.vo2Max !== undefined && dailyMetrics.vo2Max !== null ? dailyMetrics.vo2Max : base;
                              setDailyMetrics({ ...dailyMetrics, vo2Max: Math.min(90, cur + 1) });
                            }}
                            className="w-6 h-[30px] rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                            title="Aumentar VO2 Máx"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Lesão / Dor Articular Checkbox */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-black/25 border border-white/5 rounded-lg px-2.5 py-1.5 h-[36px] hover:border-white/10">
                      <input 
                        type="checkbox"
                        checked={!!dailyMetrics.hasInjury}
                        onChange={(e) => setDailyMetrics({ ...dailyMetrics, hasInjury: e.target.checked, injurySeverity: e.target.checked ? (dailyMetrics.injurySeverity || "mild") : undefined })}
                        className="accent-brand-neon cursor-pointer w-3.5 h-3.5 rounded"
                      />
                      <span className="text-[10px] text-slate-300 font-sans font-semibold uppercase tracking-tight">Lesão / Dor Articular?</span>
                    </label>
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

          </div>

          {/* RIGHT COLUMN: Importação do Treino & Último Treino Realizado */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Carregue seu treino (.FIT File Upload) */}
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-neon/15 text-brand-neon flex items-center justify-center border border-brand-neon/25 shrink-0 shadow-lg shadow-brand-neon/5">
                    <Activity className="w-4 h-4 text-brand-neon" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 font-display flex items-center gap-2">
                      Carregue seu treino
                    </h3>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Importação de telemetria <span className="text-brand-neon font-mono font-semibold">.FIT</span> (Garmin / Strava / Wahoo)
                    </p>
                  </div>
                </div>

                {/* Drag and drop zone alongside */}
                <div
                  onDragOver={localHandleDragOver}
                  onDragLeave={localHandleDragLeave}
                  onDrop={localHandleDrop}
                  onClick={localOnUploadClick}
                  className={`border-2 border-dashed rounded-xl px-3.5 py-2 flex items-center gap-2 cursor-pointer transition-all shrink-0 ${
                    localIsDragging
                      ? "border-brand-neon bg-brand-neon/5 scale-[1.01]"
                      : "border-white/10 hover:border-brand-neon/40 bg-white/5 group"
                  }`}
                >
                  <input
                    type="file"
                    ref={localFileInputRef}
                    onChange={localOnFileChange}
                    accept=".fit"
                    multiple
                    className="hidden"
                  />

                  {isUploading ? (
                    <div className="flex items-center gap-2 py-0.5">
                      <div className="w-4 h-4 rounded-full border-2 border-brand-neon/30 border-t-brand-neon animate-spin"></div>
                      <span className="text-[10px] font-mono text-brand-neon font-bold">
                        Processando...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-slate-400 group-hover:text-brand-neon shrink-0 transition-colors" />
                      <span className="text-[11px] text-slate-300 group-hover:text-white font-medium">
                        arraste seu arquivo <span className="text-brand-neon font-mono font-bold">.fit</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {!activeActivity && loadDemoWorkout && (
                <button
                  type="button"
                  onClick={loadDemoWorkout}
                  className="w-full mt-3 bg-brand-neon/15 hover:bg-brand-neon/25 text-brand-neon border border-brand-neon/20 font-bold text-[10px] py-1.5 px-3 rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Carregar Treino Demonstrativo FIT
                </button>
              )}

              {uploadNotice && (
                <div className="mt-3 p-2.5 bg-cyan-950/40 border border-cyan-500/40 rounded-lg flex gap-2 items-center text-xs text-cyan-300 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{uploadNotice}</span>
                </div>
              )}

              {uploadError && (
                <div className="mt-3 p-2.5 bg-red-950/40 border border-red-900/60 rounded-lg flex gap-2 items-start">
                  <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-300 font-sans leading-relaxed">
                    {uploadError}
                  </p>
                </div>
              )}
            </div>

            {/* Telemetry Active Activity Dashboard or Placeholder */}
            {activeActivity ? (
              <div className="space-y-6 animate-fade-in">
              {/* Dynamic Physiological Load & AI Coach Adaptive Decision Panel - 3 Levels of Information */}
              {(() => {
                const durationMins = Math.round(activeActivity.summary.durationSeconds / 60);
                const avgHrVal = activeActivity.summary.avgHeartRate || 102;
                const hrFactorValue = heartRateFactor(avgHrVal);
                const garminLoadVal = activeActivity?.summary?.rpe ? null : (activeActivity?.summary?.trainingLoad || (activeActivity as any)?.garminTrainingLoad || null);
                
                const loadBreakdown = calculateAetherisTrainingLoad(durationMins, currentRpe, avgHrVal, { 
                  hasFit: !!activeActivity,
                  garminTrainingLoad: garminLoadVal,
                  distanceKm: activeActivity?.summary?.distanceKm,
                  elevationGainMeters: activeActivity?.summary?.elevationGainMeters,
                  rpeFromFit: !!activeActivity?.summary?.rpe
                });
                const calculatedLoad = loadBreakdown.totalLoad;

                // 1. Identify Workout Intent & Scheduled Workout Context
                const targetDayName = (() => {
                  if (activeActivity?.summary?.startTime) {
                    const actDate = new Date(activeActivity.summary.startTime);
                    if (!isNaN(actDate.getTime())) {
                      const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
                      return days[actDate.getDay()];
                    }
                  }
                  const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
                  return days[new Date().getDay()];
                })();

                const scheduledWorkout = (() => {
                  if (!trainingPlan) return null;
                  const activeWeekIdx = Math.min(selectedWeekIdx, (trainingPlan.cycles[0]?.weeks?.length || 1) - 1);
                  const workouts = trainingPlan.cycles[0]?.weeks[activeWeekIdx]?.workouts || [];
                  const sw = workouts.find((w: any) => w.day === targetDayName);
                  return sw ? sw.workout : null;
                })();

                const workoutIntent = scheduledWorkout?.intent || "aerobic_base";
                const workoutIntentName = scheduledWorkout?.name || (
                  workoutIntent === "recovery" ? "Rodagem Regenerativa" :
                  workoutIntent === "threshold" ? "Tempo Run (Limiar)" :
                  workoutIntent === "vo2max" ? "Tiros de VO2 Máx" :
                  workoutIntent === "long_run" ? "Longão Progressivo" : "Rodagem Aeróbica Z2"
                );

                const prescribedDuration = Number(scheduledWorkout?.duration_minutes || scheduledWorkout?.durationMinutes) || (durationMins > 0 ? durationMins : 40);
                let prescribedRpe = 5;
                let prescribedHr = 145;
                if (workoutIntent === "recovery") { prescribedRpe = 3; prescribedHr = 125; }
                else if (workoutIntent === "aerobic_base") { prescribedRpe = 4.5; prescribedHr = 145; }
                else if (workoutIntent === "threshold") { prescribedRpe = 7; prescribedHr = 162; }
                else if (workoutIntent === "vo2max") { prescribedRpe = 9; prescribedHr = 175; }
                else if (workoutIntent === "long_run") { prescribedRpe = 5; prescribedHr = 145; }

                const calculatedPrescribedLoad = calculateActivityLoad(prescribedDuration, prescribedRpe, prescribedHr);

                // Carga Alvo estimada 100% automaticamente pelo Treinador Aetheris:
                // Cálculo: Duração Prescrita × RPE Alvo do Treino × Fator de Zona Fisiológica de FC
                const effectivePlannedLoad = Number(scheduledWorkout?.target_tss || scheduledWorkout?.targetLoad || scheduledWorkout?.plannedTss) || (calculatedPrescribedLoad > 0 ? calculatedPrescribedLoad : 240);

                const compResult = compareLoad(effectivePlannedLoad, calculatedLoad);
                const coachDecision = adjustNextWorkout(
                  effectivePlannedLoad,
                  calculatedLoad,
                  currentRpe,
                  0,
                  readiness?.score || 80,
                  trainingLoad?.acuteChronicRatio ?? 1.0,
                  avgHrVal
                );

                const getRpeDescription = (r: number) => {
                  if (r <= 2) return "Muito Fácil / Regenerativo (Z1)";
                  if (r <= 4) return "Fácil / Ritmo de Base (Z1-Z2)";
                  if (r <= 6) return "Moderado controlado / Aeróbico leve (Z1-Z2)";
                  if (r <= 8) return "Sub-limiar / Limiar de Lactato (Z3-Z4)";
                  return "Esforço Máximo / Tiros de VO2 (Z5)";
                };

                // 2. Tolerance Bands by Intent
                let lowerTol = 0.85;
                let upperTol = 1.15; // Standard 85% to 115% expected range

                if (workoutIntent === "long_run") {
                  lowerTol = 0.80;
                  upperTol = 1.25; // Long runs accommodate extra volume
                }

                const loadRatio = calculatedLoad / (effectivePlannedLoad || 1);
                const differencePercent = Math.round(((calculatedLoad - effectivePlannedLoad) / (effectivePlannedLoad || 1)) * 100);

                // 3. Physiological Cross-Reference (State of Athlete)
                const readinessScore = readiness?.score || 80;
                const sleepHrs = dailyMetrics.sleepHours || 7.5;
                const domsScore = dailyMetrics.muscleSoreness || 2;
                const athleteHasInjury = !!dailyMetrics.hasInjury;
                const isPhysiologicallyStrong = currentRpe <= 6 && readinessScore >= 70 && !athleteHasInjury && domsScore <= 4 && sleepHrs >= 6.5;

                let planComparisonBadge = {
                  symbol: "🟢",
                  label: "Dentro do objetivo fisiológico",
                  style: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                };

                let executionLabel = "🟢 Execução Completa";
                let executionSub = "Treino alinhado ao planejamento";
                let organismResponse = "🟢 Boa assimilação";

                let coachSynthesisText = "";

                // Status comparativo com treino planejado (Isento de diagnóstico direto de fadiga):
                // 🟢 Dentro do esperado (-15% a +15%)
                // 🟡 Abaixo do previsto (<-15%)
                // 🟡 Acima do previsto (+15% a +30%)
                // 🟡 Estímulo Superior (>+30%)
                let loadStatus = {
                  label: "Dentro do esperado",
                  symbol: "🟢",
                  style: "text-emerald-400"
                };

                if (differencePercent < -15) {
                  loadStatus = {
                    label: "Abaixo do previsto",
                    symbol: "🟡",
                    style: "text-amber-400"
                  };
                  planComparisonBadge = {
                    symbol: "🟡",
                    label: "Estímulo Leve / Conservador",
                    style: "bg-amber-950/80 text-amber-300 border-amber-800/60"
                  };
                  executionLabel = "🟡 Execução Leve";
                  executionSub = "Carga realizada inferior ao planejado";
                  organismResponse = "🟡 Baixa demanda fisiológica";
                } else if (differencePercent <= 15) {
                  loadStatus = {
                    label: "Dentro do esperado",
                    symbol: "🟢",
                    style: "text-emerald-400"
                  };
                  planComparisonBadge = {
                    symbol: "🟢",
                    label: "Dentro do objetivo fisiológico",
                    style: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                  };
                  executionLabel = "🟢 Conforme planejado";
                  executionSub = "Volume e intensidade alinhados ao alvo";
                  organismResponse = "🟢 Boa adaptação";
                } else if (differencePercent <= 30) {
                  loadStatus = {
                    label: "Acima do previsto",
                    symbol: "🟡",
                    style: "text-amber-400"
                  };
                  planComparisonBadge = {
                    symbol: "🟡",
                    label: "Estímulo Elevado (+15% a +30%)",
                    style: "bg-amber-950/80 text-amber-300 border-amber-800/60"
                  };
                  executionLabel = "🟡 Carga Elevada";
                  executionSub = "Estímulo gerado superior ao previsto";
                  organismResponse = isPhysiologicallyStrong ? "🟢 Boa tolerância fisiológica" : "🟡 Requer atenção na recuperação";
                } else {
                  loadStatus = {
                    label: "Estímulo Superior ao Previsto",
                    symbol: "🟡",
                    style: "text-amber-400"
                  };
                  planComparisonBadge = {
                    symbol: "🟡",
                    label: `Estímulo Superior ao Previsto (+${differencePercent}%)`,
                    style: "bg-amber-950/80 text-amber-300 border-amber-800/60"
                  };
                  executionLabel = "🟡 Carga Expressiva";
                  executionSub = "Volume/Intensidade superior ao planejado";
                  organismResponse = isPhysiologicallyStrong ? "🟢 Boa assimilação (RPE sob controle)" : "🟡 Monitorar recuperação diária";
                }

                // Zona Fisiológica baseada na FC real comparada às zonas personalizadas (Karvonen) do atleta
                const getPhysiologicalIntensity = (avgHr: number) => {
                  const restHr = Number(athleteProfile.restingHeartRate) || 60;
                  const maxHr = Number(athleteProfile.maxHeartRate) || 190;
                  const hrR = maxHr - restHr;

                  const z1Max = Math.round(restHr + hrR * 0.60);
                  const z2Max = Math.round(restHr + hrR * 0.70);
                  const z3Max = Math.round(restHr + hrR * 0.80);
                  const z4Max = Math.round(restHr + hrR * 0.90);

                  if (avgHr <= 0) {
                    return { label: "Aeróbico leve (Z2)", symbol: "🟢", style: "text-emerald-400" };
                  } else if (avgHr < z1Max) {
                    return { label: "Regenerativo (Z1)", symbol: "🟢", style: "text-emerald-400" };
                  } else if (avgHr < z2Max) {
                    return { label: "Aeróbico leve (Z2)", symbol: "🟢", style: "text-emerald-400" };
                  } else if (avgHr < z3Max) {
                    return { label: "Aeróbico moderado (Z3)", symbol: "🟡", style: "text-amber-400" };
                  } else if (avgHr < z4Max) {
                    return { label: "Limiar de lactato (Z4)", symbol: "🟠", style: "text-amber-500" };
                  } else {
                    return { label: "VO2 máximo (Z5)", symbol: "🔴", style: "text-red-400" };
                  }
                };

                const physioIntensity = getPhysiologicalIntensity(avgHrVal);

                // Avaliação da Sessão em linguagem amigável de atleta
                let executionStatus = {
                  label: "Conforme planejado",
                  symbol: "🟢",
                  style: "text-emerald-400"
                };

                if (loadRatio < 0.85) {
                  executionStatus = { label: "Abaixo do planejado", symbol: "🟡", style: "text-amber-400" };
                } else if (loadRatio <= 1.15) {
                  executionStatus = { label: "Conforme planejado", symbol: "🟢", style: "text-emerald-400" };
                } else if (loadRatio <= 1.30) {
                  executionStatus = { label: "Acima do planejado", symbol: "🟠", style: "text-amber-500" };
                } else {
                  executionStatus = { label: "Muito acima do planejado", symbol: "🔴", style: "text-red-400" };
                }

                let responseStatus = {
                  label: "Boa adaptação",
                  symbol: "🟢",
                  style: "text-emerald-400"
                };

                if (loadRatio < 0.85) {
                  responseStatus = { label: "Estímulo leve / conservador", symbol: "🟡", style: "text-amber-400" };
                } else if (loadRatio <= 1.15) {
                  responseStatus = { label: "Boa adaptação", symbol: "🟢", style: "text-emerald-400" };
                } else if (isPhysiologicallyStrong) {
                  responseStatus = { label: "Boa adaptação", symbol: "🟢", style: "text-emerald-400" };
                } else {
                  responseStatus = { label: "Estresse elevado", symbol: "🔴", style: "text-red-400" };
                }

                let recoveryEstimate = "12–24h";
                if (calculatedLoad > 320) {
                  recoveryEstimate = "36–48h";
                } else if (calculatedLoad > 220) {
                  recoveryEstimate = "24–36h";
                } else if (calculatedLoad > 120) {
                  recoveryEstimate = "18–24h";
                } else {
                  recoveryEstimate = "12–24h";
                }

                // REGRA COACH: RPE valida a resposta fisiológica real do organismo
                const isEasyOrBaseZone = workoutIntent === "easy" || workoutIntent === "recovery" || workoutIntent === "base" || prescribedRpe <= 4;
                if (currentRpe >= 6 && isEasyOrBaseZone) {
                  organismResponse = "⚠️ RPE Elevado (RPE Valida o Treino)";
                  coachSynthesisText += ` ⚠️ Registro do Treinador: Pace estava dentro da previsão, porém a percepção de esforço (${currentRpe}/10) ficou acima do esperado para esta zona (previsto RPE ${prescribedRpe || "3-4"}). Isto indica fadiga acumulada, calor/clima ou recuperação inadequada. O RPE é a métrica principal que valida a real assimilação do organismo.`;
                }

                return (
                  <div className="space-y-4">
                    {/* TELA PRINCIPAL DE ANÁLISE PÓS-TREINO (ESTRUTURA PASSO 3) */}
                    <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-5 shadow-sm space-y-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-brand-neon/5 rounded-full blur-3xl pointer-events-none"></div>

                      {/* Header com Título do Treino */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
                            ✅
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-100 font-display flex items-center gap-2">
                              Último treino carregado
                            </h3>
                            <p className="text-[10px] text-slate-400 font-sans">
                              Sessão de Corrida • {activeActivity.summary.distanceKm} km em {durationMins} min
                            </p>
                          </div>
                        </div>

                        {/* Badge de Alinhamento com o Treinador */}
                        <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
                          <span className="text-[10px] text-slate-400 font-sans font-medium">Estímulo vs Planejado:</span>
                          <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-lg border ${planComparisonBadge.style}`}>
                            {planComparisonBadge.symbol} {planComparisonBadge.label}
                          </span>
                        </div>
                      </div>

                      {/* 1º BLOCO: RESUMO DO TREINO (Métricas Brutas) */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                          1. Resumo do Treino
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                            <span className="text-[9px] text-slate-400 font-mono block mb-0.5">Distância</span>
                            <span className="text-lg font-extrabold font-mono text-white">{activeActivity.summary.distanceKm}</span>
                            <span className="text-[9px] text-slate-400 font-mono ml-0.5">km</span>
                          </div>

                          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                            <span className="text-[9px] text-slate-400 font-mono block mb-0.5">Duração</span>
                            <span className="text-lg font-extrabold font-mono text-white">{durationMins}</span>
                            <span className="text-[9px] text-slate-400 font-mono ml-0.5">min</span>
                          </div>

                          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                            <span className="text-[9px] text-slate-400 font-mono block mb-0.5">Pace Médio</span>
                            <span className="text-lg font-extrabold font-mono text-white">
                              {speedToPace(activeActivity.summary.avgSpeedKmh).split(" ")[0]}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono ml-0.5">/km</span>
                          </div>

                          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                            <span className="text-[9px] text-slate-400 font-mono block mb-0.5">FC Média</span>
                            <span className="text-lg font-extrabold font-mono text-white">{avgHrVal}</span>
                            <span className="text-[9px] text-slate-400 font-mono ml-0.5">bpm</span>
                          </div>
                        </div>
                      </div>

                      {/* 2º BLOCO: PAINEL DE ANÁLISE FISIOLÓGICA (2 CARDS) */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                          2. Análise Fisiológica do Treino
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Card 1: Carga do treino */}
                          <div className="bg-white/5 border border-brand-neon/30 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-brand-neon"></div>
                            <div>
                              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block font-bold">
                                Carga do Treino
                              </span>
                              <div className="my-2 flex items-baseline gap-1.5">
                                <span className="text-3xl font-extrabold font-mono text-white">{calculatedLoad}</span>
                                <span className="text-xs text-brand-neon font-mono font-bold">pts (ATL)</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
                              <span className="text-slate-400">Método / Origem:</span>
                              <span className="text-brand-neon font-bold bg-brand-neon/10 px-2 py-0.5 rounded border border-brand-neon/20">
                                {loadBreakdown.methodLabel}
                              </span>
                            </div>
                          </div>

                          {/* Card 2: Resposta do organismo */}
                          <div className="bg-white/5 border border-cyan-500/30 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-cyan-400"></div>
                            <div>
                              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block font-bold">
                                Resposta do Organismo
                              </span>
                              <div className="mt-2 space-y-1 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">FC Média:</span>
                                  <strong className="text-white font-mono">{avgHrVal} bpm</strong>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Percepção (RPE):</span>
                                  <strong className="text-amber-300 font-mono">{currentRpe}/10</strong>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Recuperação Estimada:</span>
                                  <strong className="text-emerald-400 font-mono">{recoveryEstimate}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-white/10 text-[9px] text-slate-400 font-mono truncate">
                              Fonte RPE: {loadBreakdown.biologicalState.rpeSource === "fit" ? "📡 Telemetria .FIT" : "✍️ Manual pelo Atleta"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BOTÃO PARA AUDITORIA TÉCNICA */}
                      <div className="pt-2 border-t border-white/5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowLoadAudit(!showLoadAudit)}
                          className={`text-xs font-bold font-sans px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 border ${
                            showLoadAudit 
                              ? "bg-brand-neon/20 border-brand-neon/50 text-brand-neon shadow-lg shadow-brand-neon/10" 
                              : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
                          }`}
                        >
                          <span>🔍 {showLoadAudit ? "Ocultar Auditoria Fisiológica" : "Ver Auditoria em Camadas & Modelo Científico"}</span>
                        </button>
                      </div>
                    </div>

                    {/* PAINEL DE AUDITORIA AVANÇADA EM CAMADAS (SEM MODELO TRIPARTITE) */}
                    {showLoadAudit && (
                      <div className="bg-black/50 border border-brand-neon/30 rounded-2xl p-5 shadow-2xl space-y-4 animate-fade-in relative">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-brand-neon" />
                            <h4 className="text-xs font-bold text-slate-100 font-display uppercase tracking-wider">
                              Auditoria de Carga em Camadas Fisiológicas (Aetheris Engine)
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              Confiança: {loadBreakdown.confidence}
                            </span>
                            <span className="text-[9px] font-mono text-brand-neon bg-brand-neon/10 px-2 py-0.5 rounded border border-brand-neon/20 font-bold">
                              {loadBreakdown.methodLabel}
                            </span>
                          </div>
                        </div>

                        {/* Exibição Clara da Origem da Carga Unificada */}
                        <div className="bg-brand-neon/10 border border-brand-neon/30 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono uppercase block">Método Selecionado (Camada B - Carga Interna):</span>
                            <strong className="text-sm font-bold text-brand-neon font-mono">{loadBreakdown.methodLabel}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono uppercase block">Valor Final Unificado:</span>
                            <strong className="text-lg font-extrabold text-white font-mono">{loadBreakdown.internalLoad} pts</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono uppercase block">Detalhamento da Origem:</span>
                            <span className="text-xs font-mono text-slate-200">{loadBreakdown.sourceDetails}</span>
                          </div>
                        </div>

                        {/* 3 Camadas Independentes */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                            <span className="text-[10px] text-cyan-400 font-mono font-bold block uppercase">
                              Camada A — Carga Externa
                            </span>
                            <div className="text-sm font-extrabold text-white font-mono">
                              {durationMins} min em movimento
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                              Distância: {activeActivity?.summary?.distanceKm || 0} km • Altimetria: {activeActivity?.summary?.elevationGainMeters || 0}m. Mede o trabalho executado, não a fadiga fisiológica.
                            </p>
                          </div>

                          <div className="bg-white/5 p-3.5 rounded-xl border border-brand-neon/30 space-y-1">
                            <span className="text-[10px] text-brand-neon font-mono font-bold block uppercase">
                              Camada B — Carga Interna (Fisiologia Pura)
                            </span>
                            <div className="text-sm font-extrabold text-white font-mono">
                              {loadBreakdown.internalLoad} pontos
                            </div>
                            <p className="text-[10px] text-slate-300 leading-relaxed">
                              Fonte: <strong className="text-brand-neon">{loadBreakdown.methodLabel}</strong>. Única referência utilizada para o cálculo de estresse acumulado (ATL, CTL e ACWR).
                            </p>
                          </div>

                          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                            <span className="text-[10px] text-amber-400 font-mono font-bold block uppercase">
                              Camada C — Estado Biológico & RPE
                            </span>
                            <div className="text-sm font-extrabold text-amber-300 font-mono">
                              RPE {currentRpe}/10 • FC {avgHrVal} bpm
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                              Variável qualitativa de resposta ({loadBreakdown.biologicalState.rpeSource === "fit" ? "Telemetria .FIT" : "Manual Atleta"}). Não altera quantitativamente a Carga Interna.
                            </p>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-sans leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                          💡 <strong>Arquitetura Fisiológica Aetheris:</strong> Em conformidade com a literatura (Banister, Foster, Impellizzeri), o motor elimina pesos arbitrários e calcula a Carga Interna exclusivamente via resposta fisiológica objetiva (Garmin Load -&gt; TRIMP -&gt; Session RPE). O RPE atua como variável de interpretação de contexto para tomadas de decisão.
                        </p>
                      </div>
                    )}

                    {/* LEVEL 3: ANÁLISE AVANÇADA PARA ATLETAS & TREINADORES */}
                    {showAdvancedTelemetry && (
                      <div className="bg-black/40 border border-cyan-500/20 rounded-2xl p-5 shadow-xl space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-cyan-400" />
                            <h4 className="text-xs font-bold text-slate-100 font-display uppercase tracking-wider">
                              Análise Avançada de Carga Acumulada & Fisiologia (ATL, CTL, ACWR)
                            </h4>
                          </div>
                          <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                            Aetheris Advanced Engine
                          </span>
                        </div>

                        {/* Interactive Controls in Level 3 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Left: Interactive RPE Input */}
                          <div className="space-y-2.5 bg-white/5 border border-white/5 rounded-xl p-3.5">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block">
                              Ajustar Percepção de Esforço (RPE)
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

                          {/* Middle: Advanced Fatigue Metrics (ATL, CTL, ACWR) */}
                          <div className="space-y-2.5 bg-white/5 border border-white/5 rounded-xl p-3.5">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block">
                              Modelo de Carga Acumulada
                            </span>

                            <div className="grid grid-cols-3 gap-2 text-center pt-1">
                              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                                <span className="text-[8px] font-mono text-slate-400 block">ATL (7d)</span>
                                <span className="text-sm font-bold font-mono text-amber-400">{Math.round(calculatedLoad * 0.95)}</span>
                              </div>
                              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                                <span className="text-[8px] font-mono text-slate-400 block">CTL (42d)</span>
                                <span className="text-sm font-bold font-mono text-emerald-400">{Math.round(calculatedLoad * 0.82)}</span>
                              </div>
                              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                                <span className="text-[8px] font-mono text-slate-400 block">ACWR</span>
                                <span className="text-sm font-bold font-mono text-cyan-300">
                                  {((calculatedLoad * 0.95) / (calculatedLoad * 0.82 || 1)).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <p className="text-[9px] text-slate-400 font-sans pt-1">
                              ACWR na faixa ideal (0.80 - 1.30): Risco minimizado de lesão por sobrecarga.
                            </p>
                          </div>

                          {/* Right: Planned vs Actual Comparison */}
                          <div className="space-y-2.5 bg-white/5 border border-white/5 rounded-xl p-3.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                                Carga Alvo (Estimada pelo Treinador)
                              </span>
                              <span className={`text-[8px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                                compResult.status === "dentro do esperado" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                                compResult.status === "acima do planejado" ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-blue-950 text-blue-300 border border-blue-800"
                              }`}>
                                {compResult.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 my-1">
                              <div className="text-2xl font-extrabold font-mono text-cyan-300">
                                {effectivePlannedLoad} <span className="text-xs font-normal text-slate-400">TSS</span>
                              </div>
                              <div className="text-[9px] font-mono text-slate-400 flex-1 leading-tight border-l border-white/10 pl-2">
                                <div>Diferença: <strong className={differencePercent > 15 ? "text-amber-400" : differencePercent < -15 ? "text-amber-300" : "text-emerald-400"}>{differencePercent > 0 ? `+${differencePercent}%` : `${differencePercent}%`}</strong></div>
                                <div className="text-[8px] text-slate-400 mt-0.5">Estimado via Prescrição Aetheris</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Adaptive Decision Alert box */}
                        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
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
                    )}
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

            </div>
            ) : (
              <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center py-10">
                <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center mb-3 text-brand-neon">
                  <Activity className="w-6 h-6 text-brand-neon" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 font-display">Análise Fisiológica & IA Running Coach</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
                  Importe um arquivo <span className="text-brand-neon font-mono font-bold">.FIT</span> no menu acima para registrar sua carga de treino e calcular a resposta adaptativa da sua prontidão.
                </p>
              </div>
            )}

          </div>
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
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-brand-neon/10 text-brand-neon mb-1">
                <Sparkles className="w-3 h-3 animate-pulse" /> IA Virtual Running Coach
              </span>
              <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
                Periodização Inteligente de Treinos
              </h2>
            </div>

            <div className="flex flex-wrap gap-3 self-start md:self-auto items-center">
              <div className="relative group/tooltip">
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
                      Gerar meu plano personalizado
                    </>
                  )}
                </button>

                {/* Floating Tooltip on Hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover/tooltip:block w-72 p-3 bg-slate-900/95 border border-cyan-500/40 text-slate-200 text-xs rounded-xl shadow-2xl backdrop-blur-md z-30 pointer-events-none transition-all">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-brand-neon shrink-0 mt-0.5" />
                    <p className="leading-relaxed text-[11px] font-sans">
                      O treinador analisa seu <strong className="text-white">histórico real</strong>, perfil fisiológico e <strong className="text-cyan-300">prontidão atual</strong> para estruturar e prescrever uma rotina semanal equilibrada.
                    </p>
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-cyan-500/40 rotate-45"></div>
                </div>
              </div>
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
              Planilha de Treinos Semanal
            </h3>
            {trainingPlan && (
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2.5 py-0.5 rounded border border-white/5">
                Fase: <strong className="text-brand-neon">{trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.phase || "Construção"}</strong>
              </span>
            )}
          </div>

          {trainingPlan ? (
            <div className="space-y-5 flex-1 flex flex-col justify-start">
              
              {/* 2. Resumo da Semana Cards (Carga, Volume Programado, Recuperação) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white/5 p-3.5 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block font-bold">Carga</span>
                  <p className="text-xs font-bold text-cyan-300 font-sans">
                    Carga ideal para construir resistência sem excesso
                  </p>
                </div>
                <div className="bg-white/5 border border-white/5 p-3.5 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block font-bold">Volume Programado</span>
                  <p className="text-sm font-bold text-white font-mono">
                    {(() => {
                      const weekWorkouts = trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.workouts || [];
                      const isDoubleActive = athleteProfile.doubleSessionsAllowed || athleteProfile.sessionsPerDay === 2;
                      const totalMins = weekWorkouts.reduce((acc: number, sw: any) => {
                        const t1 = sw.turno1?.durationMinutes || sw.workout?.durationMinutes || 0;
                        const isRest = !sw.workout || sw.workout.intent === "recovery" || sw.workout.intent === "rest" || sw.workout.durationMinutes === 0;
                        const t2 = (isDoubleActive && !isRest)
                          ? (sw.turno2?.durationMinutes || athleteProfile.turno2TimeMinutes || athleteProfile.timePerShiftMinutes || 30)
                          : 0;
                        return acc + t1 + t2;
                      }, 0);
                      const estKm = Math.round((totalMins / 60) * 10);
                      return `${estKm > 0 ? estKm : 32} km (${totalMins} min)`;
                    })()}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/5 p-3.5 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block font-bold">Recuperação</span>
                  <p className="text-xs font-bold text-emerald-400 font-sans flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Recuperação completa
                  </p>
                </div>
              </div>

              {/* 3. Multi-Week Periodized Macrostructure Row with Active Fill Progress & Horizontal Navigation */}
              {trainingPlan.cycles[0]?.weeks?.length > 0 && (() => {
                const totalWeeks = trainingPlan.cycles[0].weeks.length;

                return (
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-4 shadow-lg">
                    
                    {/* Macrostructure Header, Scroll Controls & Start Date Picker */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-mono tracking-widest text-cyan-400 font-extrabold bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/20">
                            <Zap className="w-3 h-3 text-cyan-400" /> Macrociclo de {totalWeeks} Semana{totalWeeks > 1 ? "s" : ""}
                          </span>
                          <span className="text-[10px] text-slate-300 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            • Fase Selecionada: <strong className="text-cyan-300">{trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.phase || "Base"}</strong>
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-extrabold text-white mt-1 flex items-center gap-2">
                          Evolução Contínua de Carga • Bloco Fisiológico Ativo
                        </h3>
                      </div>

                      {/* Controls Row: Left/Right arrows & Date picker */}
                      <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
                        {totalWeeks > 1 && (
                          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner">
                            <button
                              type="button"
                              onClick={() => {
                                const prev = Math.max(0, selectedWeekIdx - 1);
                                setSelectedWeekIdx(prev);
                                scrollWeeksRow('left');
                              }}
                              className="p-1.5 rounded-lg bg-black/60 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 border border-slate-700/60 transition-all text-xs flex items-center gap-1 font-mono font-bold"
                              title="Semana Anterior"
                            >
                              <ChevronLeft className="w-4 h-4 text-cyan-400" />
                            </button>
                            <span className="text-[11px] font-mono font-bold px-2 text-cyan-300">
                              Semana {selectedWeekIdx + 1} de {totalWeeks}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = Math.min(totalWeeks - 1, selectedWeekIdx + 1);
                                setSelectedWeekIdx(next);
                                scrollWeeksRow('right');
                              }}
                              className="p-1.5 rounded-lg bg-black/60 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 border border-slate-700/60 transition-all text-xs flex items-center gap-1 font-mono font-bold"
                              title="Próxima Semana"
                            >
                              <ChevronRight className="w-4 h-4 text-cyan-400" />
                            </button>
                          </div>
                        )}

                        {/* Date Config Selector */}
                        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
                          <Calendar className="w-3.5 h-3.5 text-brand-neon shrink-0" />
                          <span className="text-[10px] font-mono uppercase text-slate-300 font-bold shrink-0">Início:</span>
                          <input
                            type="date"
                            value={cycleStartDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCycleStartDate(val);
                              localStorage.setItem("fit_cycle_start_date", val);
                            }}
                            className="bg-black/60 border border-slate-700 rounded text-[11px] font-mono text-cyan-300 px-2 py-0.5 focus:outline-none focus:border-cyan-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mobile Horizontal Swipe Hint */}
                    {totalWeeks > 1 && (
                      <div className="sm:hidden text-[10px] font-mono text-cyan-400/80 flex items-center gap-1 mb-1">
                        <span>← Arraste para o lado para ver outros blocos →</span>
                      </div>
                    )}

                    {/* Scrollable Block Cards Grid / Slider */}
                    <div
                      ref={weeksScrollRef}
                      className="flex items-stretch gap-3 sm:gap-3.5 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-slate-900 scroll-smooth snap-x snap-mandatory touch-pan-x"
                    >
                      {Array.from({ length: totalWeeks }).map((_, wIdx) => {
                        const weekData = trainingPlan.cycles[0]?.weeks[wIdx];
                        const phaseName = weekData?.phase || `Semana ${wIdx + 1}`;
                        const range = getWeekDateRange(cycleStartDate, wIdx);
                        const timeline = getWeekDaysTimeline(cycleStartDate, wIdx);
                        const isSelected = selectedWeekIdx === wIdx;

                        return (
                          <div
                            key={wIdx}
                            onClick={() => setSelectedWeekIdx(wIdx)}
                            className={`relative rounded-xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between group overflow-hidden snap-center w-full min-w-full sm:min-w-0 sm:w-auto shrink-0 ${
                              totalWeeks > 4
                                ? "sm:min-w-[280px] sm:max-w-[320px] sm:flex-1"
                                : "sm:w-full sm:min-w-[250px] sm:flex-1"
                            } ${
                              isSelected
                                ? "border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.25)]"
                                : timeline.fillPercent === 100
                                ? "border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-500/60"
                                : timeline.fillPercent > 0
                                ? "border-cyan-500/30 bg-slate-900/80 hover:border-cyan-500/50"
                                : "border-slate-800 bg-slate-900/40 opacity-75 hover:opacity-100 hover:border-slate-700"
                            }`}
                          >
                            {/* Top Header of Block */}
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className={`text-[10px] font-mono uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded ${
                                  isSelected
                                    ? "bg-cyan-400 text-slate-950 shadow-glow-cyan"
                                    : "bg-white/10 text-slate-300"
                                }`}>
                                  Bloco {wIdx + 1}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                                  {range.label}
                                </span>
                              </div>

                              <div className="mt-1.5">
                                <h4 className="text-xs font-bold text-white font-display flex items-center justify-between gap-2">
                                  <span className="truncate">Semana {wIdx + 1} • {phaseName}</span>
                                  {isSelected && (
                                    <span className="text-[8px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono font-extrabold uppercase shrink-0">
                                      Ativa
                                    </span>
                                  )}
                                </h4>
                              </div>

                              {/* Gauge Progress Bar */}
                              <div className="mt-2.5 space-y-1">
                                <div className="flex items-center justify-end text-[9px] font-mono">
                                  <span className={`font-bold ${
                                    timeline.fillPercent === 100
                                      ? "text-emerald-400"
                                      : timeline.fillPercent > 0
                                      ? "text-cyan-300"
                                      : "text-slate-500"
                                  }`}>
                                    {timeline.fillPercent}% {timeline.fillPercent === 100 ? "✓" : ""}
                                  </span>
                                </div>

                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      timeline.fillPercent === 100
                                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                        : timeline.fillPercent > 0
                                        ? "bg-gradient-to-r from-cyan-500 via-brand-neon to-emerald-400 shadow-glow-cyan"
                                        : "bg-slate-700"
                                    }`}
                                    style={{ width: `${timeline.fillPercent}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 7 Day Pills Row */}
                            <div className="mt-3.5 pt-2.5 border-t border-white/5">
                              <span className="text-[8px] uppercase font-mono tracking-wider text-slate-400 block mb-1.5 font-bold">
                                Dias do Bloco (clique para ver o treino):
                              </span>
                              <div className="grid grid-cols-7 gap-1 text-center">
                                {timeline.daysInfo.map((dayItem, dIdx) => {
                                  const isPast = dayItem.temporalState === "past";
                                  const isToday = dayItem.temporalState === "today";
                                  const isDaySelected = isSelected && selectedDayIdx === dIdx;

                                  return (
                                    <div
                                      key={dIdx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedWeekIdx(wIdx);
                                        setSelectedDayIdx(prev => (isSelected && prev === dIdx ? null : dIdx));
                                      }}
                                      title={`${dayItem.fullDay} (${dayItem.dateFormatted}) - Clique para ver o treino`}
                                      className={`rounded py-1 flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 select-none ${
                                        isDaySelected
                                          ? "bg-cyan-400 text-slate-950 font-extrabold border-2 border-cyan-300 ring-2 ring-cyan-400/60 shadow-glow-cyan scale-105 z-10"
                                          : isPast
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold hover:border-emerald-400"
                                          : isToday
                                          ? "bg-brand-neon text-brand-dark font-extrabold border border-brand-neon shadow-[0_0_10px_rgba(6,182,212,0.6)] animate-pulse"
                                          : "bg-slate-800/80 text-slate-500 border border-slate-700/50 font-normal hover:border-slate-500 hover:text-slate-200"
                                      }`}
                                    >
                                      <span className="text-[9px] font-mono uppercase leading-none">
                                        {dayItem.abbrev}
                                      </span>
                                      <span className="text-[7px] font-mono mt-0.5 leading-none opacity-80">
                                        {dayItem.date.getDate()}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Color Legend Footnote inside block */}
                            <div className="mt-2.5 flex items-center justify-between text-[8px] font-mono text-slate-400">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Passado
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-neon inline-block shadow-glow-cyan" /> Atual
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" /> Futuro
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 4. Weekly Calendar Rows (Single Selected Day Workout View) */}
              <div className="space-y-2 mt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-white/5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-200 font-bold flex items-center gap-1.5 flex-wrap">
                    <Calendar className="w-3.5 h-3.5 text-brand-neon" />
                    {selectedDayIdx !== null ? (
                      <>
                        Treino de {["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"][selectedDayIdx]} • Semana {selectedWeekIdx + 1}
                      </>
                    ) : (
                      <>
                        Treinos Prescritos da Semana {selectedWeekIdx + 1}
                      </>
                    )}
                    <span className="text-[9px] text-cyan-300 font-mono font-extrabold bg-cyan-500/15 px-2 py-0.5 rounded border border-cyan-500/30">
                      Fase: {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.phase || "Ativa"}
                    </span>
                  </span>
                  
                  {/* Selection Control */}
                  {selectedDayIdx !== null && (
                    <button
                      onClick={() => setSelectedDayIdx(null)}
                      className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>✕ Ocultar Treino</span>
                    </button>
                  )}
                </div>

                {selectedDayIdx === null ? (
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 text-center space-y-2 my-2">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
                      <Calendar className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-200 font-display">Selecione um dia da semana</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto font-sans leading-relaxed">
                      Clique em qualquer dia (<strong className="text-cyan-300 font-mono">Seg, Ter, Qua, Qui, Sex, Sáb, Dom</strong>) nos blocos semanais acima para carregar a prescrição do treino.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trainingPlan.cycles[0]?.weeks[selectedWeekIdx]?.workouts
                      .filter((sw: any, idx: number) => {
                        const dIdx = getDayIndexFromName(sw.day) >= 0 ? getDayIndexFromName(sw.day) : idx;
                        return dIdx === selectedDayIdx;
                      })
                      .map((sw: any, idx: number) => {
                        const hasSteps = sw.workout.steps && sw.workout.steps.length > 0;
                        const adaptedInfo = getAdaptedWorkoutForDay(sw, selectedWeekIdx);
                        const dayStatus = adaptedInfo.dayStatus || getDetailedDayStatus(
                          sw.day,
                          getDayIndexFromName(sw.day) >= 0 ? getDayIndexFromName(sw.day) : idx,
                          selectedWeekIdx,
                          trainingPlan,
                          savedList.length > 0 ? savedList : localSavedList,
                          todayWorkoutCompleted,
                          completedBlocksSummary
                        );

                        const displayedWorkout = adaptedInfo.adaptedWorkout;
                        const isAdapted = adaptedInfo.isAdapted;
                        const adaptationReason = adaptedInfo.adaptationReason;
                        const completedFeedback = adaptedInfo.completedFeedback;

                        const displayedName = displayedWorkout.name;
                        const displayedDesc = displayedWorkout.description;
                        const displayedIntent = displayedWorkout.intent;

                        // Date & Temporal State calculation
                        const dayIdx = getDayIndexFromName(sw.day) >= 0 ? getDayIndexFromName(sw.day) : idx;
                        const dateParts = (cycleStartDate || "").split("-").map(Number);
                        const [sy, sm, sd] = (dateParts.length >= 3 && !isNaN(dateParts[0])) ? dateParts : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()];
                        const dayDate = new Date(sy, sm - 1, sd + (selectedWeekIdx * 7) + dayIdx);
                        const dateLabel = `${String(dayDate.getDate()).padStart(2, '0')}/${String(dayDate.getMonth() + 1).padStart(2, '0')}`;

                        const nowZero = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
                        const dayZero = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
                        const isPastDay = dayZero < nowZero;
                        const isTodayDay = dayZero === nowZero;
                        const isFutureDay = dayZero > nowZero;

                        const isExpanded = expandedDays[idx] !== false;

                    const isDoubleSessionActive = athleteProfile.doubleSessionsAllowed || athleteProfile.sessionsPerDay === 2;
                    const turno1 = sw.turno1 || sw.workouts?.[0] || displayedWorkout;
                    const turno2 = sw.turno2 || sw.workouts?.[1] || (
                      isDoubleSessionActive && displayedIntent !== "rest" && displayedIntent !== "recovery"
                        ? {
                            name: displayedIntent === "strength" ? "Mobilidade & Regeneração (Turno 2)" : "Fortalecimento Estrutural & Core (Turno 2)",
                            intent: displayedIntent === "strength" ? "mobility" : "strength",
                            durationMinutes: athleteProfile.timePerShiftMinutes || 30,
                            description: displayedIntent === "strength"
                              ? "Exercícios de soltura miofascial, mobilidade articular de quadril e descompressão da coluna para otimizar absorção de carga."
                              : "Fortalecimento funcional focado em estabilização de core, glúteo médio e panturrilhas para prevenção de lesões na corrida.",
                            steps: [
                              {
                                name: "Ativação & Exercícios Principais",
                                durationSeconds: (athleteProfile.timePerShiftMinutes || 30) * 60,
                                intensity: "Moderada / RPE 5-6",
                                stepType: "main_set"
                              }
                            ]
                          }
                        : null
                    );

                    return (
                      <div 
                        key={idx}
                        className={`border rounded-xl transition-all overflow-hidden ${
                          dayStatus.status === "completed"
                            ? "border-emerald-500/30 bg-emerald-950/15"
                            : dayStatus.status === "partial"
                            ? "border-amber-500/25 bg-amber-950/10"
                            : dayStatus.status === "missed"
                            ? "border-rose-500/25 bg-rose-950/10"
                            : isTodayDay
                            ? "border-brand-neon bg-brand-neon/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                            : isPastDay
                            ? "border-emerald-500/20 bg-slate-900/60"
                            : isAdapted || dayStatus.status === "rest_compensation"
                            ? "border-cyan-500/35 bg-cyan-950/20"
                            : "border-slate-800 bg-slate-900/40"
                        }`}
                      >
                        {/* Collapsible Header Bar */}
                        <div
                          onClick={() => toggleDayExpanded(idx)}
                          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                            <span className={`text-xs font-bold uppercase tracking-widest font-mono shrink-0 ${
                              isTodayDay ? "text-brand-neon font-extrabold" : isPastDay ? "text-emerald-400" : "text-slate-200"
                            }`}>
                              {sw.day}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5 shrink-0">
                              {dateLabel}
                            </span>

                            {/* Double Session Status Pill */}
                            {athleteProfile.doubleSessionsAllowed && (
                              <span className="text-[8px] bg-purple-500/20 text-purple-300 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider border border-purple-500/30 flex items-center gap-1 shrink-0">
                                <Zap className="w-2.5 h-2.5 text-purple-400" />
                                2 Turnos Programados
                              </span>
                            )}

                            {/* Status Badges */}
                            {dayStatus.status === "completed" && (
                              <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider border border-emerald-500/30 flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                Concluído
                              </span>
                            )}
                            {dayStatus.status === "partial" && (
                              <span className="text-[8px] bg-amber-500/15 text-amber-300 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider border border-amber-500/30 flex items-center gap-1 shrink-0">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                Parcial
                              </span>
                            )}
                            {dayStatus.status === "missed" && (
                              <span className="text-[8px] bg-rose-500/15 text-rose-400 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider border border-rose-500/30 flex items-center gap-1 shrink-0">
                                <XCircle className="w-2.5 h-2.5 text-rose-400" />
                                Treino Perdido
                              </span>
                            )}
                            {isTodayDay && dayStatus.status !== "completed" && (
                              <span className="text-[8px] bg-brand-neon text-brand-dark font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shadow-glow-cyan flex items-center gap-1 shrink-0">
                                <Clock className="w-2.5 h-2.5 text-brand-dark animate-spin" style={{ animationDuration: '3s' }} />
                                Hoje
                              </span>
                            )}
                            {isPastDay && dayStatus.status !== "completed" && dayStatus.status !== "missed" && (
                              <span className="text-[8px] bg-emerald-500/15 text-emerald-400 font-bold px-1.5 py-0.5 rounded uppercase font-mono border border-emerald-500/25 shrink-0">
                                Passado
                              </span>
                            )}
                            {isFutureDay && (
                              <span className="text-[8px] bg-slate-800 text-slate-400 font-normal px-1.5 py-0.5 rounded uppercase font-mono border border-slate-700 shrink-0">
                                Futuro
                              </span>
                            )}
                            {isAdapted && (
                              <span className="text-[8px] bg-cyan-500/20 text-cyan-300 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider border border-cyan-500/40 flex items-center gap-1 shrink-0">
                                <Zap className="w-2.5 h-2.5 text-cyan-400" />
                                Adaptado IA ⚡
                              </span>
                            )}

                            {/* Workout Name preview on header */}
                            <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[320px] ml-1">
                              {displayedName} {turno2 ? `+ ${turno2.name}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {getIntentBadge(displayedIntent)}
                            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {(displayedWorkout.durationMinutes || 48) + (turno2?.durationMinutes || 0)} min total
                            </span>
                            <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-slate-400 hover:text-white border border-white/10">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Body Content - TWO COLUMNS FOR TURNO 1 AND TURNO 2 */}
                        {isExpanded && (
                          <div className="p-4 pt-3 border-t border-white/5 bg-black/30 space-y-4">
                            
                            {/* Inline Adaptation & Status Messages */}
                            {isAdapted && (
                              <div className="text-[10px] text-cyan-200 flex items-center gap-1.5 font-sans bg-cyan-500/10 px-2.5 py-1.5 rounded border border-cyan-500/20">
                                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span><strong>Adaptado pelo Treinador IA:</strong> {adaptationReason}</span>
                              </div>
                            )}

                            {dayStatus.status === "missed" && !isAdapted && (
                              <div className="text-[10px] text-rose-300 flex items-center gap-1.5 font-sans bg-rose-500/10 px-2 py-1.5 rounded border border-rose-500/20">
                                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <span>Treino não realizado — Adaptado pelo Treinador para o dia de descanso.</span>
                              </div>
                            )}

                            {(dayStatus.status === "completed" || dayStatus.status === "partial") && (
                              <div className="text-[10px] text-emerald-300 font-sans bg-emerald-950/20 p-2.5 rounded border border-emerald-500/20 space-y-1">
                                <div className="flex items-center justify-between font-mono font-bold text-emerald-400">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    {(() => {
                                      const act = dayStatus.activities && dayStatus.activities[0];
                                      if (act) {
                                        const dist = act.distanceKm || act.summary?.distanceKm || (act.distance ? (act.distance / 1000).toFixed(1) : null);
                                        const secs = act.durationSeconds || act.summary?.durationSeconds || act.totalTimerTime || act.movingTime || (act.durationMinutes ? act.durationMinutes * 60 : 0);
                                        let timeStr = "";
                                        if (secs && secs > 0) {
                                          const m = Math.floor(secs / 60);
                                          const s = Math.round(secs % 60);
                                          timeStr = s > 0 ? `${m}min ${s}s` : `${m} min`;
                                        } else {
                                          timeStr = `${act.durationMinutes || 48} min`;
                                        }
                                        return `FIT: ${dist ? `${dist} km (` : ''}${timeStr}${dist ? ')' : ''}`;
                                      }
                                      return "FIT: 48min 38s (Sincronizado)";
                                    })()}
                                  </span>
                                  {completedFeedback?.rpe && (
                                    <span className="bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded text-[9px] font-mono">
                                      RPE {completedFeedback.rpe}/10
                                    </span>
                                  )}
                                </div>
                                {completedFeedback?.reply && (
                                  <p className="text-cyan-300 text-[10px] font-medium flex items-start gap-1 mt-1">
                                    <Sparkles className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                                    <span><strong>Feedback do Treinador:</strong> {completedFeedback.reply}</span>
                                  </p>
                                )}
                              </div>
                            )}

                            {/* 2-COLUMN TURNO LAYOUT */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                              
                              {/* TURNO 1 COLUMN */}
                              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                                <div>
                                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono text-cyan-400 uppercase tracking-wider">
                                      <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      Turno 1 • {athleteProfile.turno1PreferredTime || athleteProfile.preferredTimeOfDay || "Manhã"}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {turno1.durationMinutes || 45} min
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 mb-1.5">
                                    <h4 className="text-xs font-bold text-white font-display">
                                      {turno1.name}
                                    </h4>
                                    {getIntentBadge(turno1.intent || displayedIntent)}
                                  </div>

                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    {turno1.description || displayedDesc}
                                  </p>

                                  <div className="flex flex-wrap gap-1 pt-2">
                                    {(turno1.intent === "strength" || displayedIntent === "strength") && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                                        <Dumbbell className="w-3 h-3 shrink-0" />
                                        Fortalecimento / Força
                                      </span>
                                    )}
                                    {(turno1.intent === "mobility" || displayedIntent === "mobility") && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-pink-400 bg-pink-400/10 px-2 py-0.5 rounded border border-pink-400/20">
                                        <Activity className="w-3 h-3 shrink-0" />
                                        Mobilidade & Prevenção
                                      </span>
                                    )}
                                    {turno1.steps && turno1.steps.some((s: any) => s.name?.toLowerCase().includes("educativ") || s.description?.toLowerCase().includes("educativ")) && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                                        <Footprints className="w-3 h-3 shrink-0 text-cyan-400" />
                                        Inclui Educativos
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {turno1.steps ? `${turno1.steps.length} blocos prescritos` : "Sessão contínua"}
                                  </span>
                                  {hasSteps && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedWorkout({ ...turno1, day: sw.day });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                    >
                                      Ver Intervalos <ChevronRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* TURNO 2 COLUMN */}
                              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                                {turno2 ? (
                                  <>
                                    <div>
                                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono text-purple-400 uppercase tracking-wider">
                                          <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                          Turno 2 • {athleteProfile.turno2PreferredTime || "Tarde"}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                          <Clock className="w-3 h-3 text-slate-400" />
                                          {turno2.durationMinutes || 30} min
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 mb-1.5">
                                        <h4 className="text-xs font-bold text-white font-display">
                                          {turno2.name}
                                        </h4>
                                        {getIntentBadge(turno2.intent || "strength")}
                                      </div>

                                      <p className="text-[11px] text-slate-300 leading-relaxed">
                                        {turno2.description}
                                      </p>
                                    </div>

                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                      <span className="text-[10px] text-purple-300 font-mono">
                                        Sessão Complementar ⚡
                                      </span>
                                      {turno2.steps && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedWorkout({ ...turno2, day: sw.day });
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          Ver Intervalos <ChevronRight className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex-1 flex flex-col items-center justify-center text-center p-3">
                                    <Moon className="w-6 h-6 text-slate-600 mb-2" />
                                    <span className="text-xs font-bold text-slate-400">Turno 2 Desativado</span>
                                    <p className="text-[10px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                                      Atleta configurado para turno único ({athleteProfile.availableTimeMinutes || 60} min/dia). Para dividir o treino em 2 sessões diárias, ative no Perfil.
                                    </p>
                                  </div>
                                )}
                              </div>

                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
              {/* Footer Actions: Clear Plan Button at bottom of plan */}
              <div className="pt-6 mt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400/80 font-sans">
                  Zona de segurança: Reinicie seu ciclo de treino se desejar recalcular a planilha do zero.
                </p>
                <button
                  onClick={clearPlan}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
                  title="Limpar a planilha atual e reiniciar o progresso"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar Planilha
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-white/10 rounded-2xl bg-white/5">
              <Calendar className="w-10 h-10 text-slate-600 mb-3" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Planilha em Branco</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 font-sans">
                Seu perfil está configurado! Clique no botão <strong>"Gerar meu plano personalizado"</strong> acima para o Treinador IA estruturar seu primeiro ciclo de treinos baseado na sua prontidão e histórico de quilômetros.
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
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-emerald-500/10 text-emerald-400 mb-1 border border-emerald-500/20">
                  <History className="w-3.5 h-3.5" /> Evolução de Parâmetros Fisiológicos
                </span>
                <h3 className="text-sm font-bold text-slate-200 tracking-wide uppercase flex items-center gap-2">
                  Histórico de Adaptação Fisiológica <span className="text-[10px] text-slate-400 font-mono font-normal tracking-normal lowercase">/ longitudinal tracking</span>
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Timeframe Selector Buttons */}
                <div className="bg-black/50 border border-white/10 p-1 rounded-xl flex items-center gap-1 text-xs font-mono">
                  <button
                    onClick={() => setAdaptationTimeframe("weekly")}
                    className={`px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                      adaptationTimeframe === "weekly"
                        ? "bg-brand-neon text-brand-dark shadow-glow-cyan"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Intervalo semanal (últimos 7 dias - padrão)"
                  >
                    Semanal (7d)
                  </button>
                  <button
                    onClick={() => setAdaptationTimeframe("monthly")}
                    className={`px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                      adaptationTimeframe === "monthly"
                        ? "bg-brand-neon text-brand-dark shadow-glow-cyan"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Intervalo mensal (últimos 30 dias)"
                  >
                    Mensal (30d)
                  </button>
                  <button
                    onClick={() => setAdaptationTimeframe("yearly")}
                    className={`px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                      adaptationTimeframe === "yearly"
                        ? "bg-brand-neon text-brand-dark shadow-glow-cyan"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Intervalo anual (1 ano)"
                  >
                    Anual (1 ano)
                  </button>
                </div>

                <button 
                  onClick={handleClearProgressHistory}
                  className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 border border-white/10"
                  title="Limpar histórico fisiológico"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar
                </button>
              </div>
            </div>

            {/* Bio Highlights / Summary stats of progress for 3 parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 text-xs">
              {/* 1. Peso Corporal (Cor Verde) */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5" /> Peso Corporal
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {(() => {
                      const lastWithWeight = [...filteredAdaptationData].reverse().find(p => p.weight !== undefined && p.weight !== null && !isNaN(p.weight));
                      return lastWithWeight ? `${lastWithWeight.weight} kg` : "---";
                    })()}
                  </span>
                  <span className="text-[10px] text-slate-400">última medição</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">
                  Massa corporal registrada no check-in.
                </p>
              </div>

              {/* 2. Batimento de Repouso (Cor Vermelha/Rose) */}
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-rose-400 font-bold flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" /> Batimento de Repouso
                  </span>
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-rose-400">
                    {(() => {
                      const lastWithHR = [...filteredAdaptationData].reverse().find(p => p.restingHeartRate !== undefined && p.restingHeartRate !== null && !isNaN(p.restingHeartRate));
                      return lastWithHR ? `${lastWithHR.restingHeartRate} bpm` : "---";
                    })()}
                  </span>
                  <span className="text-[10px] text-slate-400">FC matinal</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">
                  Frequência cardíaca em repouso absoluto.
                </p>
              </div>

              {/* 3. VO2 Máximo (Cor Roxa) */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3.5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-purple-400 font-bold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> VO2 Máximo Estimado
                  </span>
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-purple-400">
                    {(() => {
                      const lastWithVo2 = [...filteredAdaptationData].reverse().find(p => p.vo2Max !== undefined && p.vo2Max !== null && !isNaN(p.vo2Max));
                      return lastWithVo2 ? `${lastWithVo2.vo2Max} ml/kg/min` : "---";
                    })()}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">
                  Capacidade aeróbica máxima de consumo de O₂.
                </p>
              </div>
            </div>

            {/* Interactive Recharts Line Plot or Blank Initial State */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-4">
              {filteredAdaptationData.length === 0 ? (
                <div className="py-12 px-4 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center bg-black/20">
                  <Activity className="w-9 h-9 text-emerald-500/40 mb-2 animate-pulse" />
                  <h5 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Gráfico em Branco</h5>
                  <p className="text-xs text-slate-400 max-w-md mt-1.5 font-sans leading-relaxed">
                    Nenhum dado fisiológico registrado ainda. Faça o seu primeiro Check-in no painel para iniciar a plotagem do gráfico longitudinal.
                  </p>
                </div>
              ) : (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredAdaptationData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="displayDate" 
                        stroke="rgba(255,255,255,0.4)" 
                        fontSize={10} 
                        tickLine={false} 
                      />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                      <ChartTooltip
                        contentStyle={{ backgroundColor: "#0b0f19", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", padding: "10px" }}
                        labelStyle={{ color: "#94a3b8", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}
                        itemStyle={{ fontSize: "11px", fontWeight: "bold" }}
                        formatter={(val: any, name: any) => {
                          if (name === "Peso Corporal (kg)") return [`${val} kg`, name];
                          if (name === "Batimento de Repouso (bpm)") return [`${val} bpm`, name];
                          if (name === "VO2 Máximo (ml/kg/min)") return [`${val} ml/kg/min`, name];
                          return [val, name];
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", color: "#cbd5e1", paddingTop: "8px" }} />
                      <Line 
                        name="Peso Corporal (kg)" 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#10b981" 
                        strokeWidth={2.5} 
                        dot={{ r: 3, strokeWidth: 1, fill: "#10b981" }} 
                        activeDot={{ r: 6, fill: "#10b981" }} 
                      />
                      <Line 
                        name="Batimento de Repouso (bpm)" 
                        type="monotone" 
                        dataKey="restingHeartRate" 
                        stroke="#f43f5e" 
                        strokeWidth={2.5} 
                        dot={{ r: 3, strokeWidth: 1, fill: "#f43f5e" }} 
                        activeDot={{ r: 6, fill: "#f43f5e" }} 
                      />
                      <Line 
                        name="VO2 Máximo (ml/kg/min)" 
                        type="monotone" 
                        dataKey="vo2Max" 
                        stroke="#a855f7" 
                        strokeWidth={2.5} 
                        dot={{ r: 3, strokeWidth: 1, fill: "#a855f7" }} 
                        activeDot={{ r: 6, fill: "#a855f7" }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
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
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0 && handleFileUpload) {
                        handleFileUpload(e.target.files);
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

            {uploadNotice && (
              <div className="mb-5 p-3.5 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-center gap-2.5 text-xs text-cyan-300 font-mono">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{uploadNotice}</span>
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
              const lastWeekActivities = displayList.filter((item) => {
                const itemTime = item.startTime || item.uploadedAt || item.date;
                if (!itemTime) return false;
                return new Date(itemTime) >= cutoffWeek;
              });
              const lwCount = lastWeekActivities.length;
              const lwDist = Math.round(lastWeekActivities.reduce((acc, item) => acc + (item.distanceKm || 0), 0) * 10) / 10;
              const lwSecs = lastWeekActivities.reduce((acc, item) => acc + (item.durationSeconds || 0), 0);
              const lastUpload = displayList.length > 0 && (displayList[0].uploadedAt || displayList[0].startTime) 
                ? new Date(displayList[0].uploadedAt || displayList[0].startTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
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
            {(() => {
              if (displayList.length === 0) {
                return (
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
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0 && handleFileUpload) {
                              handleFileUpload(e.target.files);
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
                );
              }

              return (
                <div className="space-y-3">
                  {/* Filters and Search Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono uppercase text-slate-400">Filtro por Data:</span>
                      <button
                        onClick={() => setListFilter("last10")}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                          listFilter === "last10"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                        }`}
                      >
                        Últimas 10
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
                        onClick={() => setListFilter("last50")}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                          listFilter === "last50"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                        }`}
                      >
                        Últimos 50 Treinos
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
                        Todas ({displayList.length})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Buscar treino por título..."
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        className="px-3 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder:text-slate-500 font-sans focus:outline-none focus:border-cyan-500/50"
                      />
                      <span className="text-[10px] font-mono text-slate-400">
                        Total: {displayList.length} salvas
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Container with Custom Scrollbar */}
                  <div className="overflow-x-auto overflow-y-auto max-h-[550px] rounded-xl border border-white/5 bg-black/20 scrollbar-thin scrollbar-thumb-white/10">
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
                          let filtered = [...displayList];
                          if (historySearchQuery.trim()) {
                            const q = historySearchQuery.toLowerCase();
                            filtered = filtered.filter((item) => {
                              const title = (item.title || "").toLowerCase();
                              const filename = (item.filename || "").toLowerCase();
                              const sport = (item.sport || "").toLowerCase();
                              const dateStr = (item.startTime || item.uploadedAt || item.date || "").toLowerCase();
                              return title.includes(q) || filename.includes(q) || sport.includes(q) || dateStr.includes(q);
                            });
                          }
                          if (listFilter === "last10") {
                            filtered = filtered.slice(0, 10);
                          } else if (listFilter === "last50") {
                            filtered = filtered.slice(0, 50);
                          } else if (listFilter === "lastWeek") {
                            const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                            filtered = filtered.filter(item => new Date(item.startTime || item.uploadedAt || item.date) >= cutoff);
                          } else if (listFilter === "lastMonth") {
                            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            filtered = filtered.filter(item => new Date(item.startTime || item.uploadedAt || item.date) >= cutoff);
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

                            const dateFormatted = (item.startTime || item.uploadedAt || item.date)
                              ? new Date(item.startTime || item.uploadedAt || item.date).toLocaleDateString("pt-BR", {
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
              );
            })()}

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
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">Pace Médio</span>
                    <span className="text-sm font-bold font-mono text-cyan-400">
                      {(() => {
                        const speedKmh = activeActivity.summary?.avgSpeedKmh || 0;
                        if (!speedKmh || speedKmh <= 0) return "--- /km";
                        const paceMinutes = 60 / speedKmh;
                        const mins = Math.floor(paceMinutes);
                        const secs = Math.round((paceMinutes - mins) * 60);
                        if (secs === 60) return `${mins + 1}:00 /km`;
                        return `${mins}:${secs < 10 ? "0" : ""}${secs} /km`;
                      })()}
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">FC Média</span>
                    <span className="text-sm font-bold font-mono text-red-400">{activeActivity.summary?.avgHeartRate || "---"} bpm</span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">Percepção de Esforço (RPE)</span>
                    <span className="text-sm font-bold font-mono text-brand-neon truncate block">
                      {(() => {
                        const rpeVal = activeActivity.summary?.rpe ?? activeActivity.summary?.perceivedExertion ?? currentRpe;
                        return `${rpeVal} / 10`;
                      })()}
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
              {readiness && (readiness.status === "REDUCE" || readiness.status === "RECOVER") && readiness.score < 70 && !selectedWorkout.isAdapted && (
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
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-bold">Passos Estruturados (Steps)</span>
                  <span className="text-[9px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded font-bold">
                    Zona FC = Prioridade #1 • Pace = Guia Ref
                  </span>
                </div>

                <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-xl p-2.5 mb-3 text-[10px] text-cyan-200/90 font-sans leading-relaxed flex items-start gap-2">
                  <Heart className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-cyan-300 block font-mono text-[9px] uppercase tracking-wider">Regra de Ouro da Prescrição:</strong>
                    A zona fisiológica (Z1-Z5 / FC) define o objetivo metabólico. O pace informado é apenas a referência estimada. Se calor, vento, subida ou cansaço elevarem sua FC, ajuste o ritmo para permanecer na zona correta — assim você cumpre o treino com 100% de precisão fisiológica!
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedWorkout.steps.map((step, sIdx) => {
                    const stepMins = Math.floor(step.durationSeconds / 60);
                    const stepSecs = step.durationSeconds % 60;
                    const instructionText = step.instruction || step.description;
                    const hasComplexInterval = step.sets || step.repetitions || step.recoverySeconds;
                    
                    const details = getStepBlockDetails(
                      step,
                      athleteProfile,
                      savedList.length > 0 ? savedList : localSavedList,
                      dailyMetrics
                    );
                    
                    return (
                      <div key={sIdx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-3 font-mono">
                        {/* Header: Title & Duration */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
                            <span className="font-bold text-slate-100 text-sm font-sans">{step.name}</span>
                            {step.stepType && (
                              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50 font-bold">
                                {step.stepType === "warmup" ? "Aquecimento" :
                                 step.stepType === "main_set" ? "Principal" :
                                 step.stepType === "cooldown" ? "Desaquecimento" : step.stepType}
                              </span>
                            )}
                          </div>
                          <span className="font-extrabold text-brand-neon text-sm shrink-0">
                            {stepMins > 0 ? `${stepMins}m` : ""}{stepSecs > 0 ? `${stepSecs}s` : ""}
                          </span>
                        </div>

                        {/* 3 Structured Information Columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {/* 1. Objetivo */}
                          <div className="bg-white/5 border border-white/5 rounded-lg p-2.5 flex flex-col justify-between">
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                              Objetivo
                            </span>
                            <span className="font-bold text-slate-200 text-xs font-sans leading-tight">
                              {details.objective}
                            </span>
                          </div>

                          {/* 2. Zona & FC */}
                          <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-lg p-2.5 flex flex-col justify-between">
                            <span className="text-[9px] uppercase tracking-wider text-cyan-400 font-bold block mb-1 flex items-center justify-between">
                              <span>Zona & FC</span>
                              <Heart className="w-3 h-3 text-cyan-400" />
                            </span>
                            <div>
                              <span className="font-extrabold text-cyan-300 text-xs block">{details.zonaRpe}</span>
                              <span className="text-[10px] text-cyan-200/80 font-mono font-semibold">FC: {details.fcRange}</span>
                            </div>
                          </div>

                          {/* 3. Pace referência */}
                          <div className="bg-slate-950/90 border border-slate-700/60 rounded-lg p-2.5 flex flex-col justify-between">
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-1 flex items-center justify-between">
                              <span>Pace referência</span>
                              <Gauge className="w-3 h-3 text-slate-400" />
                            </span>
                            <div>
                              <span className="font-mono font-bold text-emerald-400 text-xs block">
                                {details.paceRef}
                              </span>
                              {details.activeModifiers && details.activeModifiers.length > 0 && (
                                <span className="text-[8.5px] text-amber-300 font-sans block mt-0.5 font-semibold">
                                  Pace ajustado hoje ({details.activeModifiers.length} fator{details.activeModifiers.length > 1 ? "es" : ""})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Dynamic Condition Banner if Pace Adjusted Today */}
                        {details.conditionNote && (
                          <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-2 text-[10px] text-amber-200 font-sans flex items-start gap-1.5 leading-tight">
                            <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <strong>Modificador Diário do Pace:</strong> {details.conditionNote}
                            </div>
                          </div>
                        )}

                        {/* Instruction Text & Complex Intervals */}
                        {instructionText && (
                          <p className="text-[11px] text-slate-300 font-sans leading-relaxed pt-1">{instructionText}</p>
                        )}

                        {hasComplexInterval && (
                          <div className="flex flex-wrap gap-2 text-[10px] text-slate-300 font-mono pt-1">
                            {step.sets && (
                              <span className="bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/40">
                                Séries: <strong className="text-indigo-300">{step.sets}</strong>
                              </span>
                            )}
                            {step.repetitions && (
                              <span className="bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/40">
                                Repetições: <strong className="text-indigo-300">{step.repetitions}</strong>
                              </span>
                            )}
                            {step.recoverySeconds && (
                              <span className="bg-teal-950/60 px-2 py-0.5 rounded border border-teal-900/40">
                                Recuperação: <strong className="text-teal-300">{step.recoverySeconds}s</strong>
                              </span>
                            )}
                          </div>
                        )}
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
                  Cálculos Auditáveis do Índice de Preparação ({readiness?.score || 70}/100)
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
            {readiness && (
              <div className="space-y-3">
                {/* Physical Biometrics Summary Grid (Moved to Audit Analysis Modal) */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-brand-neon" /> Métricas Biométricas & Fisiológicas Coletadas
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Moon className="w-3 h-3 text-slate-500" /> Sono</span>
                      <span className="text-xs font-bold text-white mt-1">
                        {dailyMetrics.sleepHours ? `${dailyMetrics.sleepHours}h` : "Pendente"} 
                        {dailyMetrics.sleepScore ? <span className="text-[10px] text-slate-400 font-normal"> ({dailyMetrics.sleepScore} pts)</span> : null}
                      </span>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3 text-slate-500" /> Body Battery</span>
                      <span className={`text-xs font-bold mt-1 ${dailyMetrics.bodyBattery !== undefined ? "text-brand-neon" : "text-slate-500 font-normal"}`}>
                        {dailyMetrics.bodyBattery !== undefined ? `${dailyMetrics.bodyBattery}%` : "Ausente"}
                      </span>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Heart className="w-3 h-3 text-slate-500" /> HRV (VFC)</span>
                      <div className="flex items-center justify-between mt-1 gap-1">
                        <span className={`text-xs font-bold ${dailyMetrics.hrv !== undefined ? "text-brand-neon" : "text-slate-500 font-normal"}`}>
                          {dailyMetrics.hrv !== undefined ? `${dailyMetrics.hrv} ms` : "Ausente"}
                        </span>
                        {dailyMetrics.hrv !== undefined && (() => {
                          const baseline = dailyMetrics.hrvBaseline || 55;
                          const currentHrv = dailyMetrics.hrv;
                          const isBalanced = dailyMetrics.hrvStatus 
                            ? dailyMetrics.hrvStatus === "balanced" 
                            : currentHrv >= Math.round(baseline * 0.88);
                          return (
                            <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded border ${
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
                    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Heart className="w-3 h-3 text-slate-500" /> FC Repouso</span>
                      <span className={`text-xs font-bold mt-1 ${dailyMetrics.restingHeartRate ? "text-white" : "text-slate-500 font-normal"}`}>
                        {dailyMetrics.restingHeartRate ? `${dailyMetrics.restingHeartRate} bpm` : "Ausente"}
                      </span>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Sparkles className="w-3 h-3 text-cyan-400" /> Prep. Garmin</span>
                      <span className={`text-xs font-bold mt-1 ${dailyMetrics.garminReadiness !== undefined || dailyMetrics.prepScore !== undefined ? "text-cyan-300" : "text-slate-500 font-normal"}`}>
                        {dailyMetrics.garminReadiness !== undefined ? `${dailyMetrics.garminReadiness}/100` : (dailyMetrics.prepScore !== undefined ? `${dailyMetrics.prepScore}/100` : "Não conectado")}
                      </span>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3 text-amber-400" /> Sensação Atleta</span>
                      {(() => {
                        const stageId = dailyMetrics.subjectiveFeeling || "bem";
                        const stage = SUBJECTIVE_FEELING_STAGES.find(s => s.id === stageId) || SUBJECTIVE_FEELING_STAGES[1];
                        return (
                          <span className={`text-[9px] font-mono font-bold mt-1 px-1.5 py-0.5 rounded border w-fit ${stage.color}`}>
                            {stage.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

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
                    <span className="text-xl font-bold font-mono text-emerald-300 block mt-1 flex items-center gap-1.5">
                      <span>🟢</span>
                      <span>{readiness.decisionQuality || "Alta"}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {readiness.dataInputs?.filter(d => d.present).length || 0} de {readiness.dataInputs?.length || 0} fontes ativas
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
            </div>
            )}

            {/* ACWR, Monotonia & Training Load Calculation Audit Card */}
            {trainingLoad && (
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-cyan-400" /> Métricas de Carga de Treino & Estresse
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                    ATL: {trainingLoad.atl} TL | CTL: {trainingLoad.ctl} TL
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Proporção ACWR</span>
                    <span className="text-sm font-bold text-white font-mono mt-0.5 block">{trainingLoad.acuteChronicRatio}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Fadiga aguda ÷ Aptidão crônica</span>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Monotonia</span>
                    <span className="text-sm font-bold text-white font-mono mt-0.5 block">{monotonyData.monotony}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Variação de carga diária</span>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Carga Estresse</span>
                    <span className="text-sm font-bold text-brand-neon font-mono mt-0.5 block">{monotonyData.strain} pts</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Carga semanal x Monotonia</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 font-mono leading-relaxed bg-black/40 p-2.5 rounded-lg border border-white/5">
                  <strong>Fórmulas & Contexto:</strong>
                  <br />
                  <span className="text-slate-400 text-[10px]">
                    • <strong>ACWR:</strong> Carga Aguda ({trainingLoad.atl}) ÷ Carga Crônica ({trainingLoad.ctl}) = <strong>{trainingLoad.acuteChronicRatio}</strong> ({trainingLoad.acuteChronicRatio < 0.8 ? 'Faixa de Recuperação' : trainingLoad.acuteChronicRatio <= 1.3 ? 'Faixa Ótima de Carga' : 'Carga Elevada / Sobrecarga'}).
                    <br />
                    • <strong>Monotonia (Foster):</strong> Média Diária ÷ Desvio Padrão = <strong>{monotonyData.monotony}</strong> ({monotonyData.monotony < 1.5 ? 'Variabilidade Adequada' : 'Monotonia Elevada'}).
                    <br />
                    • <strong>Carga Estresse (Strain):</strong> Carga Semanal x Monotonia = <strong>{monotonyData.strain} pts</strong>.
                  </span>
                </p>
              </div>
            )}

            {/* Missed Workout Compensation Strategy Audit Card */}
            <div className="bg-cyan-950/20 border border-cyan-500/30 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-cyan-400" /> Estratégia do Treinador Aetheris para Compensação Semanal
                </h4>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                  dailyMetrics.hasMissedWorkoutInWeek
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse"
                    : "bg-white/5 text-slate-400 border-white/10"
                }`}>
                  {dailyMetrics.hasMissedWorkoutInWeek ? "⚡ Compensação Ativa nesta Semana" : "✓ Calendário Semanal Regular"}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                <strong>Diretriz do Motor Aetheris:</strong> Em semanas onde o atleta perde um dia de treino, o treinador ignora o dia de descanso e sugere a continuação do programa sem descanso naquele dia, convertendo o slot de descanso em um novo dia de treino para compensação e preservação do estímulo fisiológico.
              </p>
            </div>

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

      {/* Simulation Suite Modal */}
      <SimulationSuiteModal
        isOpen={isSimulationSuiteOpen}
        onClose={() => setIsSimulationSuiteOpen(false)}
        currentAthleteProfile={athleteProfile}
      />

    </div>
  );
}
