import { DailyMetrics, ReadinessResult, ReadinessStatus, TrainingLoad, TrainingHistory } from "./types";

/**
 * 1. Readiness Engine - Motor de Prontidão Multicamadas
 * Avalia a recuperação física, mental e o contexto de carga do atleta para o dia corrente.
 * 
 * Camada 1: Segurança Primária (Lesões e Dores Limitantes)
 * Camada 2: Estado Fisiológico Atual & Sensação Subjetiva (Pesos Científicos)
 * Camada 3: Contexto de Treinamento (Risco de Carga e ACWR)
 * Camada 4: Decisão Adaptativa (Sinais Verde, Amarelo, Vermelho)
 * Camada 5: Comunicação e Objetivos Fisiológicos (Supercompensação vs Homeostase)
 */
export function calculateReadiness(metrics: DailyMetrics, acwr?: number): ReadinessResult {
  const sleepHours = metrics.sleepHours || 7.5;
  const sleepScore = metrics.sleepScore || 70;
  const fatigue = metrics.fatigueScore || 3; // 1 (baixa) a 10 (alta)
  const hrv = metrics.hrv || 50; // ms
  const hrvBaseline = metrics.hrvBaseline || 55; // linha de base pessoal
  const bodyBattery = metrics.bodyBattery !== undefined ? metrics.bodyBattery : 75; // 0-100
  const muscleSoreness = metrics.muscleSoreness !== undefined ? metrics.muscleSoreness : 2; // 1-10
  const hasInjury = !!metrics.hasInjury;
  const injurySeverity = metrics.injurySeverity || "clinical";
  const mood = metrics.mood || "Neutro";
  const garminReadiness = metrics.garminReadiness !== undefined 
    ? metrics.garminReadiness 
    : (metrics.prepScore !== undefined ? metrics.prepScore : 75); // 1-100 (Garmin)

  // ==========================================
  // CAMADA 1: SEGURANÇA PRIMÁRIA (Lesões Limitações)
  // ==========================================
  if (hasInjury && injurySeverity === "clinical") {
    const capacities: TrainingCapacityByWorkoutType = {
      mobilityCore: { percentage: 100, status: "optimal", label: "Mobilidade & Fortalecimento", recommendation: "100% Liberado: Foco em mobilidade passiva e fisioterapia sem impacto." },
      lightZone2: { percentage: 0, status: "restricted", label: "Rodagem Leve (Z2)", recommendation: "Contraindicado por restrição clínica ativa." },
      tempoThreshold: { percentage: 0, status: "restricted", label: "Tempo Run / Limiar", recommendation: "Contraindicado por restrição clínica ativa." },
      intervalsVo2max: { percentage: 0, status: "restricted", label: "Intervalados / Tiros", recommendation: "Contraindicado por restrição clínica ativa." }
    };

    return {
      status: ReadinessStatus.RECOVER,
      score: 15,
      explanation: "Restrição Clínica Ativa! Presença de dor incapacitante ou limitação funcional importante. Recomendamos foco exclusivo em reabilitação e alívio de dor.",
      capacities,
      formulaSummary: "Sua prontidão está ajustada em 15/100 devido a protocolo de segurança médica/clínica."
    };
  }

  // ==========================================
  // CAMADA 2: ESTRUTURA DE PESOS CIENTÍFICOS DIRETA (100% BASE SEM DUPLA CONTAGEM)
  // Garmin Training Readiness é isolado do score base e usado como Guardrail / Checagem Cruzada
  // ==========================================

  // 1. Sono Quantidade (20%)
  let sleepQtyPts = 0;
  if (sleepHours >= 8.0) sleepQtyPts = 20.0;
  else if (sleepHours >= 7.0) sleepQtyPts = 17.0;
  else if (sleepHours >= 6.0) sleepQtyPts = 12.0;
  else if (sleepHours >= 5.0) sleepQtyPts = 6.0;
  else sleepQtyPts = 2.0;

  // 2. Sono Qualidade / Score (20%)
  const sleepQualPts = Math.min(20, Math.round(((sleepScore / 100) * 20) * 10) / 10);

  // 3. Sensação Subjetiva / Percepção do Atleta (20%)
  let subjectivePts = 12.0; // "normal" default
  if (metrics.subjectiveFeeling === "muito_bem") subjectivePts = 20.0;
  else if (metrics.subjectiveFeeling === "bem") subjectivePts = 16.0;
  else if (metrics.subjectiveFeeling === "normal") subjectivePts = 12.0;
  else if (metrics.subjectiveFeeling === "cansado") subjectivePts = 7.0;
  else if (metrics.subjectiveFeeling === "muito_cansado") subjectivePts = 3.0;

  // 4. HRV Baseline / Tendência Relativa do Atleta (15%)
  const hrvDev = (hrv - hrvBaseline) / hrvBaseline;
  let hrvPts = 15.0;
  let hrvDevText = "Normal (0% a -10%)";

  if (hrvDev < -0.30) {
    hrvPts = 3.0;
    hrvDevText = "Queda acentuada (> -30%)";
  } else if (hrvDev < -0.20) {
    hrvPts = 6.0;
    hrvDevText = "Queda moderada (-20% a -30%)";
  } else if (hrvDev < -0.10) {
    hrvPts = 10.5;
    hrvDevText = "Atenção (-10% a -20%)";
  } else {
    hrvPts = 15.0;
    hrvDevText = "Preservada (0% a -10%)";
  }

  // 5. Body Battery (15%) - Peso calibrado para mitigar redundância com VFC, Sono e Estresse
  const batteryPts = Math.min(15, Math.round(((bodyBattery / 100) * 15) * 10) / 10);

  // 6. Fadiga / Dor Muscular (10%)
  let sorenessPts = 10.0;
  if (muscleSoreness <= 2) sorenessPts = 10.0;
  else if (muscleSoreness <= 4) sorenessPts = 7.0;
  else if (muscleSoreness <= 6) sorenessPts = 4.0;
  else sorenessPts = 0.0;

  // Soma Base = 100 PONTOS (20 + 20 + 20 + 10 + 20 + 10 = 100)
  const baseScore = sleepQtyPts + sleepQualPts + subjectivePts + hrvPts + batteryPts + sorenessPts;

  // ==========================================
  // CAMADA 3: MODULADORES PROPORCIONAIS & TENDÊNCIA TEMPORAL (3 a 7 DIAS)
  // Penalidades acumuladas possuem teto máximo de -25 pontos para evitar penalização excessiva
  // ==========================================
  let rawBonusPts = 0;
  let rawPenaltyPts = 0;
  let modulatorsBreakdown: ReadinessModulatorItem[] = [];

  // Bônus/Penalidade proporcional para Sensação Subjetiva
  if (metrics.subjectiveFeeling === "muito_bem") {
    rawBonusPts += 5;
    modulatorsBreakdown.push({ label: "Disposição Subjetiva Ótima", points: 5, type: "bonus", reason: "Atleta relatou 'muito bem'" });
  } else if (metrics.subjectiveFeeling === "bem") {
    rawBonusPts += 2;
    modulatorsBreakdown.push({ label: "Disposição Subjetiva Positiva", points: 2, type: "bonus", reason: "Atleta relatou 'bem'" });
  } else if (metrics.subjectiveFeeling === "cansado") {
    rawPenaltyPts -= 4;
    modulatorsBreakdown.push({ label: "Sensação Subjetiva de Cansaço", points: -4, type: "penalty", reason: "Atleta relatou 'cansado'" });
  } else if (metrics.subjectiveFeeling === "muito_cansado") {
    rawPenaltyPts -= 8;
    modulatorsBreakdown.push({ label: "Sensação Subjetiva de Exaustão", points: -8, type: "penalty", reason: "Atleta relatou 'muito cansado'" });
  }

  // Penalidade/Bônus proporcional para Dor Muscular
  if (muscleSoreness >= 7) {
    rawPenaltyPts -= 8;
    modulatorsBreakdown.push({ label: `Dor Muscular Severa (${muscleSoreness}/10)`, points: -8, type: "penalty", reason: "Risco elevado de estiramento ou rigidez miofascial" });
  } else if (muscleSoreness >= 4) {
    rawPenaltyPts -= 4;
    modulatorsBreakdown.push({ label: `Dor Muscular Leve/Moderada (${muscleSoreness}/10)`, points: -4, type: "penalty", reason: "Rigidez muscular de treinos anteriores" });
  } else if (muscleSoreness <= 2) {
    rawBonusPts += 2;
    modulatorsBreakdown.push({ label: "Músculos Sem Dores Espontâneas", points: 2, type: "bonus", reason: "Integridade tecidual preservada" });
  }

  // Ajuste por ACWR (Contexto de Carga Aguda vs Crônica)
  if (acwr !== undefined) {
    if (acwr > 1.5) {
      rawPenaltyPts -= 10;
      modulatorsBreakdown.push({ label: `Pico Crítico de Carga ACWR (${acwr.toFixed(2)})`, points: -10, type: "penalty", reason: "Carga aguda desproporcional à crônica" });
    } else if (acwr > 1.3) {
      rawPenaltyPts -= 5;
      modulatorsBreakdown.push({ label: `Carga Elevada ACWR (${acwr.toFixed(2)})`, points: -5, type: "penalty", reason: "Zona de transição de carga" });
    }
  }

  // Avaliação de Tendência Temporal de 3 a 7 dias
  let temporalTrendMessage = "";
  const isMultiDayFatigue = (sleepHours < 6.0 && sleepScore < 65) || (fatigue >= 6) || (hrvDev <= -0.12);
  if (isMultiDayFatigue) {
    rawPenaltyPts -= 4;
    modulatorsBreakdown.push({ label: "Tendência de Fadiga Acumulada (3-7 dias)", points: -4, type: "penalty", reason: "Múltiplos dias consecutivos de sono curto ou VFC oscilante" });
    temporalTrendMessage = "Atenção à tendência temporal: Os indicadores dos últimos dias apontam acúmulo de estresse fisiológico (sono restrito e oscilação na VFC).";
  } else {
    temporalTrendMessage = "Tendência temporal estável nos últimos 3 a 7 dias.";
  }

  // Aplicação do Teto de Penalização (-25 pts no máximo)
  const MAX_PENALTY_CAP = -25;
  const effectivePenaltyPts = Math.max(MAX_PENALTY_CAP, rawPenaltyPts);
  const adjustmentPts = rawBonusPts + effectivePenaltyPts;

  if (rawPenaltyPts < MAX_PENALTY_CAP) {
    modulatorsBreakdown.push({
      label: "Teto de Penalização Protegido",
      points: MAX_PENALTY_CAP - rawPenaltyPts,
      type: "bonus",
      reason: `As penalidades brutas somavam ${rawPenaltyPts} pts. Foi aplicado o teto de -25 pts para preservar a razoabilidade do score.`
    });
  }

  // Calculate Data Inputs & Confidence Score
  const dataInputs: DataInputAvailability[] = [
    { name: "Horas de Sono", present: metrics.sleepHours !== undefined, source: "Garmin / Check-in" },
    { name: "Qualidade do Sono (Score)", present: metrics.sleepScore !== undefined, source: "Garmin Sleep Score" },
    { name: "Variabilidade da Freq. Cardíaca (HRV/VFC)", present: metrics.hrv !== undefined, source: "Garmin Nightly HRV" },
    { name: "Body Battery", present: metrics.bodyBattery !== undefined, source: "Garmin Body Battery" },
    { name: "Garmin Training Readiness", present: metrics.garminReadiness !== undefined || metrics.prepScore !== undefined, source: "Garmin Connect API" },
    { name: "Percepção Subjetiva do Atleta", present: metrics.subjectiveFeeling !== undefined, source: "Check-in Diário" },
    { name: "Escala de Dor Muscular (DOMS)", present: metrics.muscleSoreness !== undefined, source: "Check-in Diário" },
    { name: "Carga de Treino Acumulada (ACWR)", present: acwr !== undefined, source: "Cálculo do Motor Aetheris" }
  ];

  const presentCount = dataInputs.filter(d => d.present).length;
  const confidenceScore = Math.round((presentCount / dataInputs.length) * 100);

  // Score Final Calculado
  const finalScore = Math.min(100, Math.max(0, Math.round(baseScore + adjustmentPts)));

  // Daily Physiological Objectives
  let dailyPhysiologicalObjectives: string[] = [];
  if (finalScore >= 80) {
    dailyPhysiologicalObjectives = [
      "☑ Estimular capacidade aeróbica máxima (VO₂max) e Limiar Anaeróbico",
      "☑ Promover supercompensação e adaptação neuromuscular de alta qualidade",
      "☑ Consolidar ritmo de prova e eficiência da passada"
    ];
  } else if (finalScore >= 50) {
    dailyPhysiologicalObjectives = [
      "☑ Consolidar adaptações aeróbicas em Zona 2 sem sobrecarregar o SNC",
      "☑ Manter circulação ativa e oxigenação tecidual",
      "☑ Evitar depleção profunda dos estoques de glicogênio muscular"
    ];
  } else {
    dailyPhysiologicalObjectives = [
      "☑ Reduzir estresse simpático e reativar a modulação parassimpática",
      "☑ Promover síntese e restauração dos estoques de glicogênio",
      "☑ Aumentar circulação periférica e lavagem metabólica sem carga cardiovascular",
      "☑ Preparar a musculatura para o próximo estímulo de qualidade"
    ];
  }

  // ==========================================
  // CAMADA 4: BREAKDOWN AUDITÁVEL (EXPLICABILIDADE)
  // ==========================================
  const breakdown: ReadinessBreakdownPillar[] = [
    {
      name: "Sono (Quantidade)",
      category: "sleep_qty",
      weightPercent: 20,
      pointsEarned: sleepQtyPts,
      maxPoints: 20,
      description: `${sleepHours}h de sono registradas (ideal: 7.5h a 8.5h).`,
      contributionPercent: Math.round((sleepQtyPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Sono (Qualidade)",
      category: "sleep_qual",
      weightPercent: 20,
      pointsEarned: sleepQualPts,
      maxPoints: 20,
      description: `Score de qualidade do sono de ${sleepScore}/100.`,
      contributionPercent: Math.round((sleepQualPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Sensação / Percepção Subjetiva",
      category: "subjective_feeling",
      weightPercent: 20,
      pointsEarned: subjectivePts,
      maxPoints: 20,
      description: `Percepção relatada do atleta: "${metrics.subjectiveFeeling || 'normal'}".`,
      contributionPercent: Math.round((subjectivePts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "HRV (Tendência vs Baseline do Atleta)",
      category: "hrv",
      weightPercent: 15,
      pointsEarned: hrvPts,
      maxPoints: 15,
      description: `VFC atual ${hrv}ms vs baseline do próprio atleta (${hrvBaseline}ms) -> ${(hrvDev * 100).toFixed(1)}%: Classificação '${hrvDevText}'.`,
      contributionPercent: Math.round((hrvPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Body Battery",
      category: "battery",
      weightPercent: 15,
      pointsEarned: batteryPts,
      maxPoints: 15,
      description: `Reserva energética Garmin: ${bodyBattery}% (Peso 15% para calibrar sobreposição com VFC/Sono).`,
      contributionPercent: Math.round((batteryPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Fadiga & Dor Muscular",
      category: "soreness",
      weightPercent: 10,
      pointsEarned: sorenessPts,
      maxPoints: 10,
      description: `Nível de dor muscular: ${muscleSoreness}/10.`,
      contributionPercent: Math.round((sorenessPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Garmin Readiness (Guardrail / Checagem)",
      category: "garmin_prep",
      weightPercent: 0,
      pointsEarned: 0,
      maxPoints: 0,
      description: garminReadiness > 0 
        ? `Prontidão Garmin de ${garminReadiness}/100 usada como validação cruzada para evitar dupla contagem.` 
        : "Garmin Readiness não informado para checagem cruzada.",
      contributionPercent: 0
    },
    {
      name: "Moduladores & Ajustes",
      category: "adjustments",
      weightPercent: 0,
      pointsEarned: adjustmentPts,
      maxPoints: 0,
      description: modulatorsBreakdown.length > 0 
        ? modulatorsBreakdown.map(m => `${m.label} (${m.points > 0 ? '+' : ''}${m.points} pts)`).join(" | ")
        : "Sem penalidades ou bônus adicionais aplicados.",
      contributionPercent: 0
    }
  ];

  // ==========================================
  // CAMADA 5: CAPACIDADE DE TREINAR POR TIPO DE SESSÃO
  // ==========================================
  // Uma prontidão de 45/100 NÃO significa não treinar; significa mudar o tipo de treino!
  let capacities: TrainingCapacityByWorkoutType;

  if (finalScore >= 80) {
    capacities = {
      mobilityCore: { percentage: 100, status: "optimal", label: "Mobilidade & Fortalecimento", recommendation: "100% Liberado: Atividade perfeita para aquecimento ou complemento." },
      lightZone2: { percentage: 100, status: "optimal", label: "Rodagem Leve (Zona 2)", recommendation: "100% Liberado: Excelente absorção aeróbica." },
      tempoThreshold: { percentage: 100, status: "optimal", label: "Tempo Run / Limiar", recommendation: "100% Liberado: Organismo pronto para estímulo de ritmo." },
      intervalsVo2max: { percentage: 100, status: "optimal", label: "Intervalado / Tiros (VO2max)", recommendation: "100% Liberado: Fisiologia no ápice para supercompensação." }
    };
  } else if (finalScore >= 50) {
    capacities = {
      mobilityCore: { percentage: 100, status: "optimal", label: "Mobilidade & Fortalecimento", recommendation: "100% Liberado: Mantém amplitude muscular sem estresse cardiovascular." },
      lightZone2: { percentage: 85, status: "acceptable", label: "Rodagem Leve (Zona 2)", recommendation: "85% Recomendado: Rodagem leve a moderada mantém estímulo com segurança." },
      tempoThreshold: { percentage: 50, status: "restricted", label: "Tempo Run / Limiar", recommendation: "50% Reduzido: Reduza intensidade para Zona 2 para não extrapolar." },
      intervalsVo2max: { percentage: 25, status: "restricted", label: "Intervalado / Tiros (VO2max)", recommendation: "25% Recomenda-se substituir tiros por rodagem contínua suave." }
    };
  } else {
    // Score < 50 (ex: 45/100)
    capacities = {
      mobilityCore: { percentage: 100, status: "optimal", label: "Mobilidade & Fortalecimento", recommendation: "100% Liberado: Fortalece articulações e estimula circulação." },
      lightZone2: { percentage: 80, status: "acceptable", label: "Rodagem Leve / Caminhada (Z1-Z2)", recommendation: "80% Ajustado: Rodagem leve regenerativa Z1/Z2 promove fluxo sem fadiga." },
      tempoThreshold: { percentage: 35, status: "restricted", label: "Tempo Run / Limiar", recommendation: "35% Não recomendado: Converter em ritmo regenerativo leve." },
      intervalsVo2max: { percentage: 15, status: "restricted", label: "Intervalado / Tiros (VO2max)", recommendation: "15% Contraindicado: Tiros sob fadiga elevam risco de distensão muscular." }
    };
  }

  // Status final
  let status = ReadinessStatus.READY;
  if (finalScore < 50) status = ReadinessStatus.RECOVER;
  else if (finalScore < 80) status = ReadinessStatus.REDUCE;

  let explanation = "";
  if (finalScore >= 80) {
    explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Alta capacidade para estímulos intensos e treinos chave. Biomarcadores em excelente harmonia (${sleepHours}h de sono, score ${sleepScore}). Treino prescrito totalmente liberado!`;
  } else if (finalScore >= 50) {
    explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Capacidade moderada para cargas elevadas. Reduzimos o volume de tiros/ritmo e priorizamos Zona 2 para favorecer supercompensação sem acúmulo de fadiga.`;
  } else {
    explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Baixa capacidade para estímulos intensos. Capacidade preservada para recuperação ativa (100% mobilidade/core, 80% rodagem leve Z1/Z2). Recomenda-se trocar tiros por rodagem regenerativa suave.`;
  }

  let garminCheckText = "";
  if (garminReadiness > 0) {
    const diff = finalScore - garminReadiness;
    if (diff >= 20 || (finalScore >= 65 && garminReadiness < 50)) {
      garminCheckText = ` [Checagem Garmin: Relógio marca Prontidão ${garminReadiness}/100, mas seus sinais fisiológicos diretos apontam ${finalScore}/100. Evitamos a dupla contagem mantendo foco na sua sensação real e moderando picos de intensidade].`;
    } else if (diff <= -20 || (finalScore < 50 && garminReadiness >= 70)) {
      garminCheckText = ` [Checagem Garmin: Relógio marca Prontidão ${garminReadiness}/100, porém seus sinais fisiológicos apontam fadiga (${finalScore}/100). Prevalecem os biossinais diretos].`;
    }
  }

  const formulaSummary = `Score Base (${baseScore.toFixed(1)} pts) = Sono Qtd (20%): ${sleepQtyPts} + Sono Qual (20%): ${sleepQualPts} + Sensação (20%): ${subjectivePts} + HRV (15%): ${hrvPts} + Body Battery (15%): ${batteryPts} + Dor (10%): ${sorenessPts}. Moduladores/Ajustes: ${adjustmentPts > 0 ? '+' : ''}${adjustmentPts} pts. Total: ${finalScore}/100.${garminCheckText}`;

  return {
    status,
    score: finalScore,
    explanation,
    breakdown,
    capacities,
    temporalTrendMessage,
    formulaSummary,
    confidenceScore,
    dataInputs,
    modulatorsBreakdown,
    dailyPhysiologicalObjectives
  };
}

/**
 * 2. Training Load Engine
 * Calcula os níveis de aptidão crônica (CTL) e fadiga aguda (ATL) baseados nas distâncias
 * e volumes do histórico do atleta, determinando a relação ACWR (Acute-to-Chronic Workload Ratio).
 */
export function calculateTrainingLoad(history: TrainingHistory, weeklyKm: number = 0, daysWithoutTraining: number = 0): TrainingLoad {
  // CTL representa a aptidão crônica (EWMA com constante de tempo de 28-42 dias)
  const baseCtl = Math.max(15, (history.monthDistanceKm || 40) / 4);

  // ATL representa a fadiga aguda (EWMA com constante de tempo de 7 dias, alpha = 0.20)
  // Em dias de descanso, dissipa dinamicamente via EWMA: ATL_hoje = ATL_ontem * (1 - alpha)^dias
  const currentWeekDistance = history.weekDistanceKm || 0;
  const rawAtl = Math.max(15, currentWeekDistance + (weeklyKm > 0 ? weeklyKm * 0.15 : 0));
  
  const alphaAtl = 0.20; // Constante de suavização EWMA para fadiga aguda (janela de 7 dias)
  const ewmaDecayFactor = Math.pow(1 - alphaAtl, Math.min(14, Math.max(0, daysWithoutTraining)));
  const baseAtl = rawAtl * ewmaDecayFactor;

  // ACWR é a Razão Carga Aguda (ATL) / Carga Crônica (CTL)
  const ctl = Math.round(baseCtl * 10) / 10;
  const atl = Math.round(baseAtl * 10) / 10;
  
  const acuteChronicRatio = ctl > 0 ? Math.round((atl / ctl) * 100) / 100 : 1.0;

  let loadStatus: "normal" | "optimal" | "overreaching" | "detraining" = "normal";
  let trend: "stable" | "increasing" | "decreasing" = "stable";

  if (acuteChronicRatio < 0.8) {
    loadStatus = "detraining";
    trend = "decreasing";
  } else if (acuteChronicRatio >= 0.8 && acuteChronicRatio <= 1.3) {
    loadStatus = "optimal";
    trend = "stable";
  } else if (acuteChronicRatio > 1.3 && acuteChronicRatio <= 1.5) {
    loadStatus = "overreaching";
    trend = "increasing";
  } else {
    loadStatus = "overreaching"; // injury risk!
    trend = "increasing";
  }

  return {
    ctl,
    atl,
    acuteChronicRatio,
    loadStatus,
    trend
  };
}

/**
 * 3. Activity Training Load (TRIMP/Garmin load)
 * Baseado na duração, percepção de esforço (RPE) e freqüência cardíaca média.
 */
export function heartRateFactor(avgHr: number): number {
  if (avgHr < 130) return 0.9;
  if (avgHr < 150) return 1.0;
  if (avgHr < 165) return 1.15;
  return 1.30;
}

export function calculateActivityLoad(durationMinutes: number, rpe: number, avgHr: number): number {
  const factor = heartRateFactor(avgHr);
  return Math.round(durationMinutes * rpe * factor);
}

/**
 * 4. Load Comparison Helper
 */
export interface LoadComparisonResult {
  planned: number;
  actual: number;
  differencePercent: number;
  status: "acima do planejado" | "abaixo do planejado" | "dentro do esperado";
}

export function compareLoad(plannedLoad: number, actualLoad: number): LoadComparisonResult {
  if (plannedLoad <= 0) {
    return {
      planned: 0,
      actual: actualLoad,
      differencePercent: 0,
      status: "dentro do esperado"
    };
  }
  const difference = actualLoad - plannedLoad;
  const percentage = Math.round((difference / plannedLoad) * 100);

  let status: "acima do planejado" | "abaixo do planejado" | "dentro do esperado" = "dentro do esperado";
  if (percentage > 20) {
    status = "acima do planejado";
  } else if (percentage < -20) {
    status = "abaixo do planejado";
  }

  return {
    planned: plannedLoad,
    actual: actualLoad,
    differencePercent: percentage,
    status
  };
}

/**
 * 5. Coach Next Workout Adaptive Advisor
 */
export interface AdaptiveDecision {
  action: "reduce" | "maintain" | "progress";
  message: string;
  reason: string;
}

export function adjustNextWorkout(
  plannedLoad: number,
  actualLoad: number,
  rpe: number,
  accumulatedWeeklyLoad: number = 0
): AdaptiveDecision {
  if (plannedLoad <= 0) {
    return {
      action: "maintain",
      message: "Resposta adequada.",
      reason: "Seguir progressão normal."
    };
  }
  
  const difference = (actualLoad - plannedLoad) / plannedLoad;

  // Caso de carga excessiva ou exaustão extrema
  if (difference > 0.20 || rpe >= 8) {
    return {
      action: "reduce",
      message: "Treino acima do esperado ou esforço elevado.",
      reason: "Reduzir estímulo no próximo treino para controlar a fadiga e evitar lesões."
    };
  }

  // Histórico acumulado muito elevado
  if (accumulatedWeeklyLoad > 1200) {
    return {
      action: "maintain",
      message: "Carga acumulada semanal elevada.",
      reason: "Manter intensidade sem progressão nesta semana para consolidação da base."
    };
  }

  // Resposta fisiológica adequada
  return {
    action: "maintain",
    message: "Resposta fisiológica adequada.",
    reason: "Seguir com a progressão planejada na planilha de treinos."
  };
}

/**
 * 6. Training Monotony & Strain Calculation
 * Monotonia: Média das cargas diárias dos últimos 7 dias dividida pelo desvio padrão.
 * Strain: Carga total semanal multiplicada pela monotonia.
 */
export function calculateMonotonyAndStrain(dailyLoads: number[]): { monotony: number; strain: number } {
  if (!dailyLoads || dailyLoads.length === 0) {
    return { monotony: 1.0, strain: 0 };
  }
  
  const loads = dailyLoads.slice(-7);
  const totalLoad = loads.reduce((sum, val) => sum + val, 0);
  const n = loads.length;
  const mean = totalLoad / n;
  
  if (n < 2 || mean === 0) {
    return { monotony: 1.0, strain: totalLoad };
  }
  
  const variance = loads.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  
  // Se o desvio padrão for zero (cargas idênticas todos os dias), a monotonia é alta (ex: 2.0)
  const monotony = stdDev > 0 ? mean / stdDev : 2.0;
  const strain = totalLoad * monotony;
  
  return {
    monotony: Math.round(monotony * 100) / 100,
    strain: Math.round(strain)
  };
}


