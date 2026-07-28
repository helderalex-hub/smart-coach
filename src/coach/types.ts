export enum GoalType {
  GENERAL_FITNESS = "general_fitness",
  WEIGHT_LOSS = "weight_loss",
  FIVE_K = "5k",
  TEN_K = "10k",
  HALF_MARATHON = "half_marathon",
  MARATHON = "marathon",
  ULTRA = "ultra"
}

export interface Goal {
  type: GoalType;
  distanceKm?: number;
  targetPace?: string;
  targetDate?: string;
  raceName?: string;
  targetTimeSeconds?: number;
  description: string;
}

export interface Athlete {
  id?: string;
  name: string;
  age?: number;
  birthDate?: string;
  weightKg?: number;
  heightCm?: number;
  gender?: string;
  targetWeightKg?: number;
  goal?: Goal;
}

export interface AthleteProfile {
  name: string;
  gender?: string;
  age?: number;
  heightCm?: number;
  weightCurrentKg?: number;
  weightGoalKg?: number | string;
  objective?: string;
  yearsRunning?: number;
  weeklyTrainingDays?: number;
  currentWeekKm?: number;
  longestRunKm?: number;
  best5k?: string;
  best10k?: string;
  bestHalfMarathon?: string;
  restDay?: string;
  longRunDay?: string;
  injuries?: string;
  limitations?: string;
  notes?: string;
  maxHeartRate?: number | string;
  restingHeartRate?: number | string;
  weight?: number;
  height?: number;
  fitnessLevel?: string;
  trainingGoal?: string;
  estimatedPaceCurrent?: string;
  availableTimePerWorkout?: string;
  sportsHistory?: string;
  longestDistance3Months?: string;
  recentPaceOrTime?: string;
  strengthEquipment?: string;
  availableDays?: string[];
}

export enum ReadinessStatus {
  READY = "ready",
  REDUCE = "reduce",
  RECOVER = "recover"
}

export interface ReadinessBreakdownPillar {
  name: string;
  category: "sleep_qty" | "sleep_qual" | "garmin_prep" | "subjective_feeling" | "mood" | "soreness" | "hrv" | "battery" | "adjustments";
  weightPercent: number; // Base weight e.g. 15%
  pointsEarned: number;  // Points earned out of base weight
  maxPoints: number;     // Max points possible
  description: string;
  contributionPercent: number; // Contribution to final score
}

export interface TrainingCapacityItem {
  percentage: number;
  status: "optimal" | "acceptable" | "restricted";
  label: string;
  recommendation: string;
}

export interface TrainingCapacityByWorkoutType {
  mobilityCore: TrainingCapacityItem;
  lightZone2: TrainingCapacityItem;
  tempoThreshold: TrainingCapacityItem;
  intervalsVo2max: TrainingCapacityItem;
}

export interface ReadinessModulatorItem {
  label: string;
  points: number; // e.g. -4 or +2
  type: "bonus" | "penalty" | "neutral";
  reason: string;
}

export interface DataInputAvailability {
  name: string;
  present: boolean;
  source: string;
}

export interface ReadinessResult {
  status: ReadinessStatus;
  score: number;
  explanation: string;
  breakdown?: ReadinessBreakdownPillar[];
  capacities?: TrainingCapacityByWorkoutType;
  temporalTrendMessage?: string;
  formulaSummary?: string;
  confidenceScore?: number; // 0-100%
  dataInputs?: DataInputAvailability[];
  modulatorsBreakdown?: ReadinessModulatorItem[];
  dailyPhysiologicalObjectives?: string[];
}

export interface AthleteState {
  date: string;
  weightKg?: number;
  sleepHours?: number;
  sleepScore?: number;
  stressScore?: number;
  fatigueScore?: number;
  readiness?: ReadinessResult;
}

export type SubjectiveFeelingStage = "muito_bem" | "bem" | "normal" | "cansado" | "muito_cansado";

export interface DailyMetrics {
  date?: string;
  sleepHours: number;
  sleepScore?: number;
  fatigueScore?: number;
  stressScore?: number;
  bodyBattery?: number;
  hrv?: number;
  restingHeartRate?: number;
  muscleSoreness?: number;
  hasInjury?: boolean;
  injurySeverity?: "mild" | "clinical";
  hrvBaseline?: number;
  hrvStatus?: "balanced" | "unbalanced";
  mood?: string;
  weight?: number;
  prepScore?: number;
  garminReadiness?: number;
  subjectiveFeeling?: SubjectiveFeelingStage;
  daysWithoutTraining?: number;
  garminTrainingLoad?: number;
}

export enum TrainingIntent {
  RECOVERY = "recovery",
  AEROBIC_BASE = "aerobic_base",
  THRESHOLD = "threshold",
  VO2MAX = "vo2max",
  LONG_RUN = "long_run",
  STRENGTH = "strength",
  MOBILITY = "mobility",
  REST = "rest"
}

export interface WorkoutStep {
  name: string;
  durationSeconds: number;
  intensity: string; // e.g. "Low", "Z2", "Threshold", "Max effort"
  description?: string;
  stepType?: string; // e.g. "warmup", "main_set", "cooldown", "recovery"
  repetitions?: number;
  sets?: number;
  recoverySeconds?: number;
  instruction?: string;
}

export interface WorkoutPrescription {
  name: string;
  intent: TrainingIntent;
  durationMinutes: number;
  description: string;
  steps: WorkoutStep[];
  day?: string;
  isAdapted?: boolean;
  objective?: string;
  observations?: string[];
  ifTired?: string;
}

export interface ScheduledWorkout {
  day: string; // e.g. "Monday", "Segunda-feira"
  workout: WorkoutPrescription;
}

export interface WeekOverview {
  title: string;
  objective: string;
  predictedLoad: string;
  keyWorkout: string;
  attentionPoint: string;
}

export interface WeeklyPlan {
  weekNumber: number;
  workouts: ScheduledWorkout[];
  phase: string; // e.g. "Base", "Building", "Peak", "Taper"
  overview?: WeekOverview;
}

export interface TrainingCycle {
  cycleNumber: number;
  weeks: WeeklyPlan[];
}

export interface TrainingPlan {
  athleteName: string;
  goal: Goal;
  startDate: string;
  endDate?: string;
  cycles: TrainingCycle[];
  isFallback?: boolean;
}

export interface TrainingHistory {
  weekDistanceKm: number;
  monthDistanceKm: number;
  totalRuns: number;
  longestRunKm: number;
  averageDistanceKm: number;
  averageHr?: number;
  averagePace?: string;
}

export interface TrainingLoad {
  ctl: number; // Chronic Training Load (fitness)
  atl: number; // Acute Training Load (fatigue)
  acuteChronicRatio: number; // ATL/CTL ratio (sweet spot: 0.8 - 1.3)
  loadStatus: "normal" | "optimal" | "overreaching" | "detraining";
  trend: "stable" | "increasing" | "decreasing";
}

export interface CoachContext {
  athlete: Athlete;
  currentState: AthleteState;
  history?: TrainingHistory;
  metrics?: DailyMetrics;
  goal?: Goal;
  athleteProfile?: AthleteProfile;
}
