import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Award,
  Bike,
  Calendar,
  Compass,
  Clock,
  Dumbbell,
  FileDown,
  Flame,
  Footprints,
  Heart,
  HelpCircle,
  History,
  Info,
  Layers,
  MapPin,
  Trash2,
  TrendingUp,
  Upload,
  Waves,
  Zap,
  Check,
  User
} from "lucide-react";
import { ActivityData, SavedActivityListItem } from "./types";
import GpsMap from "./components/GpsMap";
import TelemetryCharts from "./components/TelemetryCharts";
import { getDemoActivity } from "./demoData";
import CoachWorkspace from "./components/CoachWorkspace";
import AthleteProfileForm from "./components/AthleteProfileForm";
import { TrainingHistory } from "./coach/types";
import { calculateActivityLoad, compareLoad, adjustNextWorkout, heartRateFactor } from "./coach/coachEngine";
import { useLanguage } from "./i18n/LanguageContext";
import LanguageSelector from "./components/LanguageSelector";

export default function App() {
  const { t } = useLanguage();

  // Navigation State
  const [activeTab, setActiveTab] = useState<"profile" | "today" | "plan" | "state" | "adaptation" | "library">("profile");

  const [viewMode, setViewMode] = useState<"athlete" | "advanced">("athlete");

  // Activity state
  const [activeActivity, setActiveActivity] = useState<ActivityData | null>(null);
  const [savedList, setSavedList] = useState<SavedActivityListItem[]>([]);
  const [currentRpe, setCurrentRpe] = useState<number>(5);
  
  // Track RPE for each active activity
  useEffect(() => {
    if (activeActivity) {
      const savedRpe = localStorage.getItem(`fit_rpe_${activeActivity.id}`);
      if (savedRpe) {
        setCurrentRpe(parseInt(savedRpe));
      } else {
        setCurrentRpe(5);
      }
    }
  }, [activeActivity?.id]);

  
  // Athlete profile state
  const [plannedLoadInput, setPlannedLoadInput] = useState<number>(180);

  const [athleteProfile, setAthleteProfile] = useState<{
    age: number;
    weight: number;
    height: number;
    heightCm?: number;
    restingHeartRate: number | "";
    maxHeartRate: number | "";
    fitnessLevel: string;
    trainingGoal: string;
    objective?: string;
    weeklyTrainingDays: number;
    restDay: string;
    longRunDay: string;
    limitations: string;
    best5k: string;
    best10k: string;
    bestHalfMarathon: string;
    estimatedPaceCurrent: string;
    gender: string;
    weightGoalKg?: string;
    availableTimePerWorkout?: string;
    sportsHistory?: string;
    longestDistance3Months?: string;
    recentPaceOrTime?: string;
    strengthEquipment?: string;
    availableDays?: string[];
  }>({
    age: 46,
    weight: 90,
    height: 181,
    heightCm: 181,
    restingHeartRate: 60,
    maxHeartRate: 190,
    fitnessLevel: "advanced",
    trainingGoal: "general_fitness",
    objective: "general_fitness",
    weeklyTrainingDays: 6,
    restDay: "Quinta-feira",
    longRunDay: "Domingo",
    limitations: "Não tenho",
    best5k: "20:10",
    best10k: "42:10",
    bestHalfMarathon: "1:45:00",
    estimatedPaceCurrent: "6:20",
    gender: "Masculino",
    weightGoalKg: "85",
    availableTimePerWorkout: "50 minutos",
    sportsHistory: "Pratico corrida de rua e treinos de força para manter a performance aeróbica.",
    longestDistance3Months: "21 km",
    recentPaceOrTime: "Ritmo de 4:50/km a 5:10/km nos treinos ritmados de 10k.",
    strengthEquipment: "Halteres de 10kg, kettlebell de 14kg e elásticos de resistência",
    availableDays: ["Segunda-feira", "Terça-feira", "Quarta-feira", "Sexta-feira", "Sábado", "Domingo"],
  });

  // UI States
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(true);
  const [profileSaved, setProfileSaved] = useState(false);
  const [showProfileValidationErrors, setShowProfileValidationErrors] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic physiological training history calculation
  const getTrainingHistory = (): TrainingHistory => {
    const runs = savedList;
    const totalRuns = runs.length;
    const maxRun = totalRuns > 0 ? Math.max(...runs.map(r => r.distanceKm)) : 0;
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    let weekDist = 0;
    let monthDist = 0;
    let totalDist = 0;
    
    runs.forEach(r => {
      const activityDate = new Date(r.startTime);
      if (activityDate >= sevenDaysAgo) {
        weekDist += r.distanceKm;
      }
      if (activityDate >= thirtyDaysAgo) {
        monthDist += r.distanceKm;
      }
      totalDist += r.distanceKm;
    });

    const avgDistance = totalRuns > 0 ? totalDist / totalRuns : 0;

    return {
      weekDistanceKm: Math.round(weekDist * 10) / 10,
      monthDistanceKm: Math.round(monthDist * 10) / 10,
      totalRuns,
      longestRunKm: Math.round(maxRun * 10) / 10,
      averageDistanceKm: Math.round(avgDistance * 10) / 10,
    };
  };

  // Load activities from server DB
  const loadDbActivities = async () => {
    try {
      const res = await fetch("/api/activities");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.activities) && data.activities.length > 0) {
          const dbActivities: ActivityData[] = data.activities;
          
          const listItems: SavedActivityListItem[] = dbActivities.map((act) => ({
            id: act.id,
            filename: act.filename || "activity.fit",
            sport: act.sport || "running",
            startTime: act.startTime || act.uploadedAt || new Date().toISOString(),
            distanceKm: act.summary?.distanceKm || 0,
            durationSeconds: act.summary?.durationSeconds || 0,
            title: act.aiAnalysis?.title || `${act.sport} Workout`,
            uploadedAt: act.uploadedAt || new Date().toISOString(),
          }));

          setSavedList(listItems);
          
          dbActivities.forEach((act) => {
            localStorage.setItem(`fit_activity_data_${act.id}`, JSON.stringify(act));
          });
          localStorage.setItem("fit_activity_list", JSON.stringify(listItems));

          const lastViewedId = localStorage.getItem("fit_last_viewed_id");
          const target = dbActivities.find((a) => a.id === lastViewedId) || dbActivities[0];
          if (target) {
            setActiveActivity(target);
          }
          return true;
        }
      }
    } catch (err) {
      console.warn("Could not fetch DB activities:", err);
    }
    return false;
  };

  // Load activities and profile on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const profileStr = localStorage.getItem("fit_athlete_profile_v4");
        if (profileStr) {
          setAthleteProfile(JSON.parse(profileStr));
        }

        // First try DB load
        const dbLoaded = await loadDbActivities();
        if (dbLoaded) return;

        // Fallback to localStorage
        const listStr = localStorage.getItem("fit_activity_list");
        if (listStr) {
          let parsedList = JSON.parse(listStr) as SavedActivityListItem[];
          
          const demoIndex = parsedList.findIndex(item => item.id === "demo-golden-gate-trail");
          const freshDemo = getDemoActivity();
          if (demoIndex !== -1) {
            parsedList[demoIndex].title = freshDemo.aiAnalysis.title;
            localStorage.setItem("fit_activity_list", JSON.stringify(parsedList));
            localStorage.setItem("fit_activity_data_demo-golden-gate-trail", JSON.stringify(freshDemo));
          }

          setSavedList(parsedList);

          const lastViewedId = localStorage.getItem("fit_last_viewed_id");
          if (lastViewedId) {
            if (lastViewedId === "demo-golden-gate-trail") {
              setActiveActivity(freshDemo);
            } else {
              const detailStr = localStorage.getItem(`fit_activity_data_${lastViewedId}`);
              if (detailStr) {
                setActiveActivity(JSON.parse(detailStr));
              }
            }
          } else if (parsedList.length > 0) {
            if (parsedList[0].id === "demo-golden-gate-trail") {
              setActiveActivity(freshDemo);
            } else {
              const firstDetailStr = localStorage.getItem(`fit_activity_data_${parsedList[0].id}`);
              if (firstDetailStr) {
                setActiveActivity(JSON.parse(firstDetailStr));
              }
            }
          }
        } else {
          loadDemoWorkout();
        }
      } catch (e) {
        console.error("Failed to load saved activities:", e);
      }
    };

    initData();
  }, []);

  // Save athlete profile to localStorage when changed
  useEffect(() => {
    localStorage.setItem("fit_athlete_profile_v4", JSON.stringify(athleteProfile));
  }, [athleteProfile]);

  // Set active activity and record to last viewed
  const selectActivity = async (id: string) => {
    try {
      const detailStr = localStorage.getItem(`fit_activity_data_${id}`);
      if (detailStr) {
        const data = JSON.parse(detailStr) as ActivityData;
        setActiveActivity(data);
        localStorage.setItem("fit_last_viewed_id", id);
        setUploadError(null);
      } else {
        const res = await fetch(`/api/activities/${id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.activity) {
            setActiveActivity(json.activity);
            localStorage.setItem(`fit_activity_data_${id}`, JSON.stringify(json.activity));
            localStorage.setItem("fit_last_viewed_id", id);
            setUploadError(null);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load activity detail:", e);
    }
  };

  // Delete an activity
  const deleteActivity = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Avoid triggering select
    try {
      fetch(`/api/activities/${id}`, { method: "DELETE" }).catch((err) => console.error("Error deleting from DB:", err));

      const updatedList = savedList.filter((item) => item.id !== id);
      setSavedList(updatedList);
      localStorage.setItem("fit_activity_list", JSON.stringify(updatedList));
      localStorage.removeItem(`fit_activity_data_${id}`);
      
      if (activeActivity && activeActivity.id === id) {
        if (updatedList.length > 0) {
          selectActivity(updatedList[0].id);
        } else {
          setActiveActivity(null);
          localStorage.removeItem("fit_last_viewed_id");
        }
      }
    } catch (err) {
      console.error("Failed to delete activity:", err);
    }
  };

  // Load demo workout
  const loadDemoWorkout = async () => {
    const demo = getDemoActivity();
    
    // Save to list
    const newItem: SavedActivityListItem = {
      id: demo.id,
      filename: demo.filename,
      sport: demo.sport,
      startTime: demo.startTime,
      distanceKm: demo.summary.distanceKm,
      durationSeconds: demo.summary.durationSeconds,
      title: demo.aiAnalysis.title,
      uploadedAt: demo.uploadedAt,
    };

    const updatedList = [newItem, ...savedList.filter((x) => x.id !== demo.id)];
    setSavedList(updatedList);
    localStorage.setItem("fit_activity_list", JSON.stringify(updatedList));
    localStorage.setItem(`fit_activity_data_${demo.id}`, JSON.stringify(demo));
    setActiveActivity(demo);
    localStorage.setItem("fit_last_viewed_id", demo.id);
    setUploadError(null);
    setActiveTab("adaptation"); // Move automatically to Histórico tab

    try {
      fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demo),
      });
    } catch (e) {
      console.error("Failed to sync demo to DB:", e);
    }
  };

  // Handle .FIT File Upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    // Check extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "fit") {
      setUploadError("Invalid file type. Please upload a Garmin '.fit' activity file.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("athleteProfile", JSON.stringify(athleteProfile));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errMsg = "Failed to process the FIT file.";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errMsg = errorData.error || errMsg;
          } else {
            const text = await response.text();
            if (text && text.trim().startsWith("{")) {
              const parsed = JSON.parse(text);
              errMsg = parsed.error || errMsg;
            } else if (text && text.length < 300 && !text.includes("<!DOCTYPE") && !text.includes("<!doctype")) {
              errMsg = text;
            }
          }
        } catch (e) {
          console.error("Error parsing API error response:", e);
        }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("O servidor de inteligência esportiva retornou um formato inválido de resposta (esperado JSON, mas recebido HTML). Por favor, verifique se o servidor está ativo.");
      }

      const rawData = await response.json();
      
      // Construct saved details
      const id = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const newActivity: ActivityData = {
        id,
        filename: file.name,
        sport: rawData.sport,
        startTime: rawData.startTime,
        summary: rawData.summary,
        gpsPath: rawData.gpsPath,
        records: rawData.records,
        aiAnalysis: rawData.aiAnalysis,
        aiEnabled: rawData.aiEnabled,
        uploadedAt: new Date().toISOString(),
      };

      // Add to localStorage list
      const newItem: SavedActivityListItem = {
        id,
        filename: file.name,
        sport: rawData.sport,
        startTime: rawData.startTime,
        distanceKm: rawData.summary.distanceKm,
        durationSeconds: rawData.summary.durationSeconds,
        title: rawData.aiAnalysis.title,
        uploadedAt: newActivity.uploadedAt,
      };

      const updatedList = [newItem, ...savedList];
      setSavedList(updatedList);
      localStorage.setItem("fit_activity_list", JSON.stringify(updatedList));
      localStorage.setItem(`fit_activity_data_${id}`, JSON.stringify(newActivity));
      
      setActiveActivity(newActivity);
      localStorage.setItem("fit_last_viewed_id", id);
      setActiveTab("adaptation"); // Move automatically to Histórico tab
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsUploading(false);
    }
  };

  // Re-analyze active workout using current Athlete Profile
  const reanalyzeWorkout = async () => {
    if (!activeActivity) return;

    setIsReanalyzing(true);
    setUploadError(null);

    try {
      const response = await fetch("/api/reanalyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sport: activeActivity.sport,
          summary: activeActivity.summary,
          athleteProfile,
        }),
      });

      if (!response.ok) {
        let errMsg = "Failed to re-analyze telemetry with coach.";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errMsg = errorData.error || errMsg;
          } else {
            const text = await response.text();
            if (text && text.trim().startsWith("{")) {
              const parsed = JSON.parse(text);
              errMsg = parsed.error || errMsg;
            } else if (text && text.length < 300 && !text.includes("<!DOCTYPE") && !text.includes("<!doctype")) {
              errMsg = text;
            }
          }
        } catch (e) {
          console.error("Error parsing API error response:", e);
        }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("O servidor de inteligência esportiva retornou um formato inválido de resposta (esperado JSON, mas recebido HTML). Por favor, verifique se o servidor está ativo.");
      }

      const resData = await response.json();

      const updatedActivity: ActivityData = {
        ...activeActivity,
        aiAnalysis: resData.aiAnalysis,
        aiEnabled: true,
      };

      // Update in active state
      setActiveActivity(updatedActivity);

      // Save updated details to localStorage
      localStorage.setItem(`fit_activity_data_${activeActivity.id}`, JSON.stringify(updatedActivity));

      // Update the title in the sidebar list too
      const updatedList = savedList.map((item) => {
        if (item.id === activeActivity.id) {
          return {
            ...item,
            title: resData.aiAnalysis.title,
          };
        }
        return item;
      });
      setSavedList(updatedList);
      localStorage.setItem("fit_activity_list", JSON.stringify(updatedList));
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Could not complete customized coaching re-analysis.");
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Drag-and-drop triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Trigger input file selector
  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Utility formatting functions
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

  // Calculate Heart Rate Zones based on Karvonen formula
  const getHeartRateZones = () => {
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

    return [
      { name: "Zona 1 (Regenerativo)", range: `${z1Min} - ${z1Max} bpm`, desc: "Recuperação ativa, regeneração pós-treino e metabolismo de gorduras inicial.", color: "text-teal-400" },
      { name: "Zona 2 (Base Aeróbica / Lipólise)", range: `${z2Min} - ${z2Max} bpm`, desc: "Estímulo mitocondrial, aumento da capilarização e queima de gordura.", color: "text-blue-400" },
      { name: "Zona 3 (Tempo / Aeróbico Intensivo)", range: `${z3Min} - ${z3Max} bpm`, desc: "Resistência aeróbica geral, capilarização e ritmo confortável de prova.", color: "text-indigo-400" },
      { name: "Zona 4 (Limiar de Lactato)", range: `${z4Min} - ${z4Max} bpm`, desc: "Ponto de acúmulo de ácido lático, aumento da tolerância à fadiga muscular.", color: "text-orange-400" },
      { name: "Zona 5 (VO2 Máximo / Potência Anaeróbica)", range: `${z5Min} - ${z5Max} bpm`, desc: "Capacidade cardiorrespiratória máxima, velocidade e explosão.", color: "text-red-400" },
    ];
  };

  // Select sport icon
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
        return <Dumbbell className={className} />;
    }
  };

  const handleTabChange = (newTab: "profile" | "today" | "plan" | "state" | "adaptation" | "library") => {
    if (activeTab === "profile" && newTab !== "profile") {
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
        setShowProfileValidationErrors(true);
        return;
      }
    }
    setShowProfileValidationErrors(false);
    setActiveTab(newTab);
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden bg-grid-pattern">
      {/* Immersive Ambient Glow Highlights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-950/15 blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] rounded-full bg-indigo-950/15 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-blue-950/8 blur-[150px]" />
      </div>

      {/* 1. Header Navigation Bar */}
      <header id="app-header" className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-[2000] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Top Left: Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)] shrink-0">
              <Activity className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-display tracking-tight text-white flex items-center gap-2">
                {t("appTitle")}
              </h1>
              <p className="text-[10px] text-cyan-400/80 font-mono hidden sm:block tracking-widest uppercase">
                {t("appSubtitle")}
              </p>
            </div>
          </div>

          {/* Top Right: Status Indicator & Language Flag Selector */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden xs:flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] sm:text-xs font-semibold font-mono tracking-wider text-slate-300 uppercase">
                {t("statusOk")}
              </span>
            </div>
            <LanguageSelector />
          </div>
        </div>
      </header>

      {/* Brand Promise Banner */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 relative z-10">
        <div className="bg-gradient-to-r from-cyan-950/20 via-black/30 to-indigo-950/10 border border-cyan-500/10 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            {t("brandPromise")}
          </p>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">
        <div className="flex flex-row flex-wrap md:flex-nowrap items-center gap-2 p-1.5 bg-black/40 border border-white/5 backdrop-blur-md rounded-2xl w-full">
          {/* 1. Perfil */}
          <button
            id="tab-profile"
            onClick={() => handleTabChange("profile")}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === "profile"
                ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-brand-neon/30 text-brand-neon shadow-glow-cyan"
                : "text-slate-400 hover:text-white border-transparent hover:bg-white/5"
            }`}
          >
            <User className="w-4 h-4" />
            {t("tabProfile")}
          </button>

          {/* 2. Meu Plano */}
          <button
            id="tab-plan"
            onClick={() => handleTabChange("plan")}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === "plan"
                ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-brand-neon/30 text-brand-neon shadow-glow-cyan"
                : "text-slate-400 hover:text-white border-transparent hover:bg-white/5"
            }`}
          >
            <Calendar className="w-4 h-4" />
            {t("tabPlan")}
          </button>

          {/* 3. Check-in Diário */}
          <button
            id="tab-state"
            onClick={() => handleTabChange("state")}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === "state"
                ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-brand-neon/30 text-brand-neon shadow-glow-cyan"
                : "text-slate-400 hover:text-white border-transparent hover:bg-white/5"
            }`}
          >
            <Activity className="w-4 h-4" />
            {t("tabState")}
          </button>

          {/* 4. Histórico */}
          <button
            id="tab-adaptation"
            onClick={() => handleTabChange("adaptation")}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === "adaptation"
                ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-brand-neon/30 text-brand-neon shadow-glow-cyan"
                : "text-slate-400 hover:text-white border-transparent hover:bg-white/5"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            {t("tabAdaptation")}
          </button>

          {/* 5. Treino de Hoje */}
          <button
            id="tab-today"
            onClick={() => handleTabChange("today")}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === "today"
                ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-brand-neon/30 text-brand-neon shadow-glow-cyan"
                : "text-slate-400 hover:text-white border-transparent hover:bg-white/5"
            }`}
          >
            <Zap className="w-4 h-4" />
            {t("tabToday")}
          </button>

          {/* 6. Biblioteca */}
          <button
            id="tab-library"
            onClick={() => handleTabChange("library")}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === "library"
                ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-brand-neon/30 text-brand-neon shadow-glow-cyan"
                : "text-slate-400 hover:text-white border-transparent hover:bg-white/5"
            }`}
          >
            <Layers className="w-4 h-4" />
            {t("tabLibrary")}
          </button>
        </div>
      </div>

      {/* 3. Main Dashboard Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        {activeTab !== "profile" ? (
          <CoachWorkspace 
            athleteProfile={athleteProfile as any} 
            setAthleteProfile={setAthleteProfile} 
            getTrainingHistory={getTrainingHistory} 
            viewMode={viewMode}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            handleFileUpload={handleFileUpload}
            isUploading={isUploading}
            uploadError={uploadError}
            activeActivity={activeActivity}
            setActiveActivity={setActiveActivity}
            currentRpe={currentRpe}
            setCurrentRpe={setCurrentRpe}
            plannedLoadInput={plannedLoadInput}
            setPlannedLoadInput={setPlannedLoadInput}
            isReanalyzing={isReanalyzing}
            reanalyzeWorkout={reanalyzeWorkout}
            loadDemoWorkout={loadDemoWorkout}
            savedList={savedList}
            selectActivity={selectActivity}
            deleteActivity={deleteActivity}
            refreshActivities={loadDbActivities}
          />
        ) : (
          <div className="w-full">
            <AthleteProfileForm 
              athleteProfile={athleteProfile as any}
              setAthleteProfile={setAthleteProfile}
              profileSaved={profileSaved}
              setProfileSaved={setProfileSaved}
              showValidationErrors={showProfileValidationErrors}
              setShowValidationErrors={setShowProfileValidationErrors}
            />
          </div>
        )}

        {/* Redundant active workout dashboard moved to CoachWorkspace.tsx */}
        {false && (
          <div>
            {activeActivity ? (
            <div className="space-y-6 animate-fade-in">
              {/* Dashboard header card */}
              <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-neon/15 text-brand-neon flex items-center justify-center border border-brand-neon/25 shadow-lg shadow-brand-neon/5">
                      {getSportIcon(activeActivity.sport, "w-5 h-5")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold font-display tracking-tight text-white">
                          {activeActivity.aiAnalysis.title}
                        </h2>
                        <span className="text-[10px] font-semibold bg-brand-neon/10 border border-brand-neon/20 px-2.5 py-0.5 rounded-full text-brand-neon uppercase font-mono tracking-wider">
                          {activeActivity.sport === "run" || activeActivity.sport === "running" ? "Corrida" : activeActivity.sport}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-sans mt-0.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
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

                  <div className="text-left sm:text-right font-mono">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-sans font-medium">Origem</p>
                    <p className="text-xs text-slate-300 font-semibold truncate max-w-[200px]">
                      {activeActivity.filename}
                    </p>
                  </div>
                </div>

                {/* AI Coaching Insights Area */}
                <div className="mt-5 p-5 bg-gradient-to-br from-cyan-950/20 via-black/40 to-slate-900/10 rounded-2xl border border-cyan-500/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-950/20 rounded-full blur-2xl"></div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-full bg-black border border-brand-neon flex items-center justify-center shrink-0 shadow-glow-cyan">
                      <Award className="w-5 h-5 text-brand-neon stroke-[1.5]" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest font-mono text-brand-neon">
                            Análise do Treinador de Elite
                          </h4>
                          <span className="text-[9px] font-mono bg-black border border-white/5 px-2 py-0.5 rounded text-cyan-400">
                            {activeActivity.aiEnabled ? "Gemini 3.5 Flash" : "Motor de Heurísticas Local"}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-100 mt-1">
                          Efeito do Treino: <span className="text-brand-neon font-display">{activeActivity.aiAnalysis.trainingEffect}</span>
                        </p>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans italic">
                        "{activeActivity.aiAnalysis.summary}"
                      </p>

                      <div className="space-y-1.5 pt-1">
                        {activeActivity.aiAnalysis.coachingInsights.split("\n").map((line, idx) => {
                          const cleanLine = line.replace(/^\s*•\s*/, "");
                          if (!cleanLine.trim()) return null;
                          return (
                            <div key={idx} className="flex gap-2 items-start text-xs text-slate-300 font-sans leading-relaxed">
                              <span className="text-brand-neon mt-1">•</span>
                              <p dangerouslySetInnerHTML={{ __html: cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong class="text-brand-neon font-semibold">$1</strong>') }} />
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-sans">Tempo de Recuperação Recomendado:</span>
                          <span className="font-mono font-semibold text-brand-neon bg-black/50 px-2 py-0.5 rounded border border-white/5">
                            {activeActivity.aiAnalysis.suggestedRecovery}
                          </span>
                        </div>
                        
                        {!activeActivity.aiEnabled && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Info className="w-3 h-3 text-amber-500" />
                            Chave de API ausente. Executando em modo de contingência.
                          </span>
                        )}
                      </div>

                      {/* Athlete profile analysis context footer */}
                      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono text-slate-400 bg-white/5 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse"></span>
                          <span>
                            Análise do Treinador para: <strong className="text-slate-200">{athleteProfile.age} anos ({athleteProfile.weight}kg)</strong> | Objetivo: <strong className="text-brand-neon uppercase font-bold">
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
                          onClick={reanalyzeWorkout}
                          disabled={isReanalyzing}
                          className="text-brand-neon hover:text-cyan-300 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-right sm:text-left self-end sm:self-auto"
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
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-sm">
                    <h3 className="text-xs uppercase font-bold text-slate-200 tracking-widest mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-neon" />
                      Modelo de Carga Fisiológica & Ajuste Adaptativo <span className="text-[9px] text-slate-400 font-normal lowercase font-sans">/ real-time telemetry analytics</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Left: Interactive RPE Input */}
                      <div className="space-y-3 bg-white/5 border border-white/5 rounded-xl p-4">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                          Percepção de Esforço (RPE)
                        </span>
                        
                        <div className="flex justify-between items-baseline">
                          <span className="text-3xl font-extrabold font-mono text-white">
                            {currentRpe} <span className="text-xs text-slate-500">/ 10</span>
                          </span>
                          <span className="text-[10px] font-semibold text-brand-neon font-mono bg-black/40 px-2 py-0.5 rounded border border-white/5">
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
                          className="w-full accent-brand-neon cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none mt-2"
                        />

                        <p className="text-xs text-slate-300 font-sans mt-2 font-medium bg-brand-dark/40 py-1.5 px-2.5 rounded border border-white/5">
                          {getRpeDescription(currentRpe)}
                        </p>
                      </div>

                      {/* Middle: Calculated Load details */}
                      <div className="space-y-3 bg-white/5 border border-white/5 rounded-xl p-4">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                          Carga Realizada (Garmin Load)
                        </span>

                        <div className="flex justify-between items-baseline">
                          <span className="text-3xl font-extrabold font-mono text-cyan-400">
                            {calculatedLoad} <span className="text-xs text-slate-500">tss</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Fator FC: {hrFactorValue.toFixed(2)}x
                          </span>
                        </div>

                        <div className="text-[10px] space-y-1 text-slate-400 font-mono leading-relaxed pt-1.5 border-t border-white/5">
                          <div>Fórmula TRIMP Aplicada:</div>
                          <div className="text-slate-300">
                            {durationMins}m × {currentRpe} rpe × {hrFactorValue.toFixed(2)} factor
                          </div>
                          <div className="text-[9px] text-slate-500">
                            FC média registrada: {avgHrVal} bpm (zona {avgHrVal < 130 ? "Z1/Fácil" : avgHrVal < 150 ? "Z2/Base" : avgHrVal < 165 ? "Z3/Tempo" : "Z4/Z5"})
                          </div>
                        </div>
                      </div>

                      {/* Right: Planned vs Actual Comparison */}
                      <div className="space-y-3 bg-white/5 border border-white/5 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            Carga Planejada Alvo
                          </span>
                          <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                            compResult.status === "dentro do esperado" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                            compResult.status === "acima do planejado" ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-blue-950 text-blue-300 border border-blue-800"
                          }`}>
                            {compResult.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <input 
                            type="number" 
                            min="10" 
                            max="1000" 
                            step="10"
                            value={plannedLoadInput}
                            onChange={(e) => setPlannedLoadInput(Math.max(10, parseInt(e.target.value) || 0))}
                            className="bg-brand-dark/60 border border-white/10 text-white font-mono font-bold text-lg rounded-lg p-1.5 w-24 text-center focus:outline-none focus:border-brand-neon"
                          />
                          <div className="text-[10px] font-mono text-slate-400 flex-1">
                            <div>Diferença: <strong className={compResult.differencePercent > 20 ? "text-amber-400" : "text-emerald-400"}>{compResult.differencePercent > 0 ? `+${compResult.differencePercent}%` : `${compResult.differencePercent}%`}</strong></div>
                            <div className="text-[9px] text-slate-500 mt-1">Clique para ajustar a carga planejada alvo</div>
                          </div>
                        </div>

                        <div className="flex gap-1.5 mt-2.5">
                          <button onClick={() => setPlannedLoadInput(100)} className="text-[9px] font-mono bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-slate-300 border border-white/5 cursor-pointer flex-1">100 (Regenerat)</button>
                          <button onClick={() => setPlannedLoadInput(180)} className="text-[9px] font-mono bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-slate-300 border border-white/5 cursor-pointer flex-1">180 (Base Z2)</button>
                          <button onClick={() => setPlannedLoadInput(280)} className="text-[9px] font-mono bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-slate-300 border border-white/5 cursor-pointer flex-1">280 (Tiros Z4)</button>
                        </div>
                      </div>
                    </div>

                    {/* Adaptive Decision Alert box */}
                    <div className={`mt-5 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      coachDecision.action === "reduce" ? "bg-amber-950/25 border-amber-500/20 text-amber-300" :
                      coachDecision.action === "progress" ? "bg-purple-950/25 border-purple-500/20 text-purple-300" :
                      "bg-emerald-950/20 border-emerald-500/10 text-emerald-300"
                    }`}>
                      <div className="flex gap-3 items-start sm:items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                          coachDecision.action === "reduce" ? "bg-amber-950 border-amber-500/40" : "bg-emerald-950 border-emerald-500/30"
                        }`}>
                          <Award className="w-5 h-5 text-brand-neon" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">Decisão do Treinador Virtual</span>
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                              coachDecision.action === "reduce" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                            }`}>
                              {coachDecision.action === "reduce" ? "Reduzir Carga" : "Manter & Progredir"}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white mt-0.5">{coachDecision.message}</h4>
                          <p className="text-[11px] text-slate-400 font-sans mt-0.5">{coachDecision.reason}</p>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-500 font-mono block">Feedback Fisiológico</span>
                        <strong className="text-xs font-bold text-white font-mono uppercase">{coachDecision.action === "reduce" ? "Fadiga Excessiva" : "Adaptação Saudável"}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Bento Grid: Core Telemetry Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* 1. Distance */}
                <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-sans font-medium">Distance</span>
                    <Compass className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono tracking-tight text-white">
                      {activeActivity.summary.distanceKm}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">km</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1">
                    GPS Tracked Distance
                  </span>
                </div>

                {/* 2. Duration */}
                <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-sans font-medium">Timer Time</span>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono tracking-tight text-white">
                      {formatDuration(activeActivity.summary.durationSeconds)}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1">
                    Active Moving Time
                  </span>
                </div>

                {/* 3. Speed / Pace */}
                <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-sans font-medium">
                      {activeActivity.sport === "running" ? "Average Pace" : "Average Speed"}
                    </span>
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono tracking-tight text-white">
                      {activeActivity.sport === "running"
                        ? speedToPace(activeActivity.summary.avgSpeedKmh).split(" ")[0]
                        : activeActivity.summary.avgSpeedKmh}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {activeActivity.sport === "running" ? "/km" : "km/h"}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1">
                    Max: {activeActivity.sport === "running" 
                      ? speedToPace(activeActivity.summary.maxSpeedKmh) 
                      : `${activeActivity.summary.maxSpeedKmh} km/h`}
                  </span>
                </div>

                {/* 4. Heart Rate */}
                <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-sans font-medium">Heart Rate</span>
                    <Heart className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono tracking-tight text-white">
                      {activeActivity.summary.avgHeartRate || "---"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">bpm</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1">
                    Max: {activeActivity.summary.maxHeartRate || "---"} bpm
                  </span>
                </div>

                {/* Row 2 of Bento Grid (Conditionally visible based on availability) */}
                {/* 5. Calories */}
                {activeActivity.summary.calories !== null && (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-sans font-medium">Energy</span>
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono tracking-tight text-white">
                        {activeActivity.summary.calories}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">kcal</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 mt-1">
                      Caloric Exertion
                    </span>
                  </div>
                )}

                {/* 6. Elevation Gain */}
                {activeActivity.summary.ascentMeters !== null && (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-sans font-medium">Elevation Climb</span>
                      <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono tracking-tight text-white">
                        +{activeActivity.summary.ascentMeters}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">m</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 mt-1">
                      Loss: -{activeActivity.summary.descentMeters || 0}m
                    </span>
                  </div>
                )}

                {/* 7. Cycling Power */}
                {activeActivity.summary.avgPower !== null && (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-sans font-medium">Avg Power</span>
                      <Zap className="w-3.5 h-3.5 text-yellow-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono tracking-tight text-white">
                        {activeActivity.summary.avgPower}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">W</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 mt-1">
                      Max: {activeActivity.summary.maxPower || "---"} W
                    </span>
                  </div>
                )}

                {/* 8. Cadence */}
                {activeActivity.summary.avgCadence !== null && (
                  <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] font-sans font-medium">Cadence</span>
                      <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono tracking-tight text-white">
                        {activeActivity.summary.avgCadence}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {activeActivity.sport === "running" ? "spm" : "rpm"}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 mt-1">
                      {activeActivity.sport === "running" ? "Steps per Minute" : "Revolutions per Minute"}
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic activity charts and maps will be rendered in the coach's workspace */}
            </div>
          ) : (
            <div className="bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-8 flex flex-col items-center justify-center text-center py-20 shadow-sm">
              <p className="text-slate-400 font-sans text-sm">Selecione uma atividade no histórico do treinador para visualizar a telemetria detalhada.</p>
            </div>
          )}
          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="bg-black/60 border-t border-white/5 py-4 mt-12 text-[10px] text-slate-500 font-mono uppercase tracking-[0.1em]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span>KERNEL: 8.2.1-GENESIS</span>
            <span className="text-slate-700">|</span>
            <span>ATHLETIC MONITOR: OMEGA</span>
            <span className="text-slate-700">|</span>
            <p className="text-slate-400">© 2026 FIT Activity Analyzer.</p>
          </div>
          <div className="flex gap-6 items-center">
            <span>LATENCY: 14MS</span>
            <span>JITTER: 0.2MS</span>
            <span className="text-brand-neon font-bold">CONNECTION SECURE // POWERED BY GEMINI 3.5</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
