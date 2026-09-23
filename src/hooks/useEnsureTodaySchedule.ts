import { useEffect } from 'react';
import { db } from '../lib/firebase';
import { ensureTodayDisplays } from '../lib/schedule';
import { dateKeyInHotelTz } from '../lib/time';

/**
 * Keeps embedded room schedules on hotel-today.
 * Runs on mount and again when the America/New_York calendar day rolls over.
 */
export function useEnsureTodaySchedule(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      void ensureTodayDisplays(db).catch(() => {
        /* offline / rules — displays keep last known day until retry */
      });
    };

    run();

    let lastKey = dateKeyInHotelTz();
    const timer = window.setInterval(() => {
      const key = dateKeyInHotelTz();
      if (key !== lastKey) {
        lastKey = key;
        run();
      }
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);
}
