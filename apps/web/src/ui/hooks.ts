import { useEffect, useState } from 'react';
import { useGame } from '../game/store';

/** Server (or debug-shifted) time in seconds, ticking every second. */
export function useNow(): number {
  const backend = useGame((s) => s.backend);
  const [now, setNow] = useState(() => backend.now());
  useEffect(() => {
    const id = setInterval(() => setNow(backend.now()), 1000);
    return () => clearInterval(id);
  }, [backend]);
  return now;
}
