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

export interface StructuredInjury {
  id: string;
  type: string;
  startDate?: string;
  status: "em_tratamento" | "curada" | "cronica";
  side: "direito" | "esquerdo" | "ambos";
  limitation?: string;
}

export interface AthleteProfile {
  firstName?: string;
  lastName?: string;
  name: string;
  gender?: string;
  age?: number;
  birthDate?: string;
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
  startedFastInLastWorkouts?: boolean;
  hrSpikesEarly?: boolean;
  finishesStrong?: boolean;
  dropsIntenseWorkouts?: boolean;

  // Layer 1: Perfil do Atleta
  targetWeightKg?: number | string;
  multipleGoals?: string[];
  experienceLevel?: "iniciante" | "intermediario" | "avancado";
  sportsHistoryList?: string[];

  // Layer 2: Perfil Fisiológico & Saúde
  hrZoneMode?: "auto_garmin" | "manual";
  thresholdHR?: number | string;
  thresholdPace?: string;
  vo2Max?: number | string;
  baselineHRV?: number | string;
  bodyFatPercent?: number | string;
  muscleMassKg?: number | string;
  structuredInjuries?: StructuredInjury[];
  clinicalConditions?: string[];

  // Layer 3: Restrições & Viabilidade ("O que é possível?")
  preferredTimeOfDay?: "manha" | "almoco" | "tarde" | "noite";
  doubleSessionsAllowed?: boolean;
  sessionsPerDay?: 1 | 2 | number | string;
  logistics?: string;
  routineType?: string;
  turno1TimeMinutes?: number;
  turno1PreferredTime?: string;
  turno2TimeMinutes?: number;
  turno2PreferredTime?: string;
  timePerShiftMinutes?: number;
  availableTimeMinutes?: number;
  preferredTerrain?: string[];
  hasGymAccess?: boolean;
  hasTreadmillAccess?: boolean;
  hasTrackAccess?: boolean;
  equipmentsList?: string[];

  // Layer 4: Integrações
  connectedApps?: string[];

  // Layer 5: Perfil de Treinamento
  currentTargetRaceName?: string;
  currentTargetRaceDate?: string;
  targetTimeGoal?: string;
  workoutLengthPreference?: "curtos" | "longos" | "equilibrado";

  // Layer 6: Perfil Nutricional
  dietType?: "onivora" | "vegetariana" | "vegana" | "low_carb";
  allergiesIntolerances?: string;
  nutritionalGoal?: "perder_peso" | "ganhar_massa" | "manter_peso" | "performance";

  // Layer 7: Sono e Estilo de Vida
  bedTime?: string;
  wakeTime?: string;
  nightShiftWork?: boolean;
  youngChildren?: boolean;

  // Layer 8: Perfil Psicológico
  missedWorkoutReaction?: "desanimo" | "recupero_depois" | "treino_dobro" | "ignoro";
  primaryMotivation?: "saude" | "competicao" | "estetica" | "prazer";

  // Layer 9: Baseline Inicial (Dia Zero)
  baselineCooperTestMeters?: number;
  baseline5kTime?: string;
  baseline30minDistanceKm?: number;
  baselineDate?: string;

  // Layer 10: Configurações do Treinador IA & Memória Profunda
  coachStyle?: "conservador" | "equilibrado" | "agressivo";
  coachCommunication?: "tecnica" | "motivacional" | "minimalista";
  explanationFrequency?: "sempre" | "quando_muda" | "nunca";
  longTermCoachMemory?: string[];
  coachMemoryNotes?: string;
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
  decisionQuality?: "Alta" | "Moderada" | "Limitada";
  decisionQualityLabel?: string;
  sourcesUsed?: string[];
  missingSources?: string[];
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
  vo2Max?: number;
  prepScore?: number;
  garminReadiness?: number;
  subjectiveFeeling?: SubjectiveFeelingStage;
  daysWithoutTraining?: number;
  garminTrainingLoad?: number;
  garminTrainingStatus?: "sem_dados" | "mantendo" | "eficaz" | "excessivo" | "ineficiente" | "recuperacao" | string;
  hasMissedWorkoutInWeek?: boolean;
  missedWorkoutDaysCount?: number;
  dietType?: "onivora" | "vegetariana" | "vegana" | "low_carb" | string;
  athleteWeightKg?: number;
  primaryMotivation?: "saude" | "competicao" | "estetica" | "prazer" | string;
  experienceLevel?: "iniciante" | "intermediario" | "avancado" | string;
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
  ctl: number; // Chronic Training Load (fitness / capacidade adquirida)
  atl: number; // Acute Training Load (fatigue / estresse recente)
  tsb: number; // Training Stress Balance (CTL - ATL / saldo fisiológico)
  acuteChronicRatio: number; // ACWR (Razão Carga Aguda / Crônica)
  loadStatus: "normal" | "optimal" | "overreaching" | "detraining";
  trend: "stable" | "increasing" | "decreasing";
  message?: string;
}

export interface CoachContext {
  athlete: Athlete;
  currentState: AthleteState;
  history?: TrainingHistory;
  metrics?: DailyMetrics;
  goal?: Goal;
  athleteProfile?: AthleteProfile;
}

export type GuidanceCategory =
  | "seguranca"
  | "alerta"
  | "objetivo"
  | "ritmo"
  | "tecnica"
  | "nutricao"
  | "recuperacao"
  | "clima"
  | "psicologia"
  | "aprendizado";

export interface GuidanceContext {
  metrics: DailyMetrics;
  athleteProfile?: AthleteProfile;
  readinessScore?: number;
  readinessStatus?: ReadinessStatus;
  acwr?: number;
  garminRecoveryTimeHours?: number;
  hasInjury?: boolean;
  workoutIntent?: TrainingIntent | string;
  workoutDurationMinutes?: number;
  workoutName?: string;
  isLongRun?: boolean;
  temperature?: number;
  weatherCondition?: string;
  isWindy?: boolean;
  isUphill?: boolean;
  completedWorkoutsCount?: number;
  consecutiveBadSleepNights?: number;
  hasMissedWorkoutInWeek?: boolean;
  // Learned patterns flags (Aprendizado do Treinador)
  startedFastInLastWorkouts?: boolean;
  improvesWithSleep?: boolean;
  hrSpikesEarly?: boolean;
  finishesStrong?: boolean;
  dropsIntenseWorkouts?: boolean;
  recentLongRunCompleted?: boolean;
  // History log for cooldown calculation
  shownHistory?: Record<string, number>; // id -> timestamp in ms
}

export interface GuidanceMessage {
  id: string;
  categoria: GuidanceCategory;
  prioridade: number;
  titulo?: string;
  regra: (ctx: GuidanceContext) => boolean;
  texto: string | ((ctx: GuidanceContext) => string);
  validade?: number; // days
  cooldownDays?: number; // days until message can reappear
  podeCombinar?: boolean;
  objetivoFisiologico?: string;
  conflictingIds?: string[];
  isPersonalized?: boolean;
}

export interface UserAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: "athlete" | "coach" | "admin";
  createdAt: string;
  updatedAt: string;
  consentGdpr: boolean;
  consentTimestamp: string;
  termsVersion: string;
  profile?: AthleteProfile;
}

export interface AuthSession {
  token: string;
  user: UserAccount;
  expiresAt: string;
}

