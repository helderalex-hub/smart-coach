import { 
  DailyMetrics, 
  ReadinessResult, 
  ReadinessStatus, 
  TrainingLoad, 
  TrainingHistory,
  TrainingCapacityByWorkoutType,
  ReadinessModulatorItem,
  DataInputAvailability,
  ReadinessBreakdownPillar
} from "./types";

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
  const hasInjury = !!metrics.hasInjury;
  const injurySeverity = metrics.injurySeverity || "clinical";

  // ==========================================
  // CAMADA 1: SEGURANÇA PRIMÁRIA (Lesões & Limitações)
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
      formulaSummary: "Sua prontidão está ajustada em 15/100 devido a protocolo de segurança médica/clínica.",
      confidenceScore: 100,
      decisionQuality: "Alta",
      decisionQualityLabel: "Alta (Restrição Clínica Confirmada)",
      sourcesUsed: ["Check-in Clínico de Lesão"],
      missingSources: []
    };
  }

  // ==========================================
  // CAMADA 2: ESTRUTURA DE PESOS ADAPTATIVOS & PROTEÇÃO CONTRA DADOS AUSENTES
  // Regra fundamental: O motor trabalha estritamente com evidências disponíveis.
  // Quando um sensor não existe, o peso do indicador é redistribuído proporcionalmente
  // entre os dados restantes, mantendo a percepção do atleta como principal referência (piso min 30%).
  // ==========================================

  // Verificação de presença real de sensores/entradas
  const hasSubjective = metrics.subjectiveFeeling !== undefined && metrics.subjectiveFeeling !== null;
  const hasSleepHours = metrics.sleepHours !== undefined && metrics.sleepHours !== null && metrics.sleepHours > 0;
  const hasSleepScore = metrics.sleepScore !== undefined && metrics.sleepScore !== null && metrics.sleepScore > 0;
  const hasHrv = metrics.hrv !== undefined && metrics.hrv !== null && metrics.hrv > 0;
  const hasBodyBattery = metrics.bodyBattery !== undefined && metrics.bodyBattery !== null && metrics.bodyBattery >= 0;
  const hasMuscleSoreness = metrics.muscleSoreness !== undefined && metrics.muscleSoreness !== null;
  const hasRhr = metrics.restingHeartRate !== undefined && metrics.restingHeartRate > 0;

  // Pesos Nominais Padrão (Sensação tem piso garantido de 30%)
  const baseWeights = {
    subjective: 30,    // Percepção do Atleta (Piso Mínimo Obrigatório de 30%)
    sleepHours: 20,    // Quantidade de Sono
    sleepScore: 15,    // Qualidade de Sono (Sleep Score)
    hrv: 15,           // Variabilidade da Frequência Cardíaca
    bodyBattery: 10,   // Reserva Energética
    muscleSoreness: 10, // Dor Muscular (DOMS)
    rhr: 5             // FC de Repouso (se disponível)
  };

  // Soma de pesos base dos dados efetivamente disponíveis
  let totalAvailableBaseWeight = 0;
  if (hasSubjective) totalAvailableBaseWeight += baseWeights.subjective;
  if (hasSleepHours) totalAvailableBaseWeight += baseWeights.sleepHours;
  if (hasSleepScore) totalAvailableBaseWeight += baseWeights.sleepScore;
  if (hasHrv) totalAvailableBaseWeight += baseWeights.hrv;
  if (hasBodyBattery) totalAvailableBaseWeight += baseWeights.bodyBattery;
  if (hasMuscleSoreness) totalAvailableBaseWeight += baseWeights.muscleSoreness;
  if (hasRhr) totalAvailableBaseWeight += baseWeights.rhr;

  // Fallback caso não haja nenhum dado fornecido
  if (totalAvailableBaseWeight === 0) {
    totalAvailableBaseWeight = 30; // assume sensação padrão
  }

  const normFactor = 100 / totalAvailableBaseWeight;

  // Pesos normalizados para totalizar exatamente 100%
  const normWeights = {
    subjective: hasSubjective ? Math.round(baseWeights.subjective * normFactor * 10) / 10 : (totalAvailableBaseWeight === 30 ? 100 : 0),
    sleepHours: hasSleepHours ? Math.round(baseWeights.sleepHours * normFactor * 10) / 10 : 0,
    sleepScore: hasSleepScore ? Math.round(baseWeights.sleepScore * normFactor * 10) / 10 : 0,
    hrv: hasHrv ? Math.round(baseWeights.hrv * normFactor * 10) / 10 : 0,
    bodyBattery: hasBodyBattery ? Math.round(baseWeights.bodyBattery * normFactor * 10) / 10 : 0,
    muscleSoreness: hasMuscleSoreness ? Math.round(baseWeights.muscleSoreness * normFactor * 10) / 10 : 0,
    rhr: hasRhr ? Math.round(baseWeights.rhr * normFactor * 10) / 10 : 0
  };

  // 1. Sensação Subjetiva do Atleta (Piso Adaptativo >= 30%)
  let subjectivePts = 0;
  let subjectiveRatio = 0.6; // "normal" default
  if (metrics.subjectiveFeeling === "muito_bem") subjectiveRatio = 1.0;
  else if (metrics.subjectiveFeeling === "bem") subjectiveRatio = 0.8;
  else if (metrics.subjectiveFeeling === "normal") subjectiveRatio = 0.6;
  else if (metrics.subjectiveFeeling === "cansado") subjectiveRatio = 0.35;
  else if (metrics.subjectiveFeeling === "muito_cansado") subjectiveRatio = 0.15;

  if (normWeights.subjective > 0) {
    subjectivePts = Math.round((subjectiveRatio * normWeights.subjective) * 10) / 10;
  }

  // 2. Horas de Sono
  let sleepQtyPts = 0;
  const sleepHours = metrics.sleepHours || 7.5;
  let sleepQtyRatio = 0.85;
  if (sleepHours >= 8.0) sleepQtyRatio = 1.0;
  else if (sleepHours >= 7.0) sleepQtyRatio = 0.85;
  else if (sleepHours >= 6.0) sleepQtyRatio = 0.60;
  else if (sleepHours >= 5.0) sleepQtyRatio = 0.30;
  else sleepQtyRatio = 0.10;

  if (hasSleepHours) {
    sleepQtyPts = Math.round((sleepQtyRatio * normWeights.sleepHours) * 10) / 10;
  }

  // 3. Score de Qualidade de Sono
  let sleepQualPts = 0;
  const sleepScore = metrics.sleepScore || 70;
  if (hasSleepScore) {
    sleepQualPts = Math.round(((sleepScore / 100) * normWeights.sleepScore) * 10) / 10;
  }

  // 4. HRV (Variabilidade da Frequência Cardíaca)
  let hrvPts = 0;
  const hrv = metrics.hrv || 50;
  const hrvBaseline = metrics.hrvBaseline || 55;
  const hrvDev = (hrv - hrvBaseline) / hrvBaseline;
  let hrvDevText = "Normal";
  let hrvRatio = 1.0;
  if (hrvDev < -0.30) {
    hrvRatio = 0.20;
    hrvDevText = "Queda acentuada (> -30%)";
  } else if (hrvDev < -0.20) {
    hrvRatio = 0.40;
    hrvDevText = "Queda moderada (-20% a -30%)";
  } else if (hrvDev < -0.10) {
    hrvRatio = 0.70;
    hrvDevText = "Atenção (-10% a -20%)";
  } else {
    hrvRatio = 1.0;
    hrvDevText = "Preservada (Equilibrada)";
  }

  if (hasHrv) {
    hrvPts = Math.round((hrvRatio * normWeights.hrv) * 10) / 10;
  }

  // 5. Body Battery
  let batteryPts = 0;
  const bodyBattery = metrics.bodyBattery !== undefined ? metrics.bodyBattery : 75;
  if (hasBodyBattery) {
    batteryPts = Math.round(((bodyBattery / 100) * normWeights.bodyBattery) * 10) / 10;
  }

  // 6. Dor Muscular (DOMS)
  let sorenessPts = 0;
  const muscleSoreness = metrics.muscleSoreness !== undefined ? metrics.muscleSoreness : 2;
  let sorenessRatio = 1.0;
  if (muscleSoreness <= 2) sorenessRatio = 1.0;
  else if (muscleSoreness <= 4) sorenessRatio = 0.70;
  else if (muscleSoreness <= 6) sorenessRatio = 0.40;
  else sorenessRatio = 0.0;

  if (hasMuscleSoreness) {
    sorenessPts = Math.round((sorenessRatio * normWeights.muscleSoreness) * 10) / 10;
  }

  // 7. FC Repouso
  let rhrPts = 0;
  const rhr = metrics.restingHeartRate || 55;
  if (hasRhr) {
    rhrPts = Math.round((1.0 * normWeights.rhr) * 10) / 10;
  }

  // Soma Base Normalizada para 100 PONTOS
  const baseScore = subjectivePts + sleepQtyPts + sleepQualPts + hrvPts + batteryPts + sorenessPts + rhrPts;

  // ==========================================
  // CAMADA 3: MODULADORES PROPORCIONAIS & CONTEXTO TEMPORAL
  // Teto de Penalização Protegido (-25 pts no máximo)
  // ==========================================
  let rawBonusPts = 0;
  let rawPenaltyPts = 0;
  let modulatorsBreakdown: ReadinessModulatorItem[] = [];

  // Disposição Subjetiva Extra
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

  // Dor Muscular Proporcional
  if (muscleSoreness >= 7) {
    rawPenaltyPts -= 8;
    modulatorsBreakdown.push({ label: `Dor Muscular Severa (${muscleSoreness}/10)`, points: -8, type: "penalty", reason: "Risco elevado de estiramento miofascial" });
  } else if (muscleSoreness >= 4) {
    rawPenaltyPts -= 4;
    modulatorsBreakdown.push({ label: `Dor Muscular Moderada (${muscleSoreness}/10)`, points: -4, type: "penalty", reason: "Rigidez muscular de treinos anteriores" });
  }

  // Carga Mecânica Corporal (Atleta > 85 kg)
  const athleteW = metrics.athleteWeightKg || metrics.weight || 0;
  if (athleteW > 85 && muscleSoreness >= 3) {
    rawPenaltyPts -= 3;
    modulatorsBreakdown.push({ label: `Carga Mecânica Elevada (${athleteW}kg)`, points: -3, type: "penalty", reason: "Maior impacto articular sol-passada sob fadiga muscular" });
  }

  // Recuperação Proteica (Dieta Vegetariana / Vegana)
  if ((metrics.dietType === "vegetariana" || metrics.dietType === "vegana") && (muscleSoreness >= 4 || sleepHours < 6.5)) {
    rawPenaltyPts -= 2;
    modulatorsBreakdown.push({ label: `Janela Proteica (${metrics.dietType})`, points: -2, type: "penalty", reason: "Atividade com maior exigência de síntese proteica sob sono/dor restritos" });
  }

  // Carga ACWR
  if (acwr !== undefined) {
    if (acwr > 1.5) {
      rawPenaltyPts -= 10;
      modulatorsBreakdown.push({ label: `Pico Crítico de Carga ACWR (${acwr.toFixed(2)})`, points: -10, type: "penalty", reason: "Carga aguda desproporcional à crônica" });
    } else if (acwr > 1.3) {
      rawPenaltyPts -= 5;
      modulatorsBreakdown.push({ label: `Carga Elevada ACWR (${acwr.toFixed(2)})`, points: -5, type: "penalty", reason: "Zona de transição de carga" });
    }
  }

  let temporalTrendMessage = "";
  const isMultiDayFatigue = (hasSleepHours && sleepHours < 6.0 && hasSleepScore && sleepScore < 65) || (hasHrv && hrvDev <= -0.12);
  if (isMultiDayFatigue) {
    rawPenaltyPts -= 4;
    modulatorsBreakdown.push({ label: "Tendência de Fadiga Acumulada", points: -4, type: "penalty", reason: "Acúmulo recente de sono restrito ou oscilação na VFC" });
    temporalTrendMessage = "Atenção à tendência temporal: Os dados recentes apontam acúmulo de estresse fisiológico.";
  } else {
    temporalTrendMessage = "Tendência temporal estável.";
  }

  if (metrics.hasMissedWorkoutInWeek) {
    modulatorsBreakdown.push({
      label: "Estratégia de Compensação de Treino",
      points: 0,
      type: "bonus",
      reason: "Treino não realizado detectado na semana. Dias de descanso ignorados para uso como novos slots de treino e continuidade do programa."
    });
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
      reason: `As penalidades brutas somavam ${rawPenaltyPts} pts. Aplicado o teto de -25 pts para preservar a razoabilidade.`
    });
  }

  // Mapeamento de Fontes Utilizadas vs Ausentes
  const sourcesUsed: string[] = [];
  const missingSources: string[] = [];

  if (hasSubjective) sourcesUsed.push("Sensação Subjetiva (Check-in)");
  else missingSources.push("Sensação Subjetiva");

  if (hasSleepHours) sourcesUsed.push(`Horas de Sono (${sleepHours}h)`);
  else missingSources.push("Horas de Sono");

  if (hasSleepScore) sourcesUsed.push(`Qualidade do Sono (${sleepScore}/100)`);
  else missingSources.push("Qualidade do Sono");

  if (hasHrv) sourcesUsed.push(`HRV/VFC Noturna (${hrv}ms)`);
  else missingSources.push("Variabilidade da FC (HRV)");

  if (hasBodyBattery) sourcesUsed.push(`Body Battery (${bodyBattery}%)`);
  else missingSources.push("Body Battery");

  if (hasMuscleSoreness) sourcesUsed.push(`Fadiga Muscular (${muscleSoreness}/10)`);
  else missingSources.push("Escala de Dor (DOMS)");

  if (hasRhr) sourcesUsed.push(`FC Repouso (${rhr} bpm)`);

  if (metrics.garminTrainingLoad && metrics.garminTrainingLoad > 0) {
    sourcesUsed.push(`Carga Garmin (${metrics.garminTrainingLoad} pts)`);
  }

  if (metrics.garminTrainingStatus && metrics.garminTrainingStatus !== "sem_dados") {
    const statusLabels: Record<string, string> = {
      recuperacao: "Recuperação",
      mantendo: "Mantendo",
      eficaz: "Eficaz",
      excessivo: "Excessivo",
      ineficiente: "Ineficiente"
    };
    sourcesUsed.push(`Status Garmin (${statusLabels[metrics.garminTrainingStatus] || metrics.garminTrainingStatus})`);
  }

  const objectiveSensorsCount = (hasSleepHours ? 1 : 0) + (hasSleepScore ? 1 : 0) + (hasHrv ? 1 : 0) + (hasBodyBattery ? 1 : 0) + (hasRhr ? 1 : 0);

  // Determinação de Qualidade da Decisão & Confiança
  let decisionQuality: "Alta" | "Moderada" | "Limitada" = "Alta";
  let decisionQualityLabel = "";
  let confidenceScore = 100;

  if (objectiveSensorsCount >= 3 && hasSubjective) {
    decisionQuality = "Alta";
    decisionQualityLabel = "Alta (Dados Fisiológicos Completos + Sensação Subjetiva)";
    confidenceScore = Math.min(100, 85 + objectiveSensorsCount * 3);
  } else if (objectiveSensorsCount >= 1 || (hasSubjective && hasMuscleSoreness)) {
    decisionQuality = "Moderada";
    decisionQualityLabel = "Moderada (Dados Subjetivos + Carga de Treino)";
    confidenceScore = Math.min(80, 60 + objectiveSensorsCount * 5);
  } else {
    decisionQuality = "Limitada";
    decisionQualityLabel = "Limitada (Apenas Percepção Subjetiva - Sem Sensores Objetivos)";
    confidenceScore = 55;
  }

  // Score Final Calculado
  const finalScore = Math.min(100, Math.max(0, Math.round(baseScore + adjustmentPts)));

  // Objetivos Fisiológicos do Dia
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
      name: "Sensação Subjetiva (Piso ≥ 30%)",
      category: "subjective_feeling",
      weightPercent: normWeights.subjective,
      pointsEarned: subjectivePts,
      maxPoints: normWeights.subjective,
      description: hasSubjective 
        ? `Percepção relatada: "${metrics.subjectiveFeeling}". Contribui com ${subjectivePts}/${normWeights.subjective} pts (Peso adaptativo: ${normWeights.subjective}%).`
        : "Não informada no check-in. Peso redistribuído proporcionalmente.",
      contributionPercent: Math.round((subjectivePts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Sono (Quantidade)",
      category: "sleep_qty",
      weightPercent: normWeights.sleepHours,
      pointsEarned: sleepQtyPts,
      maxPoints: normWeights.sleepHours,
      description: hasSleepHours 
        ? `${sleepHours}h de sono registradas (Peso adaptativo: ${normWeights.sleepHours}%).`
        : "Dados de horas de sono ausentes. Peso redistribuído proporcionalmente.",
      contributionPercent: Math.round((sleepQtyPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Sono (Qualidade)",
      category: "sleep_qual",
      weightPercent: normWeights.sleepScore,
      pointsEarned: sleepQualPts,
      maxPoints: normWeights.sleepScore,
      description: hasSleepScore 
        ? `Score de qualidade do sono de ${sleepScore}/100 (Peso adaptativo: ${normWeights.sleepScore}%).`
        : "Score de qualidade de sono ausente. O motor não inventa dados e não penaliza o atleta.",
      contributionPercent: Math.round((sleepQualPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "HRV (Tendência vs Baseline)",
      category: "hrv",
      weightPercent: normWeights.hrv,
      pointsEarned: hrvPts,
      maxPoints: normWeights.hrv,
      description: hasHrv 
        ? `VFC de ${hrv}ms vs baseline (${hrvBaseline}ms) -> '${hrvDevText}' (Peso adaptativo: ${normWeights.hrv}%).`
        : "Sensor VFC/HRV ausente. Sem penalização por falta de sensor.",
      contributionPercent: Math.round((hrvPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Body Battery",
      category: "battery",
      weightPercent: normWeights.bodyBattery,
      pointsEarned: batteryPts,
      maxPoints: normWeights.bodyBattery,
      description: hasBodyBattery 
        ? `Reserva energética Garmin: ${bodyBattery}% (Peso adaptativo: ${normWeights.bodyBattery}%).`
        : "Body Battery ausente. Peso redistribuído entre métricas ativas.",
      contributionPercent: Math.round((batteryPts / Math.max(1, finalScore)) * 100)
    },
    {
      name: "Fadiga & Dor Muscular",
      category: "soreness",
      weightPercent: normWeights.muscleSoreness,
      pointsEarned: sorenessPts,
      maxPoints: normWeights.muscleSoreness,
      description: hasMuscleSoreness 
        ? `Nível de dor muscular: ${muscleSoreness}/10 (Peso adaptativo: ${normWeights.muscleSoreness}%).`
        : "Avaliação de dor muscular não fornecida.",
      contributionPercent: Math.round((sorenessPts / Math.max(1, finalScore)) * 100)
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
  else if (finalScore < 70) status = ReadinessStatus.REDUCE;

  // Linguagem Adaptativa do Treinador (Com vs Sem Sensores Objetivos)
  let explanation = "";
  if (objectiveSensorsCount >= 2) {
    if (finalScore >= 70) {
      explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Alta capacidade para estímulos intensos. Biomarcadores em harmonia (${sleepHours}h de sono, score ${sleepScore}, Body Battery ${bodyBattery}%). Treino mantido a 100%!`;
    } else if (finalScore >= 50) {
      explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Capacidade moderada. Os biossinais indicam controle de carga; reduzimos a intensidade para Zona 2 para favorecer supercompensação.`;
    } else {
      explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Baixa capacidade fisiológica. Priorizamos recuperação ativa em Z1/Z2 para restabelecer homeostase sem estresse excessivo.`;
    }
  } else {
    // Modo com sensores limitados / apenas percepção
    const feelingText = metrics.subjectiveFeeling ? `Sua percepção (${metrics.subjectiveFeeling.replace('_', ' ')})` : "Sua percepção subjetiva";
    if (finalScore >= 70) {
      explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Excelente disposição autorrelatada. ${feelingText}, ausência de dores limítrofes e histórico recente indicam prontidão para a sessão chave. Treino mantido a 100%!`;
    } else if (finalScore >= 50) {
      explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Com base na sua percepção de cansaço, histórico recente de treino e resposta ao último estímulo, ajustamos a sessão para preservar consistência.`;
    } else {
      explanation = `Preparação Hoje: ${finalScore}/100. Interpretação: Cansaço e dor muscular relatados exigem cautela. Treino ajustado para rodagem leve regenerativa Z1/Z2 ou mobilidade.`;
    }
  }

  const formulaSummary = `Score Base (${baseScore.toFixed(1)} pts) = Sensação (${normWeights.subjective}%): ${subjectivePts} + Sono Qtd (${normWeights.sleepHours}%): ${sleepQtyPts} + Sono Qual (${normWeights.sleepScore}%): ${sleepQualPts} + HRV (${normWeights.hrv}%): ${hrvPts} + Battery (${normWeights.bodyBattery}%): ${batteryPts} + Dor (${normWeights.muscleSoreness}%): ${sorenessPts}. Moduladores: ${adjustmentPts > 0 ? '+' : ''}${adjustmentPts} pts. Total: ${finalScore}/100 [Qualidade: ${decisionQuality} (${confidenceScore}%)].`;

  return {
    status,
    score: finalScore,
    explanation,
    breakdown,
    capacities,
    temporalTrendMessage,
    formulaSummary,
    confidenceScore,
    decisionQuality,
    decisionQualityLabel,
    sourcesUsed,
    missingSources,
    dataInputs: [
      { name: "Percepção Subjetiva do Atleta", present: hasSubjective, source: "Check-in Diário" },
      { name: "Horas de Sono", present: hasSleepHours, source: "Garmin / Check-in" },
      { name: "Qualidade do Sono (Score)", present: hasSleepScore, source: "Garmin Sleep Score" },
      { name: "Variabilidade da FC (HRV)", present: hasHrv, source: "Garmin Nightly HRV" },
      { name: "Body Battery", present: hasBodyBattery, source: "Garmin Body Battery" },
      { name: "Escala de Dor Muscular (DOMS)", present: hasMuscleSoreness, source: "Check-in Diário" },
      { name: "FC de Repouso", present: hasRhr, source: "Garmin FIT / Health" },
      { name: "Carga de Treino ACWR", present: acwr !== undefined, source: "Cálculo do Motor Aetheris" }
    ],
    modulatorsBreakdown,
    dailyPhysiologicalObjectives
  };
}

/**
 * Extrai e calcula automaticamente os dias consecutivos sem treino (descanso passivo)
 * a partir dos arquivos .FIT carregados, históricos de atividades e treinos concluídos.
 */
export function calculateConsecutiveRestDays(
  savedList: Array<{ startTime?: string; uploadedAt?: string; date?: string }> = [],
  todayWorkoutCompleted: boolean = false
): number {
  if (todayWorkoutCompleted) {
    return 0;
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Coleta datas únicas (YYYY-MM-DD) em que ocorreram treinos
  const workoutDates = new Set<string>();

  savedList.forEach((item) => {
    const timeStr = item.startTime || item.uploadedAt || item.date;
    if (timeStr) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        workoutDates.add(dateStr);
      }
    }
  });

  if (typeof localStorage !== "undefined") {
    if (localStorage.getItem("fit_today_completed") === "true") {
      workoutDates.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    }
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (workoutDates.has(todayStr)) {
    return 0;
  }

  if (workoutDates.size === 0) {
    return 0;
  }

  let restDays = 0;
  let checkDate = new Date(todayMidnight);
  checkDate.setDate(checkDate.getDate() - 1);

  while (restDays < 30) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
    if (workoutDates.has(dateStr)) {
      break;
    }
    restDays++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return restDays;
}

/**
 * 2. Training Load Engine
 * Calcula os níveis de aptidão crônica (CTL) e fadiga aguda (ATL) baseados nas distâncias
 * e volumes do histórico do atleta, determinando a relação ACWR (Acute-to-Chronic Workload Ratio).
 */
export function calculateTrainingLoad(history: TrainingHistory, weeklyKm: number = 0, daysWithoutTraining: number = 0): TrainingLoad {
  // CTL representa a aptidão crônica (capacidade adquirida - janela de 28-42 dias)
  const baseCtl = Math.max(15, (history.monthDistanceKm || 40) / 4);

  // ATL representa a fadiga aguda (estresse recente - janela de 7 dias)
  const currentWeekDistance = history.weekDistanceKm || 0;
  const rawAtl = Math.max(15, currentWeekDistance + (weeklyKm > 0 ? weeklyKm * 0.15 : 0));
  
  const alphaAtl = 0.20; // Constante de suavização EWMA para fadiga aguda
  const ewmaDecayFactor = Math.pow(1 - alphaAtl, Math.min(14, Math.max(0, daysWithoutTraining)));
  const baseAtl = rawAtl * ewmaDecayFactor;

  const ctl = Math.round(baseCtl * 10) / 10;
  const atl = Math.round(baseAtl * 10) / 10;
  const tsb = Math.round((ctl - atl) * 10) / 10; // Training Stress Balance (Saldo Fisiológico)
  
  const acuteChronicRatio = ctl > 0 ? Math.round((atl / ctl) * 100) / 100 : 1.0;

  let loadStatus: "normal" | "optimal" | "overreaching" | "detraining" = "normal";
  let trend: "stable" | "increasing" | "decreasing" = "stable";
  let message = "Carga recente compatível com o histórico de treinamento.";

  if (acuteChronicRatio < 0.8) {
    loadStatus = "detraining";
    trend = "decreasing";
    message = "Carga recente reduzida (possível recuperação, polimento/taper ou transição de ciclo).";
  } else if (acuteChronicRatio >= 0.8 && acuteChronicRatio <= 1.3) {
    loadStatus = "optimal";
    trend = "stable";
    message = "Carga recente em faixa otimizada de assimilação e adaptação.";
  } else {
    loadStatus = "overreaching";
    trend = "increasing";
    message = "Aumento rápido de carga (monitorar resposta e recuperação nas próximas sessões).";
  }

  return {
    ctl,
    atl,
    tsb,
    acuteChronicRatio,
    loadStatus,
    trend,
    message
  };
}

/**
 * 3. Aetheris Training Load (ATL) & Activity Load Calculation
 * Baseado na duração em movimento (moving time), RPE ponderado e Fator Cardíaco Contínuo.
 */

export function getRpeFactor(rpe: number): number {
  if (rpe <= 2) return 0.6;
  if (rpe <= 4) return 0.8;
  if (rpe <= 6) return 1.0;
  if (rpe <= 8) return 1.3;
  return 1.6;
}

/**
 * Fator Cardíaco Contínuo baseado em % da Frequência Cardíaca de Reserva (%FCReserva).
 * Evita saltos artificiais por degraus.
 */
export function heartRateFactor(avgHr: number, restingHr: number = 60, maxHr: number = 190): number {
  if (avgHr <= 0) return 1.0;
  const clampedRest = Math.max(30, Math.min(restingHr, 100));
  const clampedMax = Math.max(clampedRest + 40, Math.min(maxHr, 220));
  const hrReserveRatio = Math.max(0, Math.min(1, (avgHr - clampedRest) / (clampedMax - clampedRest)));
  
  // heartRateFactor = 0.8 + (%FCReserva × 0.6)
  return Math.round((0.8 + (hrReserveRatio * 0.6)) * 100) / 100;
}

export type LoadMethod = "garmin" | "trimp" | "session_rpe";

export interface AetherisLoadBreakdown {
  method: LoadMethod;
  methodLabel: string;
  sourceDetails: string;
  
  // Camada A — Carga Externa (Trabalho executado - não mede fadiga)
  externalWork: {
    movingTimeMinutes: number;
    distanceKm?: number;
    elevationGainMeters?: number;
    avgPace?: string;
    avgPower?: number | null;
  };

  // Camada B — Carga Interna (Resposta Fisiológica Pura - Única usada para ATL/CTL/ACWR)
  internalLoad: number;
  garminLoadValue?: number | null;
  trimpValue?: number | null;
  sessionRpeValue?: number | null;

  // Camada C — Estado Biológico & Percepção (Para Interpretação)
  biologicalState: {
    rpe: number;
    rpeSource: "fit" | "manual";
    avgHr: number;
    readinessScore?: number;
    sleepHrs?: number;
    hrvMs?: number;
  };

  // Backward compatibility fields
  externalLoad: number;        
  cardiovascularLoad: number;  
  perceptualLoad: number;      
  totalLoad: number;           // Carga Interna Pura
  confidence: LoadConfidence;  
  intensityRatioPercent: number; 
}

/**
 * Cálculo de Carga Fisiológica em Camadas (Sem modelo tripartite 50/30/20)
 * Camada B (Carga Interna) utiliza hierarquia estrita: Garmin Load -> TRIMP -> Session RPE.
 */
export function calculateAetherisTrainingLoad(
  movingTimeMinutes: number,
  rpe: number,
  avgHr: number,
  options?: {
    restingHr?: number;
    maxHr?: number;
    thresholdHr?: number;
    hasFit?: boolean;
    elevationGainMeters?: number;
    distanceKm?: number;
    avgPace?: string;
    avgPower?: number | null;
    garminTrainingLoad?: number | null;
    rpeFromFit?: boolean;
    readinessScore?: number;
    sleepHrs?: number;
    hrvMs?: number;
  }
): AetherisLoadBreakdown {
  const restingHr = options?.restingHr ?? 60;
  const maxHr = options?.maxHr ?? 190;
  const thresholdHr = options?.thresholdHr ?? 168;
  const hasFit = options?.hasFit ?? (movingTimeMinutes > 0);
  const elevation = options?.elevationGainMeters ?? 0;
  const garminLoad = options?.garminTrainingLoad;

  // -------------------------------------------------------------
  // CAMADA A — CARGA EXTERNA (Trabalho executado)
  // -------------------------------------------------------------
  const externalWork = {
    movingTimeMinutes,
    distanceKm: options?.distanceKm,
    elevationGainMeters: elevation,
    avgPace: options?.avgPace,
    avgPower: options?.avgPower,
  };

  // -------------------------------------------------------------
  // CAMADA B — CARGA INTERNA (Única para ATL / CTL / ACWR)
  // Hierarquia Estrita: Garmin Load -> TRIMP -> Session RPE
  // -------------------------------------------------------------
  let method: LoadMethod = "session_rpe";
  let methodLabel = "Session RPE";
  let sourceDetails = "";
  let internalLoad = 0;
  let garminLoadValue: number | null = null;
  let trimpValue: number | null = null;
  let sessionRpeValue: number | null = null;

  let cardioRatio = 0.85;
  if (avgHr > 0) {
    cardioRatio = avgHr / Math.max(120, thresholdHr);
  }
  const intensityRatioPercent = Math.round(cardioRatio * 100);

  // 1. Garmin Training Load (Prioridade Máxima)
  if (garminLoad !== undefined && garminLoad !== null && garminLoad > 0) {
    method = "garmin";
    methodLabel = "Garmin Training Load";
    garminLoadValue = Math.round(garminLoad);
    internalLoad = garminLoadValue;
    sourceDetails = "Arquivo .FIT / Dispositivo Garmin";
  } 
  // 2. TRIMP (Fator FC se sem Garmin Load)
  else if (avgHr > 0) {
    method = "trimp";
    methodLabel = "TRIMP (Fisiológico)";
    const hrFactor = heartRateFactor(avgHr, restingHr, maxHr);
    const rawTrimp = movingTimeMinutes * hrFactor * (cardioRatio * cardioRatio) * 3.2;
    trimpValue = Math.max(10, Math.round(rawTrimp));
    internalLoad = trimpValue;
    sourceDetails = `Tempo (${movingTimeMinutes} min) × FC Média (${avgHr} bpm)`;
  } 
  // 3. Session RPE (Apenas se sem FC)
  else {
    method = "session_rpe";
    methodLabel = "Session RPE (Perceptivo)";
    const safeRpe = Math.max(1, Math.min(10, rpe || 5));
    sessionRpeValue = Math.round(movingTimeMinutes * safeRpe * 0.8);
    internalLoad = sessionRpeValue;
    sourceDetails = `Tempo (${movingTimeMinutes} min) × RPE (${safeRpe}/10)`;
  }

  // -------------------------------------------------------------
  // CAMADA C — ESTADO BIOLÓGICO & PERCEPÇÃO (Serve para interpretação)
  // -------------------------------------------------------------
  const biologicalState = {
    rpe: Math.max(1, Math.min(10, rpe || 5)),
    rpeSource: (options?.rpeFromFit ? "fit" : "manual") as "fit" | "manual",
    avgHr,
    readinessScore: options?.readinessScore,
    sleepHrs: options?.sleepHrs,
    hrvMs: options?.hrvMs,
  };

  const confidence = getLoadConfidence(method === "garmin" || hasFit, avgHr > 0, rpe > 0);

  return {
    method,
    methodLabel,
    sourceDetails,
    externalWork,
    internalLoad,
    garminLoadValue,
    trimpValue,
    sessionRpeValue,
    biologicalState,
    
    // Legacy support fields mapping clean single internal load
    externalLoad: Math.round(movingTimeMinutes * 3.0 + elevation * 0.15),
    cardiovascularLoad: trimpValue || internalLoad,
    perceptualLoad: Math.round(movingTimeMinutes * getRpeFactor(rpe) * 3.0),
    totalLoad: internalLoad,
    confidence,
    intensityRatioPercent
  };
}

/**
 * Carga Realizada Aetheris (ATL / Activity Load)
 */
export function calculateActivityLoad(
  movingTimeMinutes: number,
  rpe: number,
  avgHr: number,
  restingHr: number = 60,
  maxHr: number = 190,
  garminLoad?: number | null
): number {
  const breakdown = calculateAetherisTrainingLoad(movingTimeMinutes, rpe, avgHr, {
    restingHr,
    maxHr,
    garminTrainingLoad: garminLoad
  });
  return breakdown.internalLoad;
}

/**
 * Interpretação contextualizada cruzando Carga Interna com Estado Biológico
 */
export function interpretLoadWithContext(
  plannedLoad: number,
  actualLoad: number,
  readinessScore: number = 75,
  acwr: number = 1.0,
  rpe: number = 5,
  avgHr: number = 145
): string {
  const isHighLoad = actualLoad >= 180;
  const isLowLoad = actualLoad <= 130;
  const isPerceivedHeavy = rpe >= 7;
  const isPerceivedLight = rpe <= 4;

  if (plannedLoad <= 0) {
    if (isHighLoad && isPerceivedLight) {
      return `Carga realizada de ${actualLoad} pontos. O treino gerou alta demanda fisiológica, porém foi percebido como leve (RPE ${rpe}/10), indicando excelente assimilação e adaptação.`;
    }
    if (isLowLoad && isPerceivedHeavy) {
      return `Carga realizada de ${actualLoad} pontos. Baixa carga objetiva, porém com alta fadiga percebida (RPE ${rpe}/10). Pode indicar estresse ambiental, fadiga acumulada ou recuperação incompleta.`;
    }
    return `Carga realizada de ${actualLoad} pontos (RPE ${rpe}/10). Treino executado com boa resposta fisiológica.`;
  }

  const deviation = Math.round(((actualLoad - plannedLoad) / plannedLoad) * 100);

  if (Math.abs(deviation) <= 15) {
    if (isPerceivedLight) {
      return `Sua carga realizada de ${actualLoad} pontos ficou alinhada com a meta planejada (${plannedLoad} pts) e foi assimilada com facilidade (RPE ${rpe}/10).`;
    }
    return `Sua carga realizada de ${actualLoad} pontos ficou alinhada com a meta planejada (${plannedLoad} pts). Excelente consistência e assimilação do estímulo.`;
  }

  if (deviation > 15) {
    if (isPerceivedLight && readinessScore >= 65) {
      return `Sua carga realizada de ${actualLoad} pontos ficou +${deviation}% acima do previsto (${plannedLoad} pts). A percepção de esforço (${rpe}/10) e a prontidão em ${readinessScore}/100 indicam excelente tolerância fisiológica.`;
    }
    if (isPerceivedHeavy) {
      return `Sua carga realizada de ${actualLoad} pontos ficou +${deviation}% acima do previsto (${plannedLoad} pts) com alta percepção de esforço (RPE ${rpe}/10). Recomenda-se priorizar a recuperação.`;
    }
    return `Sua carga realizada de ${actualLoad} pontos ficou +${deviation}% acima do previsto (${plannedLoad} pts). Acompanhe a recuperação nas próximas sessões.`;
  }

  return `Sua carga realizada de ${actualLoad} pontos ficou abaixo da meta planejada (${plannedLoad} pts, ${deviation}%). Treino mais conservador executado, mantendo a absorção preservada.`;
}

/**
 * Camada de Confiança na estimativa da Carga
 */
export type LoadConfidence = "Alta" | "Moderada" | "Baixa";

export function getLoadConfidence(hasFit: boolean, hasHr: boolean, hasRpe: boolean): LoadConfidence {
  if (hasFit && hasHr && hasRpe) return "Alta";
  if (hasFit || (hasRpe && !hasHr)) return "Moderada";
  return "Baixa";
}

/**
 * 4. Comparação Neutra de Carga de Execução
 */
export interface LoadComparisonResult {
  planned: number;
  actual: number;
  executionRatio: number; // Ex: 1.53 (153% da carga)
  differencePercent: number; // Ex: +53%
  status: "acima do planejado" | "abaixo do planejado" | "dentro do esperado";
  message: string;
}

export function compareLoad(plannedLoad: number, actualLoad: number): LoadComparisonResult {
  if (plannedLoad <= 0) {
    return {
      planned: 0,
      actual: actualLoad,
      executionRatio: 1.0,
      differencePercent: 0,
      status: "dentro do esperado",
      message: "Carga realizada sem meta prévia definida."
    };
  }
  
  const executionRatio = Math.round((actualLoad / plannedLoad) * 100) / 100;
  const difference = actualLoad - plannedLoad;
  const percentage = Math.round((difference / plannedLoad) * 100);

  let status: "acima do planejado" | "abaixo do planejado" | "dentro do esperado" = "dentro do esperado";
  let message = "Treino executado de acordo com a carga planejada.";

  if (percentage > 15) {
    status = "acima do planejado";
    message = `Seu treino gerou mais carga que o planejado (+${percentage}%).`;
  } else if (percentage < -15) {
    status = "abaixo do planejado";
    message = `Seu treino gerou menos carga que o planejado (${percentage}%).`;
  }

  return {
    planned: plannedLoad,
    actual: actualLoad,
    executionRatio,
    differencePercent: percentage,
    status,
    message
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
  accumulatedWeeklyLoad: number = 0,
  readinessScore?: number,
  acwr?: number,
  avgHr?: number
): AdaptiveDecision {
  if (plannedLoad <= 0) {
    return {
      action: "maintain",
      message: "Treino sem meta prévia de carga.",
      reason: "Seguir planejamento do ciclo adaptando o volume conforme a prontidão diária."
    };
  }
  
  const loadDeviation = (actualLoad - plannedLoad) / plannedLoad;
  const currentReadiness = readinessScore !== undefined ? readinessScore : 75;
  const currentAcwr = acwr !== undefined ? acwr : 1.0;

  // CASO A: Treino com carga superior ao previsto, porém organismo em excelente estado (boa tolerância)
  if (loadDeviation > 0.15 && currentReadiness >= 70 && rpe <= 6 && currentAcwr <= 1.3) {
    return {
      action: "progress",
      message: "Excelente assimilação fisiológica do estímulo.",
      reason: "Mesmo com carga acima do previsto, a percepção de esforço foi sob controle e a prontidão está alta. Manter a progressão planejada do ciclo."
    };
  }

  // CASO B: Treino com carga superior ao previsto E organismo com sinais de sobrecarga/fadiga
  if (loadDeviation > 0.15 && (currentReadiness < 50 || rpe >= 8 || currentAcwr > 1.4)) {
    return {
      action: "reduce",
      message: "Estímulo superior à capacidade atual de absorção.",
      reason: "Prontidão reduzida ou percepção de esforço elevada indicam que o estresse fisiológico foi alto. Recomenda-se moderar a intensidade na próxima sessão."
    };
  }

  // CASO C: Treino abaixo da carga planejada com organismo fadigado (autorregulação inteligente)
  if (loadDeviation < -0.15 && currentReadiness < 50) {
    return {
      action: "maintain",
      message: "Autorregulação fisiológica ativada.",
      reason: "O organismo limitou a absorção do estímulo para preservação da recuperação. Priorizar descanso antes da próxima carga alta."
    };
  }

  // CASO D: Treino abaixo da carga planejada com organismo recuperado
  if (loadDeviation < -0.15 && currentReadiness >= 50) {
    return {
      action: "maintain",
      message: "Sessão conservadora executada.",
      reason: "Carga realizada ficou abaixo da meta planejada. Manter a programação prevista sem necessidade de compensação."
    };
  }

  // CASO E: Carga semanal acumulada muito elevada
  if (accumulatedWeeklyLoad > 1200 && currentReadiness < 60) {
    return {
      action: "maintain",
      message: "Volume semanal acumulado elevado.",
      reason: "Manter a intensidade sem novas progressões nesta semana para consolidação do estímulo e adaptação."
    };
  }

  // CASO PADRÃO: Execução alinhada e resposta fisiológica dentro do esperado
  return {
    action: "maintain",
    message: "Resposta fisiológica adequada ao estímulo.",
    reason: "Treino executado de forma compatível com a meta. Manter a programação prevista no ciclo de treinos."
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

/**
 * 7. ÍNDICE DE FADIGA GLOBAL (IFG: 0 - 100)
 * Especificação Técnica Aetheris (Parte 3/5 & Parte 6)
 * Modelo Ponderado:
 * - Sono: 25%
 * - Dor Muscular: 20%
 * - FC Repouso (Desvio): 20%
 * - Carga Recente / ACWR: 20%
 * - Percepção / Estresse: 15%
 */
export interface GlobalFatigueIndexResult {
  ifg: number;
  level: "baixa" | "moderada" | "alta";
  recommendation: string;
  breakdown: {
    sleep: number;
    muscleSoreness: number;
    restingHeartRate: number;
    recentLoad: number;
    perception: number;
  };
}

export function calculateGlobalFatigueIndex(metrics: DailyMetrics, acwr: number = 1.0): GlobalFatigueIndexResult {
  // 1. Sono (25%): 8h+ = 0 pts de fadiga, <5h = 100 pts
  const sleepHours = metrics.sleepHours || 7.5;
  let sleepFatigue = 0;
  if (sleepHours >= 8.0) sleepFatigue = 10;
  else if (sleepHours >= 7.0) sleepFatigue = 25;
  else if (sleepHours >= 6.0) sleepFatigue = 55;
  else if (sleepHours >= 5.0) sleepFatigue = 80;
  else sleepFatigue = 100;

  // 2. Dor Muscular DOMS (20%): 0-10 escala
  const muscleSoreness = metrics.muscleSoreness !== undefined ? metrics.muscleSoreness : 2;
  const sorenessFatigue = Math.min(100, Math.max(0, muscleSoreness * 10));

  // 3. FC Repouso (20%): elevação indica fadiga simpática acumulada
  const rhr = metrics.restingHeartRate || 60;
  const rhrBaseline = 60; // baseline de referência
  const rhrDiff = rhr - rhrBaseline;
  let rhrFatigue = 20;
  if (rhrDiff > 7) rhrFatigue = 90;
  else if (rhrDiff > 4) rhrFatigue = 65;
  else if (rhrDiff > 2) rhrFatigue = 40;
  else if (rhrDiff < -2) rhrFatigue = 10;

  // 4. Carga Recente / ACWR (20%): ACWR > 1.5 = fadiga muito alta
  let loadFatigue = 30;
  if (acwr > 1.5) loadFatigue = 95;
  else if (acwr > 1.3) loadFatigue = 75;
  else if (acwr >= 0.8 && acwr <= 1.3) loadFatigue = 30;
  else loadFatigue = 15; // sub-estímulo / destreinamento

  // 5. Percepção / Estresse (15%)
  let perceptionFatigue = 30;
  if (metrics.subjectiveFeeling === "muito_cansado") perceptionFatigue = 95;
  else if (metrics.subjectiveFeeling === "cansado") perceptionFatigue = 70;
  else if (metrics.subjectiveFeeling === "normal") perceptionFatigue = 40;
  else if (metrics.subjectiveFeeling === "bem") perceptionFatigue = 20;
  else if (metrics.subjectiveFeeling === "muito_bem") perceptionFatigue = 5;

  const ifg = Math.round(
    sleepFatigue * 0.25 +
    sorenessFatigue * 0.20 +
    rhrFatigue * 0.20 +
    loadFatigue * 0.20 +
    perceptionFatigue * 0.15
  );

  let level: "baixa" | "moderada" | "alta" = "baixa";
  let recommendation = "IFG Baixo (0-30): Organismo bem recuperado. Treinar normalmente conforme plano.";

  if (ifg >= 61) {
    level = "alta";
    recommendation = "IFG Alto (61-100): Fadiga acumulada elevada! Reduzir carga imediatamente (-30% a -50%) ou converter em descanso/mobilidade.";
  } else if (ifg >= 31) {
    level = "moderada";
    recommendation = "IFG Moderado (31-60): Fadiga intermediária. Ajustar volume da sessão mantendo consistência sem extrapolar.";
  }

  return {
    ifg,
    level,
    recommendation,
    breakdown: {
      sleep: Math.round(sleepFatigue * 0.25),
      muscleSoreness: Math.round(sorenessFatigue * 0.20),
      restingHeartRate: Math.round(rhrFatigue * 0.20),
      recentLoad: Math.round(loadFatigue * 0.20),
      perception: Math.round(perceptionFatigue * 0.15)
    }
  };
}

/**
 * 8. ÍNDICE DE PREPARAÇÃO DIÁRIA (IPD: 0 - 100)
 * Fórmula exata da Especificação Parte 6 Secção 4:
 * IPD = (Sono * 0.20) + (Energia * 0.20) + (VFC * 0.20) + (FC Repouso * 0.15) + (Humor * 0.10) + (Dor Inversa * 0.15)
 */
export interface DailyReadinessIndexResult {
  ipd: number;
  zone: "Verde" | "Amarela" | "Vermelha";
  actionDecision: string;
  recommendation: string;
}

export function calculateDailyReadinessIndex(metrics: DailyMetrics): DailyReadinessIndexResult {
  // Conversão padronizada 0-100 das variáveis:
  const sleepHrs = metrics.sleepHours || 7.5;
  const sleepScoreNorm = Math.min(100, Math.max(0, (sleepHrs / 8.0) * 100));

  const energyNorm = metrics.bodyBattery !== undefined ? metrics.bodyBattery : 75;

  const hrv = metrics.hrv || 50;
  const hrvBaseline = metrics.hrvBaseline || 50;
  const hrvNorm = Math.min(100, Math.max(0, 100 + ((hrv - hrvBaseline) / hrvBaseline) * 100));

  const rhr = metrics.restingHeartRate || 60;
  const rhrBaseline = 60;
  const rhrNorm = Math.min(100, Math.max(0, 100 - (rhr - rhrBaseline) * 5));

  let moodNorm = 70;
  if (metrics.subjectiveFeeling === "muito_bem") moodNorm = 100;
  else if (metrics.subjectiveFeeling === "bem") moodNorm = 85;
  else if (metrics.subjectiveFeeling === "normal") moodNorm = 65;
  else if (metrics.subjectiveFeeling === "cansado") moodNorm = 35;
  else if (metrics.subjectiveFeeling === "muito_cansado") moodNorm = 15;

  const muscleSoreness = metrics.muscleSoreness !== undefined ? metrics.muscleSoreness : 2;
  const inverseSorenessNorm = Math.max(0, 100 - muscleSoreness * 10);

  const ipd = Math.round(
    sleepScoreNorm * 0.20 +
    energyNorm * 0.20 +
    hrvNorm * 0.20 +
    rhrNorm * 0.15 +
    moodNorm * 0.10 +
    inverseSorenessNorm * 0.15
  );

  let zone: "Verde" | "Amarela" | "Vermelha" = "Verde";
  let actionDecision = "Executar treino completo planejado";
  let recommendation = "Zona Verde (80-100): Prontidão excelente para treinos de qualidade (VO2, Tempo Run ou Longão).";

  if (ipd < 50) {
    zone = "Vermelha";
    actionDecision = "Trocar estímulo por regenerativo (Z1/Z2) ou mobilidade";
    recommendation = "Zona Vermelha (<50): Baixa prontidão. Substituir tiros/limiar por rodagem leve Z2 ou regenerativo ativo.";
  } else if (ipd < 80) {
    zone = "Amarela";
    actionDecision = "Manter estímulo, reduzindo volume em 20-30%";
    recommendation = "Zona Amarela (50-79): Prontidão moderada. Preservar a intensidade principal reduzindo volume total de repetições.";
  }

  return {
    ipd,
    zone,
    actionDecision,
    recommendation
  };
}

/**
 * 9. ÍNDICE DE EVOLUÇÃO DO ATLETA (IEA: 0 - 100)
 * Métrica de Longo Prazo da Especificação Técnica Parte 6 Secção 19:
 * IEA = (30% * Consistência) + (25% * Performance) + (20% * Recuperação) + (15% * Saúde) + (10% * Satisfação)
 */
export function calculateAthleteEvolutionIndex(
  consistencyRate: number,       // 0-100 (% treinos realizados)
  performanceImprovement: number, // 0-100 (evolução de pace/potência)
  recoveryScore: number,          // 0-100 (qualidade média da prontidão/sono)
  healthScore: number,            // 0-100 (ausência de lesões e dores)
  satisfactionScore: number       // 0-100 (percepção subjetiva de satisfação)
): { iea: number; status: string; action: string } {
  const iea = Math.round(
    consistencyRate * 0.30 +
    performanceImprovement * 0.25 +
    recoveryScore * 0.20 +
    healthScore * 0.15 +
    satisfactionScore * 0.10
  );

  let status = "Manutenção";
  let action = "Manter estrutura de treino e consolidação de adaptações.";

  if (iea > 85) {
    status = "Progressão Excelente";
    action = "Atleta em supercompensação ideal. Liberada progressão de carga de 5-10%.";
  } else if (iea >= 70) {
    status = "Evolução Estável";
    action = "Manter estímulos atuais com progressão conservadora.";
  } else if (iea >= 50) {
    status = "Reavaliação";
    action = "Reavaliar equilíbrio entre estímulos e descanso. Ajustar volume.";
  } else {
    status = "Intervenção Urgente";
    action = "Aplicar semana de descarga estratégica e revisar histórico de fadiga.";
  }

  return { iea, status, action };
}

/**
 * 10. ESTRUTURA DE MESOCICLO E SEMANA DE DESCARGA (Parte 3/5 Secção 24 & 25)
 * Modelo padrão de 4 semanas:
 * Semana 1: Construção
 * Semana 2: Progressão (+5-10% volume)
 * Semana 3: Pico do Bloco (+10-15% volume, maior estímulo)
 * Semana 4: Descarga (-20% a -40% volume, mantendo estímulo neuromuscular)
 */
export function getPeriodizationBlockWeek(weekNumber: number): {
  type: "Construção" | "Progressão" | "Pico" | "Descarga";
  volumeAdjustmentFactor: number;
  intensityStrategy: string;
  description: string;
} {
  const weekInCycle = ((weekNumber - 1) % 4) + 1;

  switch (weekInCycle) {
    case 1:
      return {
        type: "Construção",
        volumeAdjustmentFactor: 1.0,
        intensityStrategy: "Volume moderado e técnica reforçada.",
        description: "Semana 1: Adaptação e introdução de carga controlada."
      };
    case 2:
      return {
        type: "Progressão",
        volumeAdjustmentFactor: 1.08,
        intensityStrategy: "Aumento progressivo de 5-10% na carga.",
        description: "Semana 2: Progressão contínua de volume e consolidação."
      };
    case 3:
      return {
        type: "Pico",
        volumeAdjustmentFactor: 1.15,
        intensityStrategy: "Maior estímulo do bloco (volume e treino-chave).",
        description: "Semana 3: Pico do mesociclo com maior estímulo fisiológico."
      };
    case 4:
    default:
      return {
        type: "Descarga",
        volumeAdjustmentFactor: 0.70, // -30% volume
        intensityStrategy: "Redução de 20-40% no volume mantendo qualidade neuromuscular (ex: repetições mais curtas).",
        description: "Semana 4: Descarga obrigatória para supercompensação e dissipação de fadiga."
      };
  }
}

/**
 * 11. ALGORITMO DE POLIMENTO (TAPER) ANTES DE PROVAS (Parte 3/5 Secção 35)
 */
export function getTaperSchedule(goalType: string): {
  taperDurationWeeks: number;
  weeklyVolumePercentages: number[];
  description: string;
} {
  const type = goalType?.toLowerCase() || "";

  if (type.includes("marathon") || type.includes("maratona") || type.includes("42")) {
    return {
      taperDurationWeeks: 3,
      weeklyVolumePercentages: [80, 60, 40],
      description: "Polimento de Maratona (3 semanas): Sem -3 (80%), Sem -2 (60%), Sem -1 (40%). Manter intensidade em tiros curtos."
    };
  }

  if (type.includes("half") || type.includes("meia") || type.includes("21")) {
    return {
      taperDurationWeeks: 2,
      weeklyVolumePercentages: [80, 50],
      description: "Polimento de Meia Maratona (2 semanas): Sem -2 (80%), Sem -1 (50%). Preservar ritmos específicos."
    };
  }

  return {
    taperDurationWeeks: 1,
    weeklyVolumePercentages: [70],
    description: "Polimento de 5k / 10k (7-10 dias): Redução de 30% do volume mantendo velocidade."
  };
}

/**
 * 12. DETECÇÃO DE ESTAGNAÇÃO DO ATLETA (Parte 3/5 Secção 37)
 * Identifica quando em 3-4 semanas o pace não melhora, a carga aumenta e a percepção de esforço piora.
 */
export function detectStagnation(
  weeksHistory: Array<{ averagePaceSec: number; weeklyLoad: number; averageRpe: number }>
): { detected: boolean; reason?: string; action?: string } {
  if (!weeksHistory || weeksHistory.length < 3) {
    return { detected: false };
  }

  const recent = weeksHistory.slice(-3);
  const loadIncreasing = recent[2].weeklyLoad > recent[0].weeklyLoad;
  const paceNotImproving = recent[2].averagePaceSec >= recent[0].averagePaceSec;
  const rpeWorsening = recent[2].averageRpe > recent[0].averageRpe;

  if (loadIncreasing && paceNotImproving && rpeWorsening) {
    return {
      detected: true,
      reason: "Estagnação detectada: Nas últimas 3 semanas, a carga aumentou mas o ritmo estagnou/piorou e o RPE elevou-se.",
      action: "Intervenção automática: Aplicar semana imediata de descarga, alterar variabilidade de estímulos e reavaliar recuperação."
    };
  }

  return { detected: false };
}



