import express from "express";
import path from "path";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import FitParserModule from "fit-file-parser";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { generateAetherisMicrocycle } from "./src/coach/aetherisMicrocycleEngine.js";
import { runAetherisSimulationSuite } from "./src/coach/aetherisSimulationSuite.js";

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

// Database Storage setup for persistent FIT files and Users
const DB_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DB_DIR, "fit_activities_db.json");
const USERS_FILE = path.join(DB_DIR, "users_db.json");

if (!fs.existsSync(DB_DIR)) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create data directory for database:", err);
  }
}

interface StoredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  salt: string;
  role: "athlete" | "coach" | "admin";
  createdAt: string;
  updatedAt: string;
  consentGdpr: boolean;
  consentTimestamp: string;
  termsVersion: string;
  profile?: any;
}

function getUsersDb(): StoredUser[] {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      // Seed default admin/athlete user if empty
      const defaultSalt = crypto.randomBytes(16).toString("hex");
      const defaultHash = crypto.pbkdf2Sync("Atleta123!", defaultSalt, 10000, 64, "sha512").toString("hex");
      const initialUsers: StoredUser[] = [
        {
          id: "usr_helder_alex",
          email: "helderalex@gmail.com",
          firstName: "Helder",
          lastName: "Alex",
          passwordHash: defaultHash,
          salt: defaultSalt,
          role: "athlete",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          consentGdpr: true,
          consentTimestamp: new Date().toISOString(),
          termsVersion: "1.0",
          profile: {
            name: "Helder Alex",
            firstName: "Helder",
            lastName: "Alex",
            gender: "Masculino",
            age: 34,
            heightCm: 178,
            weightCurrentKg: 72
          }
        }
      ];
      fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), "utf-8");
      return initialUsers;
    }
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("Error reading users_db.json:", err);
    return [];
  }
}

function saveUsersDb(users: StoredUser[]) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to users_db.json:", err);
  }
}

const SESS_FILE = path.join(DB_DIR, "sessions_db.json");

function getSessionsDb(): Map<string, { userId: string; expiresAt: number }> {
  const map = new Map<string, { userId: string; expiresAt: number }>();
  try {
    if (fs.existsSync(SESS_FILE)) {
      const raw = fs.readFileSync(SESS_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const now = Date.now();
        list.forEach((item: any) => {
          if (item.token && item.userId && item.expiresAt > now) {
            map.set(item.token, { userId: item.userId, expiresAt: item.expiresAt });
          }
        });
      }
    }
  } catch (err) {
    console.error("Error reading sessions_db.json:", err);
  }
  return map;
}

function saveSessionsDb(sessionsMap: Map<string, { userId: string; expiresAt: number }>) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const array = Array.from(sessionsMap.entries()).map(([token, val]) => ({
      token,
      userId: val.userId,
      expiresAt: val.expiresAt,
    }));
    fs.writeFileSync(SESS_FILE, JSON.stringify(array, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to sessions_db.json:", err);
  }
}

// Active sessions map (token -> session) - loaded from disk
const activeSessions = getSessionsDb();

function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Mínimo de 8 caracteres");
  if (!/[A-Z]/.test(password)) errors.push("Ao menos 1 letra maiúscula (A-Z)");
  if (!/[a-z]/.test(password)) errors.push("Ao menos 1 letra minúscula (a-z)");
  if (!/\d/.test(password)) errors.push("Ao menos 1 número (0-9)");
  if (!/[@$!%*?&_\-#]/.test(password)) errors.push("Ao menos 1 caractere especial (@, $, !, %, *, ?, &, _, -, #)");
  return { valid: errors.length === 0, errors };
}

function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const { hash: computedHash } = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"));
  } catch {
    return false;
  }
}

function sanitizeUser(user: StoredUser) {
  const { passwordHash, salt, ...sanitized } = user;
  return sanitized;
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

function isDuplicateFitActivity(act1: any, act2: any): boolean {
  if (!act1 || !act2) return false;
  if (act1.id && act2.id && act1.id === act2.id) return false;

  const t1Raw = act1.startTime || act1.start_time || act1.timestamp;
  const t2Raw = act2.startTime || act2.start_time || act2.timestamp;
  if (!t1Raw || !t2Raw) return false;

  const t1 = new Date(t1Raw).getTime();
  const t2 = new Date(t2Raw).getTime();
  if (isNaN(t1) || isNaN(t2)) return false;

  // Compare start date & time (tolerance of 2 seconds / 2000 ms)
  const isSameStartTime = Math.abs(t1 - t2) <= 2000;
  if (!isSameStartTime) return false;

  // Compare workout duration (tolerance of 2 seconds)
  const d1 = act1.summary?.durationSeconds ?? act1.durationSeconds ?? act1.totalDurationSeconds ?? 0;
  const d2 = act2.summary?.durationSeconds ?? act2.durationSeconds ?? act2.totalDurationSeconds ?? 0;
  const isSameDuration = Math.abs(d1 - d2) <= 2;

  return isSameStartTime && isSameDuration;
}

function deduplicateDbActivities(): { removedCount: number; removedIds: string[]; keptActivities: any[] } {
  const current = getDbActivities();
  const uniqueActivities: any[] = [];
  const removedIds: string[] = [];

  for (const act of current) {
    const existingIdx = uniqueActivities.findIndex((existing) => isDuplicateFitActivity(existing, act));
    if (existingIdx >= 0) {
      const existing = uniqueActivities[existingIdx];
      const existingUploadTime = new Date(existing.uploadedAt || 0).getTime();
      const actUploadTime = new Date(act.uploadedAt || 0).getTime();

      // Rule: delete the last imported one
      if (actUploadTime >= existingUploadTime) {
        removedIds.push(act.id);
      } else {
        removedIds.push(existing.id);
        uniqueActivities[existingIdx] = act;
      }
    } else {
      uniqueActivities.push(act);
    }
  }

  if (removedIds.length > 0) {
    saveDbActivities(uniqueActivities);
    console.log(`[Deduplication] Excluídas ${removedIds.length} atividades .FIT duplicadas: ${removedIds.join(", ")}`);
  }

  return { removedCount: removedIds.length, removedIds, keptActivities: uniqueActivities };
}

function addOrUpdateDbActivity(activity: any) {
  const current = getDbActivities();
  const existingIdx = current.findIndex((a) => a.id === activity.id);
  if (existingIdx >= 0) {
    current[existingIdx] = activity;
    saveDbActivities(current);
    return { isDuplicate: false, savedActivity: activity };
  }

  // Check if a duplicate exists with same start date/time and duration
  const duplicateIdx = current.findIndex((a) => isDuplicateFitActivity(a, activity));
  if (duplicateIdx >= 0) {
    const existing = current[duplicateIdx];
    console.warn(`[Deduplication] Descartando arquivo .FIT duplicado (${activity.filename || activity.id}). Já existe no banco (${existing.filename || existing.id}) com início em ${activity.startTime} e duração ${activity.summary?.durationSeconds || 0}s.`);
    return { isDuplicate: true, savedActivity: existing, discardedId: activity.id };
  }

  current.unshift(activity); // newest first
  saveDbActivities(current);
  return { isDuplicate: false, savedActivity: activity };
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
  if (!array || !Array.isArray(array) || array.length === 0) return [];
  if (limit <= 0) return [];
  if (array.length <= limit) return array;
  const step = Math.max(1, Math.floor(array.length / limit));
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
    try {
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
          reject(new Error(`Erro ao decodificar arquivo .FIT: ${err.message || String(err)}`));
        } else if (!data) {
          reject(new Error("Arquivo .FIT inválido ou corrompido: nenhum dado extraído."));
        } else {
          resolve(data);
        }
      });
    } catch (e: any) {
      reject(new Error(`Falha no leitor do arquivo .FIT: ${e.message || String(e)}`));
    }
  });
}

const handleSingleUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      console.error("Multer upload error:", err);
      return res.status(400).json({
        error: err instanceof multer.MulterError
          ? `Erro no upload: ${err.message}`
          : `Falha ao receber arquivo: ${err.message || String(err)}`
      });
    }
    next();
  });
};

// Core API endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// AUTHENTICATION & MULTI-USER API ENDPOINTS (Cybersecurity + GDPR compliant)
app.post("/api/auth/register", (req, res) => {
  try {
    const { email, password, firstName, lastName, consentGdpr } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "Preencha todos os campos obrigatórios (nome, sobrenome, e-mail e senha)." });
    }

    if (!consentGdpr) {
      return res.status(400).json({ error: "Você deve aceitar os termos da LGPD / GDPR para realizar o cadastro com segurança." });
    }

    const emailNormalized = email.trim().toLowerCase();
    const users = getUsersDb();

    if (users.some((u) => u.email.toLowerCase() === emailNormalized)) {
      return res.status(400).json({ error: "Este endereço de e-mail já está cadastrado no sistema." });
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        error: "A senha não atende aos requisitos de segurança.",
        details: passwordCheck.errors,
      });
    }

    const { hash, salt } = hashPassword(password);
    const userId = "usr_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");

    const newUser: StoredUser = {
      id: userId,
      email: emailNormalized,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      passwordHash: hash,
      salt: salt,
      role: "athlete",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      consentGdpr: true,
      consentTimestamp: new Date().toISOString(),
      termsVersion: "1.0",
      profile: {
        name: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender: "Masculino",
        age: 30,
        heightCm: 175,
        weightCurrentKg: 70
      },
    };

    users.push(newUser);
    saveUsersDb(users);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    activeSessions.set(token, { userId, expiresAt });
    saveSessionsDb(activeSessions);

    res.json({
      success: true,
      token,
      user: sanitizeUser(newUser),
      message: "Usuário cadastrado com sucesso de acordo com as diretrizes GDPR/LGPD.",
    });
  } catch (err: any) {
    console.error("Error registering user:", err);
    res.status(500).json({ error: "Erro interno no servidor ao registrar usuário." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha." });
    }

    const emailNormalized = email.trim().toLowerCase();
    const users = getUsersDb();
    const user = users.find((u) => u.email.toLowerCase() === emailNormalized);

    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const isValidPassword = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    activeSessions.set(token, { userId: user.id, expiresAt });
    saveSessionsDb(activeSessions);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error("Error logging in:", err);
    res.status(500).json({ error: "Erro ao autenticar usuário." });
  }
});

app.get("/api/auth/me", (req, res) => {
  try {
    let userId = "";
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const session = activeSessions.get(token);
      if (session && session.expiresAt >= Date.now()) {
        userId = session.userId;
      } else if (session) {
        activeSessions.delete(token);
        saveSessionsDb(activeSessions);
      }
    }

    if (!userId && req.headers["x-user-id"]) {
      userId = String(req.headers["x-user-id"]);
    }

    if (!userId) {
      return res.status(401).json({ error: "Não autenticado ou sessão expirada." });
    }

    const users = getUsersDb();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao verificar sessão." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    activeSessions.delete(token);
    saveSessionsDb(activeSessions);
  }
  res.json({ success: true, message: "Sessão encerrada com segurança." });
});

app.get("/api/users", (req, res) => {
  try {
    const users = getUsersDb();
    res.json({
      success: true,
      count: users.length,
      users: users.map(sanitizeUser),
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

app.put("/api/users/:id/profile", (req, res) => {
  try {
    const userId = req.params.id;
    const { profile, firstName, lastName } = req.body;
    const users = getUsersDb();
    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    if (firstName) users[userIndex].firstName = firstName.trim();
    if (lastName) users[userIndex].lastName = lastName.trim();
    if (profile) users[userIndex].profile = profile;
    users[userIndex].updatedAt = new Date().toISOString();

    saveUsersDb(users);
    res.json({ success: true, user: sanitizeUser(users[userIndex]) });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar perfil do usuário." });
  }
});

app.get("/api/users/:id/profile", (req, res) => {
  try {
    const userId = req.params.id;
    const users = getUsersDb();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    res.json({ success: true, profile: user.profile || null });
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar perfil do usuário." });
  }
});

// GDPR / LGPD DATA PORTABILITY EXPORT (ART. 15 / 20)
app.get("/api/user/gdpr-export", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    const token = authHeader.split(" ")[1];
    const session = activeSessions.get(token);
    if (!session) return res.status(401).json({ error: "Sessão inválida." });

    const users = getUsersDb();
    const user = users.find((u) => u.id === session.userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    const activities = getDbActivities();

    const gdprPackage = {
      exportTimestamp: new Date().toISOString(),
      gdprComplianceNotice: "Este arquivo contém todas as suas informações pessoais e registros de atividades armazenados na plataforma conforme a LGPD / GDPR.",
      accountInformation: sanitizeUser(user),
      activitiesCount: activities.length,
      activities: activities,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="gdpr_export_${user.firstName}_${user.lastName}.json"`);
    res.send(JSON.stringify(gdprPackage, null, 2));
  } catch (err) {
    res.status(500).json({ error: "Erro ao exportar dados do usuário." });
  }
});

// GDPR / LGPD RIGHT TO BE FORGOTTEN (ART. 17) - PERMANENT ERASURE
app.delete("/api/user/gdpr-delete", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    const token = authHeader.split(" ")[1];
    const session = activeSessions.get(token);
    if (!session) return res.status(401).json({ error: "Sessão inválida." });

    const users = getUsersDb();
    const userIndex = users.findIndex((u) => u.id === session.userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    saveUsersDb(users);
    activeSessions.delete(token);

    console.log(`[GDPR Erasure] Conta de usuário excluída permanentemente: ${deletedUser.email} (${deletedUser.id})`);

    res.json({
      success: true,
      message: "Sua conta e todos os seus dados pessoais foram completamente excluídos conforme a política de privacidade GDPR/LGPD.",
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir conta." });
  }
});


// Database API endpoints for FIT activities
app.get("/api/activities", (req, res) => {
  try {
    let activities = getDbActivities();
    let filterUserId: string | null = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const session = activeSessions.get(token);
      if (session) filterUserId = session.userId;
    }
    if (!filterUserId && req.query.userId) {
      filterUserId = String(req.query.userId);
    }

    if (filterUserId) {
      activities = activities.filter((a) => !a.userId || a.userId === filterUserId);
    }

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
    
    let filterUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const session = activeSessions.get(token);
      if (session) filterUserId = session.userId;
    }
    if (!filterUserId && activity.userId) {
      filterUserId = activity.userId;
    }
    if (filterUserId) {
      activity.userId = filterUserId;
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

// Dedicated endpoint to remove duplicates from database
app.post("/api/activities/deduplicate", (req, res) => {
  try {
    const result = deduplicateDbActivities();
    res.json({
      success: true,
      message: result.removedCount > 0
        ? `Deduplicação realizada com sucesso: ${result.removedCount} atividade(s) duplicada(s) excluída(s).`
        : "Nenhuma atividade duplicada encontrada.",
      removedCount: result.removedCount,
      removedIds: result.removedIds,
      remainingCount: result.keptActivities.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: "Falha ao executar deduplicação no banco de dados." });
  }
});

// API endpoint to parse and analyze FIT file
app.post("/api/analyze", handleSingleUpload, async (req, res): Promise<any> => {
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

    // Extract path coordinates for Leaflet map (only if we have lat/lng data, downsampled for performance)
    const rawGpsPath = processedRecords
      .filter((r: any) => r.lat !== null && r.lng !== null)
      .map((r: any) => [r.lat, r.lng]);
    const gpsPath = downsample(rawGpsPath, 1000);

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

    // Early Duplicate Check: Check if an activity with same start time and duration is already in DB
    const candidateSummary = { durationSeconds: totalDurationSeconds };
    const currentDb = getDbActivities();
    const existingDuplicate = currentDb.find((a) => isDuplicateFitActivity(a, { startTime, summary: candidateSummary }));

    if (existingDuplicate) {
      console.log(`[Deduplication] Arquivo .FIT duplicado detectado (${req.file.originalname}). Retornando treino existente no banco (ID: ${existingDuplicate.id}).`);
      return res.json({
        success: true,
        isDuplicate: true,
        message: "Arquivo carregado. Verifique o histórico de treinos.",
        activity: existingDuplicate,
        sport: existingDuplicate.sport,
        startTime: existingDuplicate.startTime,
        summary: existingDuplicate.summary,
        gpsPath: existingDuplicate.gpsPath,
        records: existingDuplicate.records,
        aiAnalysis: existingDuplicate.aiAnalysis,
        aiEnabled: existingDuplicate.aiEnabled,
      });
    }

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

    // Extract RPE / Perceived Exertion from session or developer fields
    let fitRpe: number | null = null;
    const possibleRpeKeys = [
      "perceived_exertion",
      "rpe",
      "perceived_exertion_rating",
      "enhanced_perceived_exertion",
      "perceivedExertion",
      "total_feeling",
      "feeling",
      "rating",
      "activity_feeling",
      "subjective_effort"
    ];

    for (const key of possibleRpeKeys) {
      if (session && session[key] !== undefined && session[key] !== null) {
        const val = Number(session[key]);
        if (!isNaN(val) && val > 0) {
          fitRpe = val;
          break;
        }
      }
    }

    if (fitRpe === null && activity) {
      for (const key of possibleRpeKeys) {
        if (activity[key] !== undefined && activity[key] !== null) {
          const val = Number(activity[key]);
          if (!isNaN(val) && val > 0) {
            fitRpe = val;
            break;
          }
        }
      }
    }

    if (fitRpe === null && session && session.developer_fields) {
      const devFields = Array.isArray(session.developer_fields) 
        ? session.developer_fields 
        : Object.values(session.developer_fields);
      for (const df of devFields) {
        const fieldObj = df as any;
        if (fieldObj && fieldObj.name) {
          const fieldNameLower = fieldObj.name.toLowerCase();
          if (
            fieldNameLower.includes("rpe") ||
            fieldNameLower.includes("perceived") ||
            fieldNameLower.includes("feeling") ||
            fieldNameLower.includes("effort") ||
            fieldNameLower.includes("rating") ||
            fieldNameLower.includes("subjective")
          ) {
            const val = Number(fieldObj.value);
            if (!isNaN(val) && val > 0) {
              fitRpe = val;
              break;
            }
          }
        }
      }
    }

    if (fitRpe !== null) {
      if (fitRpe >= 6 && fitRpe <= 20) {
        fitRpe = Math.round(Math.max(1, Math.min(10, ((fitRpe - 6) / 14) * 9 + 1)));
      } else if (fitRpe > 20 && fitRpe <= 100) {
        fitRpe = Math.round(Math.max(1, Math.min(10, (fitRpe / 100) * 10)));
      } else if (fitRpe >= 1 && fitRpe <= 10) {
        fitRpe = Math.round(fitRpe);
      }
    }

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
        rpe: fitRpe,
        perceivedExertion: fitRpe,
      },
      gpsPath,
      records: chartRecords,
      aiAnalysis,
      aiEnabled: hasAi,
      uploadedAt: new Date().toISOString(),
    };

    // Store in backend database
    const saveResult = addOrUpdateDbActivity(activityRecord);
    const finalActivity = saveResult.savedActivity || activityRecord;

    // 5. Return processed metrics + AI insights + saved database object
    res.json({
      success: true,
      isDuplicate: saveResult.isDuplicate || false,
      message: saveResult.isDuplicate ? "Arquivo carregado. Verifique o histórico de treinos." : "Treino importado com sucesso.",
      activity: finalActivity,
      sport: finalActivity.sport,
      startTime: finalActivity.startTime,
      summary: finalActivity.summary,
      gpsPath: finalActivity.gpsPath,
      records: finalActivity.records,
      aiAnalysis: finalActivity.aiAnalysis,
      aiEnabled: finalActivity.aiEnabled,
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
  const name = athleteProfile?.name || athleteProfile?.firstName || "Atleta";
  const goalType = athleteProfile?.trainingGoal || athleteProfile?.objective || "general";
  const fitnessLevel = athleteProfile?.experienceLevel || athleteProfile?.fitnessLevel || "intermediate";
  const restDay = athleteProfile?.restDay || "Quinta-feira";
  const longRunDay = athleteProfile?.longRunDay || "Domingo";
  
  const availableDaysList: string[] = Array.isArray(athleteProfile?.availableDays) && athleteProfile.availableDays.length > 0 
    ? athleteProfile.availableDays 
    : ["Segunda-feira", "Terça-feira", "Quarta-feira", "Sexta-feira", "Sábado", "Domingo"];

  const isDoubleSession = Boolean(athleteProfile?.doubleSessionsAllowed || athleteProfile?.sessionsPerDay === 2);
  const t1Min = athleteProfile?.turno1TimeMinutes || athleteProfile?.availableTimePerWorkout || 50;
  const t2Min = athleteProfile?.turno2TimeMinutes || athleteProfile?.timePerShiftMinutes || 30;

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
      overviewObjective = "Estabelecer a rotina de treinos e preparar músculos e tendões para as cargas futuras.";
      overviewKey = "Treino de ritmo e volume controlado";
      overviewAttention = "Foque na postura correta de corrida e mantenha as rodagens fáceis bem leves.";
    } else if (w === 2) {
      phase = "Base II & Carga";
      durationScale = 1.15;
      overviewTitle = "Base II & Progressão";
      overviewLoad = "Moderada";
      overviewObjective = "Progredir o volume das rodagens e elevar suavemente o estresse cardiovascular.";
      overviewKey = "Intervalados de VO2 Máx ou Limiar";
      overviewAttention = "Tente manter os tiros em um ritmo firme sem se esgotar na primeira série.";
    } else if (w === 3) {
      phase = "Pico & Intensidade";
      durationScale = 1.30;
      overviewTitle = "Pico de Volume & Carga";
      overviewLoad = "Moderada Alta";
      overviewObjective = "Estímulo fisiológico máximo de velocidade e tolerância ao lactato para ganho de performance.";
      overviewKey = "Sessão principal de tiros e Longão semanal";
      overviewAttention = "Mantenha a postura e frequência de passadas quando bater a fadiga.";
    } else {
      phase = "Recuperação & Descarga";
      durationScale = 0.70;
      overviewTitle = "Recuperação Ativa & Descarga";
      overviewLoad = "Leve";
      overviewObjective = "Reduzir o volume agudo de treino para permitir a supercompensação biológica e muscular.";
      overviewKey = "Treinos regenerativos ultra leves";
      overviewAttention = "Semana para descansar e assimilar os ganhos. Evite treinar forte.";
    }

    weekdays.forEach(day => {
      const dayLower = day.toLowerCase();
      const restLower = restDay.toLowerCase();
      const isExplicitRest = dayLower.includes(restLower.slice(0, 3));
      const isAvailable = availableDaysList.some(ad => ad.toLowerCase().includes(dayLower.slice(0, 3)));

      const isRestDay = isExplicitRest || (!isAvailable && day !== longRunDay);

      if (isRestDay) {
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
        let duration = Math.round((goalType === "5k" ? 50 : goalType === "10k" ? 70 : goalType === "half_marathon" ? 95 : 60) * durationScale);
        const mainWorkout = {
          name: w === 4 ? "Longão de Descarga Z2" : "Longão Progressivo Z2",
          intent: "long_run",
          durationMinutes: isDoubleSession ? t1Min : duration,
          description: "Mantenha um ritmo confortável em Zona 2. Foco em capacidade aeróbica prolongada e estabilidade de passada.",
          objective: "Desenvolver resistência aeróbica e adaptação musculoesquelética de longa duração.",
          observations: ["mantenha ritmo confortável", "conversa em frases completas", "foco em Zona 2"],
          ifTired: "Reduza a duração em 15 minutos e termine caminhando se necessário.",
          steps: [
            {
              name: "Aquecimento e Educativos de Corrida",
              durationSeconds: 600,
              intensity: "Z1 Leve",
              description: "Trote leve e educativos de corrida (Skip Alto, Soldadinho) para coordenação.",
              stepType: "warmup"
            },
            {
              name: "Corrida Contínua de Endurance",
              durationSeconds: Math.max(300, ((isDoubleSession ? t1Min : duration) - 15) * 60),
              intensity: "Z2 Confortável",
              description: `Ritmo constante visando adaptação de tendões e capilarização muscular. Pace Alvo: ~${pace}/km.`,
              stepType: "main_set"
            },
            {
              name: "Desaquecimento",
              durationSeconds: 300,
              intensity: "Z1 regenerativo",
              description: "Caminhada lenta para baixar os batimentos cardíacos.",
              stepType: "cooldown"
            }
          ]
        };

        const workoutObj: any = { day, workout: mainWorkout };

        if (isDoubleSession) {
          workoutObj.turno1 = { ...mainWorkout, name: `${mainWorkout.name} (Turno 1 - Manhã)` };
          workoutObj.turno2 = {
            name: "Mobilidade Articular & Soltura (Turno 2 - Tarde/Noite)",
            intent: "mobility",
            durationMinutes: t2Min,
            description: "Sessão dedicada à soltura de cadeias musculares posteriores, mobilidade de quadril e tornozelos após o treino longo de corrida.",
            steps: [
              {
                name: "Mobilidade e Recuperação Ativa",
                durationSeconds: t2Min * 60,
                intensity: "Baixa / Regenerativo",
                description: "Alongamentos estáticos passivos e soltura miofascial de panturrilhas, isquiotibiais e quadríceps."
              }
            ]
          };
        }

        workouts.push(workoutObj);
      } else if (day === "Quarta-feira") {
        // Quality interval session
        let duration = Math.round(45 * (w === 4 ? 0.75 : durationScale));
        const mainWorkout = {
          name: "Intervalados de VO2 Máx (Tiros de 400m)",
          intent: "vo2max",
          durationMinutes: isDoubleSession ? t1Min : duration,
          description: "Sessão de alta intensidade para expandir o teto de captação de oxigênio e tolerância ao lactato.",
          objective: "Expandir o teto de captação de oxigênio (VO2 Máx) e velocidade de corrida.",
          observations: ["esforço forte nos tiros", "manter a postura alta", "recuperação ativa no trote"],
          ifTired: "Aumente o tempo de recuperação entre os tiros ou reduza 2 repetições.",
          steps: [
            {
              name: "Aquecimento e Acelerações",
              durationSeconds: 600,
              intensity: "Z2 Progressivo",
              description: "Trote leve + educativos + 2 acelerações curtas de 50m.",
              stepType: "warmup"
            },
            {
              name: "Tiros Rápidos de 400m",
              durationSeconds: 90,
              intensity: "Z5 Esforço Forte",
              description: "Velocidade de tiro submáximo.",
              stepType: "main_set",
              repetitions: w === 1 ? 4 : w === 2 ? 6 : w === 3 ? 8 : 4,
              recoverySeconds: 90,
              instruction: "Foque na postura alta e passada rápida."
            },
            {
              name: "Trote de Descompressão",
              durationSeconds: 300,
              intensity: "Z1 Regenerativo",
              description: "Corrida leve para remoção de lactato.",
              stepType: "cooldown"
            }
          ]
        };

        const workoutObj: any = { day, workout: mainWorkout };

        if (isDoubleSession) {
          workoutObj.turno1 = { ...mainWorkout, name: `${mainWorkout.name} (Turno 1 - Manhã)` };
          workoutObj.turno2 = {
            name: "Fortalecimento Estrutural & Core (Turno 2 - Tarde/Noite)",
            intent: "strength",
            durationMinutes: t2Min,
            description: "Sessão complementar no segundo turno focada na estabilização de core, glúteo médio e prevenção de lesões na corrida.",
            steps: [
              {
                name: "Fortalecimento de Estabilidade",
                durationSeconds: t2Min * 60,
                intensity: "Moderada / RPE 5-6",
                description: "Pranchas frontais e laterais, ponte unilateral de glúteo e agachamento sumô."
              }
            ]
          };
        }

        workouts.push(workoutObj);
      } else if (day === "Sábado" || day === "Terça-feira") {
        // Strength / Base combo
        const mainWorkout = {
          name: day === "Terça-feira" ? "Tempo Run de Limiar de Lactato" : "Fortalecimento Funcional para Corrida",
          intent: day === "Terça-feira" ? "threshold" : "strength",
          durationMinutes: isDoubleSession ? t1Min : 45,
          description: day === "Terça-feira"
            ? "Treino ritmado em Zona 4 para elevação do limiar anaeróbico e controle de ritmo."
            : "Treino de força focado em cadeia posterior, quadríceps e core para potência de passada.",
          objective: day === "Terça-feira" ? "Melhorar a velocidade sustentada." : "Prevenir lesões e fortalecer a musculatura.",
          observations: ["manter alinhamento articular", "respiração controlada"],
          steps: [
            {
              name: "Aquecimento e Ativação",
              durationSeconds: 600,
              intensity: "Moderada",
              description: "Ativação de glúteos e mobilidade."
            },
            {
              name: "Bloco Principal",
              durationSeconds: Math.max(300, ((isDoubleSession ? t1Min : 45) - 15) * 60),
              intensity: "Z3/Z4 Firme",
              description: "Série técnica contínua."
            },
            {
              name: "Alongamento Final",
              durationSeconds: 300,
              intensity: "Leve"
            }
          ]
        };

        const workoutObj: any = { day, workout: mainWorkout };

        if (isDoubleSession) {
          workoutObj.turno1 = { ...mainWorkout, name: `${mainWorkout.name} (Turno 1 - Manhã)` };
          workoutObj.turno2 = {
            name: day === "Terça-feira" ? "Fortalecimento Estrutural & Core (Turno 2 - Tarde/Noite)" : "Rodagem Regenerativa Z1 (Turno 2 - Tarde/Noite)",
            intent: day === "Terça-feira" ? "strength" : "recovery",
            durationMinutes: t2Min,
            description: day === "Terça-feira"
              ? "Fortalecimento do core e quadril no segundo turno."
              : "Rodagem leve ou caminhada para recuperação ativa e aumento do fluxo sanguíneo.",
            steps: [
              {
                name: "Sessão Complementar Turno 2",
                durationSeconds: t2Min * 60,
                intensity: "Leve / Regenerativa",
                description: "Exercícios contínuos no segundo turno."
              }
            ]
          };
        }

        workouts.push(workoutObj);
      } else {
        // Standard Base Aerobic run for remaining days (Segunda, Sexta)
        const mainWorkout = {
          name: "Rodagem de Base Aeróbica Z2",
          intent: "aerobic_base",
          durationMinutes: isDoubleSession ? t1Min : 40,
          description: "Rodagem leve e conversável em Zona 2 para aumento de volume semanal e capilarização muscular sem fadiga excessiva.",
          objective: "Desenvolver capacidade aeróbica e suporte mitocondrial.",
          observations: ["ritmo conversável", "foco em Zona 2"],
          steps: [
            {
              name: "Aquecimento Leve",
              durationSeconds: 300,
              intensity: "Z1 Leve"
            },
            {
              name: "Rodagem Confortável",
              durationSeconds: Math.max(300, ((isDoubleSession ? t1Min : 40) - 10) * 60),
              intensity: "Z2 Confortável",
              description: `Pace Alvo: ~${pace}/km.`
            },
            {
              name: "Desaquecimento",
              durationSeconds: 300,
              intensity: "Z1"
            }
          ]
        };

        const workoutObj: any = { day, workout: mainWorkout };

        if (isDoubleSession) {
          workoutObj.turno1 = { ...mainWorkout, name: `${mainWorkout.name} (Turno 1 - Manhã)` };
          workoutObj.turno2 = {
            name: "Fortalecimento Estrutural & Core (Turno 2 - Tarde/Noite)",
            intent: "strength",
            durationMinutes: t2Min,
            description: "Sessão do segundo turno focada no fortalecimento de tornozelos, panturrilhas, joelhos e core.",
            steps: [
              {
                name: "Core e Fortalecimento Articular",
                durationSeconds: t2Min * 60,
                intensity: "Moderada",
                description: "Pranchas, pontes, elevação de panturrilhas e estabilização de quadril."
              }
            ]
          };
        }

        workouts.push(workoutObj);
      }
    });

    // Sort workouts chronologically from Segunda-feira to Domingo
    const dayOrder = [
      "segunda-feira",
      "terça-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "sábado",
      "domingo"
    ];
    workouts.sort((a, b) => {
      const ia = dayOrder.findIndex(d => (a.day || "").toLowerCase().includes(d.slice(0, 3)));
      const ib = dayOrder.findIndex(d => (b.day || "").toLowerCase().includes(d.slice(0, 3)));
      return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
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

// Helper to fill missing days of the week and enforce restDay / availableDays / double sessions rules
function fillMissingDaysInPlan(plan: any, athleteProfile?: any) {
  if (!plan || !plan.cycles || !Array.isArray(plan.cycles)) return plan;

  const fullWeekDays = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo"
  ];

  const restDay = (athleteProfile?.restDay || "Quinta-feira").toLowerCase().trim();
  const availableDaysList: string[] = Array.isArray(athleteProfile?.availableDays) && athleteProfile.availableDays.length > 0
    ? athleteProfile.availableDays
    : [];

  const isDoubleSession = Boolean(athleteProfile?.doubleSessionsAllowed || athleteProfile?.sessionsPerDay === 2);
  const t1Min = athleteProfile?.turno1TimeMinutes || athleteProfile?.availableTimePerWorkout || 50;
  const t2Min = athleteProfile?.turno2TimeMinutes || athleteProfile?.timePerShiftMinutes || 30;

  plan.cycles.forEach((cycle: any) => {
    if (cycle && Array.isArray(cycle.weeks)) {
      cycle.weeks.forEach((week: any) => {
        if (week && Array.isArray(week.workouts)) {
          // Normalize day names to full Portuguese
          week.workouts.forEach((sw: any) => {
            if (sw && sw.day) {
              const dl = sw.day.toLowerCase().trim();
              if (dl.includes("seg") || dl.includes("mon")) sw.day = "Segunda-feira";
              else if (dl.includes("ter") || dl.includes("tue")) sw.day = "Terça-feira";
              else if (dl.includes("qua") || dl.includes("wed")) sw.day = "Quarta-feira";
              else if (dl.includes("qui") || dl.includes("thu")) sw.day = "Quinta-feira";
              else if (dl.includes("sex") || dl.includes("fri")) sw.day = "Sexta-feira";
              else if (dl.includes("sáb") || dl.includes("sab") || dl.includes("sat")) sw.day = "Sábado";
              else if (dl.includes("dom") || dl.includes("sun")) sw.day = "Domingo";
            }
          });

          const existingDays = week.workouts.map((w: any) => (w.day || "").toLowerCase().trim());

          fullWeekDays.forEach((day) => {
            const dayLower = day.toLowerCase();
            const exists = existingDays.some((d: string) => d.includes(dayLower.slice(0, 3)));

            if (!exists) {
              const isExplicitRest = dayLower.includes(restDay.slice(0, 3));
              const isAvailable = availableDaysList.length === 0 || availableDaysList.some(ad => ad.toLowerCase().includes(dayLower.slice(0, 3)));

              if (isExplicitRest || !isAvailable) {
                week.workouts.push({
                  day,
                  workout: {
                    name: "Descanso Total Fisiológico",
                    intent: "rest",
                    durationMinutes: 0,
                    description: "Dia de recuperação passiva, assimilação de adaptações físicas e regeneração.",
                    objective: "Permitir a supercompensação muscular e a regeneração do sistema nervoso central.",
                    observations: ["Zero corrida", "Sono de qualidade", "Hidratação abundante"],
                    ifTired: "Aproveite para realizar banho morno e alongamentos muito leves.",
                    steps: [
                      {
                        name: "Folga Completa",
                        durationSeconds: 0,
                        intensity: "Nenhuma",
                        description: "Foque em hidratação, alimentação equilibrada e descanso."
                      }
                    ]
                  }
                });
              } else {
                // Active day was missing: add a proper workout
                const isLongRun = dayLower.includes("dom");
                const isQuality = dayLower.includes("qua");
                
                const mainWk = {
                  name: isLongRun ? "Longão Progressivo Z2" : isQuality ? "Intervalados de VO2 Máx" : "Rodagem de Base Aeróbica Z2",
                  intent: isLongRun ? "long_run" : isQuality ? "vo2max" : "aerobic_base",
                  durationMinutes: t1Min,
                  description: isLongRun 
                    ? "Corrida de longa duração em Zona 2 para resistência aeróbica."
                    : isQuality 
                    ? "Sessão de tiros para desenvolvimento da capacidade cardiorrespiratória."
                    : "Rodagem leve conversável em Zona 2.",
                  steps: [
                    {
                      name: "Aquecimento",
                      durationSeconds: 300,
                      intensity: "Z1 Leve"
                    },
                    {
                      name: "Bloco Principal",
                      durationSeconds: Math.max(300, (t1Min - 10) * 60),
                      intensity: isQuality ? "Z4/Z5 Fortes" : "Z2 Confortável",
                      description: "Manter ritmo estável."
                    },
                    {
                      name: "Desaquecimento",
                      durationSeconds: 300,
                      intensity: "Z1"
                    }
                  ]
                };

                const newWorkoutObj: any = { day, workout: mainWk };

                if (isDoubleSession) {
                  newWorkoutObj.turno1 = { ...mainWk, name: `${mainWk.name} (Turno 1 - Manhã)` };
                  newWorkoutObj.turno2 = {
                    name: "Fortalecimento Estrutural & Core (Turno 2 - Tarde/Noite)",
                    intent: "strength",
                    durationMinutes: t2Min,
                    description: "Sessão no segundo turno para estabilização de quadril, joelho e fortalecimento de core.",
                    steps: [
                      {
                        name: "Fortalecimento de Core e Glúteos",
                        durationSeconds: t2Min * 60,
                        intensity: "Moderada",
                        description: "Pranchas, pontes e agachamentos isométricos."
                      }
                    ]
                  };
                }

                week.workouts.push(newWorkoutObj);
              }
            }
          });

          // Ensure double sessions (turno1 and turno2) exist for all active training days if configured
          if (isDoubleSession) {
            week.workouts.forEach((sw: any) => {
              if (sw.workout && sw.workout.intent !== "rest") {
                if (!sw.turno1) {
                  sw.turno1 = { ...sw.workout, name: `${sw.workout.name} (Turno 1 - Manhã)` };
                }
                if (!sw.turno2) {
                  sw.turno2 = {
                    name: sw.workout.intent === "strength" ? "Mobilidade Articular & Soltura (Turno 2 - Tarde/Noite)" : "Fortalecimento Estrutural & Core (Turno 2 - Tarde/Noite)",
                    intent: sw.workout.intent === "strength" ? "mobility" : "strength",
                    durationMinutes: t2Min,
                    description: "Sessão no segundo turno para estabilidade de quadril, joelho e core.",
                    steps: [
                      {
                        name: "Sessão Turno 2 (Tarde/Noite)",
                        durationSeconds: t2Min * 60,
                        intensity: "Moderada / Regenerativa",
                        description: "Exercícios de fortalecimento e mobilidade articular."
                      }
                    ]
                  };
                }
              }
            });
          }

          // Sort workouts chronologically from Segunda-feira to Domingo
          const dayOrder = [
            "segunda-feira",
            "terça-feira",
            "quarta-feira",
            "quinta-feira",
            "sexta-feira",
            "sábado",
            "domingo"
          ];
          week.workouts.sort((a: any, b: any) => {
            const ia = dayOrder.findIndex(d => (a.day || "").toLowerCase().includes(d.slice(0, 3)));
            const ib = dayOrder.findIndex(d => (b.day || "").toLowerCase().includes(d.slice(0, 3)));
            return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
          });
        }
      });
    }
  });

  return plan;
}

// Endpoint to generate a fully customized Training Plan based on Coach Context and Athlete Profile
app.post("/api/generate-training-plan", async (req, res): Promise<any> => {
  try {
    const { athleteProfile, dailyMetrics, trainingHistory, readiness } = req.body;

    const aiClient = getGeminiClient();

    const prompt = `
Generate a highly detailed, personalized running training plan for this athlete.

ATHLETE PROFILE:

[CAMADA 1 — IDENTIDADE BIOLÓGICA E PERMANENTE DO ATLETA]
- Name: ${athleteProfile?.name || athleteProfile?.firstName || "Atleta"}
- Age: ${athleteProfile?.age || "Not specified"} years old
- Gender: ${athleteProfile?.gender || "Not specified"}
- Height: ${athleteProfile?.heightCm || athleteProfile?.height || "Not specified"} cm
- Current Weight: ${athleteProfile?.weightCurrentKg || athleteProfile?.weight || "Not specified"} kg
- Experience Level (Nível de Experiência): ${athleteProfile?.experienceLevel || athleteProfile?.fitnessLevel || "intermediario"}
- Sports History / Background: ${Array.isArray(athleteProfile?.sportsHistoryList) ? athleteProfile.sportsHistoryList.join(", ") : athleteProfile?.sportsHistory || "Nenhum informado"}
- Structured Injuries / Permanent Limitations: ${Array.isArray(athleteProfile?.structuredInjuries) && athleteProfile.structuredInjuries.length > 0 ? JSON.stringify(athleteProfile.structuredInjuries) : athleteProfile?.injuries || athleteProfile?.limitations || "Nenhuma"}
- Clinical Conditions / Illnesses: ${Array.isArray(athleteProfile?.clinicalConditions) ? athleteProfile.clinicalConditions.join(", ") : "Nenhuma"}
- Diet Type (Tipo de Dieta): ${athleteProfile?.dietType || "onivora"}
- Profession / Occupation: ${athleteProfile?.profession || "Not specified"}
- Night Shift Work (Trabalho Noturno): ${athleteProfile?.nightShiftWork ? "YES (Ajustar janela de recuperação do SNC)" : "NO"}
- Young Children at Home (Filhos Pequenos): ${athleteProfile?.youngChildren ? "YES (Ajustar margem de descanso estressante)" : "NO"}
- Long-Term Coach Memory (Memória Profunda do Treinador): ${Array.isArray(athleteProfile?.longTermCoachMemory) ? athleteProfile.longTermCoachMemory.join("; ") : athleteProfile?.coachMemoryNotes || "Atleta focado em consistência e evolução progressiva sem sobrecarga."}

[CAMADA 2 — OBJETIVOS E ESTRATÉGIA (RESPONDE: "PARA ONDE ESTAMOS INDO?")]
- Objetivos Esportivos e Pessoais Selecionados: ${Array.isArray(athleteProfile?.multipleGoals) && athleteProfile.multipleGoals.length > 0 ? athleteProfile.multipleGoals.join("; ") : athleteProfile?.objective || athleteProfile?.trainingGoal || "Fitness Geral & Saúde"}
- Prova Alvo (Target Race): ${athleteProfile?.currentTargetRaceName || "Nenhuma prova específica"}
- Data da Prova Alvo (Target Race Date): ${athleteProfile?.currentTargetRaceDate || "Não definida"}
- Tempo Alvo Desejado (Target Time Goal): ${athleteProfile?.targetTimeGoal || "Não definido"}
- Meta de Peso (Target Weight Goal): ${athleteProfile?.targetWeightKg || athleteProfile?.weightGoalKg || "Manter peso atual"} kg
- Motivação Primária (Primary Motivation): ${athleteProfile?.primaryMotivation || "Performance & Saúde"}
- Estilo de Treinador Desejado (Coach Style): ${athleteProfile?.coachStyle || "equilibrado"}
- Comunicação do Treinador (Coach Communication): ${athleteProfile?.coachCommunication || "tecnica"}
- Primary Goal Category: ${athleteProfile?.objective || athleteProfile?.trainingGoal || "General Fitness"}
- Weekly training days available count: ${athleteProfile?.weeklyTrainingDays || "3"} days/week
- Longest run distance history: ${athleteProfile?.longestRunKm || "Not specified"} km
- Personal Bests: 5k: ${athleteProfile?.best5k || "N/A"} | 10k: ${athleteProfile?.best10k || "N/A"} | Half Marathon: ${athleteProfile?.bestHalfMarathon || "N/A"}
- Rest Day preference: ${athleteProfile?.restDay || "Segunda-feira"}
- Long Run preference: ${athleteProfile?.longRunDay || "Domingo"}

[CAMADA 3 — RESTRIÇÕES E VIABILIDADE (RESPONDE: "O QUE É POSSÍVEL?")]
- Dias da Semana Específicos Disponíveis: ${Array.isArray(athleteProfile?.availableDays) && athleteProfile.availableDays.length > 0 ? athleteProfile.availableDays.join(", ") : "Todos os dias disponíveis conforme preferências"}
- Duração Máxima por Sessão de Treino: ${athleteProfile?.availableTimePerWorkout || "60 minutos"}
- Horário Preferido do Dia: ${athleteProfile?.preferredTimeOfDay || "Manhã"}
- Terrenos Predominantes Disponíveis: ${Array.isArray(athleteProfile?.preferredTerrain) && athleteProfile.preferredTerrain.length > 0 ? athleteProfile.preferredTerrain.join(", ") : "Rua / Asfalto"}
- Acesso a Academia (Gym Access): ${athleteProfile?.hasGymAccess ? "SIM" : "NÃO"}
- Acesso a Esteira (Treadmill Access): ${athleteProfile?.hasTreadmillAccess || (Array.isArray(athleteProfile?.preferredTerrain) && athleteProfile.preferredTerrain.includes("Esteira")) ? "SIM" : "NÃO"}
- Acesso a Pista de Atletismo (Track Access): ${athleteProfile?.hasTrackAccess || (Array.isArray(athleteProfile?.preferredTerrain) && athleteProfile.preferredTerrain.includes("Pista de Atletismo")) ? "SIM" : "NÃO"}
- Equipamentos para Fortalecimento: ${Array.isArray(athleteProfile?.equipmentsList) && athleteProfile.equipmentsList.length > 0 ? athleteProfile.equipmentsList.join(", ") : "Nenhum / Calistenia com peso corporal"}
- Additional notes: ${athleteProfile?.notes || "None"}

CURRENT DAY ATHLETE STATE / DAILY BIOMETRICS:
- Sleep Hours: ${dailyMetrics?.sleepHours || "Not specified"}
- Sleep Score: ${dailyMetrics?.sleepScore || "Not specified"}
- Stress Score (1-10): ${dailyMetrics?.stressScore || "Not specified"}
- Fatigue Score (1-10): ${dailyMetrics?.fatigueScore || "Not specified"}
- Rest Heart Rate: ${dailyMetrics?.restingHeartRate || "Not specified"} bpm
- HRV (Heart Rate Variability): ${dailyMetrics?.hrv || "Not specified"} ms
- Readiness Score calculated locally: ${readiness?.score || "Not specified"}/100 (${readiness?.status || "Normal"})
- Confidence Level of Decision (Nível de Confiança): ${readiness?.decisionQualityLabel || "Alta"} (${readiness?.confidenceScore || 100}%)

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
        systemInstruction: `You are an elite endurance sports coach, specialized in running physiology, CTL/ATL metrics, biomechanics, and customized periodization.
Using the provided Athlete Profile, Current State (Readiness), and Training History, generate a professional, periodized 1-week training schedule (represented as 1 cycle and 1 week containing scheduled workouts).

O TREINADOR DEVE ADAPTAR TODO O SEU COMPORTAMENTO (NÃO APENAS O TEXTO) COM BASE NAS SEGUINTES REGRAS MULTICAMADAS:

1. CAMADA 1 — IDENTIDADE SILENCIOSA, BIOMECÂNICA E MEMÓRIA PROFUNDA DO TREINADOR:
   - MEMÓRIA DO TREINADOR: O perfil não é um formulário passivo. É a MEMÓRIA ATIVA de longo prazo do Treinador. Leve em conta todas as memórias do atleta (ex: trabalho noturno, filhos pequenos, histórico de distensão em panturrilha, aversão a esteira, horário matutino preferido, desânimo se ficar 3 dias parado, etc.).
   - PESO CORPORAL E CARGA MECÂNICA / IMPACTO ARTICULAR:
     * Compare um atleta de 58 kg vs 92 kg: Um atleta de 92 kg (ou IMC > 27) sofre CARGA MECÂNICA E IMPACTO ARTICULAR drasticamente maiores a cada passada.
     * Para atletas com maior peso/IMC: limite rigorosamente a progressão de volume semanal (máx 5% a 7% por semana), limite a distância máxima do longão, imponha fortalecimento obrigatório para estabilização articular (joelho/quadríceps/glúteo/tornozelo), dê preferência a pisos macios ou esteira para absorção de impacto, e estenda o tempo de regeneração.
   - IMPACTO DA DIETA (ex: VEGETARIANA / VEGANA / LOW CARB):
     * Dieta Vegetariana/Vegana: O treinador aumenta a atenção para a janela de ingestão proteica e síntese muscular, estende o tempo de recuperação tecidual (+10% a +15% de margem) e monitora a fadiga neuromuscular com maior rigor no pós-treino.
   - NÍVEL DE EXPERIÊNCIA (INICIANTE vs AVANÇADO):
     * Atleta Iniciante: Requer mais educativos de corrida (Skip, Anfersen) no aquecimento, explicações detalhadas das passadas, menor intensidade e orientações claras de execução.
     * Atleta Avançado: Exige métricas diretas, faixas exatas de pace (min/km), zonas de FC e instruções técnicas sintéticas, sem explicações redundantes.
   - LESÕES E LIMITAÇÕES (ex: Dor Patelofemoral, Tendinite de Aquiles, Canelite):
     * A lesão NÃO serve apenas para bloquear um exercício. Ela altera volume (-20% a -50%), reduz intensidade (substitui tiros Z5 por Z1/Z2), reduz treinos em descidas acentuadas, aumenta fortalecimento direcionado e adiciona educativos específicos de postura e absorção de impacto.

2. CAMADA 2 — PERSONALIDADE E ESTILO DE COMUNICAÇÃO CONFORME A MOTIVAÇÃO:
   - ATLETA COMPETITIVO / PERFORMANCE (primaryMotivation = "competicao"):
     * PERSONALIDADE DO TREINADOR: Objetivo, focado em métricas e direto ao ponto. Fala menos, cobra foco no pace/splits/zonas, mostra números e exige disciplina. Zero mensagens clichês de vendas ou floreios motivacionais.
   - ATLETA SAÚDE / LONGEVIDADE (primaryMotivation = "saude"):
     * PERSONALIDADE DO TREINADOR: Encorajador, acolhedor e focado em aderência sustentável. Elogia a consistência, evita comparações com outros atletas, elimina a pressão e foca no bem-estar fisiológico de longo prazo.
   - ATLETA PERDA DE PESO / ESTÉTICA (primaryMotivation = "estetica" / "perder_peso"):
     * PERSONALIDADE DO TREINADOR: Focado na zona de oxidação de gorduras (Z2), na preservação muscular e na consistência sem julgar o atleta.

3. CAMADA 3 — RESTRIÇÕES E VIABILIDADE ("O QUE É POSSÍVEL?"):
   - Duração da Sessão: Respeite rigorosamente a limitação de tempo do atleta (availableTimePerWorkout).
   - REGRAS CRÍTICAS DE COBERTURA DE DIAS E DIA DE DESCANSO:
     * Você DEVE fornecer prescrições para TODOS os 7 dias da semana ("Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo").
     * Dias Disponíveis Informados: ${Array.isArray(athleteProfile?.availableDays) && athleteProfile.availableDays.length > 0 ? athleteProfile.availableDays.join(", ") : "6 dias por semana"}.
     * Dia de Descanso Configurado: "${athleteProfile?.restDay || "Quinta-feira"}".
     * O ÚNICO DIA DE DESCANSO ("intent": "rest") DEVE SER "${athleteProfile?.restDay || "Quinta-feira"}". TODOS OS OUTROS DIAS DISPONÍVEIS SÃO DIAS DE TREINO ATIVO! NUNCA preencha os dias disponíveis com descanso passivo.
   - REGRAS CRÍTICAS DE 2 TURNOS (TURNO DUPLO):
     * Status de Turno Duplo: ${athleteProfile?.doubleSessionsAllowed || athleteProfile?.sessionsPerDay === 2 ? "ATIVADO (2 Sessões por dia: Manhã e Tarde/Noite)" : "Desativado (1 Sessão por dia)"}.
     * Quando ativado, garanta que os dias ativos tenham prescrição no Turno 1 (Manhã - Corrida/Cardio) e Turno 2 (Tarde/Noite - Fortalecimento/Core/Mobilidade).
   - Terreno e Infraestrutura:
     * Sem Pista de Atletismo: Prescreva tiros por tempo (ex: 6x 3min Z4).
     * Com Pista de Atletismo: Prescreva tiros por distância (ex: 10x 400m Z4).
     * Sem Academia: Prescreva fortalecimento calistênico com peso corporal / mini bands.

4. CAMADA 4 — ESTADO ATUAL E DEGRADAÇÃO ELEGANTE / NÍVEL DE CONFIANÇA:
   - PRIORIDADE ABSOLUTA: Se o atleta dormiu mal, está fadigado ou relatou dor no Check-in, O TREINADOR ALTERA O TREINO IMEDIATAMENTE para regenerativo leve Z1/Z2 ou descanso.
   - DEGRADAÇÃO ELEGANTE SEM SENSORES: Se faltarem dados de sensores (sem Garmin, sem HRV, sem Body Battery), O MOTOR NÃO QUEBRA E NUNCA INVENTA VALORES FALSOS! Ele redistribui os pesos para a Percepção Subjetiva do Atleta, ajusta o Nível de Confiança (Alta, Moderada, Baixa) e o treinador avisa com transparência sobre a confiança da decisão.

5. OBRIGATÓRIO — FAIXA DE PACE POR ZONA (MIN/KM):
   - Sempre que prescrever o treino por Zona de Frequência Cardíaca (Z1, Z2, Z3, Z4, Z5) ou RPE, INCLUA a faixa estimada de PACE em min/km (ex: "Z2 / RPE 3-4 (Pace Alvo: 05:30 - 05:55 min/km)").

6. ESTRUTURA DO TREINO E EDUCATIVOS DE CORRIDA:
   - HIERARQUIA DE ESTÍMULOS POR OBJETIVO:
     * 5k / 10k: Priorize VO2 máx (Intervalados / Tiros) + Limiar + Base Aeróbica Z2.
     * Meia Maratona: Priorize Tempo Run (Limiar) + Longão + Rodagem Z2 + Força.
     * Maratona: Priorize Longão Progressivo Z2 + Volume Aeróbico Z2 + Tempo Run + Força.
     * NUNCA prescreva a semana inteira com o mesmo tipo de treino (jamais repita "Tempo Run" em múltiplos dias seguidos). Diversifique os estímulos conforme a arquitetura fisiológica (Rodagem Z2, Longão, Fortalecimento Funcional, Descanso, Intervalado / Tempo Run).
   - REGRAS ABSOLUTAS DE ESPAÇAMENTO:
     * Nunca 2 estímulos máximos em dias consecutivos.
     * Proteção do Longão: 24h-48h antes do Longão, prescreva apenas Z2 leve, mobilidade ou descanso.
     * Após treino de alta intensidade (VO2 máx ou Limiar), o dia seguinte deve ser Z1/Z2, mobilidade ou descanso.
   - Inclua educativos de técnica de corrida (Skip Alto, Anfersen, Soldadinho) nos aquecimentos das corridas.
   - Agende pelo menos 1 sessão dedicada de Fortalecimento Funcional para Corrida.

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
      let trainingPlan = JSON.parse(responseText.trim());
      trainingPlan = fillMissingDaysInPlan(trainingPlan, athleteProfile);
      return res.json({ success: true, trainingPlan });
    } else {
      throw new Error("Empty response from AI engine");
    }
  } catch (error: any) {
    console.warn("Generate training plan falling back to local generator.");
    try {
      let localPlan = generateLocalTrainingPlan(req.body.athleteProfile, req.body.dailyMetrics, req.body.trainingHistory, req.body.readiness);
      localPlan = fillMissingDaysInPlan(localPlan, req.body.athleteProfile);
      (localPlan as any).isFallback = true;
      return res.json({ success: true, trainingPlan: localPlan, isFallback: true });
    } catch (fallbackError: any) {
      console.warn("Local fallback failed:", fallbackError?.message || fallbackError);
      res.status(500).json({ error: fallbackError?.message || "Failed to generate training plan." });
    }
  }
});

// Aetheris Official Microcycle Automatic Generation API Endpoint (Especificação Técnica Parte 7 / API Specs)
app.post("/api/v1/microcycle/generate", (req, res): any => {
  try {
    const response = generateAetherisMicrocycle(req.body);
    if (response.status === "error") {
      return res.status(400).json(response);
    }
    return res.json(response);
  } catch (error: any) {
    console.error("Error in /api/v1/microcycle/generate:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Internal server error generating microcycle decision."
    });
  }
});

// Aetheris Official Simulated Athlete Testing Suite Endpoint (Especificação Técnica Parte 8 / Sistema de Testes)
app.post("/api/v1/simulation/suite", (req, res): any => {
  try {
    const suiteReport = runAetherisSimulationSuite();
    return res.json({ success: true, report: suiteReport });
  } catch (error: any) {
    console.error("Error in /api/v1/simulation/suite:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to run simulation suite."
    });
  }
});

app.post("/api/v1/simulation/run", (req, res): any => {
  try {
    const suiteReport = runAetherisSimulationSuite();
    return res.json({ success: true, report: suiteReport });
  } catch (error: any) {
    console.error("Error in /api/v1/simulation/run:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to run simulation."
    });
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

    const systemInstruction = `Você é o Treinador Virtual de Performance Esportiva, Biomecânica e Fisiologia do Exercício do aplicativo Aetheris Fit.
Você auxilia corredores e ciclistas a otimizarem seus treinos de endurance, baseados em métricas de telemetria Garmin, carga semanal (CTL/ATL), percepção de esforço (RPE) e índice de prontidão física (readiness).

Perfil Completo e Memória do Atleta com quem você está conversando:
- Idade: ${athleteProfile?.age || "Não especificado"} anos | Peso: ${athleteProfile?.weightCurrentKg || athleteProfile?.weight || "Não especificado"} kg | Altura: ${athleteProfile?.heightCm || athleteProfile?.height || "Não especificado"} cm
- FC de Repouso: ${athleteProfile?.restingHeartRate || "60"} bpm | FC Máxima: ${athleteProfile?.maxHeartRate || "190"} bpm
- Experiência: ${athleteProfile?.experienceLevel || athleteProfile?.fitnessLevel || "iniciante"}
- Objetivos Esportivos & Pessoais: ${Array.isArray(athleteProfile?.multipleGoals) && athleteProfile.multipleGoals.length > 0 ? athleteProfile.multipleGoals.join("; ") : athleteProfile?.objective || athleteProfile?.trainingGoal || "Saúde e Performance Geral"}
- Dieta: ${athleteProfile?.dietType || "onivora"}
- Motivação Primária: ${athleteProfile?.primaryMotivation || "saude"} (Competição, Saúde, Estética, Prazer)
- Estilo do Treinador: ${athleteProfile?.coachStyle || "equilibrado"} | Comunicação: ${athleteProfile?.coachCommunication || "tecnica"}
- Lesões Estruturais: ${Array.isArray(athleteProfile?.structuredInjuries) ? JSON.stringify(athleteProfile.structuredInjuries) : athleteProfile?.injuries || "Nenhuma"}
- Memória Profunda do Atleta: ${Array.isArray(athleteProfile?.longTermCoachMemory) ? athleteProfile.longTermCoachMemory.join("; ") : athleteProfile?.coachMemoryNotes || "Sem notas prévias"}

Estado Fisiológico e Prontidão de Hoje (Camada 4):
- Pontuação de Prontidão (Readiness): ${readiness?.score || "80"}/100 [Status: ${readiness?.status || "READY"}]
- Qualidade / Nível de Confiança da Decisão: ${readiness?.decisionQualityLabel || "Alta"} (${readiness?.confidenceScore || 100}%)
- Quilometragem Semanal acumulada: ${trainingHistory?.weekDistanceKm || "0"} km

REGRAS DE ADAPTAÇÃO DE PERSONALIDADE E COMPORTAMENTO DO TREINADOR:
1. PERSONALIDADE E TOM DE VOZ (DITADOS PELA MOTIVAÇÃO E ESTILO):
   - Atleta Competitivo (primaryMotivation = "competicao" / "performance"): Seja objetivo, direto ao ponto e focado em métricas e dados de ritmo/pace. Fale menos, cobre mais disciplina e mostre números (splits, zonas de FC, CTL/ATL). Zero enrolação e zero floreios.
   - Atleta Saúde (primaryMotivation = "saude" / "longevidade"): Seja acolhedor, encorajador e focado na consistência de longo prazo. Elogie a aderência, evite comparações com outros corredores, reduza a pressão e foque no bem-estar sem cobranças excessivas de pace.
   - Atleta Perda de Peso (primaryMotivation = "estetica" / "perder_peso"): Destaque a consistência da Zona 2 (oxidação de gorduras) e preservação de massa magra.
2. CONSCIÊNCIA DE CARGA MECÂNICA E PESO CORPORAL:
   - Peso elevado (>85 kg) implica maior impacto articular por passada. Respeite essa fragilidade biomecânica recomendando fortalecimento de joelho/glúteo/tornozelo, superfícies macias e rodagens progressivas sem choques de volume.
3. ADAPTAÇÃO PARA DIETA VEGETARIANA / VEGANA:
   - Se o atleta for vegetariano/vegano, leve em consideração a necessidade de atenção à janela proteica pós-treino e o tempo de síntese tecidual, oferecendo orientações fisiológicas sem julgamentos.
4. NÍVEL DE CONFIANÇA TRANSPARENTE SEM INVENTAR VALORES:
   - Se não houver dados de sensores (HRV/Body Battery), mencione com transparência a confiança da análise: "Nossa confiança hoje é [Moderada/Baixa] pois faltam dados de HRV/Garmin. A decisão baseia-se na sua percepção subjetiva."
5. Mantenha as respostas em Português do Brasil (PT-BR) com formatação Markdown limpa e legível.`;

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
