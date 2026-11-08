import { useEffect, useState } from 'react';

/** True below the 900 px breakpoint of the stylesheet. */
export function useNarrow(query = '(max-width: 900px)'): boolean {
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return narrow;
}
