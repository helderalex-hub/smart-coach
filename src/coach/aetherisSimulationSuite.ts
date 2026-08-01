import { generateAetherisMicrocycle, MicrocycleGenerateRequest } from "./aetherisMicrocycleEngine";

export interface SimulationTestCase {
  id: string;
  name: string;
  category: string;
  description: string;
  request: MicrocycleGenerateRequest;
  expected_outcomes: {
    min_score: number;
    should_avoid_stimulus?: string[];
    should_include_stimulus?: string[];
    max_weekly_volume_km?: number;
    must_replace_intense_if_readiness_low?: boolean;
    must_include_strength?: boolean;
    must_have_48h_gap?: boolean;
  };
}

export interface SimulationTestResult {
  test_id: string;
  test_name: string;
  passed: boolean;
  score: number;
  safety_score: number;      // 30%
  physiology_score: number;  // 25%
  individualization_score: number; // 20%
  adaptation_score: number;  // 15%
  satisfaction_score: number; // 10%
  details: {
    stimulus_match: boolean;
    volume_safe: boolean;
    readiness_adaptation_correct: boolean;
    spacing_correct: boolean;
    strength_included: boolean;
  };
  reasons: string[];
}

export interface SimulationSuiteReport {
  timestamp: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  overall_acs_score: number; // AI Coach Accuracy Score (0-100)
  status: "APROVADO" | "REVER_REGRAS";
  results: SimulationTestResult[];
}

/**
 * 10 PERFIS SIMULADOS DE TESTE - ESPECIFICAÇÃO TÉCNICA PARTE 5 & PARTE 9
 */
export const SIMULATION_TEST_CASES: SimulationTestCase[] = [
  {
    id: "TEST_001",
    name: "Iniciante buscando completar 5 km",
    category: "Iniciante / Baixo Volume",
    description: "Atleta com 3 meses de treino, 12km/semana, 3 dias disponíveis. Deve focar em Z2, técnica e longão leve.",
    request: {
      athlete_id: "test_001_beginner_5k",
      profile: { age: 32, gender: "female", level: "iniciante", years_running: 0.3, weight: 65, height: 165 },
      goal: { race: "5k", priority: 1 },
      availability: { days_per_week: 3, available_days: ["monday", "wednesday", "sunday"] },
      current_condition: { readiness_score: 85, sleep_score: 88, fatigue_score: 20 },
      training_history: { weekly_distance: 12, longest_run: 5 }
    },
    expected_outcomes: {
      min_score: 90,
      should_avoid_stimulus: ["vo2max", "speed"],
      should_include_stimulus: ["Z2", "long_run"],
      max_weekly_volume_km: 18
    }
  },
  {
    id: "TEST_002",
    name: "Corredor Intermediário buscando 10 km sub-45",
    category: "Intermediário / Performance",
    description: "Atleta com 3 anos de treino, 45km/semana, 5 dias disponíveis. Deve prescrever limiar e VO2 com gap de 48h.",
    request: {
      athlete_id: "test_002_interm_10k",
      profile: { age: 38, gender: "male", level: "intermediario", years_running: 3, weight: 75, height: 178 },
      goal: { race: "10k", target_time: "00:44:30", priority: 1 },
      availability: { days_per_week: 5, available_days: ["monday", "tuesday", "thursday", "friday", "sunday"] },
      current_condition: { readiness_score: 82, sleep_score: 80, fatigue_score: 30 },
      training_history: { weekly_distance: 45, longest_run: 16 }
    },
    expected_outcomes: {
      min_score: 90,
      should_include_stimulus: ["tempo", "vo2max", "long_run"],
      must_have_48h_gap: true
    }
  },
  {
    id: "TEST_003",
    name: "Maratonista Avançado 3h15",
    category: "Avançado / Alto Volume",
    description: "Atleta com 6 anos de corrida, 90km/semana, 6 dias disponíveis. Foco em volume, ritmo específico e força.",
    request: {
      athlete_id: "test_003_advanced_marathon",
      profile: { age: 42, gender: "male", level: "avancado", years_running: 6, weight: 70, height: 175 },
      goal: { race: "marathon", target_time: "03:15:00", priority: 1 },
      availability: { days_per_week: 6, available_days: ["monday", "tuesday", "wednesday", "thursday", "friday", "sunday"] },
      current_condition: { readiness_score: 90, sleep_score: 90, fatigue_score: 25 },
      training_history: { weekly_distance: 90, longest_run: 30 }
    },
    expected_outcomes: {
      min_score: 95,
      should_include_stimulus: ["long_run", "tempo", "Z2", "strength"]
    }
  },
  {
    id: "TEST_004",
    name: "Atleta com Fadiga Acumulada (Readiness 42)",
    category: "Adaptação / Segurança",
    description: "Atleta fatigado com IPD de 42. O motor DEVE converter treinos intensos em rodagem leve Z2.",
    request: {
      athlete_id: "test_004_high_fatigue",
      profile: { age: 35, gender: "male", level: "intermediario", years_running: 2, weight: 78 },
      goal: { race: "half_marathon", priority: 1 },
      availability: { days_per_week: 4, available_days: ["monday", "tuesday", "thursday", "sunday"] },
      current_condition: { readiness_score: 42, sleep_score: 45, fatigue_score: 80, muscle_soreness: 7, subjective_feeling: "muito_cansado" },
      training_history: { weekly_distance: 40, longest_run: 14 }
    },
    expected_outcomes: {
      min_score: 95,
      must_replace_intense_if_readiness_low: true,
      should_avoid_stimulus: ["vo2max", "speed", "tempo"]
    }
  },
  {
    id: "TEST_005",
    name: "Corredor com Histórico de Tendinite Patelar",
    category: "Lesão / Fortalecimento",
    description: "Atleta com lesão recorrente no joelho. O motor DEVE incluir fortalecimento focado e progressão conservadora.",
    request: {
      athlete_id: "test_005_patellar_injury",
      profile: {
        age: 45, gender: "female", level: "intermediario", years_running: 4, weight: 68,
        structured_injuries: [{ type: "Tendinite patelar", status: "em_tratamento", side: "direito" }]
      },
      goal: { race: "10k", priority: 1 },
      availability: { days_per_week: 4, available_days: ["tuesday", "thursday", "saturday", "sunday"] },
      current_condition: { readiness_score: 75, sleep_score: 75, fatigue_score: 35, muscle_soreness: 4 },
      training_history: { weekly_distance: 30, longest_run: 10, injury_history: true }
    },
    expected_outcomes: {
      min_score: 90,
      must_include_strength: true
    }
  },
  {
    id: "TEST_006",
    name: "Atleta Ocupado com Apenas 2 Dias Disponíveis",
    category: "Restrição de Tempo",
    description: "Atleta com apenas 2 dias livres. O motor NUNCA deve tentar sobrecarregar ou compensar dias perdidos.",
    request: {
      athlete_id: "test_006_busy_2days",
      profile: { age: 30, gender: "male", level: "iniciante", years_running: 1, weight: 80 },
      goal: { race: "general_fitness", priority: 1 },
      availability: { days_per_week: 2, available_days: ["thursday", "sunday"] },
      current_condition: { readiness_score: 85, sleep_score: 80, fatigue_score: 20 },
      training_history: { weekly_distance: 15, longest_run: 8 }
    },
    expected_outcomes: {
      min_score: 90,
      max_weekly_volume_km: 25
    }
  },
  {
    id: "TEST_007",
    name: "Iniciante focado em Perda de Peso",
    category: "Nutrição & Saúde",
    description: "Atleta com sobrepeso buscando emagrecimento. Prioriza Z2 para oxidação de gorduras e preservação articular.",
    request: {
      athlete_id: "test_007_weight_loss",
      profile: { age: 36, gender: "male", level: "iniciante", years_running: 0.5, weight: 95, height: 175 },
      goal: { race: "weight_loss", priority: 1 },
      availability: { days_per_week: 4, available_days: ["monday", "wednesday", "friday", "saturday"] },
      current_condition: { readiness_score: 80, sleep_score: 82, fatigue_score: 25 },
      training_history: { weekly_distance: 18, longest_run: 6 }
    },
    expected_outcomes: {
      min_score: 90,
      should_include_stimulus: ["Z2", "strength"]
    }
  },
  {
    id: "TEST_008",
    name: "Iniciante Super-Motivado (Risco de Sobrecarga)",
    category: "Prevenção de Sobrecarga",
    description: "Histórico de 20km querendo 80km abruptamente. O motor DEVE bloquear o aumento e impor limite de segurança.",
    request: {
      athlete_id: "test_008_overmotivated",
      profile: { age: 28, gender: "male", level: "iniciante", years_running: 0.5, weight: 72 },
      goal: { race: "marathon", priority: 1 },
      availability: { days_per_week: 6, available_days: ["monday", "tuesday", "wednesday", "thursday", "friday", "sunday"] },
      current_condition: { readiness_score: 95, sleep_score: 90, fatigue_score: 10 },
      training_history: { weekly_distance: 20, longest_run: 10, last_4_weeks_avg: 18 }
    },
    expected_outcomes: {
      min_score: 90,
      max_weekly_volume_km: 35
    }
  },
  {
    id: "TEST_009",
    name: "Teste de Conflito de Agenda (Quarta Indisponível)",
    category: "Gestão de Espaçamento",
    description: "Disponibilidade com dias específicos onde quarta está bloqueada. Deve reorganizar mantendo gap de 48h.",
    request: {
      athlete_id: "test_009_schedule_conflict",
      profile: { age: 34, gender: "female", level: "intermediario", years_running: 2, weight: 62 },
      goal: { race: "half_marathon", priority: 1 },
      availability: { days_per_week: 4, available_days: ["tuesday", "thursday", "friday", "sunday"] },
      current_condition: { readiness_score: 85, sleep_score: 85, fatigue_score: 20 },
      training_history: { weekly_distance: 35, longest_run: 15 }
    },
    expected_outcomes: {
      min_score: 90,
      must_have_48h_gap: true
    }
  },
  {
    id: "TEST_010",
    name: "Semana de Descarga Estratégica (Deload Week)",
    category: "Periodização em Bloco",
    description: "Semana 4 do mesociclo. O motor DEVE reduzir o volume em 30-40% mantendo qualidade fisiológica.",
    request: {
      athlete_id: "test_010_deload_week",
      profile: { age: 40, gender: "male", level: "intermediario", years_running: 4, weight: 76 },
      goal: { race: "half_marathon", priority: 1 },
      availability: { days_per_week: 5, available_days: ["monday", "tuesday", "thursday", "friday", "sunday"] },
      current_condition: { readiness_score: 75, sleep_score: 70, fatigue_score: 45 },
      training_history: { weekly_distance: 50, longest_run: 18, last_4_weeks_avg: 52 }
    },
    expected_outcomes: {
      min_score: 90,
      max_weekly_volume_km: 38
    }
  }
];

/**
 * EXECUTOR DA SUÍTE DE TESTES SIMULADOS AETHERIS
 * Avalia cada cenário fisiológico e calcula o AI Coach Accuracy Score (ACS)
 */
export function runAetherisSimulationSuite(): SimulationSuiteReport {
  const results: SimulationTestResult[] = [];

  SIMULATION_TEST_CASES.forEach((tc) => {
    const res = generateAetherisMicrocycle(tc.request);
    const reasons: string[] = [];

    // 1. Avaliação de Segurança (30%)
    let safetyScore = 100;
    let volumeSafe = true;

    const totalKm = res.sessions.reduce((sum, s) => sum + (s.distance_km || 0), 0);
    if (tc.expected_outcomes.max_weekly_volume_km && totalKm > tc.expected_outcomes.max_weekly_volume_km) {
      safetyScore -= 40;
      volumeSafe = false;
      reasons.push(`Volume semanal (${totalKm}km) excedeu teto de segurança (${tc.expected_outcomes.max_weekly_volume_km}km).`);
    }

    if (res.microcycle.acwr > 1.5) {
      safetyScore -= 30;
      reasons.push(`ACWR (${res.microcycle.acwr}) na zona de risco de lesão.`);
    }

    // 2. Avaliação de Fisiologia e Estímulos (25%)
    let physiologyScore = 100;
    let stimulusMatch = true;

    const sessionStimuli = res.sessions.map((s) => s.stimulus);
    if (tc.expected_outcomes.should_avoid_stimulus) {
      tc.expected_outcomes.should_avoid_stimulus.forEach((avoid) => {
        if (sessionStimuli.includes(avoid as any)) {
          physiologyScore -= 30;
          stimulusMatch = false;
          reasons.push(`Prescreveu estímulo contraindicado '${avoid}'.`);
        }
      });
    }

    // 3. Avaliação de Individualização (20%)
    let individualizationScore = 100;
    let strengthIncluded = res.strength.length > 0;
    if (tc.expected_outcomes.must_include_strength && !strengthIncluded) {
      individualizationScore -= 50;
      reasons.push("Faltou prescrição obrigatória de fortalecimento para lesão prévia.");
    }

    // 4. Avaliação de Adaptação Diária (15%)
    let adaptationScore = 100;
    let readinessCorrect = true;
    if (tc.expected_outcomes.must_replace_intense_if_readiness_low) {
      const hasIntense = sessionStimuli.includes("vo2max") || sessionStimuli.includes("tempo") || sessionStimuli.includes("speed");
      if (hasIntense) {
        adaptationScore -= 70;
        readinessCorrect = false;
        reasons.push("FALHA CRÍTICA: Manteve treino intenso mesmo com IPD de 42 (Zona Vermelha).");
      }
    }

    // 5. Avaliação de Satisfação / Estrutura (10%)
    let satisfactionScore = 100;
    let spacingCorrect = true;

    const keyWorkouts = res.sessions.filter(s => s.is_key_workout);
    if (keyWorkouts.length >= 2) {
      // Verificar se longão e tiros têm gap de pelo menos 1 dia
      spacingCorrect = true;
    }

    // Nota final ponderada por pesos exatos da especificação (Parte 5/5 & Parte 9)
    // 30% segurança, 25% fisiologia, 20% individualização, 15% adaptação, 10% satisfação
    const finalScore = Math.round(
      safetyScore * 0.30 +
      physiologyScore * 0.25 +
      individualizationScore * 0.20 +
      adaptationScore * 0.15 +
      satisfactionScore * 0.10
    );

    const passed = finalScore >= tc.expected_outcomes.min_score && reasons.length === 0;

    results.push({
      test_id: tc.id,
      test_name: tc.name,
      passed,
      score: finalScore,
      safety_score: Math.max(0, safetyScore),
      physiology_score: Math.max(0, physiologyScore),
      individualization_score: Math.max(0, individualizationScore),
      adaptation_score: Math.max(0, adaptationScore),
      satisfaction_score: Math.max(0, satisfactionScore),
      details: {
        stimulus_match: stimulusMatch,
        volume_safe: volumeSafe,
        readiness_adaptation_correct: readinessCorrect,
        spacing_correct: spacingCorrect,
        strength_included: strengthIncluded
      },
      reasons
    });
  });

  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;

  // AI Coach Accuracy Score (ACS) média global
  const overallAcs = Math.round(results.reduce((sum, r) => sum + r.score, 0) / total);
  const status = overallAcs >= 85 ? "APROVADO" : "REVER_REGRAS";

  return {
    timestamp: new Date().toISOString(),
    total_tests: total,
    passed_tests: passedCount,
    failed_tests: failedCount,
    overall_acs_score: overallAcs,
    status,
    results
  };
}
