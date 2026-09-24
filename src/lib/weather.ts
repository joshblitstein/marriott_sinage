/** Charlotte, NC — Sheraton Charlotte / Convention Center area */
export const CHARLOTTE_LAT = 35.2271;
export const CHARLOTTE_LON = -80.8431;

export type CharlotteWeather = {
  tempF: number;
  label: string;
  fetchedAt: string;
};

const CACHE_KEY = 'signage_charlotte_weather';
const CACHE_MS = 20 * 60 * 1000;

/** WMO weather interpretation codes → short lobby copy */
function labelForCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Charlotte';
}

/** Prefer air-quality copy when smoke/haze is the story guests notice. */
function labelWithAirQuality(
  weatherLabel: string,
  pm25: number | null,
): string {
  if (pm25 == null || !Number.isFinite(pm25)) return weatherLabel;
  if (pm25 >= 55) return 'Smoke';
  if (pm25 >= 35) return 'Hazy';
  return weatherLabel;
}

function readCache(): CharlotteWeather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CharlotteWeather;
    if (!parsed?.fetchedAt || !Number.isFinite(parsed.tempF)) return null;
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > CACHE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(wx: CharlotteWeather) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(wx));
  } catch {
    /* ignore */
  }
}

async function fetchPm25(): Promise<number | null> {
  try {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.searchParams.set('latitude', String(CHARLOTTE_LAT));
    url.searchParams.set('longitude', String(CHARLOTTE_LON));
    url.searchParams.set('current', 'pm2_5');
    url.searchParams.set('timezone', 'America/New_York');
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { pm2_5?: number };
    };
    const pm = data.current?.pm2_5;
    return Number.isFinite(pm) ? (pm as number) : null;
  } catch {
    return null;
  }
}

export async function fetchCharlotteWeather(): Promise<CharlotteWeather> {
  const cached = readCache();
  if (cached) return cached;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(CHARLOTTE_LAT));
  url.searchParams.set('longitude', String(CHARLOTTE_LON));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('timezone', 'America/New_York');

  const [res, pm25] = await Promise.all([fetch(url.toString()), fetchPm25()]);
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  const data = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const temp = data.current?.temperature_2m;
  const code = data.current?.weather_code ?? 0;
  if (!Number.isFinite(temp)) throw new Error('Weather missing temp');

  const wx: CharlotteWeather = {
    tempF: Math.round(temp as number),
    label: labelWithAirQuality(labelForCode(code), pm25),
    fetchedAt: new Date().toISOString(),
  };
  writeCache(wx);
  return wx;
}

export function formatWeatherLine(wx: CharlotteWeather | null): string | null {
  if (!wx) return null;
  return `${wx.tempF}° · ${wx.label}`;
}
