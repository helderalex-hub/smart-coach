import { ActivityData } from "./types";

export function getDemoActivity(): ActivityData {
  // Generate a realistic 150-point running track in San Francisco (around Presidio & Golden Gate Bridge)
  const startLat = 37.8012;
  const startLng = -122.4682;
  const numPoints = 150;
  const records = [];
  const gpsPath: [number, number][] = [];

  const baseTime = new Date();
  baseTime.setHours(18, 30, 0, 0); // 6:30 PM (Sunset run)

  let currentLat = startLat;
  let currentLng = startLng;
  let currentAlt = 25; // 25m starting altitude
  let currentDistance = 0;

  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(baseTime.getTime() + i * 12000).toISOString(); // 12 seconds per record (30 mins total)
    
    // Create a path loops towards the bridge and climbs a hill
    const angle = (i / numPoints) * Math.PI * 1.5;
    currentLat += 0.00012 * Math.sin(angle) + 0.00003;
    currentLng -= 0.00015 * Math.cos(angle) - 0.00004;

    // Gradual hill climb in the middle, then descent
    if (i < 90) {
      currentAlt += 0.8 + 0.3 * Math.sin(i / 10);
    } else {
      currentAlt -= 0.6 + 0.2 * Math.sin(i / 10);
    }

    // Accumulate distance (approx 3.2m per second @ ~11.5 km/h)
    const speedMps = 3.1 + 0.4 * Math.sin(i / 15) + (i > 80 ? -0.5 : 0.2); // Slows down on steep climb
    currentDistance += speedMps * 12;

    // Heart rate responds to climb and effort
    let hr = 135 + Math.round(15 * Math.sin(i / 20));
    if (i > 40 && i < 100) {
      hr += Math.round((currentAlt - 25) / 3); // Heart rate spikes with altitude gain
    }
    hr = Math.min(182, Math.max(120, hr));

    // Running cadence (steps per minute)
    const cadence = 172 + Math.round(4 * Math.sin(i / 10)) + (speedMps < 2.8 ? -4 : 0);

    // Temperature (cool SF evening)
    const temp = 14 - (i / 150) * 2; // drops to 12 degrees as sun sets

    gpsPath.push([currentLat, currentLng]);

    records.push({
      id: i,
      timestamp,
      lat: currentLat,
      lng: currentLng,
      distance: Math.round(currentDistance),
      altitude: Math.round(currentAlt * 10) / 10,
      speed: Math.round(speedMps * 3.6 * 10) / 10, // km/h
      heartRate: hr,
      cadence,
      power: null, // Runners usually don't have power unless using Stripe/special pods
      temperature: Math.round(temp * 10) / 10,
    });
  }

  return {
    id: "demo-golden-gate-trail",
    filename: "demo_sunset_trail_run.fit",
    sport: "running",
    startTime: baseTime.toISOString(),
    summary: {
      distanceKm: Number((currentDistance / 1000).toFixed(2)),
      durationSeconds: numPoints * 12,
      avgSpeedKmh: 11.2,
      maxSpeedKmh: 13.8,
      avgHeartRate: 154,
      maxHeartRate: 178,
      calories: 420,
      ascentMeters: 84,
      descentMeters: 45,
      avgPower: null,
      maxPower: null,
      avgCadence: 174,
    },
    gpsPath,
    records,
    aiAnalysis: {
      title: "Subida Aeróbica no Golden Gate ao Pôr do Sol",
      summary: "Um treino de corrida excepcional e altamente controlado ao pôr do sol, demonstrando forte capacidade aeróbica. O ritmo foi moderado com precisão durante a subida contínua de 84 metros de elevação em direção às falésias costeiras.",
      coachingInsights: "• **Ritmo na Subida**: Excelente moderação de ritmo durante a subida (minutos 10 a 18). Sua velocidade caiu ligeiramente, o que evitou que sua frequência cardíaca entrasse na zona vermelha anaeróbica.\n• **Eficiência Cardiovascular**: Sua frequência cardíaca média de 154 bpm representa um treino sólido em Zona 3, otimizando a densidade mitocondrial e a base aeróbica.\n• **Cadência Consistente**: Você manteve uma cadência de passos consistente de 174 SPM. Para aumentar a eficiência da corrida e reduzir o impacto nas articulações, tente buscar uma cadência de 178-180 SPM, dando passadas ligeiramente mais curtas e rápidas.\n• **Adaptação Térmica**: A queda de temperatura no fim do dia foi perfeitamente tolerada, sem desvio cardiovascular (cardiovascular drift) observado no terço final da sessão.",
      suggestedRecovery: "20 horas. Permita que os tendões dos membros inferiores se recuperem do esforço da subida antes da sua próxima sessão de tiros de alta intensidade.",
      trainingEffect: "Construção de Base Aeróbica",
    },
    aiEnabled: true,
    uploadedAt: new Date().toISOString(),
  };
}
