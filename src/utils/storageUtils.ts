/**
 * Utility functions for safe LocalStorage access, handling quota limits,
 * downsampling large payloads, and pruning old cache items gracefully.
 */

export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    console.warn(`localStorage.setItem failed for key "${key}" (${e?.message || e}). Attempting cache cleanup...`);

    // 1. Clean up old fit_activity_data_* keys from localStorage (except active/last viewed)
    try {
      const lastViewedId = localStorage.getItem("fit_last_viewed_id");
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          k.startsWith("fit_activity_data_") &&
          k !== `fit_activity_data_${lastViewedId}` &&
          k !== key
        ) {
          keysToRemove.push(k);
        }
      }

      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // Retry setItem
      localStorage.setItem(key, value);
      return true;
    } catch (e2) {
      // 2. If setting an activity data payload, downsample or strip large raw records for local cache
      if (key.startsWith("fit_activity_data_")) {
        try {
          const parsed = JSON.parse(value);
          if (parsed && Array.isArray(parsed.records) && parsed.records.length > 100) {
            // Downsample records to max 100 sample points for cached view
            const step = Math.ceil(parsed.records.length / 100);
            const downsampled = parsed.records.filter((_: any, idx: number) => idx % step === 0);
            const lightObj = { ...parsed, records: downsampled };
            localStorage.setItem(key, JSON.stringify(lightObj));
            return true;
          }
        } catch (e3) {
          // Ignore JSON parse errors
        }
      }

      // 3. If setting activity list, keep most recent items if payload is huge
      if (key === "fit_activity_list") {
        try {
          const list = JSON.parse(value);
          if (Array.isArray(list) && list.length > 30) {
            const shortened = list.slice(0, 30);
            localStorage.setItem(key, JSON.stringify(shortened));
            return true;
          }
        } catch (e4) {
          // Ignore
        }
      }

      console.warn(`Could not save key "${key}" to localStorage due to quota constraints. Payload remains available in memory/server.`);
      return false;
    }
  }
}

export function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`localStorage.getItem failed for key "${key}"`, e);
    return null;
  }
}

export function safeRemoveLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`localStorage.removeItem failed for key "${key}"`, e);
  }
}
