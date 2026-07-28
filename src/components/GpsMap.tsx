import { useEffect, useRef, useState } from "react";
import { TelemetryRecord } from "../types";
import { Activity, Zap, Wind, TrendingUp, Route, Info, Gauge } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

interface GpsMapProps {
  gpsPath: [number, number][];
  records?: TelemetryRecord[];
  sport?: string;
}

declare global {
  interface Window {
    L: any;
  }
}

export type MapMetricMode = "pace" | "speed" | "heartRate" | "power" | "altitude" | "solid";

// Haversine formula to compute distance in meters between two lat/lng coordinates
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Color interpolation along a multi-color palette
function interpolateColor(ratio: number, palette: string[]): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (palette.length === 1) return palette[0];
  const idx = clamped * (palette.length - 1);
  const i1 = Math.floor(idx);
  const i2 = Math.min(palette.length - 1, Math.ceil(idx));
  if (i1 === i2) return palette[i1];
  const factor = idx - i1;

  const hex1 = palette[i1].replace("#", "");
  const hex2 = palette[i2].replace("#", "");
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);

  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default function GpsMap({ gpsPath, records = [], sport = "running" }: GpsMapProps) {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  const isRunning = sport === "running" || sport === "run" || sport === "corrida";
  const [activeMode, setActiveMode] = useState<MapMetricMode>(isRunning ? "pace" : "speed");

  // Check data availability for metric buttons
  const hasGps = gpsPath && gpsPath.length > 0;

  // Filter valid GPS records
  const validGpsRecordsRaw = records.filter((r) => r.lat !== null && r.lng !== null);

  // If records lack speed, derive speed (km/h) between consecutive GPS points
  const validGpsRecords = validGpsRecordsRaw.map((r, i) => {
    let speedKmh = r.speed;
    if ((speedKmh === null || speedKmh === undefined || speedKmh <= 0) && i > 0) {
      const prev = validGpsRecordsRaw[i - 1];
      if (prev.lat !== null && prev.lng !== null && r.lat !== null && r.lng !== null) {
        const distM = haversineDistance(prev.lat, prev.lng, r.lat, r.lng);
        const t1 = new Date(prev.timestamp).getTime();
        const t2 = new Date(r.timestamp).getTime();
        const dtSec = (t2 - t1) / 1000;
        if (dtSec > 0 && dtSec < 120) {
          const calcSpeed = (distM / dtSec) * 3.6;
          if (calcSpeed > 0.5 && calcSpeed < 80) {
            speedKmh = Math.round(calcSpeed * 10) / 10;
          }
        }
      }
    }
    return {
      ...r,
      speed: speedKmh ?? null,
    };
  });

  const hasHr = validGpsRecords.some((r) => r.heartRate !== null && r.heartRate !== undefined && r.heartRate > 0);
  const hasSpeed = validGpsRecords.some((r) => r.speed !== null && r.speed !== undefined && r.speed > 0.5);
  const hasPower = validGpsRecords.some((r) => r.power !== null && r.power !== undefined && r.power > 0);
  const hasAlt = validGpsRecords.some((r) => r.altitude !== null && r.altitude !== undefined);

  // Helper: Convert speed (km/h) to Pace (min/km string)
  const formatSpeedToPace = (speedKmh: number | null | undefined): string => {
    if (!speedKmh || speedKmh < 0.5) return "--:--";
    const paceDecimal = 60 / speedKmh;
    const mins = Math.floor(paceDecimal);
    const secs = Math.round((paceDecimal - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper: Convert speed (km/h) to Pace (numeric min/km decimal)
  const speedToPaceDecimal = (speedKmh: number): number => {
    if (!speedKmh || speedKmh <= 0) return 99;
    return 60 / speedKmh;
  };

  // Dynamic range calculations for exact color scaling relative to this activity
  const speedValues = validGpsRecords
    .map((r) => r.speed)
    .filter((s): s is number => s !== null && s > 0.5);
  const minSpeed = speedValues.length > 0 ? Math.min(...speedValues) : 5;
  const maxSpeed = speedValues.length > 0 ? Math.max(...speedValues) : 15;
  const avgSpeed = speedValues.length > 0 ? speedValues.reduce((a, b) => a + b, 0) / speedValues.length : 10;

  const paceDecimals = speedValues.map((s) => speedToPaceDecimal(s)).filter((p) => p < 20);
  const minPaceDec = paceDecimals.length > 0 ? Math.min(...paceDecimals) : 4.0; // Fastest pace (lowest min/km)
  const maxPaceDec = paceDecimals.length > 0 ? Math.max(...paceDecimals) : 7.0; // Slowest pace (highest min/km)
  const avgPaceDec = paceDecimals.length > 0 ? paceDecimals.reduce((a, b) => a + b, 0) / paceDecimals.length : 5.5;

  const hrValues = validGpsRecords
    .map((r) => r.heartRate)
    .filter((h): h is number => h !== null && h > 0);
  const minHr = hrValues.length > 0 ? Math.min(...hrValues) : 120;
  const maxHr = hrValues.length > 0 ? Math.max(...hrValues) : 180;
  const avgHr = hrValues.length > 0 ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : 150;

  const powerValues = validGpsRecords
    .map((r) => r.power)
    .filter((p): p is number => p !== null && p > 0);
  const minPower = powerValues.length > 0 ? Math.min(...powerValues) : 100;
  const maxPower = powerValues.length > 0 ? Math.max(...powerValues) : 350;

  const altValues = validGpsRecords
    .map((r) => r.altitude)
    .filter((a): a is number => a !== null);
  const minAlt = altValues.length > 0 ? Math.min(...altValues) : 0;
  const maxAlt = altValues.length > 0 ? Math.max(...altValues) : 100;

  // Color Palette definitions
  const pacePalette = ["#06b6d4", "#10b981", "#eab308", "#f97316", "#ef4444"]; // Fast (Cyan) -> Slow (Red)
  const speedPalette = ["#ef4444", "#f97316", "#eab308", "#10b981", "#06b6d4"]; // Slow (Red) -> Fast (Cyan)
  const hrPalette = ["#10b981", "#84cc16", "#eab308", "#f97316", "#ef4444"]; // Low HR (Green) -> High HR (Red)
  const powerPalette = ["#38bdf8", "#10b981", "#eab308", "#f97316", "#a855f7"]; // Low (Blue) -> High (Purple)
  const altPalette = ["#6366f1", "#38bdf8", "#10b981", "#eab308"]; // Base (Indigo) -> Peak (Yellow)

  // Get segment color function
  const getSegmentColor = (r1: TelemetryRecord, r2: TelemetryRecord): string => {
    if (activeMode === "pace") {
      const spd = r1.speed ?? r2.speed;
      if (!spd || spd <= 0.5) return "#94a3b8";
      const p = speedToPaceDecimal(spd);
      if (maxPaceDec === minPaceDec) return "#06b6d4";
      // Ratio: 0 = fastest pace (minPaceDec), 1 = slowest pace (maxPaceDec)
      const ratio = (p - minPaceDec) / (maxPaceDec - minPaceDec);
      return interpolateColor(ratio, pacePalette);
    }

    if (activeMode === "speed") {
      const spd = r1.speed ?? r2.speed;
      if (!spd || spd <= 0.5) return "#94a3b8";
      if (maxSpeed === minSpeed) return "#10b981";
      // Ratio: 0 = slowest speed, 1 = fastest speed
      const ratio = (spd - minSpeed) / (maxSpeed - minSpeed);
      return interpolateColor(ratio, speedPalette);
    }

    if (activeMode === "heartRate") {
      const hr = r1.heartRate ?? r2.heartRate;
      if (!hr) return "#38bdf8";
      if (maxHr === minHr) return "#10b981";
      const ratio = (hr - minHr) / (maxHr - minHr);
      return interpolateColor(ratio, hrPalette);
    }

    if (activeMode === "power") {
      const pwr = r1.power ?? r2.power;
      if (!pwr) return "#38bdf8";
      if (maxPower === minPower) return "#10b981";
      const ratio = (pwr - minPower) / (maxPower - minPower);
      return interpolateColor(ratio, powerPalette);
    }

    if (activeMode === "altitude") {
      const alt = r1.altitude ?? r2.altitude;
      if (alt === null || maxAlt === minAlt) return "#38bdf8";
      const ratio = (alt - minAlt) / (maxAlt - minAlt);
      return interpolateColor(ratio, altPalette);
    }

    return "#22d3ee";
  };

  useEffect(() => {
    if (!mapContainerRef.current || !window.L || !hasGps) return;

    const L = window.L;

    // Initialize map if not existing
    if (!mapInstanceRef.current) {
      try {
        const startPoint =
          validGpsRecords.length > 0 && validGpsRecords[0].lat && validGpsRecords[0].lng
            ? [validGpsRecords[0].lat, validGpsRecords[0].lng]
            : gpsPath[0];

        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
          attributionControl: false,
        }).setView(startPoint, 13);

        mapInstanceRef.current = map;

        // Dark Theme Map Tiles
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 20,
        }).addTo(map);

        layerGroupRef.current = L.layerGroup().addTo(map);
      } catch (err) {
        console.error("Failed to initialize Leaflet Map:", err);
        return;
      }
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    // Clear previous polylines/markers
    if (layerGroup) {
      layerGroup.clearLayers();
    }

    try {
      if (activeMode === "solid" || validGpsRecords.length < 2) {
        // Draw standard solid neon track
        const polyline = L.polyline(gpsPath, {
          color: "#22d3ee",
          weight: 4.5,
          opacity: 0.9,
          lineJoin: "round",
        });
        layerGroup.addLayer(polyline);

        if (gpsPath.length > 0) {
          map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        }
      } else {
        // Draw multi-colored segment polylines based on active metric
        const bounds = L.latLngBounds([]);

        for (let i = 0; i < validGpsRecords.length - 1; i++) {
          const r1 = validGpsRecords[i];
          const r2 = validGpsRecords[i + 1];

          if (r1.lat !== null && r1.lng !== null && r2.lat !== null && r2.lng !== null) {
            const p1: [number, number] = [r1.lat, r1.lng];
            const p2: [number, number] = [r2.lat, r2.lng];
            bounds.extend(p1);
            bounds.extend(p2);

            const segmentColor = getSegmentColor(r1, r2);
            const distKmStr = r1.distance ? `${(r1.distance / 1000).toFixed(2)} km` : "---";
            const paceStr = r1.speed ? `${formatSpeedToPace(r1.speed)} /km` : "---";
            const speedStr = r1.speed ? `${r1.speed.toFixed(1)} km/h` : "---";
            const hrStr = r1.heartRate ? `${r1.heartRate} bpm` : "---";
            const pwrStr = r1.power ? `${r1.power} W` : "---";
            const altStr = r1.altitude !== null ? `${r1.altitude.toFixed(0)} m` : "---";

            const popupContent = `
              <div class="font-mono text-xs p-1 space-y-1">
                <div class="font-bold text-cyan-300 pb-1 border-b border-white/20">
                  📍 Ponto #${i + 1} (${distKmStr})
                </div>
                <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pt-1">
                  <span class="text-emerald-400 font-bold">⚡ Pace: ${paceStr}</span>
                  <span class="text-cyan-400 font-bold">💨 Vel: ${speedStr}</span>
                  <span class="text-red-400 font-bold">❤️ FC: ${hrStr}</span>
                  <span class="text-purple-400 font-bold">⛰️ Alt: ${altStr}</span>
                  ${r1.power ? `<span class="text-yellow-400 font-bold col-span-2">🔌 Potência: ${pwrStr}</span>` : ""}
                </div>
              </div>
            `;

            const segPoly = L.polyline([p1, p2], {
              color: segmentColor,
              weight: 5.5,
              opacity: 0.95,
              lineJoin: "round",
            });

            segPoly.bindPopup(popupContent);
            layerGroup.addLayer(segPoly);
          }
        }

        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      }

      // Add Start Marker (Neon Green Circle)
      const startPt = gpsPath[0];
      const startMarker = L.circleMarker(startPt, {
        radius: 7,
        fillColor: "#10b981",
        fillOpacity: 1,
        color: "#ffffff",
        weight: 2,
      }).bindPopup(`
        <div class="font-mono text-xs font-bold text-emerald-400">
          🟢 Ponto de Largada
        </div>
      `);
      layerGroup.addLayer(startMarker);

      // Add Finish Marker (Neon Red Circle)
      const endPt = gpsPath[gpsPath.length - 1];
      const endMarker = L.circleMarker(endPt, {
        radius: 7,
        fillColor: "#ef4444",
        fillOpacity: 1,
        color: "#ffffff",
        weight: 2,
      }).bindPopup(`
        <div class="font-mono text-xs font-bold text-red-400">
          🏁 Ponto de Chegada
        </div>
      `);
      layerGroup.addLayer(endMarker);
    } catch (err) {
      console.error("Error drawing GPS map layers:", err);
    }
  }, [gpsPath, validGpsRecords, activeMode, sport]);

  // Clean up map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (!hasGps) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-black/40 rounded-2xl border border-white/5 p-8 text-center min-h-[350px]">
        <Route className="w-10 h-10 mb-3 text-slate-600" />
        <h4 className="text-sm font-bold text-slate-300 font-mono uppercase tracking-wider">
          Sem Dados de Mapa GPS
        </h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs font-sans">
          Esta atividade não possui coordenadas de geolocalização salvas (ex: treino indoor em esteira ou rolo).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black/35 border border-white/5 backdrop-blur-md rounded-2xl p-4 shadow-sm relative overflow-hidden">
      {/* Header & Mode Selectors */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/5 mb-3">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono bg-cyan-500/10 text-cyan-400 mb-1">
            <Route className="w-3.5 h-3.5" /> Telemetria de Percurso GPS
          </span>
          <h3 className="text-xs sm:text-sm font-bold text-slate-200 tracking-wide uppercase font-mono flex items-center gap-2">
            Mapa Interativo com Variação Fisiológica
          </h3>
        </div>

        {/* Mode Selector Buttons */}
        <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-[10px] font-mono">
          <button
            onClick={() => setActiveMode("pace")}
            className={`px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
              activeMode === "pace"
                ? "bg-emerald-500 text-brand-dark shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Wind className="w-3 h-3 text-emerald-400" /> Pace (Ritmo)
          </button>

          <button
            onClick={() => setActiveMode("speed")}
            className={`px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
              activeMode === "speed"
                ? "bg-cyan-500 text-brand-dark shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Gauge className="w-3 h-3 text-cyan-400" /> Velocidade
          </button>

          {hasHr && (
            <button
              onClick={() => setActiveMode("heartRate")}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                activeMode === "heartRate"
                  ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3 h-3 text-red-400" /> FC (BPM)
            </button>
          )}

          {hasPower && (
            <button
              onClick={() => setActiveMode("power")}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                activeMode === "power"
                  ? "bg-yellow-500 text-brand-dark shadow-md shadow-yellow-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-3 h-3 text-yellow-400" /> Potência
            </button>
          )}

          {hasAlt && (
            <button
              onClick={() => setActiveMode("altitude")}
              className={`px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                activeMode === "altitude"
                  ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3 h-3 text-purple-400" /> Altitude
            </button>
          )}

          <button
            onClick={() => setActiveMode("solid")}
            className={`px-2.5 py-1 rounded-lg font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
              activeMode === "solid"
                ? "bg-slate-200 text-brand-dark font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Route className="w-3 h-3" /> Ciano
          </button>
        </div>
      </div>

      {/* Dynamic Color Scale Legend Bar with Exact Activity Metrics */}
      <div className="mb-3 bg-white/5 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-[10px] font-mono text-slate-300">
        {activeMode === "solid" && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-glow-cyan"></span>
            <span>Rota Rastreada em Ciano Neon (Caminho contínuo)</span>
          </div>
        )}

        {activeMode === "pace" && (
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Wind className="w-3 h-3 text-emerald-400" /> Variação Dinâmica de Pace (Ritmo):
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-cyan-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]"></span> ⚡ Rápido: {formatSpeedToPace(60 / minPaceDec)} /km
              </span>
              <span className="flex items-center gap-1 text-yellow-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span> 🟡 Médio: {formatSpeedToPace(60 / avgPaceDec)} /km
              </span>
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span> 🔴 Lento: {formatSpeedToPace(60 / maxPaceDec)} /km
              </span>
            </div>
          </div>
        )}

        {activeMode === "speed" && (
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" /> Variação Dinâmica de Velocidade:
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span> 🔴 Mín: {minSpeed.toFixed(1)} km/h
              </span>
              <span className="flex items-center gap-1 text-yellow-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span> 🟡 Média: {avgSpeed.toFixed(1)} km/h
              </span>
              <span className="flex items-center gap-1 text-cyan-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]"></span> ⚡ Máx: {maxSpeed.toFixed(1)} km/h
              </span>
            </div>
          </div>
        )}

        {activeMode === "heartRate" && (
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Activity className="w-3 h-3 text-red-400" /> Variação de Frequência Cardíaca:
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span> Mín: {minHr} bpm
              </span>
              <span className="flex items-center gap-1 text-yellow-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span> Média: {avgHr} bpm
              </span>
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span> Pico: {maxHr} bpm
              </span>
            </div>
          </div>
        )}

        {activeMode === "power" && (
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> Variação de Potência:
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]"></span> Mín: {minPower} W
              </span>
              <span className="flex items-center gap-1 font-bold text-yellow-400">
                <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span> Média: {Math.round((minPower + maxPower) / 2)} W
              </span>
              <span className="flex items-center gap-1 text-purple-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]"></span> Pico: {maxPower} W
              </span>
            </div>
          </div>
        )}

        {activeMode === "altitude" && (
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-purple-400" /> Perfil de Elevação:
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-indigo-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]"></span> Mín: {minAlt.toFixed(0)}m
              </span>
              <span className="flex items-center gap-1 text-sky-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]"></span> Média: {((minAlt + maxAlt) / 2).toFixed(0)}m
              </span>
              <span className="flex items-center gap-1 text-yellow-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span> Pico: {maxAlt.toFixed(0)}m
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden border border-white/10 bg-brand-dark group">
        <div ref={mapContainerRef} className="w-full h-full" id="map-leaflet-telemetry" />
        <div className="absolute bottom-3 left-3 z-[1000] bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
          <Info className="w-3 h-3 text-cyan-400" /> Clique em qualquer segmento para ver a telemetria do ponto
        </div>
      </div>
    </div>
  );
}
