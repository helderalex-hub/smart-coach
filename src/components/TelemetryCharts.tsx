import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TelemetryRecord } from "../types";
import { Activity, Flame, TrendingUp, Zap, Wind, Gauge, Layers, Eye } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

interface TelemetryChartsProps {
  records: TelemetryRecord[];
}

export type MetricKey = "heartRate" | "pace" | "speed" | "altitude" | "power" | "cadence";

interface MetricConfig {
  key: MetricKey;
  label: string;
  unit: string;
  color: string;
  icon: any;
  getValue: (r: TelemetryRecord) => number | null;
  formatValue: (val: number | null | undefined) => string;
  description: string;
}

export default function TelemetryCharts({ records }: TelemetryChartsProps) {
  const { t } = useLanguage();
  const [overlayMode, setOverlayMode] = useState<boolean>(true);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(["heartRate", "pace"]);
  const [singleMetric, setSingleMetric] = useState<MetricKey>("heartRate");

  if (!records || records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 text-center text-slate-400 text-xs font-mono">
        <Activity className="w-8 h-8 text-slate-600 mb-2" />
        <p>{t("noTelemetryAvailable", "Sem registros de telemetria disponíveis para esta atividade.")}</p>
      </div>
    );
  }

  // Calculate speed if missing by haversine distance
  const processedRecords = records.map((r, i) => {
    let speedKmh = r.speed;
    if ((speedKmh === null || speedKmh === undefined || speedKmh <= 0) && i > 0) {
      const prev = records[i - 1];
      if (prev.lat !== null && prev.lng !== null && r.lat !== null && r.lng !== null) {
        const R = 6371000;
        const dLat = ((r.lat - prev.lat) * Math.PI) / 180;
        const dLon = ((r.lng - prev.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((prev.lat * Math.PI) / 180) *
            Math.cos((r.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distM = R * c;
        const dtSec = (new Date(r.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
        if (dtSec > 0 && dtSec < 120) {
          const calcSpeed = (distM / dtSec) * 3.6;
          if (calcSpeed > 0.5 && calcSpeed < 80) {
            speedKmh = Math.round(calcSpeed * 10) / 10;
          }
        }
      }
    }

    // Pace in decimal min/km for plotting (e.g. 5.5 = 5:30/km)
    let paceDecimal: number | null = null;
    if (speedKmh && speedKmh > 0.8) {
      paceDecimal = Math.round((60 / speedKmh) * 100) / 100;
      if (paceDecimal > 20) paceDecimal = null; // Filter out standstills
    }

    return {
      ...r,
      speed: speedKmh ?? null,
      pace: paceDecimal,
    };
  });

  // Helper to format speed to pace string "M:SS /km"
  const formatPaceString = (paceDec: number | null | undefined): string => {
    if (!paceDec || paceDec <= 0 || paceDec > 20) return "--:--";
    const mins = Math.floor(paceDec);
    const secs = Math.round((paceDec - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")} /km`;
  };

  // Define metric configurations
  const metricConfigs: Record<MetricKey, MetricConfig> = {
    heartRate: {
      key: "heartRate",
      label: t("heartRate", "Freq. Cardíaca"),
      unit: " bpm",
      color: "#ef4444", // Red
      icon: Activity,
      getValue: (r) => r.heartRate ?? null,
      formatValue: (val) => (val ? `${Math.round(val)} bpm` : "---"),
      description: "Frequência cardíaca (FC) instantânea e zonas de esforço cardiovascular.",
    },
    pace: {
      key: "pace",
      label: t("pace", "Pace (Ritmo)"),
      unit: " /km",
      color: "#10b981", // Emerald Green
      icon: Wind,
      getValue: (r) => (r as any).pace ?? null,
      formatValue: (val) => formatPaceString(val),
      description: "Ritmo de corrida em min/km (quanto menor, mais rápido).",
    },
    speed: {
      key: "speed",
      label: t("speed", "Velocidade"),
      unit: " km/h",
      color: "#06b6d4", // Cyan
      icon: Gauge,
      getValue: (r) => r.speed ?? null,
      formatValue: (val) => (val ? `${val.toFixed(1)} km/h` : "---"),
      description: "Velocidade absoluta instantânea em km/h.",
    },
    altitude: {
      key: "altitude",
      label: t("elevation", "Elevação"),
      unit: " m",
      color: "#a855f7", // Purple
      icon: TrendingUp,
      getValue: (r) => r.altitude ?? null,
      formatValue: (val) => (val !== null && val !== undefined ? `${val.toFixed(0)} m` : "---"),
      description: "Perfil altimétrico de subidas e descidas do trajeto.",
    },
    power: {
      key: "power",
      label: t("power", "Potência"),
      unit: " W",
      color: "#eab308", // Yellow
      icon: Zap,
      getValue: (r) => r.power ?? null,
      formatValue: (val) => (val ? `${Math.round(val)} W` : "---"),
      description: "Potência mecânica instantânea em Watts.",
    },
    cadence: {
      key: "cadence",
      label: t("cadence", "Cadência"),
      unit: " rpm",
      color: "#f97316", // Orange
      icon: Flame,
      getValue: (r) => r.cadence ?? null,
      formatValue: (val) => (val ? `${Math.round(val)} rpm` : "---"),
      description: "Giro de pedaladas (ciclismo) ou passos por minuto (corrida).",
    },
  };

  // Find available metrics in dataset
  const availableMetricKeys: MetricKey[] = (
    ["heartRate", "pace", "speed", "altitude", "power", "cadence"] as MetricKey[]
  ).filter((key) => {
    return processedRecords.some((r) => {
      const v = metricConfigs[key].getValue(r);
      return v !== null && v !== undefined && !isNaN(v);
    });
  });

  // Calculate min and max for normalizing values when overlapping multiple metrics
  const metricRanges: Record<string, { min: number; max: number }> = {};
  availableMetricKeys.forEach((key) => {
    const vals = processedRecords
      .map((r) => metricConfigs[key].getValue(r))
      .filter((v): v is number => v !== null && !isNaN(v));
    if (vals.length > 0) {
      metricRanges[key] = {
        min: Math.min(...vals),
        max: Math.max(...vals),
      };
    } else {
      metricRanges[key] = { min: 0, max: 100 };
    }
  });

  // Prepare normalized chart data so all overlay curves fit on a 0-100% scale harmoniously
  const chartData = processedRecords.map((r) => {
    const firstTime = new Date(records[0]?.timestamp).getTime();
    const currTime = new Date(r.timestamp).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((currTime - firstTime) / 1000));

    const item: any = {
      timestamp: r.timestamp,
      elapsedSeconds,
      rawRecord: r,
    };

    availableMetricKeys.forEach((key) => {
      const rawVal = metricConfigs[key].getValue(r);
      item[`raw_${key}`] = rawVal;

      if (rawVal !== null && !isNaN(rawVal)) {
        const { min, max } = metricRanges[key];
        if (max > min) {
          if (key === "pace") {
            // Invert pace so faster pace (lower min/km) plots HIGHER on chart
            item[`norm_${key}`] = Math.round((1 - (rawVal - min) / (max - min)) * 100);
          } else {
            item[`norm_${key}`] = Math.round(((rawVal - min) / (max - min)) * 100);
          }
        } else {
          item[`norm_${key}`] = 50;
        }
      } else {
        item[`norm_${key}`] = null;
      }
    });

    return item;
  });

  // Helper to format X-Axis relative time
  const formatXAxis = (tickItem: string, index: number) => {
    if (!tickItem || index % 30 !== 0) return "";
    try {
      const firstTime = new Date(records[0]?.timestamp).getTime();
      const currTime = new Date(tickItem).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((currTime - firstTime) / 1000));

      const hrs = Math.floor(elapsedSeconds / 3600);
      const mins = Math.floor((elapsedSeconds % 3600) / 60);
      const secs = elapsedSeconds % 60;

      if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    } catch {
      return "";
    }
  };

  const toggleMetricInOverlay = (key: MetricKey) => {
    if (selectedMetrics.includes(key)) {
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter((m) => m !== key));
      }
    } else {
      setSelectedMetrics([...selectedMetrics, key]);
    }
  };

  // Custom Overlay Tooltip
  const CustomOverlayTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const mins = Math.floor(data.elapsedSeconds / 60);
      const secs = data.elapsedSeconds % 60;
      const rawRec = data.rawRecord as TelemetryRecord;

      const activeKeys = overlayMode ? selectedMetrics : [singleMetric];

      return (
        <div className="bg-black/95 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md min-w-[180px]">
          <div className="flex justify-between items-center pb-2 border-b border-white/10 text-[10px] font-mono text-slate-400">
            <span>⏱️ Tempo: {mins}:{secs.toString().padStart(2, "0")}</span>
            {rawRec.distance !== null && (
              <span className="text-cyan-400 font-bold">{(rawRec.distance / 1000).toFixed(2)} km</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 mt-2 text-xs font-mono">
            {activeKeys.map((key) => {
              const cfg = metricConfigs[key];
              const rawVal = data[`raw_${key}`];
              return (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}:
                  </span>
                  <span className="font-bold text-white" style={{ color: cfg.color }}>
                    {cfg.formatValue(rawVal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-4 shadow-sm">
      {/* Top Header: Title & View Mode Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-white/5 mb-3">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-purple-500/10 text-purple-400 mb-0.5">
            <Activity className="w-3.5 h-3.5" /> {t("timeChart", "Gráfico do Tempo")}
          </span>
          <h3 className="text-xs sm:text-sm font-bold text-slate-200 tracking-wide uppercase font-mono">
            {t("telemetryTimeSeries", "Série Temporal de Telemetria")}
          </h3>
        </div>

        {/* Toggle Mode: Overlay vs Single */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-[10px] font-mono">
          <button
            onClick={() => setOverlayMode(true)}
            className={`px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
              overlayMode
                ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-3 h-3" /> {t("overlayCurves", "Sobrepor Curvas")}
          </button>
          <button
            onClick={() => setOverlayMode(false)}
            className={`px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
              !overlayMode
                ? "bg-cyan-500 text-brand-dark shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Eye className="w-3 h-3" /> {t("singleTab", "Aba Única")}
          </button>
        </div>
      </div>

      {/* Metric Selectors depending on Overlay Mode */}
      {overlayMode ? (
        <div className="mb-3">
          <p className="text-[10px] text-slate-400 font-mono mb-1.5 flex items-center gap-1">
            <span>{t("selectMetricsToOverlay", "Marque as métricas que deseja sobrepor no mesmo gráfico:")}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableMetricKeys.map((key) => {
              const cfg = metricConfigs[key];
              const isSelected = selectedMetrics.includes(key);
              const MetricIcon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => toggleMetricInOverlay(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-white/10 text-white border-white/30 shadow-sm"
                      : "bg-black/20 text-slate-500 border-white/5 hover:text-slate-300"
                  }`}
                  style={{
                    borderColor: isSelected ? cfg.color : undefined,
                    color: isSelected ? cfg.color : undefined,
                  }}
                >
                  <MetricIcon className="w-3.5 h-3.5" />
                  {cfg.label}
                  <span className="text-[9px] opacity-70">
                    ({metricRanges[key]?.min !== undefined ? cfg.formatValue(metricRanges[key].min) : ""} - {metricRanges[key]?.max !== undefined ? cfg.formatValue(metricRanges[key].max) : ""})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 border-b border-white/5 pb-2 mb-3">
          {availableMetricKeys.map((key) => {
            const cfg = metricConfigs[key];
            const isActive = singleMetric === key;
            const MetricIcon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => setSingleMetric(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-sans transition-all cursor-pointer ${
                  isActive
                    ? "bg-white/10 text-slate-50 border-b-2 shadow-glow-cyan"
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                }`}
                style={{
                  borderBottomColor: isActive ? cfg.color : undefined,
                }}
              >
                <MetricIcon className="w-3.5 h-3.5" style={{ color: isActive ? cfg.color : undefined }} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Description text */}
      <div className="mb-2">
        <p className="text-[11px] text-slate-400 font-sans leading-tight">
          {overlayMode
            ? "Exibindo curvas de variação sincronizadas no tempo (escala adaptativa relativa)."
            : metricConfigs[singleMetric].description}
        </p>
      </div>

      {/* Main Chart Area */}
      <div className="w-full h-[280px] mt-1">
        {chartData.length > 0 ? (
          overlayMode ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.06} vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatXAxis}
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: "10px", fontFamily: "monospace" }}
                />
                <YAxis
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  unit="%"
                  style={{ fontSize: "9px", fontFamily: "monospace" }}
                />
                <Tooltip content={<CustomOverlayTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "10px", fontSize: "11px", fontFamily: "monospace" }}
                  formatter={(value) => {
                    const cfg = metricConfigs[value as MetricKey];
                    return cfg ? cfg.label : value;
                  }}
                />

                {selectedMetrics.map((key) => {
                  const cfg = metricConfigs[key];
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={`norm_${key}`}
                      name={key}
                      stroke={cfg.color}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: cfg.color, stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id={`gradient-${singleMetric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metricConfigs[singleMetric].color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={metricConfigs[singleMetric].color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.06} vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatXAxis}
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: "10px", fontFamily: "monospace" }}
                />
                <YAxis
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  style={{ fontSize: "10px", fontFamily: "monospace" }}
                />
                <Tooltip content={<CustomOverlayTooltip />} />
                <Area
                  type="monotone"
                  dataKey={`raw_${singleMetric}`}
                  stroke={metricConfigs[singleMetric].color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#gradient-${singleMetric})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
            {t("noValidTelemetryData", "Nenhum dado válido de telemetria encontrado para este treino.")}
          </div>
        )}
      </div>
    </div>
  );
}
