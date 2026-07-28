import express from "express";
import path from "path";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import FitParserModule from "fit-file-parser";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Configure Multer for in-memory file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Database Storage setup for persistent FIT files
const DB_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DB_DIR, "fit_activities_db.json");

if (!fs.existsSync(DB_DIR)) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create data directory for database:", err);
  }
}

function getDbActivities(): any[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("Error reading database fit_activities_db.json:", err);
    return [];
  }
}

function saveDbActivities(activities: any[]) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(activities, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to database fit_activities_db.json:", err);
  }
}

function normalizeSport(sportRaw: any): string {
  if (sportRaw === undefined || sportRaw === null) return "running";
  if (typeof sportRaw === "string") {
    const trimmed = sportRaw.trim();
    return trimmed.length > 0 ? trimmed : "running";
  }
  if (typeof sportRaw === "number") {
    const fitSports: Record<number, string> = {
      1: "running",
      2: "cycling",
      3: "transition",
      4: "fitness_equipment",
      5: "swimming",
      6: "basketball",
      7: "soccer",
      8: "tennis",
      11: "walking",
      17: "hiking",
      28: "multisport",
      37: "paddling",
    };
    return fitSports[sportRaw] || "running";
  }
  if (typeof sportRaw === "object") {
    if (typeof sportRaw.name === "string" && sportRaw.name) return sportRaw.name;
    if (typeof sportRaw.sport === "string" && sportRaw.sport) return sportRaw.sport;
  }
  return String(sportRaw) || "running";
}

function addOrUpdateDbActivity(activity: any) {
  const current = getDbActivities();
  const existingIdx = current.findIndex((a) => a.id === activity.id);
  if (existingIdx >= 0) {
    current[existingIdx] = activity;
  } else {
    current.unshift(activity); // newest first
  }
  saveDbActivities(current);
}

function deleteDbActivity(id: string) {
  const current = getDbActivities();
  const updated = current.filter((a) => a.id !== id);
  saveDbActivities(updated);
}

// Lazy-initialized Gemini API client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
    throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in Settings > Secrets.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Convert FIT semicircles to standard degrees
function convertSemicircles(semi: number | undefined | null): number | null {
  if (semi === undefined || semi === null) return null;
  // Standard semicircle to degrees conversion formula: semi * (180 / 2^31)
  if (Math.abs(semi) > 180) {
    return semi * (180 / 2147483648);
  }
  return semi;
}

// Downsample array to a limit for optimal chart rendering performance
function downsample<T>(array: T[], limit: number): T[] {
  if (array.length <= limit) return array;
  const step = Math.floor(array.length / limit);
  const result: T[] = [];
  for (let i = 0; i < array.length; i += step) {
    if (result.length < limit) {
      result.push(array[i]);
    }
  }
  // Guarantee the last element is included
  if (array.length > 0 && result[result.length - 1] !== array[array.length - 1] && result.length < limit) {
    result.push(array[array.length - 1]);
  }
  return result;
}

// FitParser wrapper in a Promise
function parseFitFile(buffer: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    // Resolve dynamic module structure if needed
    const FitParser = (FitParserModule as any).default || FitParserModule;
    const fitParser = new FitParser({
      force: true,
      speedUnit: "km/h",
      lengthUnit: "m",
      temperatureUnit: "celcius",
      elapsedRecordField: true,
    });

    fitParser.parse(buffer, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

// Core API endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Database API endpoints for FIT activities
app.get("/api/activities", (req, res) => {
  try {
    const activities = getDbActivities();
    res.json({ success: true, count: activities.length, activities });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch activities from database." });
  }
});

app.get("/api/activities/:id", (req, res) => {
  try {
    const activities = getDbActivities();
    const activity = activities.find((a) => a.id === req.params.id);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found in database." });
    }
    res.json({ success: true, activity });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch activity from database." });
  }
});

app.post("/api/activities", (req, res) => {
  try {
    const activity = req.body;
    if (!activity || !activity.id) {
      return res.status(400).json({ error: "Invalid activity data provided." });
    }
    if (!activity.uploadedAt) {
      activity.uploadedAt = new Date().toISOString();
    }
    addOrUpdateDbActivity(activity);
    res.json({ success: true, message: "Activity saved to database successfully.", activity });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to save activity to database." });
  }
});

app.delete("/api/activities/:id", (req, res) => {
  try {
    deleteDbActivity(req.params.id);
    res.json({ success: true, message: `Activity ${req.params.id} deleted from database.` });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to delete activity from database." });
  }
});

app.delete("/api/activities", (req, res) => {
  try {
    saveDbActivities([]);
    res.json({ success: true, message: "Activities database reset successfully." });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to reset activities database." });
  }
});

// API endpoint to parse and analyze FIT file
app.post("/api/analyze", upload.single("file"), async (req, res): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    // Parse athlete profile if supplied
    let athleteProfile: any = null;
    if (req.body.athleteProfile) {
      try {
        athleteProfile = JSON.parse(req.body.athleteProfile);
      } catch (e) {
        console.error("Failed to parse athleteProfile in analyze:", e);
      }
    }

    // 1. Parse the FIT file
    const data = await parseFitFile(req.file.buffer);

    // 2. Extract metrics and statistics
    const session = data.sessions?.[0] || {};
    const activity = data.activity || {};
    const rawRecords = data.records || [];

    // Sport type extraction
    let sport = normalizeSport(session.sport || activity.sport || "running");
    if (typeof sport === "string") {
      sport = sport.toLowerCase();
    } else {
      sport = "running";
    }

    const startTime = session.start_time || activity.timestamp || rawRecords[0]?.timestamp || new Date();

    // Map raw records to clean data objects and do unit conversions
    const processedRecords = rawRecords.map((r: any, idx: number) => {
      const lat = convertSemicircles(r.position_lat);
      const lng = convertSemicircles(r.position_long);
      
      // Calculate speed in km/h. If raw speed is m/s, convert it (m/s * 3.6 = km/h)
      let speedKmh = r.speed;
      if (speedKmh !== undefined && speedKmh !== null) {
        speedKmh = Math.max(0, speedKmh);
      }

      return {
        id: idx,
        timestamp: r.timestamp,
        lat,
        lng,
        distance: r.distance !== undefined ? r.distance : null,
        altitude: r.altitude !== undefined ? r.altitude : null,
        speed: speedKmh !== undefined ? speedKmh : null,
        heartRate: r.heart_rate !== undefined ? r.heart_rate : null,
        cadence: r.cadence !== undefined ? r.cadence : null,
        power: r.power !== undefined ? r.power : null,
        temperature: r.temperature !== undefined ? r.temperature : null,
      };
    });

    // Extract path coordinates for Leaflet map (only if we have lat/lng data)
    const gpsPath = processedRecords
      .filter((r: any) => r.lat !== null && r.lng !== null)
      .map((r: any) => [r.lat, r.lng]);

    // Calculate summaries from records if session details are sparse
    const hrRecords = processedRecords.filter((r: any) => r.heartRate !== null);
    const avgHeartRate = session.avg_heart_rate || (hrRecords.length > 0 
      ? Math.round(hrRecords.reduce((sum: number, r: any) => sum + r.heartRate, 0) / hrRecords.length)
      : null);
    const maxHeartRate = session.max_heart_rate || (hrRecords.length > 0
      ? Math.max(...hrRecords.map((r: any) => r.heartRate))
      : null);

    const distanceMeters = session.total_distance || (processedRecords.length > 0 
      ? processedRecords[processedRecords.length - 1].distance || 0 
      : 0);
    const distanceKm = Number((distanceMeters / 1000).toFixed(2));

    const totalDurationSeconds = session.total_timer_time || session.total_elapsed_time || (processedRecords.length > 0
      ? Math.round((new Date(processedRecords[processedRecords.length - 1].timestamp).getTime() - new Date(processedRecords[0].timestamp).getTime()) / 1000)
      : 0);

    const avgSpeed = session.avg_speed || (totalDurationSeconds > 0 ? (distanceMeters / totalDurationSeconds) * 3.6 : 0);
    const maxSpeed = session.max_speed || (processedRecords.length > 0 ? Math.max(...processedRecords.map((r: any) => r.speed || 0)) : 0);

    const calories = session.total_calories || null;
    const ascent = session.total_ascent || null;
    const descent = session.total_descent || null;

    const powerRecords = processedRecords.filter((r: any) => r.power !== null);
    const avgPower = session.avg_power || (powerRecords.length > 0
      ? Math.round(powerRecords.reduce((sum: number, r: any) => sum + r.power, 0) / powerRecords.length)
      : null);
    const maxPower = session.max_power || (powerRecords.length > 0
      ? Math.max(...powerRecords.map((r: any) => r.power))
      : null);

    const cadenceRecords = processedRecords.filter((r: any) => r.cadence !== null);
    const avgCadence = session.avg_cadence || (cadenceRecords.length > 0
      ? Math.round(cadenceRecords.reduce((sum: number, r: any) => sum + r.cadence, 0) / cadenceRecords.length)
      : null);

    // Downsample records to 300 points for efficient charting
    const chartRecords = downsample(processedRecords, 300);

    // 3. Perform AI Workout Analysis with Gemini
    const safeSport = (typeof sport === "string" && sport.length > 0) ? sport : "running";
    const capitalSport = safeSport.charAt(0).toUpperCase() + safeSport.slice(1);
    let aiAnalysis = {
      title: `${capitalSport} Workout`,
      summary: `Completed a ${distanceKm} km ${safeSport} session in ${Math.floor(totalDurationSeconds / 60)} minutes.`,
      coachingInsights: "• Add heart rate or pacing data for custom athletic insights.\n• Keep up the consistent training!\n• Ensure your device is calibrated for correct elevation.",
      suggestedRecovery: "12-24 hours based on standard training loads.",
      trainingEffect: "Aerobic Maintenance",
    };

    let hasAi = false;
    try {
      const aiClient = getGeminiClient();

      const statsSummary = {
        sport,
        startTime,
        distanceKm,
        durationMinutes: Math.round(totalDurationSeconds / 60),
        avgSpeedKmh: Number(avgSpeed.toFixed(1)),
        maxSpeedKmh: Number(maxSpeed.toFixed(1)),
        avgHeartRate,
        maxHeartRate,
        calories,
        ascentMeters: ascent,
        descentMeters: descent,
        avgPower,
        maxPower,
        avgCadence,
      };

      let athletePrompt = "";
      if (athleteProfile) {
        athletePrompt = `
ATHLETE PROFILE:
- Age: ${athleteProfile.age || "Not specified"} years old
- Weight: ${athleteProfile.weight || "Not specified"} kg
- Height: ${athleteProfile.height || "Not specified"} cm
- Resting HR: ${athleteProfile.restingHeartRate || "Not specified"} bpm
- Max HR: ${athleteProfile.maxHeartRate || "Not specified"} bpm
- Experience Level: ${athleteProfile.fitnessLevel || "Not specified"}
- Training Goal: ${athleteProfile.trainingGoal || "Not specified"}
`;
      }

      const response = await aiClient.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Analyze this workout data for this specific athlete and generate a structured athletic response:
${athletePrompt}

WORKOUT STATS:
${JSON.stringify(statsSummary)}`,
        config: {
          systemInstruction: `You are an elite endurance sports coach and athletic physiologist.
Analyze the provided fitness metrics (distance, heart rate, elevation, speed, power, cadence, and duration) of a workout activity in the context of the athlete's age, weight, height, resting HR, max HR, experience level, and training goal.
Generate highly professional, direct coaching feedback in a JSON format.
Your feedback must be tailored specifically to the sport type (e.g. running pacing/cadence, cycling power zones, hiking climbing rates, swimming stroke rate if applicable).
Compare their actual heart rate/zones during this activity with their fitness level and goals. Mention their stats in the context of their profile (e.g., if their goal is endurance but they spent too much time in Zone 4/5, advise on pacing down).
Be encouraging, realistic, and highly educational. Break down your coachingInsights into standard bullet points (using bullet characters like '•') focusing on heart rate control, performance breakthroughs, and pacing strategy.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A highly creative, descriptive title for the workout (e.g., 'Breezy Seaside Aerobic Tempo', 'Mist-Cloaked Mountain Hill Climbs', 'Zone 2 Base Endurance Spin'). Do not use generic names.",
              },
              summary: {
                type: Type.STRING,
                description: "A friendly, expert paragraph (2-3 sentences) summarizing the workout's key physical outcomes in relation to their profile.",
              },
              coachingInsights: {
                type: Type.STRING,
                description: "3-4 detailed athletic insights as a bulleted list (lines starting with '•'). Address specific parameters like heart rate, speed/pace, power, or cadence relative to elite coaching guidelines and the athlete's personal profile and goals.",
              },
              suggestedRecovery: {
                type: Type.STRING,
                description: "Recommended recovery time (e.g. '24 hours', '36 hours') with a brief physiological explanation adapted to their age/fitness level.",
              },
              trainingEffect: {
                type: Type.STRING,
                description: "The primary physical training benefit (e.g. 'Aerobic Base Building', 'VO2 Max Development', 'Anaerobic Threshold Spike', 'Active Muscle Recovery').",
              },
            },
            required: ["title", "summary", "coachingInsights", "suggestedRecovery", "trainingEffect"],
          },
        },
      });

      const responseText = response.text;
      if (responseText) {
        aiAnalysis = JSON.parse(responseText.trim());
        hasAi = true;
      }
    } catch (geminiError: any) {
      console.warn("Gemini Analysis falling back to local coach rules (API key may be missing or invalid).");
    }

    // 4. Save parsed activity directly to database
    const activityId = `fit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const originalFilename = req.file.originalname || "activity.fit";
    const activityRecord = {
      id: activityId,
      filename: originalFilename,
      sport,
      startTime,
      summary: {
        distanceKm,
        durationSeconds: totalDurationSeconds,
        avgSpeedKmh: Number(avgSpeed.toFixed(1)),
        maxSpeedKmh: Number(maxSpeed.toFixed(1)),
        avgHeartRate,
        maxHeartRate,
        calories,
        ascentMeters: ascent,
        descentMeters: descent,
        avgPower,
        maxPower,
        avgCadence,
      },
      gpsPath,
      records: chartRecords,
      aiAnalysis,
      aiEnabled: hasAi,
      uploadedAt: new Date().toISOString(),
    };

    // Store in backend database
    addOrUpdateDbActivity(activityRecord);

    // 5. Return processed metrics + AI insights + saved database object
    res.json({
      success: true,
      activity: activityRecord,
      sport,
      startTime,
      summary: activityRecord.summary,
      gpsPath,
      records: chartRecords,
      aiAnalysis,
      aiEnabled: hasAi,
    });
  } catch (error: any) {
    console.error("Analysis route error:", error);
    res.status(500).json({ error: error.message || "Failed to process FIT file." });
  }
});

// New API endpoint to re-analyze telemetry with a modified athlete profile
app.post("/api/reanalyze", async (req, res): Promise<any> => {
  try {
    const { sport: rawSport, summary, athleteProfile } = req.body;
    const sport = normalizeSport(rawSport);
    if (!summary) {
      return res.status(400).json({ error: "Missing summary stats for re-analysis." });
    }

    const aiClient = getGeminiClient();

    let athletePrompt = "";
    if (athleteProfile) {
      athletePrompt = `
ATHLETE PROFILE:
- Age: ${athleteProfile.age || "Not specified"} years old
- Weight: ${athleteProfile.weight || "Not specified"} kg
- Height: ${athleteProfile.height || "Not specified"} cm
- Resting HR: ${athleteProfile.restingHeartRate || "Not specified"} bpm
- Max HR: ${athleteProfile.maxHeartRate || "Not specified"} bpm
- Experience Level: ${athleteProfile.fitnessLevel || "Not specified"}
- Training Goal: ${athleteProfile.trainingGoal || "Not specified"}
`;
    }

    const statsSummary = {
      sport,
      ...summary
    };

    const response = await aiClient.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Analyze this workout data for this specific athlete and generate a structured athletic response:
${athletePrompt}

WORKOUT STATS:
${JSON.stringify(statsSummary)}`,
      config: {
        systemInstruction: `You are an elite endurance sports coach and athletic physiologist.
Analyze the provided fitness metrics (distance, heart rate, elevation, speed, power, cadence, and duration) of a workout activity in the context of the athlete's age, weight, height, resting HR, max HR, experience level, and training goal.
Generate highly professional, direct coaching feedback in a JSON format.
Your feedback must be tailored specifically to the sport type (e.g. running pacing/cadence, cycling power zones, hiking climbing rates, swimming stroke rate if applicable).
Compare their actual heart rate/zones during this activity with their fitness level and goals. Mention their stats in the context of their profile (e.g., if their goal is endurance but they spent too much time in Zone 4/5, advise on pacing down).
Be encouraging, realistic, and highly educational. Break down your coachingInsights into standard bullet points (using bullet characters like '•') focusing on heart rate control, performance breakthroughs, and pacing strategy.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A highly creative, descriptive title for the workout (e.g., 'Breezy Seaside Aerobic Tempo', 'Mist-Cloaked Mountain Hill Climbs', 'Zone 2 Base Endurance Spin'). Do not use generic names.",
            },
            summary: {
              type: Type.STRING,
              description: "A friendly, expert paragraph (2-3 sentences) summarizing the workout's key physical outcomes in relation to their profile.",
            },
            coachingInsights: {
              type: Type.STRING,
              description: "3-4 detailed athletic insights as a bulleted list (lines starting with '•'). Address specific parameters like heart rate, speed/pace, power, or cadence relative to elite coaching guidelines and the athlete's personal profile and goals.",
            },
            suggestedRecovery: {
              type: Type.STRING,
              description: "Recommended recovery time (e.g. '24 hours', '36 hours') with a brief physiological explanation adapted to their age/fitness level.",
            },
            trainingEffect: {
              type: Type.STRING,
              description: "The primary physical training benefit (e.g. 'Aerobic Base Building', 'VO2 Max Development', 'Anaerobic Threshold Spike', 'Active Muscle Recovery').",
            },
          },
          required: ["title", "summary", "coachingInsights", "suggestedRecovery", "trainingEffect"],
        },
      },
    });

    const responseText = response.text;
    if (responseText) {
      const aiAnalysis = JSON.parse(responseText.trim());
      return res.json({ success: true, aiAnalysis });
    } else {
      throw new Error("Empty response from AI engine");
    }
  } catch (error: any) {
    console.warn("Re-analysis route falling back to local coach rules.");
    try {
      const { sport: rawSport, athleteProfile } = req.body;
      const sportStr = normalizeSport(rawSport || "Corrida");
      const safeSportStr = (typeof sportStr === "string" && sportStr.length > 0) ? sportStr : "Corrida";
      const capitalSportStr = safeSportStr.charAt(0).toUpperCase() + safeSportStr.slice(1);
      const goalStr = athleteProfile?.trainingGoal === "5k" ? "bater sua meta nos 5k" :
                      athleteProfile?.trainingGoal === "10k" ? "evoluir nos 10k" :
                      athleteProfile?.trainingGoal === "half_marathon" ? "completar a Meia Maratona" :
                      athleteProfile?.trainingGoal === "marathon" ? "completar a Maratona" :
                      athleteProfile?.trainingGoal === "weight_loss" ? "perda de peso saudável" : "desenvolvimento aeróbico";
      
      const aiAnalysis = {
        title: `${capitalSportStr} de Base (Modo de Contingência)`,
        summary: `Sua sessão de ${safeSportStr} foi analisada com o nosso motor local. Considerando sua idade de ${athleteProfile?.age || "46"} anos e objetivo de ${goalStr}, este estímulo foi ideal para adaptações cardiovasculares fundamentais.`,
        coachingInsights: "• Mantenha o foco em respirações controladas pelo nariz nas rodagens leves.\n• Lembre-se de alongar a cadeia posterior e panturrilhas após as sessões.\n• Hidrate-se com eletrólitos se a sessão passar de 60 minutos.",
        suggestedRecovery: "18-24 horas de repouso relativo com foco em regeneração de tecidos e sono profundo.",
        trainingEffect: "Manutenção e Economia Aeróbica",
      };
      return res.json({ success: true, aiAnalysis, isFallback: true });
    } catch (fallbackError: any) {
      console.warn("Re-analysis local fallback failed:", fallbackError?.message || fallbackError);
      res.status(500).json({ error: fallbackError?.message || "Failed to re-analyze activity." });
    }
  }
});

// Local fallback generator for training plans when Gemini API key is missing or invalid
function generateLocalTrainingPlan(athleteProfile: any, dailyMetrics: any, trainingHistory: any, readiness: any) {
  const name = athleteProfile?.name || "Atleta";
  const goalType = athleteProfile?.trainingGoal || athleteProfile?.objective || "general";
  const fitnessLevel = athleteProfile?.fitnessLevel || "intermediate";
  const daysCount = athleteProfile?.weeklyTrainingDays || 4;
  const restDay = athleteProfile?.restDay || "Segunda-feira";
  const longRunDay = athleteProfile?.longRunDay || "Domingo";

  // Define pace based on fitness level or estimated pace
  const pace = athleteProfile?.estimatedPaceCurrent || (
    fitnessLevel === "beginner" ? "6:30" :
    fitnessLevel === "intermediate" ? "5:30" :
    fitnessLevel === "advanced" ? "4:30" : "3:50"
  );

  const weekdays = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo"
  ];

  const weeks: any[] = [];

  for (let w = 1; w <= 4; w++) {
    const workouts: any[] = [];
    let phase = "Construção de Base";
    let overviewTitle = "";
    let overviewObjective = "";
    let overviewLoad = "";
    let overviewKey = "";
    let overviewAttention = "";

    // Determine weekly progression factors
    let durationScale = 1.0;
    if (w === 1) {
      phase = "Adaptação & Base I";
      durationScale = 1.0;
      overviewTitle = "Adaptação & Base I";
      overviewLoad = "Moderada Leve";
      if (goalType === "5k" || goalType === "10k" || goalType === "weight_loss") {
        overviewObjective = "Estabelecer a rotina de treinos e preparar músculos e tendões para as cargas futuras.";
        overviewKey = "Treino de ritmo de quarta-feira (introdução gradual)";
        overviewAttention = "Foque na postura correta de corrida e mantenha as rodagens fáceis bem leves.";
      } else {
        overviewObjective = "Construir a base aeróbica inicial e acostumar o corpo com a consistência de corrida.";
        overviewKey = "Longão de Domingo (ritmo confortável)";
        overviewAttention = "Evite correr com pressa. Guarde energia para completar a distância sugerida.";
      }
    } else if (w === 2) {
      phase = "Base II & Carga";
      durationScale = 1.15;
      overviewTitle = "Base II & Progressão";
      overviewLoad = "Moderada";
      if (goalType === "5k" || goalType === "10k" || goalType === "weight_loss") {
        overviewObjective = "Progredir o volume das rodagens e elevar suavemente o estresse cardiovascular.";
        overviewKey = "Intervalados de VO2 Máx de quarta-feira";
        overviewAttention = "Tente manter os tiros em um ritmo firme, sem se esgotar completamente na primeira série.";
      } else {
        overviewObjective = "Expandir a capacidade volumétrica e consolidar a resistência musculoesquelética.";
        overviewKey = "Longão progressivo de Domingo";
        overviewAttention = "Se o clima estiver quente, capriche na hidratação antes, durante e após o treino longo.";
      }
    } else if (w === 3) {
      phase = "Pico & Intensidade";
      durationScale = 1.30;
      overviewTitle = "Pico de Volume & Carga";
      overviewLoad = "Moderada Alta";
      if (goalType === "5k" || goalType === "10k" || goalType === "weight_loss") {
        overviewObjective = "Estímulo fisiológico máximo de velocidade e tolerância ao lactato para ganho de performance.";
        overviewKey = "Tiros rápidos com recuperação reduzida na quarta-feira";
        overviewAttention = "Se sinta forte! A postura e a frequência de passadas são essenciais quando bate a fadiga.";
      } else {
        overviewObjective = "Maior volume do ciclo para testar o ritmo e a resistência mental do atleta.";
        overviewKey = "Longão de Domingo (maior distância)";
        overviewAttention = "Não tente acelerar o longão. O segredo é passar tempo ativo na Zona 2.";
      }
    } else {
      phase = "Recuperação & Descarga";
      durationScale = 0.70;
      overviewTitle = "Recuperação Ativa & Descarga";
      overviewLoad = "Leve";
      if (goalType === "5k" || goalType === "10k" || goalType === "weight_loss") {
        overviewObjective = "Reduzir o volume agudo de treino para permitir a supercompensação biológica e muscular.";
        overviewKey = "Treino regenerativo super leve de quarta-feira";
        overviewAttention = "Esta semana é para descansar e assimilar os ganhos. Nada de treinar forte.";
      } else {
        overviewObjective = "Consolidar as adaptações cardiovasculares acumuladas e restaurar o tônus muscular.";
        overviewKey = "Longão de volume reduzido no Domingo";
        overviewAttention = "Aproveite para dormir um pouco mais e investir tempo em mobilidade e alongamentos.";
      }
    }

    // Determine training days for this week
    const remainingDays = weekdays.filter(d => d !== restDay && d !== longRunDay);
    let selectedTrainingDays: string[] = [];
    if (daysCount === 1) {
      selectedTrainingDays = [];
    } else if (daysCount === 2) {
      selectedTrainingDays = [remainingDays[2]];
    } else if (daysCount === 3) {
      selectedTrainingDays = [remainingDays[1], remainingDays[3]];
    } else if (daysCount === 4) {
      selectedTrainingDays = [remainingDays[0], remainingDays[2], remainingDays[3]];
    } else if (daysCount === 5) {
      selectedTrainingDays = [remainingDays[0], remainingDays[1], remainingDays[2], remainingDays[3]];
    } else {
      selectedTrainingDays = remainingDays;
    }

    const getWorkoutForDay = (day: string, isLongRun: boolean, isQuality: boolean) => {
      if (isLongRun) {
        let duration = goalType === "5k" ? 50 :
                       goalType === "10k" ? 70 :
                       goalType === "half_marathon" ? 95 :
                       goalType === "marathon" ? 140 : 60;
        
        duration = Math.round(duration * durationScale);

        return {
          name: w === 4 ? "Longão de Descarga" : "Longão Progressivo Z2",
          intent: "long_run",
          durationMinutes: duration,
          description: "Mantenha um ritmo confortável, em Zona 2. Você deve conseguir conversar em frases completas durante a maior parte do treino. Nos quilômetros finais, aumente o ritmo apenas se estiver se sentindo bem.",
          objective: "Desenvolver resistência aeróbica e adaptação musculoesquelética de longa duração.",
          observations: ["mantenha ritmo confortável", "conversa em frases completas", "foco em Zona 2"],
          ifTired: "Reduza o volume em 15-20 minutos e termine caminhando se necessário.",
          steps: [
            {
              name: "Aquecimento e Educativos de Corrida",
              durationSeconds: 900,
              intensity: "Z1 Leve / RPE 2-3",
              description: "Trote leve e progressivo seguido de exercícios educativos (Skip Alto e Soldadinho) para coordenação motora.",
              stepType: "warmup"
            },
            {
              name: "Corrida Contínua de Endurance",
              durationSeconds: (duration - 20) * 60,
              intensity: "Z2 Confortável",
              description: `Ritmo constante visando adaptação de tendões e capilarização muscular. Alvo: ~${pace}/km.`,
              stepType: "main_set"
            },
            {
              name: "Desaquecimento",
              durationSeconds: 300,
              intensity: "Z1 regenerativo",
              description: "Caminhada lenta para baixar os batimentos cardíacos gradativamente.",
              stepType: "cooldown"
            }
          ]
        };
      }

      if (isQuality) {
        if (goalType === "5k" || goalType === "10k" || goalType === "weight_loss") {
          let duration = Math.round(45 * (w === 4 ? 0.75 : durationScale));
          let reps = w === 1 ? 4 : w === 2 ? 6 : w === 3 ? 8 : 4;
          return {
            name: "Intervalados de VO2 Máx (Tiros de 400m)",
            intent: "vo2max",
            durationMinutes: duration,
            description: "Sessão de alta intensidade para expandir o teto de captação de oxigênio e tolerância ao lactato.",
            objective: "Expandir o teto de captação de oxigênio (VO2 Máx) e tolerância ao lactato.",
            observations: ["esforço forte nos tiros", "manter a postura alta", "recuperação ativa no trote"],
            ifTired: "Aumente o tempo de recuperação entre os tiros para 2 minutos ou reduza o número de repetições pela metade.",
            steps: [
              {
                name: "Aquecimento, Educativos e Acelerações",
                durationSeconds: 900,
                intensity: "Z2 Progressivo",
                description: "10 min de trote leve + 3 min de educativos (Skip Alto, Hop) + 2 tiros de aceleração de 50m para ativação neuromuscular.",
                stepType: "warmup"
              },
              {
                name: "Tiros Rápidos de 400m",
                durationSeconds: 90,
                intensity: "Z5 Esforço Forte / RPE 9",
                description: "Velocidade de tiro submáximo.",
                stepType: "main_set",
                repetitions: reps,
                recoverySeconds: 90,
                instruction: "Foque na postura alta, passada rápida e recuperação completa no trote."
              },
              {
                name: "Trote de Descompressão",
                durationSeconds: 600,
                intensity: "Z1 Regenerativo",
                description: "Corrida extremamente leve para remoção do lactato acumulado.",
                stepType: "cooldown"
              }
            ]
          };
        } else {
          let duration = Math.round(50 * (w === 4 ? 0.75 : durationScale));
          let mainSeconds = w === 1 ? 900 : w === 2 ? 1200 : w === 3 ? 1500 : 900;
          return {
            name: "Tempo Run de Ritmo de Limiar (Lactato)",
            intent: "threshold",
            durationMinutes: duration,
            description: "Treino chave de ritmo para melhorar a velocidade de cruzeiro e eficiência metabólica sob fadiga.",
            objective: "Melhorar o limiar de lactato e a velocidade de cruzeiro sob fadiga.",
            observations: ["ritmo firme e constante", "conversa difícil (frases curtas)", "FC estável na Zona 4"],
            ifTired: "Divida o bloco contínuo em 2 partes de igual duração com 2 minutos de caminhada entre elas.",
            steps: [
              {
                name: "Trote de Aquecimento e Educativos",
                durationSeconds: 900,
                intensity: "Z2 Confortável",
                description: "Aquecimento progressivo leve (10 min) seguido de educativos de técnica (Skip Baixo e Dribbling) para coordenação.",
                stepType: "warmup"
              },
              {
                name: "Bloco Contínuo de Limiar",
                durationSeconds: mainSeconds,
                intensity: "Z4 Ritmo Firme / RPE 7-8",
                description: "Ritmo de esforço controlado porém desconfortável.",
                stepType: "main_set",
                instruction: "Mantenha o ritmo firme constante sem deixar a frequência cardíaca disparar descontroladamente."
              },
              {
                name: "Trote de Desaquecimento",
                durationSeconds: 600,
                intensity: "Z1 Muito Leve",
                description: "Resfriamento fisiológico.",
                stepType: "cooldown"
              }
            ]
          };
        }
      }

      // Default aerobic base / easy run
      let duration = Math.round(40 * (w === 4 ? 0.8 : durationScale));
      return {
        name: "Rodagem de Base Regenerativa Z2",
        intent: "aerobic_base",
        durationMinutes: duration,
        description: "Treino de rodagem leve clássico para acúmulo de quilometragem semanal e desenvolvimento capilar com baixo estresse articular.",
        objective: "Construir base aeróbica e promover recuperação ativa sem acumular fadiga.",
        observations: ["respiração confortável", "conversa normal e fluida", "FC sob controle em Zona 2"],
        ifTired: "Reduza a duração para 30 minutos ou troque por trote regenerativo ultra leve.",
        steps: [
          {
            name: "Aquecimento e Educativos",
            durationSeconds: 600,
            intensity: "Z1 Muito Leve",
            description: "5 min de trote progressivo + 5 min de exercícios educativos de corrida (Dribbling e Soldadinho) para coordenação motora.",
            stepType: "warmup"
          },
          {
            name: "Rodagem Confortável",
            durationSeconds: (duration - 15) * 60,
            intensity: "Z2 Trote Leve / RPE 3-4",
            description: "Ritmo conversável para desenvolvimento mitocondrial.",
            stepType: "main_set"
          },
          {
            name: "Desaquecimento",
            durationSeconds: 300,
            intensity: "Z1",
            stepType: "cooldown"
          }
        ]
      };
    };

    let strengthDay: string | null = null;
    let nonRunningDays = weekdays.filter(d => d !== restDay && d !== longRunDay && !selectedTrainingDays.includes(d));
    
    if (nonRunningDays.length > 0) {
      strengthDay = nonRunningDays[0];
    } else {
      const easyDays = selectedTrainingDays.filter((day) => {
        const isQuality = selectedTrainingDays.indexOf(day) === Math.floor(selectedTrainingDays.length / 2);
        return !isQuality;
      });
      if (easyDays.length > 0) {
        strengthDay = easyDays[easyDays.length - 1];
        selectedTrainingDays = selectedTrainingDays.filter(d => d !== strengthDay);
      }
    }

    weekdays.forEach(day => {
      if (day === restDay) {
        workouts.push({
          day,
          workout: {
            name: "Descanso Total Fisiológico",
            intent: "rest",
            durationMinutes: 0,
            description: "Dia sagrado de recuperação passiva. Permita que as fibras musculares e o sistema nervoso central se regenerem dos estímulos anteriores.",
            objective: "Permitir supercompensação muscular e regeneração do sistema nervoso central.",
            observations: ["zero corrida", "foco em sono de qualidade", "hidratação abundante"],
            ifTired: "Aproveite para realizar alongamentos muito leves e banho morno relaxante.",
            steps: [
              {
                name: "Folga Completa",
                durationSeconds: 0,
                intensity: "Nenhuma",
                description: "Foque em hidratação, boa alimentação e sono de alta qualidade."
              }
            ]
          }
        });
      } else if (day === longRunDay) {
        workouts.push({
          day,
          workout: getWorkoutForDay(day, true, false)
        });
      } else if (selectedTrainingDays.includes(day)) {
        const isQuality = selectedTrainingDays.indexOf(day) === Math.floor(selectedTrainingDays.length / 2);
        workouts.push({
          day,
          workout: getWorkoutForDay(day, false, isQuality)
        });
      } else if (day === strengthDay) {
        workouts.push({
          day,
          workout: {
            name: "Fortalecimento Funcional para Corrida",
            intent: "strength",
            durationMinutes: 35,
            description: "Treino de fortalecimento e força funcional focado em estabilização do quadril, joelho e core para potência de passada e prevenção de lesões comuns da corrida.",
            objective: "Fortalecer musculatura estabilizadora e prevenir lesões comuns na corrida.",
            observations: ["execução lenta e controlada", "core sempre ativo", "foco no alinhamento do joelho"],
            ifTired: "Faça apenas 2 séries de cada exercício com menos peso ou carga corporal.",
            steps: [
              {
                name: "Mobilidade e Ativação",
                durationSeconds: 300,
                intensity: "Z0 Baixa",
                description: "Exercícios de mobilidade articular de tornozelos, quadril e ativação de glúteo médio e transverso abdominal.",
                stepType: "warmup"
              },
              {
                name: "Fortalecimento de Membros Inferiores e Core (3x)",
                durationSeconds: 1500,
                intensity: "RPE 6-7 / Moderada",
                description: "Agachamento búlgaro unilateral, elevação pélvica de uma perna, elevação de panturrilha na escada e prancha isométrica frontal e lateral.",
                stepType: "main_set",
                sets: 3,
                repetitions: 12,
                recoverySeconds: 60,
                instruction: "Realize os exercícios focando no alinhamento articular. Não apresse a execução."
              },
              {
                name: "Descompressão e Mobilidade Passiva",
                durationSeconds: 300,
                intensity: "Regenerativa",
                description: "Alongamentos estáticos suaves de quadríceps, isquiotibiais e flexores de quadril.",
                stepType: "cooldown"
              }
            ]
          }
        });
      } else {
        workouts.push({
          day,
          workout: {
            name: "Mobilidade Articular e Core",
            intent: "mobility",
            durationMinutes: 25,
            description: "Sessão dedicada à flexibilidade funcional, estabilização do quadril e fortalecimento do core para prevenir lesões na corrida.",
            objective: "Melhorar a flexibilidade articular e estabilização postural.",
            observations: ["movimentos amplos e controlados", "respiração fluida", "foco no alinhamento postural"],
            ifTired: "Faça de forma mais passiva, segurando os alongamentos estáticos por mais tempo.",
            steps: [
              {
                name: "Soltura Miofascial e Mobilidade",
                durationSeconds: 600,
                intensity: "Z0 Baixa",
                description: "Exercícios dinâmicos de alongamento ativo e soltura.",
                stepType: "warmup"
              },
              {
                name: "Fortalecimento de Core e Glúteos",
                durationSeconds: 900,
                intensity: "Z0 Baixa",
                description: "Pranchas frontais, laterais e pontes unilaterais de glúteo.",
                stepType: "main_set"
              }
            ]
          }
        });
      }
    });

    weeks.push({
      weekNumber: w,
      phase: phase,
      overview: {
        title: overviewTitle,
        objective: overviewObjective,
        predictedLoad: overviewLoad,
        keyWorkout: overviewKey,
        attentionPoint: overviewAttention
      },
      workouts: workouts
    });
  }

  const goalDesc = goalType === "weight_loss" ? "Perda de Peso e Saúde Cardiovascular" :
                   goalType === "5k" ? "Melhoria de Performance e Ritmo para 5km" :
                   goalType === "10k" ? "Consolidação e Velocidade para 10km" :
                   goalType === "half_marathon" ? "Periodização para Meia Maratona (21k)" :
                   goalType === "marathon" ? "Resistência de Fadiga para Maratona (42k)" :
                   goalType === "ultra" ? "Volume e Economia de Corrida para Ultramaratona" :
                   "Condicionamento Físico Geral e Longevidade";

  return {
    athleteName: name,
    goal: {
      type: goalType,
      description: goalDesc
    },
    cycles: [
      {
        cycleNumber: 1,
        weeks: weeks
      }
    ]
  };
}

// Endpoint to generate a fully customized Training Plan based on Coach Context and Athlete Profile
app.post("/api/generate-training-plan", async (req, res): Promise<any> => {
  try {
    const { athleteProfile, dailyMetrics, trainingHistory, readiness } = req.body;

    const aiClient = getGeminiClient();

    const prompt = `
Generate a highly detailed, personalized running training plan for this athlete.

ATHLETE PROFILE:
- Name: ${athleteProfile?.name || "Atleta"}
- Age: ${athleteProfile?.age || "Not specified"} years old
- Gender: ${athleteProfile?.gender || "Not specified"}
- Weight: ${athleteProfile?.weightCurrentKg || athleteProfile?.weight || "Not specified"} kg
- Height: ${athleteProfile?.heightCm || athleteProfile?.height || "Not specified"} cm
- Goal/Objective: ${athleteProfile?.objective || athleteProfile?.trainingGoal || "General Fitness"}
- Years running: ${athleteProfile?.yearsRunning || "Not specified"}
- Weekly training days: ${athleteProfile?.weeklyTrainingDays || "3"} days/week
- Longest run: ${athleteProfile?.longestRunKm || "Not specified"} km
- Current week volume: ${athleteProfile?.currentWeekKm || "Not specified"} km
- Personal Bests: 5k: ${athleteProfile?.best5k || "N/A"} | 10k: ${athleteProfile?.best10k || "N/A"} | Half Marathon: ${athleteProfile?.bestHalfMarathon || "N/A"}
- Estimated Current Pace: ${athleteProfile?.estimatedPaceCurrent || "Not specified"} min/km
- Rest Day preference: ${athleteProfile?.restDay || "Segunda-feira"}
- Long Run preference: ${athleteProfile?.longRunDay || "Domingo"}
- Injuries/Limitations: ${athleteProfile?.injuries || athleteProfile?.limitations || "None"}
- Additional notes: ${athleteProfile?.notes || "None"}

CURRENT DAY ATHLETE STATE / DAILY BIOMETRICS:
- Sleep Hours: ${dailyMetrics?.sleepHours || "Not specified"}
- Sleep Score: ${dailyMetrics?.sleepScore || "Not specified"}
- Stress Score (1-10): ${dailyMetrics?.stressScore || "Not specified"}
- Fatigue Score (1-10): ${dailyMetrics?.fatigueScore || "Not specified"}
- Rest Heart Rate: ${dailyMetrics?.restingHeartRate || "Not specified"} bpm
- HRV (Heart Rate Variability): ${dailyMetrics?.hrv || "Not specified"} ms
- Readiness Score calculated locally: ${readiness?.score || "Not specified"}/100 (${readiness?.status || "Normal"})

HISTORICAL TRAINING METRICS (from parsed activities or defaults):
- Week distance: ${trainingHistory?.weekDistanceKm || "0"} km
- Month distance: ${trainingHistory?.monthDistanceKm || "0"} km
- Total parsed runs: ${trainingHistory?.totalRuns || "0"}
- Max run distance in log: ${trainingHistory?.longestRunKm || "0"} km
- Average heart rate: ${trainingHistory?.averageHr || "N/A"} bpm
- Average pace: ${trainingHistory?.averagePace || "N/A"} /km
`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are an elite endurance sports coach, specialized in running physiology, CTL/ATL metrics, and customized periodization (including base building, VO2 Max development, speed, and recovery).
Using the provided Athlete Profile, Current State (Readiness), and Training History, generate a professional, periodized 1-week training schedule (represented as 1 cycle and 1 week containing scheduled workouts).

Take into account:
1. If they have an injury or low Readiness (e.g. status "recover" or "reduce"), substitute intensity with "recovery", "rest", "mobility", or lower volume.
2. Respect their weekly training days (if they train 3 days, only schedule 3 run workouts, and set other days to "rest", "mobility" or dedicated strength training).
3. Respect their preferred rest day and long run day.
4. Scale paces and intervals based on their Personal Bests if provided. If the athlete is a beginner and did not specify Resting Heart Rate (FC Repouso), Max Heart Rate (FC Máxima), Personal Bests (PBs), or Estimated Current Pace, do NOT mandate strict target zone heart rates or paces. Instead, describe the training intensity using RPE (Rate of Perceived Exertion, e.g., "Esforço 3-4/10", "Trote super leve e confortável") and time duration, letting the athlete adapt comfortably without technical pressure. Explain in the descriptions/instructions that the coach will learn and estimate their zones as they report training data!
5. For each scheduled run workout (aerobic_base, threshold, vo2max, long_run), you MUST include running drills (educativos de técnica de corrida, e.g., Skip Alto, Skip Baixo, Anfersen, Soldadinho) in the description or as a specific sub-step of the Warmup to improve stride efficiency and posture.
6. You MUST schedule at least one dedicated Strength Training session ("Treino de Força Funcional para Corrida", intent: "strength"). For athletes training 5, 6, or 7 days, schedule this strength session on an easy run day or replace one easy run day to guarantee they receive lower limb and core reinforcement to prevent common injuries.
7. For each scheduled workout, provide a list of structured steps (Warmup, Main set intervals, Cooldown) with exact durations in seconds and physiological intensity tags (e.g., "Z2 Easy / RPE 3-4", "Z4 Threshold / RPE 7-8", "Z5 Max effort / RPE 9-10").
8. Always write step names explicitly (e.g., "Aquecimento + Educativos de Técnica de Corrida" for warmups) and include descriptions naming the exact exercises (e.g., Skip Alto, Anfersen, Soldadinho, or glute activation) so the athlete can easily see and perform them. Do NOT omit them.

Return the result STRICTLY as a JSON object matching the following TypeScript structure:
{
  "athleteName": string,
  "goal": {
    "type": "general_fitness" | "weight_loss" | "5k" | "10k" | "half_marathon" | "marathon" | "ultra",
    "distanceKm": number (optional),
    "targetPace": string (optional),
    "raceName": string (optional),
    "description": string (e.g., "Prepare for local 10k under 50 minutes")
  },
  "cycles": [
    {
      "cycleNumber": 1,
      "weeks": [
        {
          "weekNumber": 1,
          "phase": string (e.g. "Construção de Base", "Pico", "Polimento", "Recuperação Ativa"),
          "workouts": [
            {
              "day": string (The day of the week in Portuguese, e.g. "Segunda-feira", "Terça-feira"),
              "workout": {
                "name": string (A highly professional, encouraging name like "Rodagem de Base Z2" or "Intervalos de Limiar de Lactato"),
                "intent": "recovery" | "aerobic_base" | "threshold" | "vo2max" | "long_run" | "strength" | "mobility" | "rest",
                "durationMinutes": number,
                "description": string (Description of the target objective, e.g. "Foco em manter a pulsação abaixo de 145 bpm para expandir capacidade mitocondrial"),
                "steps": [
                  {
                    "name": string (e.g. "Aquecimento", "Tiro de 1km", "Trote leve", "Desaquecimento"),
                    "durationSeconds": number,
                    "intensity": string (e.g. "Z1 Fácil", "Z4 Ritmo de Limiar", "Z5 Máximo", "Z2"),
                    "description": string (optional),
                    "stepType": "warmup" | "main_set" | "cooldown" | "recovery" (optional),
                    "repetitions": number (optional, e.g. 5),
                    "sets": number (optional, e.g. 2),
                    "recoverySeconds": number (optional, e.g. 90),
                    "instruction": string (optional, detailed tips for execution)
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}

Return ONLY this JSON, with no other text, comments, markdown blocks, or surrounding wrappers.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            athleteName: { type: Type.STRING },
            goal: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "One of: general_fitness, weight_loss, 5k, 10k, half_marathon, marathon, ultra" },
                distanceKm: { type: Type.NUMBER },
                targetPace: { type: Type.STRING },
                raceName: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["type", "description"]
            },
            cycles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  cycleNumber: { type: Type.INTEGER },
                  weeks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        weekNumber: { type: Type.INTEGER },
                        phase: { type: Type.STRING },
                        workouts: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              day: { type: Type.STRING, description: "Day of the week in Portuguese, e.g., Segunda-feira" },
                              workout: {
                                type: Type.OBJECT,
                                properties: {
                                  name: { type: Type.STRING },
                                  intent: { type: Type.STRING, description: "Must be one of: recovery, aerobic_base, threshold, vo2max, long_run, strength, mobility, rest" },
                                  durationMinutes: { type: Type.INTEGER },
                                  description: { type: Type.STRING },
                                  steps: {
                                    type: Type.ARRAY,
                                    items: {
                                      type: Type.OBJECT,
                                      properties: {
                                        name: { type: Type.STRING },
                                        durationSeconds: { type: Type.INTEGER },
                                        intensity: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        stepType: { type: Type.STRING },
                                        repetitions: { type: Type.INTEGER },
                                        sets: { type: Type.INTEGER },
                                        recoverySeconds: { type: Type.INTEGER },
                                        instruction: { type: Type.STRING }
                                      },
                                      required: ["name", "durationSeconds", "intensity"]
                                    }
                                  }
                                },
                                required: ["name", "intent", "durationMinutes", "description", "steps"]
                              }
                            },
                            required: ["day", "workout"]
                          }
                        }
                      },
                      required: ["weekNumber", "phase", "workouts"]
                    }
                  }
                },
                required: ["cycleNumber", "weeks"]
              }
            }
          },
          required: ["athleteName", "goal", "cycles"]
        }
      }
    });

    const responseText = response.text;
    if (responseText) {
      const trainingPlan = JSON.parse(responseText.trim());
      return res.json({ success: true, trainingPlan });
    } else {
      throw new Error("Empty response from AI engine");
    }
  } catch (error: any) {
    console.warn("Generate training plan falling back to local generator.");
    try {
      const localPlan = generateLocalTrainingPlan(req.body.athleteProfile, req.body.dailyMetrics, req.body.trainingHistory, req.body.readiness);
      (localPlan as any).isFallback = true;
      return res.json({ success: true, trainingPlan: localPlan, isFallback: true });
    } catch (fallbackError: any) {
      console.warn("Local fallback failed:", fallbackError?.message || fallbackError);
      res.status(500).json({ error: fallbackError?.message || "Failed to generate training plan." });
    }
  }
});

// Endpoint for real-time sports science consultation with the AI Coach
app.post("/api/coach-chat", async (req, res): Promise<any> => {
  try {
    const { athleteProfile, chatHistory, message, readiness, trainingHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Missing message for coach chat." });
    }

    const aiClient = getGeminiClient();

    // Prepare contents array for multi-turn chat using the official @google/genai format
    const contents = [];
    
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: any) => {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.parts || msg.text || "" }]
        });
      });
    }

    // Append current user message
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const systemInstruction = `Você é o Treinador Virtual de Performance Esportiva e Fisiologia do Exercício do aplicativo Aetheris Fit.
Você auxilia corredores e ciclistas a otimizarem seus treinos de endurance, baseados em métricas de telemetria Garmin, carga semanal (CTL/ATL), percepção de esforço (RPE) e índice de prontidão física (readiness) coletado.

Perfil do Atleta atual com quem você está conversando:
- Idade: ${athleteProfile?.age || "Não especificado"} anos
- Peso: ${athleteProfile?.weight || "Não especificado"} kg
- Altura: ${athleteProfile?.height || "Não especificado"} cm
- FC de Repouso: ${athleteProfile?.restingHeartRate || "60"} bpm | FC Máxima: ${athleteProfile?.maxHeartRate || "190"} bpm
- Experiência: ${athleteProfile?.fitnessLevel || "intermediate"}
- Objetivo: ${athleteProfile?.trainingGoal || "endurance"}

Histórico e Prontidão do Atleta hoje:
- Índice de Prontidão (Readiness): ${readiness?.score || "80"}/100 [Status: ${readiness?.status || "READY"}]
- Quilometragem Semanal acumulada: ${trainingHistory?.weekDistanceKm || "0"} km
- Quilometragem Mensal: ${trainingHistory?.monthDistanceKm || "0"} km

Instruções para a conversa:
1. Seja altamente profissional, amigável, encorajador e educativo. Use termos de ciência esportiva (como limiar de lactato, zonas de FC, CTL/ATL, economia de corrida, VO2 Max) mas explique de forma clara e acessível.
2. Responda em Português do Brasil (PT-BR).
3. Mantenha respostas focadas na fisiologia de corrida e ciclismo. Se o atleta relatar dores de lesão, oriente a buscar avaliação médica, mas sugira repouso ativo, mobilidade ou treinos regenerativos baseados nas diretrizes fisiológicas.
4. Use formatação Markdown (negritos, bullet points) para deixar a resposta bonita e legível.`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.6-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    const reply = response.text;
    res.json({ success: true, reply });
  } catch (error: any) {
    console.warn("Coach chat falling back to offline sports science guidance.");
    try {
      const athlete = req.body.athleteProfile;
      const goalName = athlete?.trainingGoal === "5k" ? "bater sua meta nos 5k" :
                       athlete?.trainingGoal === "10k" ? "vencer os 10k" :
                       athlete?.trainingGoal === "half_marathon" ? "completar a Meia Maratona" :
                       athlete?.trainingGoal === "marathon" ? "completar a Maratona" :
                       athlete?.trainingGoal === "weight_loss" ? "perder peso com saúde" : "melhorar seu condicionamento físico";
      const weightInfo = athlete?.weight ? `${athlete.weight}kg` : "seu peso atual";
      const replyText = `⚠️ **[Modo de Contingência Ativo]** Olá! Identifiquei que a chave de API do Gemini não está configurada nos Secrets do AI Studio ou atingiu os limites de cota.
      
Mas não se preocupe! Como seu Treinador Virtual em modo offline/heurístico, analisei seu perfil de **${athlete?.age || "28"} anos e ${weightInfo}** com objetivo de **${goalName}** para te orientar cientificamente:

1. **Sua Prontidão Física**: Baseado nos dados de hoje (índice de prontidão de **${req.body.readiness?.score || "80"}/100**), recomendo focar na consistência da sua periodização semanal sem pular etapas.
2. **Distribuição de Cargas**: Mantenha cerca de 80% do seu volume de treinos em ritmo de conversação confortável (Zona 2). Isso maximiza as adaptações mitocondriais e enzimáticas que sustentam ritmos mais rápidos posteriormente.
3. **Segurança de Treino**: Caso sinta algum desconforto ou dor persistente nas articulações ou tendões, reduza a intensidade para caminhada rápida, foque em mobilidade ativa e dê tempo para a recuperação biológica.

*Dica: Você pode ativar as análises completas da IA configurando uma chave de API do Gemini válida nas configurações de secrets do aplicativo.*`;
      
      return res.json({ success: true, reply: replyText });
    } catch (fallbackError: any) {
      console.warn("Local fallback chat failed:", fallbackError?.message || fallbackError);
      res.status(500).json({ error: fallbackError?.message || "Failed to get coach response." });
    }
  }
});

// Setup Vite development server or static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FIT Analytics Dashboard running on http://localhost:${PORT}`);
  });
}

startServer();
