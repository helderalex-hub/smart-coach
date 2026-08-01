import { GuidanceCategory, GuidanceContext, GuidanceMessage, ReadinessStatus } from "./types";

export const GUIDANCE_CATALOG: GuidanceMessage[] = [
  // ==========================================
  // 1. SEGURANÇA (Prioridade 100)
  // ==========================================
  {
    id: "S001",
    categoria: "seguranca",
    prioridade: 100,
    titulo: "Frequência Cardíaca Precoce",
    cooldownDays: 2,
    objetivoFisiologico: "Proteção cardiovascular e prevenção de estresse simpático precoce",
    regra: (ctx) =>
      ctx.metrics.sleepHours < 6 ||
      (ctx.metrics.bodyBattery !== undefined && ctx.metrics.bodyBattery < 40) ||
      (ctx.readinessScore !== undefined && ctx.readinessScore < 55) ||
      ctx.readinessStatus === ReadinessStatus.RECOVER,
    texto:
      "Se nos primeiros 10 minutos sua frequência cardíaca subir muito acima do esperado ou o esforço parecer maior que 5/10, transforme a sessão em rodagem regenerativa."
  },
  {
    id: "S002",
    categoria: "seguranca",
    prioridade: 100,
    titulo: "Dor Muscular Repetitiva (DOMS)",
    cooldownDays: 2,
    objetivoFisiologico: "Proteção neuromuscular e microrestauração tecidual",
    regra: (ctx) => (ctx.metrics.muscleSoreness || 0) >= 5,
    texto:
      "Evite acelerações hoje. Músculos doloridos respondem melhor a movimentos contínuos do que explosivos."
  },
  {
    id: "S003",
    categoria: "seguranca",
    prioridade: 100,
    titulo: "Sinal de Alerta Articular",
    cooldownDays: 1,
    objetivoFisiologico: "Preservação de estruturas articulares e biofísica",
    regra: (ctx) => Boolean(ctx.hasInjury || ctx.metrics.hasInjury),
    texto:
      "Interrompa o treino caso a dor aumente durante a corrida. Dor progressiva não faz parte da adaptação."
  },
  {
    id: "S004",
    categoria: "seguranca",
    prioridade: 100,
    titulo: "Fadiga Residual do Treino Anterior",
    cooldownDays: 3,
    objetivoFisiologico: "Dispersão de fadiga metabólica acumulada",
    regra: (ctx) => (ctx.garminRecoveryTimeHours || 0) > 24,
    texto:
      "Ainda existe fadiga residual do treino anterior. Hoje a prioridade é facilitar a recuperação."
  },

  // ==========================================
  // 10. MENSAGENS DE ALERTA (Prioridade 95)
  // ==========================================
  {
    id: "A001",
    categoria: "alerta",
    prioridade: 95,
    titulo: "Pico Agudo de Carga Semanal (ACWR > 1.5)",
    cooldownDays: 4,
    objetivoFisiologico: "Mitigação de risco biomecânico por pico agudo de volume/intensidade",
    regra: (ctx) => (ctx.acwr || 1.0) > 1.5,
    texto:
      "Sua carga aumentou rapidamente nos últimos dias. Hoje evitamos intensidade para reduzir risco de lesão."
  },
  {
    id: "A002",
    categoria: "alerta",
    prioridade: 95,
    titulo: "Oscilação dos Biomarcadores Autonômicos",
    cooldownDays: 3,
    objetivoFisiologico: "Restauração do tônus vagal e do equilíbrio parassimpático",
    regra: (ctx) =>
      ctx.metrics.hrvStatus === "unbalanced" ||
      ((ctx.metrics.hrv || 50) < (ctx.metrics.hrvBaseline || 55) * 0.85 &&
        (ctx.metrics.restingHeartRate || 55) > 60),
    texto:
      "Seus biomarcadores sugerem recuperação incompleta. Escute seu corpo hoje."
  },
  {
    id: "A003",
    categoria: "alerta",
    prioridade: 95,
    titulo: "Privação de Sono Acumulada",
    cooldownDays: 3,
    objetivoFisiologico: "Consolidação metabólica e restauração do eixo neuroendócrino",
    regra: (ctx) =>
      (ctx.consecutiveBadSleepNights || 0) >= 3 ||
      (ctx.metrics.sleepHours < 6 && (ctx.metrics.sleepScore || 70) < 65),
    texto:
      "O principal limitador hoje é o sono, não o condicionamento físico."
  },

  // ==========================================
  // 2. OBJETIVO DO DIA (Prioridade 90)
  // ==========================================
  {
    id: "T001",
    categoria: "objetivo",
    prioridade: 90,
    titulo: "Objetivo: Recuperação Ativa",
    cooldownDays: 1,
    objetivoFisiologico: "Ativação da circulação periférica em Z1 sem gerar estresse simpático",
    regra: (ctx) =>
      (ctx.readinessScore || 100) < 50 ||
      ctx.workoutIntent === "recovery" ||
      (ctx.workoutName && /regenerativo|recupera/i.test(ctx.workoutName)),
    texto:
      "Hoje o treino existe para acelerar sua recuperação, não para aumentar condicionamento."
  },
  {
    id: "T002",
    categoria: "objetivo",
    prioridade: 90,
    titulo: "Objetivo: Base Aeróbica Z2",
    cooldownDays: 1,
    objetivoFisiologico: "Biogênese mitocondrial e capilarização muscular em ritmo conversacional",
    regra: (ctx) =>
      ctx.workoutIntent === "aerobic_base" ||
      (ctx.workoutName && /base|z2|rodagem/i.test(ctx.workoutName)),
    texto:
      "Mantenha um ritmo confortável. Hoje estamos construindo eficiência aeróbica."
  },
  {
    id: "T003",
    categoria: "objetivo",
    prioridade: 90,
    titulo: "Objetivo: Limiar de Lactato",
    cooldownDays: 1,
    objetivoFisiologico: "Tolerância metabólica à acidose e sustentabilidade em ritmo de prova",
    regra: (ctx) =>
      ctx.workoutIntent === "threshold" ||
      (ctx.workoutName && /limiar|tempo/i.test(ctx.workoutName)),
    texto:
      "O ritmo deve ser sustentado, mas controlado. Termine forte, sem esgotar."
  },
  {
    id: "T004",
    categoria: "objetivo",
    prioridade: 90,
    titulo: "Objetivo: Potência Aeróbica (VO2max)",
    cooldownDays: 1,
    objetivoFisiologico: "Expansão do teto de consumo de oxigênio e débito cardíaco máximo",
    regra: (ctx) =>
      ctx.workoutIntent === "vo2max" ||
      (ctx.workoutName && /tiros|vo2|intervalado/i.test(ctx.workoutName)),
    texto:
      "Qualidade é mais importante que velocidade absoluta. Se perder consistência, reduza o ritmo."
  },
  {
    id: "T005",
    categoria: "objetivo",
    prioridade: 90,
    titulo: "Objetivo: Treino Longo (Longão)",
    cooldownDays: 1,
    objetivoFisiologico: "Resistência de fadiga tardia e oxidação preferencial de lipídios",
    regra: (ctx) =>
      Boolean(ctx.isLongRun) ||
      ctx.workoutIntent === "long_run" ||
      (ctx.workoutName && /longão|long/i.test(ctx.workoutName)),
    texto:
      "Controle o entusiasmo nos primeiros quilômetros. O longão começa fácil."
  },

  // ==========================================
  // 9. APRENDIZADO DO TREINADOR (Prioridade 88 - Dinâmica)
  // ==========================================
  {
    id: "L001",
    categoria: "aprendizado",
    prioridade: 88,
    titulo: "Padrão: Início Acelerado",
    cooldownDays: 3,
    isPersonalized: true,
    objetivoFisiologico: "Economia de ritmo e modulação inicial de esforço",
    regra: (ctx) => ctx.startedFastInLastWorkouts === true,
    texto:
      "Você costuma iniciar acima do ritmo ideal. Experimente correr os primeiros cinco minutos mais devagar."
  },
  {
    id: "L002",
    categoria: "aprendizado",
    prioridade: 88,
    titulo: "Padrão: Sensibilidade ao Sono",
    cooldownDays: 3,
    isPersonalized: true,
    objetivoFisiologico: "Maximização dos ganhos por alinhamento neurohormonal",
    regra: (ctx) => ctx.improvesWithSleep === true || ctx.metrics.sleepHours >= 7.5,
    texto:
      "Seus melhores treinos acontecem após noites bem dormidas."
  },
  {
    id: "L003",
    categoria: "aprendizado",
    prioridade: 88,
    titulo: "Padrão: Inércia Cardiovascular",
    cooldownDays: 3,
    isPersonalized: true,
    objetivoFisiologico: "Ajuste fino de aquecimento e estabilização de frequência cardíaca",
    regra: (ctx) => ctx.hrSpikesEarly === true,
    texto:
      "Sua frequência cardíaca tende a estabilizar após aproximadamente oito minutos de aquecimento."
  },
  {
    id: "L004",
    categoria: "aprendizado",
    prioridade: 88,
    titulo: "Padrão: Gestão de Final de Treino",
    cooldownDays: 3,
    isPersonalized: true,
    objetivoFisiologico: "Evolução progressiva da capacidade de carga em ritmo",
    regra: (ctx) => ctx.finishesStrong === true,
    texto:
      "Você administra bem o esforço. Podemos começar a aumentar progressivamente a duração dos blocos de ritmo."
  },
  {
    id: "L005",
    categoria: "aprendizado",
    prioridade: 88,
    titulo: "Padrão: Assimilação de Intensidade",
    cooldownDays: 3,
    isPersonalized: true,
    objetivoFisiologico: "Progressão segura em microciclos de treino",
    regra: (ctx) => ctx.dropsIntenseWorkouts === true,
    texto:
      "Você responde melhor a aumentos graduais de intensidade do que a grandes saltos de carga."
  },

  // ==========================================
  // 3. CONTROLE DO RITMO (Prioridade 80)
  // ==========================================
  {
    id: "P001",
    categoria: "ritmo",
    prioridade: 80,
    titulo: "Frequência Cardíaca vs Pace",
    cooldownDays: 3,
    conflictingIds: ["T003", "T004"],
    regra: (ctx) =>
      ctx.workoutIntent === "aerobic_base" || ctx.workoutIntent === "recovery",
    texto:
      "Ignore o pace se necessário. Hoje a frequência cardíaca é mais importante."
  },
  {
    id: "P002",
    categoria: "ritmo",
    prioridade: 80,
    titulo: "Ajuste por Estresse Térmico",
    cooldownDays: 3,
    regra: (ctx) =>
      (ctx.temperature || 20) >= 26 ||
      Boolean(ctx.weatherCondition && /calor|quente/i.test(ctx.weatherCondition)),
    texto:
      "Ajuste o ritmo para manter o mesmo esforço fisiológico."
  },
  {
    id: "P003",
    categoria: "ritmo",
    prioridade: 80,
    titulo: "Gestão de Esforço em Subida",
    cooldownDays: 3,
    regra: (ctx) => ctx.isUphill === true,
    texto:
      "Nas subidas controle o esforço, não a velocidade."
  },
  {
    id: "P004",
    categoria: "ritmo",
    prioridade: 80,
    titulo: "Gestão de Esforço Contra o Vento",
    cooldownDays: 3,
    regra: (ctx) =>
      ctx.isWindy === true ||
      Boolean(ctx.weatherCondition && /vento/i.test(ctx.weatherCondition)),
    texto:
      "O vento altera o pace, mas não muda o objetivo fisiológico."
  },

  // ==========================================
  // 4. TÉCNICA (Prioridade 60) - Máximo 2x/semana
  // ==========================================
  {
    id: "C001",
    categoria: "tecnica",
    prioridade: 60,
    titulo: "Postura e Ombros",
    cooldownDays: 4,
    regra: () => true,
    texto: "Ombros relaxados economizam energia."
  },
  {
    id: "C002",
    categoria: "tecnica",
    prioridade: 60,
    titulo: "Sincronismo de Braços",
    cooldownDays: 4,
    regra: () => true,
    texto: "Braços acompanham o ritmo das pernas."
  },
  {
    id: "C003",
    categoria: "tecnica",
    prioridade: 60,
    titulo: "Economia de Corrida e Cadência",
    cooldownDays: 4,
    regra: () => true,
    texto: "Passadas silenciosas costumam indicar boa economia de corrida."
  },
  {
    id: "C004",
    categoria: "tecnica",
    prioridade: 60,
    titulo: "Amplitude de Passada",
    cooldownDays: 4,
    regra: () => true,
    texto: "Evite alongar excessivamente a passada."
  },
  {
    id: "C005",
    categoria: "tecnica",
    prioridade: 60,
    titulo: "Alinhamento do Olhar",
    cooldownDays: 4,
    regra: () => true,
    texto: "Olhe alguns metros à frente, não para os pés."
  },
  {
    id: "C006",
    categoria: "tecnica",
    prioridade: 60,
    titulo: "Ritmo Respiratório",
    cooldownDays: 4,
    regra: () => true,
    texto: "Respiração ritmada ajuda a controlar o esforço."
  },

  // ==========================================
  // 5. NUTRIÇÃO (Prioridade 50)
  // ==========================================
  {
    id: "N001",
    categoria: "nutricao",
    prioridade: 50,
    titulo: "Carboidratos Intra-Treino",
    cooldownDays: 3,
    regra: (ctx) => (ctx.workoutDurationMinutes || 0) > 60,
    texto: "Considere ingerir carboidratos durante o treino."
  },
  {
    id: "N002",
    categoria: "nutricao",
    prioridade: 50,
    titulo: "Janela Metabólica Pós-Treino",
    cooldownDays: 3,
    regra: (ctx) =>
      ctx.workoutIntent === "vo2max" ||
      ctx.workoutIntent === "threshold" ||
      (ctx.workoutDurationMinutes || 0) > 75,
    texto:
      "Faça uma refeição rica em carboidratos e proteína até uma hora após o treino."
  },
  {
    id: "N003",
    categoria: "nutricao",
    prioridade: 50,
    titulo: "Hidratação em Dias Quentes",
    cooldownDays: 3,
    regra: (ctx) => (ctx.temperature || 20) >= 25,
    texto: "Reforce a hidratação antes e depois da sessão."
  },
  {
    id: "N004",
    categoria: "nutricao",
    prioridade: 50,
    titulo: "Estratégia Nutricional em Longões",
    cooldownDays: 3,
    regra: (ctx) => Boolean(ctx.isLongRun),
    texto: "Não teste suplementos novos durante treinos importantes."
  },

  // ==========================================
  // 6. RECUPERAÇÃO (Prioridade 50)
  // ==========================================
  {
    id: "R001",
    categoria: "recuperacao",
    prioridade: 50,
    titulo: "Higiene do Sono",
    cooldownDays: 3,
    regra: (ctx) => ctx.metrics.sleepHours < 6.5,
    texto:
      "Priorize dormir mais cedo hoje. O ganho do treino depende da recuperação."
  },
  {
    id: "R002",
    categoria: "recuperacao",
    prioridade: 50,
    titulo: "Carga do Sistema Nervoso Central",
    cooldownDays: 3,
    regra: (ctx) =>
      ctx.metrics.hrvStatus === "unbalanced" || (ctx.metrics.hrv || 50) < 52,
    texto:
      "Seu sistema nervoso ainda está sob carga. Evite atividades intensas fora do treino."
  },
  {
    id: "R003",
    categoria: "recuperacao",
    prioridade: 50,
    titulo: "Preservação da Bateria Corporal",
    cooldownDays: 3,
    regra: (ctx) => (ctx.metrics.bodyBattery || 100) < 50,
    texto:
      "Guarde energia para o restante do dia. Recuperação continua depois da corrida."
  },
  {
    id: "R004",
    categoria: "recuperacao",
    prioridade: 50,
    titulo: "Retorno Venoso Pós-Longão",
    cooldownDays: 3,
    regra: (ctx) => Boolean(ctx.recentLongRunCompleted),
    texto:
      "Caminhe alguns minutos após terminar para acelerar a recuperação."
  },

  // ==========================================
  // 7. CLIMA (Prioridade 40)
  // ==========================================
  {
    id: "W001",
    categoria: "clima",
    prioridade: 40,
    titulo: "Temperatura Elevada (>28°C)",
    cooldownDays: 3,
    regra: (ctx) => (ctx.temperature || 20) >= 28,
    texto: "Reduza o ritmo. O calor aumenta o esforço fisiológico."
  },
  {
    id: "W002",
    categoria: "clima",
    prioridade: 40,
    titulo: "Temperatura Baixa (<10°C)",
    cooldownDays: 3,
    regra: (ctx) => (ctx.temperature || 20) <= 10 && ctx.temperature !== undefined,
    texto: "Faça um aquecimento mais longo antes de acelerar."
  },
  {
    id: "W003",
    categoria: "clima",
    prioridade: 40,
    titulo: "Corrida na Chuva",
    cooldownDays: 3,
    regra: (ctx) =>
      Boolean(ctx.weatherCondition && /chuva|chuvoso/i.test(ctx.weatherCondition)),
    texto: "Prefira superfícies seguras e evite curvas rápidas."
  },

  // ==========================================
  // 8. PSICOLOGIA (Prioridade 30)
  // ==========================================
  {
    id: "M001",
    categoria: "psicologia",
    prioridade: 30,
    titulo: "Mentalidade em Treinos Leves",
    cooldownDays: 4,
    regra: (ctx) =>
      ctx.workoutIntent === "recovery" || ctx.workoutIntent === "aerobic_base",
    texto:
      "Não subestime treinos fácil. Eles permitem que os treinos difíceis funcionem."
  },
  {
    id: "M002",
    categoria: "psicologia",
    prioridade: 30,
    titulo: "Consistência de Longo Prazo",
    cooldownDays: 4,
    regra: (ctx) => (ctx.completedWorkoutsCount || 0) >= 3,
    texto: "Consistência vale mais que um único treino perfeito."
  },
  {
    id: "M003",
    categoria: "psicologia",
    prioridade: 30,
    titulo: "Mentalidade de Retomada",
    cooldownDays: 4,
    regra: (ctx) =>
      Boolean(ctx.hasMissedWorkoutInWeek) || (ctx.metrics.daysWithoutTraining || 0) >= 3,
    texto:
      "Hoje não estamos recuperando dias perdidos. Estamos retomando a consistência."
  },
  {
    id: "M004",
    categoria: "psicologia",
    prioridade: 30,
    titulo: "Confiança no Processo",
    cooldownDays: 4,
    regra: (ctx) =>
      ctx.workoutIntent === "threshold" || ctx.workoutIntent === "vo2max",
    texto: "Confie no trabalho já realizado. Hoje é apenas mais uma etapa."
  },

  // ==========================================
  // MENSAGENS BASEADAS NAS 10 CAMADAS DO ATLETA
  // ==========================================
  {
    id: "L001",
    categoria: "recuperacao",
    prioridade: 90,
    titulo: "Impacto Circadiano & Filhos Pequenos",
    cooldownDays: 2,
    objetivoFisiologico: "Modulação da curva de fadiga para rotinas de sono fragmentado",
    regra: (ctx) => Boolean(ctx.athleteProfile?.youngChildren || ctx.athleteProfile?.nightShiftWork),
    texto:
      "Detectamos que sua rotina possui interrupções de sono/turno. O Treinador Aetheris ajustou a janela de regeneração pós-treino para evitar sobrecarga do SNC."
  },
  {
    id: "L002",
    categoria: "seguranca",
    prioridade: 95,
    titulo: "Acompanhamento Biofísico de Lesão Ativa",
    cooldownDays: 2,
    objetivoFisiologico: "Proteção de tecidos em fase de regeneração tecidual",
    regra: (ctx) =>
      Boolean(ctx.athleteProfile?.structuredInjuries && ctx.athleteProfile.structuredInjuries.some(i => i.status === "em_tratamento")),
    texto: (ctx) => {
      const activeInj = ctx.athleteProfile?.structuredInjuries?.find(i => i.status === "em_tratamento");
      return `Alerta do Treinador: Mantenha foco na limitação da sua lesão em ${activeInj?.type || "articulação"} (${activeInj?.side || "afetada"}). ${activeInj?.limitation || "Evite acelerações bruscas."}`;
    }
  },
  {
    id: "L003",
    categoria: "aprendizado",
    prioridade: 70,
    titulo: "Estilo do Treinador Persona",
    cooldownDays: 5,
    regra: (ctx) => Boolean(ctx.athleteProfile?.coachStyle),
    texto: (ctx) => {
      const style = ctx.athleteProfile?.coachStyle;
      if (style === "conservador") return "Estilo Conservador Ativo: Priorizando 100% a segurança articular e consistência a longo prazo.";
      if (style === "agressivo") return "Estilo Agressivo Ativo: Buscando estímulos de pico para máxima adaptação fisiológica.";
      return "Estilo Equilibrado Ativo: Dosagem cirúrgica entre estimulação aeróbica e recuperação parassimpática.";
    }
  }
];

/**
 * Engine execution logic to select 2 to 4 high-impact guidance messages per workout session.
 */
export function evaluateGuidanceEngine(context: GuidanceContext): GuidanceMessage[] {
  const nowMs = Date.now();
  const shownHistory = context.shownHistory || loadGuidanceHistory();

  // 1. Filter out candidates based on trigger condition (regra)
  let eligible = GUIDANCE_CATALOG.filter((msg) => {
    try {
      return msg.regra(context);
    } catch {
      return false;
    }
  });

  // 2. Filter out candidates currently in cooldown (skip if history timestamp was created in the last 15 minutes to clear previous re-render artifacts)
  eligible = eligible.filter((msg) => {
    const lastShownTime = shownHistory[msg.id];
    if (!lastShownTime) return true;
    const elapsedMs = nowMs - lastShownTime;
    if (elapsedMs < 15 * 60 * 1000) return true; // ignore recent auto-save artifacts from re-renders
    const cooldownMs = (msg.cooldownDays || 7) * 24 * 60 * 60 * 1000;
    return elapsedMs > cooldownMs;
  });

  // 3. Dynamic priority boosting: as athlete completed history grows (>=5 workouts),
  // boost Learned (Aprendizado) messages priority so they override generic psychology.
  const isExperiencedAthlete = (context.completedWorkoutsCount || 0) >= 5;
  const processedCandidates = eligible.map((msg) => {
    let effectivePriority = msg.prioridade;
    if (msg.categoria === "aprendizado" && isExperiencedAthlete) {
      effectivePriority += 7; // Boost to ~95
    }
    return { ...msg, effectivePriority };
  });

  // Sort by effective priority descending
  processedCandidates.sort((a, b) => b.effectivePriority - a.effectivePriority);

  const selected: GuidanceMessage[] = [];

  // Bucket candidates by category
  const segurancaCandidates = processedCandidates.filter((m) => m.categoria === "seguranca");
  const alertaCandidates = processedCandidates.filter((m) => m.categoria === "alerta");
  const objetivoCandidates = processedCandidates.filter((m) => m.categoria === "objetivo");
  const aprendizadoCandidates = processedCandidates.filter((m) => m.categoria === "aprendizado");

  // Rule: Max 1 Segurança (Priority 100)
  if (segurancaCandidates.length > 0) {
    selected.push(segurancaCandidates[0]);
  }

  // Rule: Max 1 Alerta (Priority 95)
  if (alertaCandidates.length > 0) {
    selected.push(alertaCandidates[0]);
  }

  // Rule: Max 1 Objetivo (Priority 90)
  if (objetivoCandidates.length > 0) {
    selected.push(objetivoCandidates[0]);
  }

  // Rule: If Aprendizado exists (Personalized), add it. If present, filter out generic Psicologia
  const hasAprendizado = aprendizadoCandidates.length > 0;
  if (hasAprendizado) {
    selected.push(aprendizadoCandidates[0]);
  }

  // Fill remaining slots up to 4 total
  for (const candidate of processedCandidates) {
    if (selected.length >= 4) break;

    // Check if already selected
    if (selected.some((s) => s.id === candidate.id)) continue;

    // Check category constraints
    if (candidate.categoria === "seguranca" && selected.some((s) => s.categoria === "seguranca")) continue;
    if (candidate.categoria === "alerta" && selected.some((s) => s.categoria === "alerta")) continue;
    if (candidate.categoria === "objetivo" && selected.some((s) => s.categoria === "objetivo")) continue;

    // Rule 5: If Aprendizado is selected, generic Psicologia is blocked
    if (hasAprendizado && candidate.categoria === "psicologia") continue;

    // Rule 6: Block conflicting messages
    const isConflicting = selected.some((s) => {
      if (s.conflictingIds && s.conflictingIds.includes(candidate.id)) return true;
      if (candidate.conflictingIds && candidate.conflictingIds.includes(s.id)) return true;
      return false;
    });
    if (isConflicting) continue;

    selected.push(candidate);
  }

  // Ensure we have at least 2 messages if available
  if (selected.length < 2) {
    for (const candidate of processedCandidates) {
      if (selected.length >= 2) break;
      if (!selected.some((s) => s.id === candidate.id)) {
        selected.push(candidate);
      }
    }
  }

  // Note: Cooldowns apply across daily sessions; evaluation itself is side-effect free.
  return selected.slice(0, 4);
}

const STORAGE_KEY_GUIDANCE_HISTORY = "fit_guidance_history_v1";

export function loadGuidanceHistory(): Record<string, number> {
  try {
    const data = localStorage.getItem(STORAGE_KEY_GUIDANCE_HISTORY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveGuidanceSelection(ids: string[]) {
  try {
    const history = loadGuidanceHistory();
    const now = Date.now();
    ids.forEach((id) => {
      history[id] = now;
    });
    localStorage.setItem(STORAGE_KEY_GUIDANCE_HISTORY, JSON.stringify(history));
  } catch {
    // ignore
  }
}
