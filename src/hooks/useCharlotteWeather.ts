import { useEffect, useState } from 'react';
import {
  fetchCharlotteWeather,
  type CharlotteWeather,
} from '../lib/weather';

/** Live Charlotte weather for lobby directory (cached ~20 min). */
export function useCharlotteWeather(enabled = true) {
  const [weather, setWeather] = useState<CharlotteWeather | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      try {
        const wx = await fetchCharlotteWeather();
        if (!cancelled) setWeather(wx);
      } catch {
        /* keep last good / null */
      }
    }

    void load();
    const t = setInterval(() => void load(), 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [enabled]);

  return weather;
}
