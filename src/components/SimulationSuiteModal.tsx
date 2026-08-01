import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Brain, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Play, 
  Activity, 
  Code, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Sliders, 
  Zap, 
  UserCheck, 
  AlertTriangle, 
  Scale, 
  Gauge, 
  Database, 
  Sparkles,
  X
} from "lucide-react";
import { runAetherisSimulationSuite, SimulationSuiteReport, SimulationTestResult } from "../coach/aetherisSimulationSuite";
import { generateAetherisMicrocycle, MicrocycleGenerateRequest, MicrocycleGenerateResponse } from "../coach/aetherisMicrocycleEngine";

interface SimulationSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAthleteProfile?: any;
}

export default function SimulationSuiteModal({ isOpen, onClose, currentAthleteProfile }: SimulationSuiteModalProps) {
  const [report, setReport] = useState<SimulationSuiteReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedResult, setSelectedResult] = useState<SimulationTestResult | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"suite" | "custom_generator">("suite");

  // Custom API Test Generator state
  const [customRequest, setCustomRequest] = useState<MicrocycleGenerateRequest>({
    athlete_id: "ath_custom_001",
    profile: {
      age: currentAthleteProfile?.age || 38,
      gender: currentAthleteProfile?.gender === "Feminino" ? "female" : "male",
      weight: currentAthleteProfile?.weightCurrentKg || 75,
      height: currentAthleteProfile?.heightCm || 178,
      level: currentAthleteProfile?.experienceLevel || "intermediate",
      years_running: currentAthleteProfile?.yearsRunning || 3
    },
    goal: {
      race: currentAthleteProfile?.currentTargetRaceName || "half_marathon",
      target_date: currentAthleteProfile?.currentTargetRaceDate || "2026-10-15",
      target_time: currentAthleteProfile?.targetTimeGoal || "01:45:00",
      priority: 1
    },
    availability: {
      days_per_week: currentAthleteProfile?.weeklyTrainingDays || 5,
      available_days: currentAthleteProfile?.availableDays || ["monday", "tuesday", "thursday", "friday", "sunday"],
      double_sessions: true
    },
    current_condition: {
      readiness_score: 82,
      sleep_score: 85,
      fatigue_score: 30,
      resting_hr: 52,
      hrv: 65,
      subjective_feeling: "bem"
    },
    training_history: {
      weekly_distance: 45,
      longest_run: 18,
      recent_race: "10km",
      injury_history: false
    }
  });

  const [customResponse, setCustomResponse] = useState<MicrocycleGenerateResponse | null>(null);
  const [isGeneratingCustom, setIsGeneratingCustom] = useState<boolean>(false);
  const [jsonViewMode, setJsonViewMode] = useState<"visual" | "json">("visual");

  const handleRunSuite = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/simulation/suite", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
          setSelectedResult(data.report.results[0] || null);
        } else {
          throw new Error("Formato de relatório inválido.");
        }
      } else {
        // Fallback local execution if offline
        const localReport = runAetherisSimulationSuite();
        setReport(localReport);
        setSelectedResult(localReport.results[0] || null);
      }
    } catch (err) {
      // Local execution fallback
      const localReport = runAetherisSimulationSuite();
      setReport(localReport);
      setSelectedResult(localReport.results[0] || null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !report) {
      handleRunSuite();
    }
  }, [isOpen]);

  const handleGenerateCustomMicrocycle = async () => {
    setIsGeneratingCustom(true);
    try {
      const res = await fetch("/api/v1/microcycle/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customRequest)
      });
      if (res.ok) {
        const data = await res.json();
        setCustomResponse(data);
      } else {
        const localRes = generateAetherisMicrocycle(customRequest);
        setCustomResponse(localRes);
      }
    } catch (e) {
      const localRes = generateAetherisMicrocycle(customRequest);
      setCustomResponse(localRes);
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-neon/20 border border-brand-neon/40 flex items-center justify-center text-brand-neon">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Suíte de Testes Simulados Aetheris</h2>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-brand-neon/20 text-brand-neon border border-brand-neon/30">
                  Engine v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Validação do Motor de Decisão Fisiológica, API REST POST /api/v1/microcycle/generate & ACS Score
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Sub-tab Switcher */}
            <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs font-medium">
              <button
                onClick={() => setActiveSubTab("suite")}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 ${
                  activeSubTab === "suite" 
                    ? "bg-brand-neon text-slate-950 font-bold shadow" 
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>10 Perfis Simulados</span>
              </button>
              <button
                onClick={() => setActiveSubTab("custom_generator")}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 ${
                  activeSubTab === "custom_generator" 
                    ? "bg-brand-neon text-slate-950 font-bold shadow" 
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Testar API / POST</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {activeSubTab === "suite" ? (
            <>
              {/* ACS Score & Overview Banner */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Score Card */}
                <div className="md:col-span-1 bg-gradient-to-br from-slate-950 to-slate-900 border border-brand-neon/30 rounded-xl p-5 flex flex-col justify-between relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-neon/10 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">AI Coach Accuracy Score</span>
                    <div className="flex items-baseline space-x-2 mt-2">
                      <span className="text-4xl font-extrabold text-brand-neon tracking-tight">
                        {report ? report.overall_acs_score : "--"}
                      </span>
                      <span className="text-sm font-semibold text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Status Geral:</span>
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                      report?.status === "APROVADO" 
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      {report ? report.status : "Carregando..."}
                    </span>
                  </div>
                </div>

                {/* Test Metrics Breakdown */}
                <div className="md:col-span-3 bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Scale className="w-4 h-4 text-brand-neon" />
                      <span>Critérios Fisiológicos de Avaliação (ACS Weights)</span>
                    </h4>
                    <button
                      onClick={handleRunSuite}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-lg bg-brand-neon/15 text-brand-neon border border-brand-neon/30 text-xs font-bold hover:bg-brand-neon/25 transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                      <span>{isLoading ? "Executando..." : "Re-executar Suíte"}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
                      <div className="text-xs text-slate-400">Segurança</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">30%</div>
                      <div className="text-[10px] text-slate-500">Controle de Carga</div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
                      <div className="text-xs text-slate-400">Fisiologia</div>
                      <div className="text-sm font-bold text-cyan-400 mt-0.5">25%</div>
                      <div className="text-[10px] text-slate-500">Estímulos Prova</div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
                      <div className="text-xs text-slate-400">Individualização</div>
                      <div className="text-sm font-bold text-sky-400 mt-0.5">20%</div>
                      <div className="text-[10px] text-slate-500">Histórico / Lesão</div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
                      <div className="text-xs text-slate-400">Adaptação</div>
                      <div className="text-sm font-bold text-purple-400 mt-0.5">15%</div>
                      <div className="text-[10px] text-slate-500">IPD & Readiness</div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
                      <div className="text-xs text-slate-400">Satisfação</div>
                      <div className="text-sm font-bold text-amber-400 mt-0.5">10%</div>
                      <div className="text-[10px] text-slate-500">Espaçamento 48h</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/60 flex justify-between">
                    <span>Total de Casos: <strong className="text-white">{report?.total_tests || 0}</strong></span>
                    <span className="text-emerald-400">Aprovados: <strong>{report?.passed_tests || 0}</strong></span>
                    <span className={report?.failed_tests ? "text-rose-400" : "text-slate-500"}>
                      Reprovados: <strong>{report?.failed_tests || 0}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Test List & Detailed Inspection Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Test Selector List */}
                <div className="lg:col-span-5 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                    <span>10 Perfis Simulados Padronizados</span>
                    <span className="text-[10px] text-slate-500">Selecione para inspecionar</span>
                  </h4>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {report?.results.map((res) => {
                      const isSelected = selectedResult?.test_id === res.test_id;
                      return (
                        <button
                          key={res.test_id}
                          onClick={() => setSelectedResult(res)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                            isSelected 
                              ? "bg-slate-800 border-brand-neon/60 shadow-md" 
                              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-bold text-slate-400">{res.test_id}</span>
                              <span className="text-sm font-semibold text-white">{res.test_name}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-slate-400">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">
                                Nota: {res.score} pts
                              </span>
                              {res.details.readiness_adaptation_correct && (
                                <span className="text-purple-300">IPD Adaptado</span>
                              )}
                            </div>
                          </div>

                          <div>
                            {res.passed ? (
                              <div className="flex items-center space-x-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>OK</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1 text-rose-400 text-xs font-bold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                                <XCircle className="w-4 h-4" />
                                <span>Ajustar</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Test Inspection Details */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-5">
                  {selectedResult ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-brand-neon font-bold">{selectedResult.test_id}</span>
                            <h3 className="text-base font-bold text-white">{selectedResult.test_name}</h3>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Nota de Avaliação Fisiológica: <strong className="text-brand-neon">{selectedResult.score}/100</strong>
                          </p>
                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          selectedResult.passed 
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
                            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        }`}>
                          {selectedResult.passed ? "APROVADO" : "REVISÃO NECESSÁRIA"}
                        </span>
                      </div>

                      {/* Score Breakdown Bars */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[11px] text-slate-400">Segurança (30%)</span>
                          <div className="text-sm font-bold text-emerald-400 mt-0.5">{selectedResult.safety_score} pts</div>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[11px] text-slate-400">Fisiologia (25%)</span>
                          <div className="text-sm font-bold text-cyan-400 mt-0.5">{selectedResult.physiology_score} pts</div>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[11px] text-slate-400">Individualização (20%)</span>
                          <div className="text-sm font-bold text-sky-400 mt-0.5">{selectedResult.individualization_score} pts</div>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[11px] text-slate-400">Adaptação (15%)</span>
                          <div className="text-sm font-bold text-purple-400 mt-0.5">{selectedResult.adaptation_score} pts</div>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[11px] text-slate-400">Satisfação (10%)</span>
                          <div className="text-sm font-bold text-amber-400 mt-0.5">{selectedResult.satisfaction_score} pts</div>
                        </div>
                      </div>

                      {/* Checks & Failure Reasons */}
                      {selectedResult.reasons.length > 0 && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 space-y-1">
                          <div className="font-bold flex items-center space-x-1.5 text-rose-400">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Observações de Validação:</span>
                          </div>
                          {selectedResult.reasons.map((r, i) => (
                            <div key={i}>• {r}</div>
                          ))}
                        </div>
                      )}

                      {/* Generated Microcycle Sample Output for this Test */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Decisão Gerada pelo Motor Aetheris:</span>
                          <div className="flex bg-slate-900 p-1 rounded-md text-[11px]">
                            <button
                              onClick={() => setJsonViewMode("visual")}
                              className={`px-2 py-0.5 rounded ${jsonViewMode === "visual" ? "bg-slate-800 text-white font-bold" : "text-slate-400"}`}
                            >
                              Visual
                            </button>
                            <button
                              onClick={() => setJsonViewMode("json")}
                              className={`px-2 py-0.5 rounded ${jsonViewMode === "json" ? "bg-slate-800 text-white font-bold" : "text-slate-400"}`}
                            >
                              JSON Output
                            </button>
                          </div>
                        </div>

                        {jsonViewMode === "visual" ? (
                          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2 max-h-[220px] overflow-y-auto">
                            <p className="text-slate-300 leading-relaxed">
                              ✅ <strong>Separação de Intensidades:</strong> Longão protegido com gap de 48h prévio.
                            </p>
                            <p className="text-slate-300 leading-relaxed">
                              ✅ <strong>Substituição Adaptativa:</strong> Se o IPD for &lt; 50, tiros são automaticamente convertidos em Z2 leve de 40 minutos.
                            </p>
                            <p className="text-slate-300 leading-relaxed">
                              ✅ <strong>Prescrição de Força:</strong> Exercícios estruturais integrados sem interferência nos dias de qualidade.
                            </p>
                          </div>
                        ) : (
                          <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-brand-neon max-h-[220px] overflow-y-auto">
                            {JSON.stringify(selectedResult, null, 2)}
                          </pre>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      Selecione um caso de teste ao lado para inspecionar os detalhes.
                    </div>
                  )}
                </div>

              </div>
            </>
          ) : (
            /* Custom Interactive API Generator Tab */
            <div className="space-y-6">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center space-x-2">
                      <Code className="w-5 h-5 text-brand-neon" />
                      <span>Gerador Automático de Microciclo (POST /api/v1/microcycle/generate)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Envie dados em formato JSON no payload e obtenha a decisão de treinamento adaptativo em tempo real.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateCustomMicrocycle}
                    disabled={isGeneratingCustom}
                    className="px-4 py-2 rounded-xl bg-brand-neon text-slate-950 font-bold text-xs hover:bg-brand-neon/90 transition-all flex items-center space-x-2 shadow-lg disabled:opacity-50"
                  >
                    <Play className={`w-4 h-4 ${isGeneratingCustom ? "animate-spin" : ""}`} />
                    <span>{isGeneratingCustom ? "Gerando..." : "Chamar API REST"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Request JSON editor */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">Payload de Entrada (Request JSON):</label>
                    <textarea
                      value={JSON.stringify(customRequest, null, 2)}
                      onChange={(e) => {
                        try {
                          setCustomRequest(JSON.parse(e.target.value));
                        } catch {}
                      }}
                      className="w-full h-80 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-brand-neon"
                    />
                  </div>

                  {/* Response JSON Output */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">Resposta da API (Response JSON):</label>
                    <pre className="w-full h-80 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-brand-neon overflow-y-auto">
                      {customResponse 
                        ? JSON.stringify(customResponse, null, 2) 
                        : "// Clique em 'Chamar API REST' para testar a resposta JSON..."}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
