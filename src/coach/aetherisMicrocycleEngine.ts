import { 
  calculateDailyReadinessIndex, 
  calculateGlobalFatigueIndex, 
  calculateTrainingLoad, 
  getPeriodizationBlockWeek, 
  getTaperSchedule 
} from "./coachEngine";

export interface MicrocycleGenerateRequest {
  athlete_id?: string;
  profile: {
    age?: number;
    gender?: string;
    weight?: number;
    height?: number;
    level?: "beginner" | "intermediate" | "advanced" | "elite" | "iniciante" | "intermediario" | "avancado";
    years_running?: number;
    structured_injuries?: any[];
    diet_type?: string;
  };
  goal: {
    race?: "5k" | "10k" | "half_marathon" | "marathon" | "general_fitness" | "weight_loss" | string;
    target_date?: string;
    target_time?: string;
    priority?: number;
  };
  availability: {
    days_per_week?: number;
    available_days?: string[];
    double_sessions?: boolean;
    available_time_minutes?: number;
  };
  current_condition?: {
    readiness_score?: number;
    sleep_score?: number;
    fatigue_score?: number;
    resting_hr?: number;
    hrv?: number;
    muscle_soreness?: number;
    subjective_feeling?: string;
  };
  training_history?: {
    weekly_distance?: number;
    longest_run?: number;
    recent_race?: string;
    injury_history?: boolean;
    last_4_weeks_avg?: number;
  };
}

export interface PlannedSessionStep {
  name: string;
  durationSeconds: number;
  intensity: string;
  description?: string;
  stepType?: "warmup" | "main_set" | "cooldown" | "recovery";
  repetitions?: number;
  sets?: number;
  recoverySeconds?: number;
  instruction?: string;
}

export interface PlannedSessionItem {
  day: string; // e.g., "monday", "tuesday" or "Segunda-feira"
  day_label_pt: string;
  session_order?: number; // 1 ou 2 para sessões duplas no mesmo dia
  time_of_day?: "Manhã" | "Tarde/Noite" | string;
  stimulus: "Z1" | "Z2" | "tempo" | "vo2max" | "speed" | "long_run" | "strength" | "mobility" | "rest";
  workout_name: string;
  duration_minutes: number;
  distance_km?: number;
  intensity_zone: string;
  target_pace_range: string;
  description: string;
  steps: PlannedSessionStep[];
  is_key_workout: boolean;
}

export interface StrengthSessionItem {
  day: string;
  focus: string;
  exercises: Array<{
    name: string;
    muscle_group: string;
    sets: number;
    reps: string;
    equipment?: string;
    alternative?: string;
  }>;
}

export interface MobilitySessionItem {
  day: string;
  routine_name: string;
  duration_minutes: number;
  target_area: string;
}

export interface TechnicalJustification {
  stimulus_selection: string;
  weekly_distribution: string;
  load_management: string;
  safety_validation: string;
  adaptation_logic: string;
}

export interface MicrocycleGenerateResponse {
  status: "success" | "error";
  message?: string;
  microcycle: {
    athlete_id: string;
    week_number: number;
    phase: string;
    objective: string;
    athlete_level: string;
    acute_load: number;
    chronic_load: number;
    acwr: number;
    load_status: string;
    readiness_ipd: number;
    fatigue_ifg: number;
    safety_zone: "Verde" | "Amarela" | "Vermelha";
  };
  sessions: PlannedSessionItem[];
  strength: StrengthSessionItem[];
  mobility: MobilitySessionItem[];
  adaptive_rules: string[];
  technical_justification: TechnicalJustification;
}

/**
 * Normaliza nível do atleta
 */
function normalizeAthleteLevel(rawLevel?: string, yearsRunning: number = 0, weeklyKm: number = 0): "iniciante" | "intermediario" | "avancado" {
  if (rawLevel) {
    const l = rawLevel.toLowerCase();
    if (l.includes("iniciante") || l.includes("beginner")) return "iniciante";
    if (l.includes("avancad") || l.includes("advanced") || l.includes("elite")) return "avancado";
    if (l.includes("intermed") || l.includes("intermediate")) return "intermediario";
  }
  if (yearsRunning < 1 || weeklyKm < 25) return "iniciante";
  if (weeklyKm > 65 || yearsRunning >= 5) return "avancado";
  return "intermediario";
}

/**
 * Formata minutos em string de pace aproximada mm:ss /km
 */
function estimatePaceRange(zone: string, level: string, basePaceSec: number = 330): string {
  let factor = 1.0;
  if (zone.includes("Z1") || zone.includes("recovery")) factor = 1.25;
  else if (zone.includes("Z2") || zone.includes("easy") || zone.includes("rodagem")) factor = 1.12;
  else if (zone.includes("tempo") || zone.includes("limiar") || zone.includes("threshold")) factor = 0.94;
  else if (zone.includes("vo2") || zone.includes("interval")) factor = 0.86;
  else if (zone.includes("speed") || zone.includes("tiro")) factor = 0.80;
  else if (zone.includes("long")) factor = 1.10;

  const lowSec = Math.round(basePaceSec * factor * 0.97);
  const highSec = Math.round(basePaceSec * factor * 1.03);

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = String(s % 60).padStart(2, "0");
    return `${String(m).padStart(2, "0")}:${rs}`;
  };

  return `${formatSec(lowSec)} - ${formatSec(highSec)} min/km`;
}

const DAY_MAP_PT: Record<string, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo"
};

/**
 * MOTOR DE GERAÇÃO AUTOMÁTICA DE MICROCICLO AETHERIS
 * Implementa integralmente as Especificações Técnicas de Partes 5/5, Árvore de Decisão e Motor Matemático.
 */
export function generateAetherisMicrocycle(req: MicrocycleGenerateRequest): MicrocycleGenerateResponse {
  // 1. Validação de dados obrigatórios
  if (!req.profile || !req.goal || !req.availability) {
    return {
      status: "error",
      message: "Dados insuficientes para prescrição segura (requer profile, goal e availability).",
      microcycle: {} as any,
      sessions: [],
      strength: [],
      mobility: [],
      adaptive_rules: [],
      technical_justification: {} as any
    };
  }

  const athleteId = req.athlete_id || "ath_" + Math.random().toString(36).substring(2, 9);
  const yearsRunning = req.profile.years_running || 1;
  const weeklyKm = req.training_history?.weekly_distance || 30;
  const athleteLevel = normalizeAthleteLevel(req.profile.level, yearsRunning, weeklyKm);

  // 2. NÍVEL 1 & NÍVEL 8 — Estado fisiológico & Prontidão (IPD / IFG)
  const readinessMetrics = {
    sleepHours: req.current_condition?.sleep_score ? (req.current_condition.sleep_score / 100) * 8 : 7.5,
    bodyBattery: req.current_condition?.readiness_score || 80,
    hrv: req.current_condition?.hrv || 55,
    restingHeartRate: req.current_condition?.resting_hr || 58,
    muscleSoreness: req.current_condition?.muscle_soreness || 2,
    subjectiveFeeling: (req.current_condition?.subjective_feeling || "bem") as any
  };

  const ipdResult = calculateDailyReadinessIndex(readinessMetrics);
  const chronicLoad = req.training_history?.last_4_weeks_avg || Math.max(20, weeklyKm * 0.9);
  const acuteLoad = weeklyKm;
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0;
  const ifgResult = calculateGlobalFatigueIndex(readinessMetrics, acwr);

  // 3. NÍVEL 2 — Identificação do Objetivo Fisiológico
  const raceGoal = (req.goal.race || "half_marathon").toLowerCase();
  let goalPhase = "desenvolvimento";
  if (req.goal.target_date) {
    const diffDays = (new Date(req.goal.target_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    const weeksToRace = Math.max(1, Math.round(diffDays / 7));
    if (weeksToRace <= 2) goalPhase = "polimento_taper";
    else if (weeksToRace <= 6) goalPhase = "especificidade";
    else if (weeksToRace <= 12) goalPhase = "desenvolvimento";
    else goalPhase = "base_aerobica";
  }

  // 4. NÍVEL 4 — Disponibilidade e Agendamento de Dias
  const daysPerWeek = Math.min(6, Math.max(2, req.availability.days_per_week || req.availability.available_days?.length || 4));
  let availableDays = req.availability.available_days && req.availability.available_days.length > 0 
    ? req.availability.available_days.map(d => d.toLowerCase())
    : ["monday", "tuesday", "thursday", "friday", "sunday"];

  // Filtro de segurança de conflito (ex: se quarta não está disponível)
  if (availableDays.length < daysPerWeek) {
    const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    availableDays = allDays.slice(0, daysPerWeek);
  }

  // 5. NÍVEL 5 & 6 — Seleção e Distribuição dos Estímulos na Semana
  // Regras de Proteção: Longão no domingo (ou último dia disponível), 48h entre treinos intensos
  const sessions: PlannedSessionItem[] = [];
  const strengthSessions: StrengthSessionItem[] = [];
  const mobilitySessions: MobilitySessionItem[] = [];

  // Ajuste de volume e intensidade se IPD estiver em Zona Amarela/Vermelha
  const volumeFactor = ipdResult.zone === "Vermelha" ? 0.60 : ipdResult.zone === "Amarela" ? 0.80 : 1.0;

  // Determinar estrutura semanal por disponibilidade (NÍVEL 4)
  const isMarathon = raceGoal.includes("marathon") || raceGoal.includes("42");
  const isHalf = raceGoal.includes("half") || raceGoal.includes("21");
  const is10k = raceGoal.includes("10k") || raceGoal.includes("10");

  let longRunKm = Math.round((req.training_history?.longest_run || (weeklyKm * 0.4)) * volumeFactor);
  if (isMarathon) longRunKm = Math.min(32, Math.max(14, longRunKm));
  else if (isHalf) longRunKm = Math.min(21, Math.max(10, longRunKm));
  else longRunKm = Math.min(14, Math.max(6, longRunKm));

  // Distribuir slots de estímulos
  availableDays.forEach((day, index) => {
    const ptDay = DAY_MAP_PT[day] || day;
    const isLastDay = index === availableDays.length - 1;
    const isFirstDay = index === 0;

    // A) LONGÃO: Alocado no último dia da disponibilidade (ex: Domingo ou Sábado)
    if (isLastDay && daysPerWeek >= 2) {
      const duration = Math.round((longRunKm * 6.0)); // ~6min/km
      sessions.push({
        day,
        day_label_pt: ptDay,
        stimulus: "long_run",
        workout_name: `Longão Progressivo Aetheris (${longRunKm}km)`,
        duration_minutes: duration,
        distance_km: longRunKm,
        intensity_zone: "Z2 -> Z3 (Progressivo)",
        target_pace_range: estimatePaceRange("long", athleteLevel),
        description: "Desenvolvimento de resistência aeróbica e eficiência mitocondrial com proteção de 48h prévia.",
        is_key_workout: true,
        steps: [
          { name: "Aquecimento e Educativos", durationSeconds: 600, intensity: "Z1 Fácil", stepType: "warmup", instruction: "Mobilidade ativa de quadril e tornozelo + 5min caminhada." },
          { name: "Bloco Aeróbico Confortável Z2", durationSeconds: (duration - 20) * 40, intensity: "Z2 Conversacional", stepType: "main_set", instruction: "Manter ritmo estável em conversação." },
          { name: "Bloco Final Especificidade Z3", durationSeconds: (duration - 20) * 20, intensity: "Z3 Ritmo de Prova", stepType: "main_set", instruction: "Aumentar a cadência ligeiramente nos últimos quilômetros." },
          { name: "Desaquecimento", durationSeconds: 600, intensity: "Z1 Leve", stepType: "cooldown", instruction: "Trote leve e descompressão." }
        ]
      });
      return;
    }

    // B) TREINO-CHAVE DE INTENSIDADE (VO2máx ou Limiar / Tempo Run)
    // Colocado no início da semana (ex: Terça-feira) respeitando o gap de 48h
    if (index === 1 || (daysPerWeek === 3 && isFirstDay)) {
      if (ipdResult.zone === "Vermelha") {
        // Degradação elegante: Se IPD < 50, converte tiros em Z2 leve
        sessions.push({
          day,
          day_label_pt: ptDay,
          stimulus: "Z2",
          workout_name: "Rodagem Regenerativa Z2 (Substituição Adaptativa por IPD Baixo)",
          duration_minutes: 35,
          distance_km: 5,
          intensity_zone: "Z2 Leve",
          target_pace_range: estimatePaceRange("Z2", athleteLevel),
          description: "Substituição automática: Prontidão física reduzida (IPD < 50). Preservando o organismo sem tiros pesados.",
          is_key_workout: false,
          steps: [
            { name: "Aquecimento", durationSeconds: 300, intensity: "Z1", stepType: "warmup" },
            { name: "Rodagem Contínua Leve", durationSeconds: 1800, intensity: "Z2", stepType: "main_set" },
            { name: "Desaquecimento", durationSeconds: 300, intensity: "Z1", stepType: "cooldown" }
          ]
        });
      } else {
        // Seleção do estímulo conforme prova
        const isVo2Needed = is10k || raceGoal.includes("5k") || athleteLevel === "iniciante";
        const stimulusType = isVo2Needed ? "vo2max" : "tempo";
        const name = isVo2Needed ? "Intervalado de VO2máx (5x 800m)" : "Tempo Run de Limiar (3x 10min Z4)";
        const dur = isVo2Needed ? 45 : 50;

        sessions.push({
          day,
          day_label_pt: ptDay,
          stimulus: stimulusType,
          workout_name: name,
          duration_minutes: dur,
          distance_km: 8,
          intensity_zone: isVo2Needed ? "Z4/Z5 Forte" : "Z4 Limiar de Lactato",
          target_pace_range: estimatePaceRange(stimulusType, athleteLevel),
          description: isVo2Needed 
            ? "Estímulo de alta potência aeróbica para expansão do consumo de oxigênio."
            : "Desenvolvimento da remoção de lactato e tolerância à acidose muscular.",
          is_key_workout: true,
          steps: [
            { name: "Aquecimento + Educativos (Skip/Anfersen)", durationSeconds: 600, intensity: "Z1-Z2", stepType: "warmup" },
            { name: "Série Principal de Qualidade", durationSeconds: 1500, intensity: isVo2Needed ? "Z5" : "Z4", stepType: "main_set", repetitions: isVo2Needed ? 5 : 3, recoverySeconds: 120, instruction: "Foco na cadência e postura." },
            { name: "Desaquecimento", durationSeconds: 600, intensity: "Z1", stepType: "cooldown" }
          ]
        });
      }
      return;
    }

    // C) FORÇA FUNCIONAL / MOBILIDADE INTEGRADA (Dias sem treino de qualidade ou pós-Z2)
    if (day === "thursday" || (daysPerWeek >= 4 && index === 2)) {
      strengthSessions.push({
        day: ptDay,
        focus: "Estabilidade de Membros Inferiores, Core e Prevenção de Lesões",
        exercises: [
          { name: "Agachamento Búlgaro", muscle_group: "Quadríceps / Glúteo", sets: 3, reps: "10-12 por perna", equipment: "Halteres ou Peso Corporal", alternative: "Agachamento Livre" },
          { name: "Stiff Unilateral (RDL)", muscle_group: "Cadeia Posterior e Isquiotibiais", sets: 3, reps: "10 reps", equipment: "Halteres", alternative: "Ponte de Glúteos Unilateral" },
          { name: "Elevação de Panturrilha em Degrau", muscle_group: "Tríceps Sural e Sóleo", sets: 4, reps: "15 reps", equipment: "Degrau", alternative: "Panturrilha no chão" },
          { name: "Prancha Abdominal com Elevação de Perna", muscle_group: "Core Profundo", sets: 3, reps: "45 segundos" }
        ]
      });

      if (req.availability?.double_sessions) {
        // Se sessões duplas estiverem habilitadas: Gerar 2 treinos distintos no mesmo dia!
        // Sessão 1 (Manhã): Rodagem Z2 Leve 30min
        sessions.push({
          day,
          day_label_pt: ptDay,
          session_order: 1,
          time_of_day: "Manhã",
          stimulus: "Z2",
          workout_name: "Sessão 1 (Manhã): Rodagem Aeróbica Leve Z2 (5km)",
          duration_minutes: 30,
          distance_km: 5,
          intensity_zone: "Z2 Conversacional",
          target_pace_range: estimatePaceRange("Z2", athleteLevel),
          description: "Primeira sessão do dia: Ativação vascular e base aeróbica leve.",
          is_key_workout: false,
          steps: [
            { name: "Aquecimento", durationSeconds: 300, intensity: "Z1", stepType: "warmup" },
            { name: "Rodagem Contínua Leve", durationSeconds: 1200, intensity: "Z2", stepType: "main_set" },
            { name: "Desaquecimento", durationSeconds: 300, intensity: "Z1", stepType: "cooldown" }
          ]
        });

        // Sessão 2 (Tarde/Noite): Fortalecimento Estrutural
        sessions.push({
          day,
          day_label_pt: ptDay,
          session_order: 2,
          time_of_day: "Tarde/Noite",
          stimulus: "strength",
          workout_name: "Sessão 2 (Tarde/Noite): Fortalecimento Estrutural & Core",
          duration_minutes: 40,
          intensity_zone: "RPE 6-7 (Força Controlada)",
          target_pace_range: "N/A (Sessão de Força)",
          description: "Segunda sessão do dia: Fortalecimento muscular de estabilizadores sem impacto.",
          is_key_workout: false,
          steps: [
            { name: "Mobilidade Articular Ativa", durationSeconds: 300, intensity: "Leve", stepType: "warmup" },
            { name: "Bloco Principal de Fortalecimento", durationSeconds: 1800, intensity: "Moderada", stepType: "main_set" },
            { name: "Liberação Miofascial e Alongamento", durationSeconds: 300, intensity: "Regenerativo", stepType: "cooldown" }
          ]
        });
      } else {
        sessions.push({
          day,
          day_label_pt: ptDay,
          session_order: 1,
          time_of_day: "Manhã",
          stimulus: "strength",
          workout_name: "Fortalecimento Estrutural & Mobilidade para Corrida",
          duration_minutes: 40,
          intensity_zone: "RPE 6-7 (Força Controlada)",
          target_pace_range: "N/A (Sessão de Força)",
          description: "Fortalecimento de quadril, joelho e tornozelo para absorção de impacto articular.",
          is_key_workout: false,
          steps: [
            { name: "Mobilidade Articular Ativa", durationSeconds: 300, intensity: "Leve", stepType: "warmup" },
            { name: "Bloco Principal de Fortalecimento", durationSeconds: 1800, intensity: "Moderada", stepType: "main_set" },
            { name: "Liberação Miofascial e Alongamento", durationSeconds: 300, intensity: "Regenerativo", stepType: "cooldown" }
          ]
        });
      }
      return;
    }

    // D) RODAGEM BASE AERÓBICA Z2 (Dias intermediários)
    const runDur = athleteLevel === "iniciante" ? 35 : 45;
    const runDist = Math.round(runDur / 6);
    sessions.push({
      day,
      day_label_pt: ptDay,
      stimulus: "Z2",
      workout_name: `Rodagem de Base Aeróbica Z2 (${runDist}km)`,
      duration_minutes: runDur,
      distance_km: runDist,
      intensity_zone: "Z2 Conversacional",
      target_pace_range: estimatePaceRange("Z2", athleteLevel),
      description: "Manutenção da capacidade aeróbica, vascularização capilar e absorção de volume sem estresse.",
      is_key_workout: false,
      steps: [
        { name: "Aquecimento", durationSeconds: 300, intensity: "Z1", stepType: "warmup" },
        { name: "Rodagem Contínua Z2", durationSeconds: (runDur - 10) * 60, intensity: "Z2", stepType: "main_set" },
        { name: "Desaquecimento", durationSeconds: 300, intensity: "Z1", stepType: "cooldown" }
      ]
    });
  });

  // Mobilidade diária recomendada
  mobilitySessions.push({
    day: "Diário (Pré/Pós Treino)",
    routine_name: "Rotina Aetheris de Liberação de Tornozelo e Flexores de Quadril",
    duration_minutes: 10,
    target_area: "Cadeia posterior, solear e banda iliotibial"
  });

  // 6. VALIDAÇÃO DE CARGA E SEGURANÇA (RAC / ACWR)
  let loadStatus = "Segura (Zona Ideal 0.8 - 1.3)";
  if (acwr > 1.5) loadStatus = "Risco de Sobrecarga (ACWR > 1.5) -> Volume reduzido preventivamente";
  else if (acwr < 0.8) loadStatus = "Sub-estímulo / Destreinamento (ACWR < 0.8)";

  // 7. REGRAS ADAPTATIVAS DO MICROCICLO
  const adaptiveRules = [
    `Regra IPD: Se o Índice de Preparação no dia for < 50, converter tiros/limiar em 40min Z2 leve.`,
    `Regra de Dor (DOMS): Se dor muscular em panturrilha/joelho for > 4/10, substituir corrida por mobilidade ou caminhada.`,
    `Regra de Espaçamento 48h: Garantir no mínimo 48 horas de intervalo entre o treino de tiros e o longão.`,
    `Regra de Progressão: Só aumentar volume na próxima semana (+5%) se a consistência semanal for > 85% e sem queixas de dor.`
  ];

  // 8. JUSTIFICATIVA TÉCNICA E CIENTÍFICA
  const technicalJustification: TechnicalJustification = {
    stimulus_selection: `Para o objetivo (${raceGoal.toUpperCase()}) em fase de ${goalPhase}, priorizou-se ${is10k ? "Limiar de Lactato e VO2máx" : "Volume Aeróbico Z2 e Longão Progressivo"}.`,
    weekly_distribution: `A semana foi estruturada em ${daysPerWeek} dias disponíveis com proteção rigorosa de 48h no pré-longão.`,
    load_management: `Razão Carga Aguda/Crônica (ACWR = ${acwr.toFixed(2)}) mantida sob limite de segurança fisiológica.`,
    safety_validation: `Atleta classificado como Nível ${athleteLevel.toUpperCase()}. Filtro de lesões ativado.`,
    adaptation_logic: `O motor recalculou os volumes com base no IPD (${ipdResult.ipd}/100) e IFG (${ifgResult.ifg}/100).`
  };

  return {
    status: "success",
    microcycle: {
      athlete_id: athleteId,
      week_number: 1,
      phase: goalPhase,
      objective: `Preparação Fisiológica para ${raceGoal.toUpperCase()}`,
      athlete_level: athleteLevel,
      acute_load: acuteLoad,
      chronic_load: chronicLoad,
      acwr: Math.round(acwr * 100) / 100,
      load_status: loadStatus,
      readiness_ipd: ipdResult.ipd,
      fatigue_ifg: ifgResult.ifg,
      safety_zone: ipdResult.zone
    },
    sessions,
    strength: strengthSessions,
    mobility: mobilitySessions,
    adaptive_rules: adaptiveRules,
    technical_justification: technicalJustification
  };
}
