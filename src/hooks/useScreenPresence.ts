import { useEffect } from 'react';
import {
  beaconScreenOffline,
  PRESENCE_HEARTBEAT_MS,
  setScreenPresence,
  type PresenceDocPath,
} from '../lib/screenPresence';

/**
 * Marks a display document online while this tab has the URL open,
 * and offline when the tab closes or the route unmounts.
 */
export function useScreenPresence(
  path: PresenceDocPath | null,
  extra?: Record<string, unknown>,
) {
  const pathKey = path ? `${path[0]}/${path[1]}` : '';
  const extraKey = extra ? JSON.stringify(extra) : '';

  useEffect(() => {
    if (!path) return;

    let closed = false;
    const goOnline = () => {
      if (closed) return;
      void setScreenPresence(path, true, extra);
    };
    const goOffline = () => {
      if (closed) return;
      closed = true;
      beaconScreenOffline(path, extra);
      void setScreenPresence(path, false, extra).catch(() => {
        /* unload race */
      });
    };

    goOnline();
    const heartbeat = window.setInterval(goOnline, PRESENCE_HEARTBEAT_MS);

    const onPageHide = () => goOffline();
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      goOffline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathKey/extraKey stabilize identity
  }, [pathKey, extraKey]);
}
