export interface ActivitySummary {
  distanceKm: number;
  durationSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  ascentMeters: number | null;
  descentMeters: number | null;
  avgPower: number | null;
  maxPower: number | null;
  avgCadence: number | null;
}

export interface TelemetryRecord {
  id: number;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  distance: number | null;
  altitude: number | null;
  speed: number | null;
  heartRate: number | null;
  cadence: number | null;
  power: number | null;
  temperature: number | null;
}

export interface AiAnalysis {
  title: string;
  summary: string;
  coachingInsights: string;
  suggestedRecovery: string;
  trainingEffect: string;
}

export interface ActivityData {
  id: string; // Unique ID (e.g. hash or filename + timestamp)
  filename: string;
  sport: string;
  startTime: string;
  summary: ActivitySummary;
  gpsPath: [number, number][];
  records: TelemetryRecord[];
  aiAnalysis: AiAnalysis;
  aiEnabled: boolean;
  uploadedAt: string;
}

export interface SavedActivityListItem {
  id: string;
  filename: string;
  sport: string;
  startTime: string;
  distanceKm: number;
  durationSeconds: number;
  title: string;
  uploadedAt: string;
}
