import { useEffect, useState } from 'react';

const Q = '(max-width: 899px)';

export function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(Q).matches);

  useEffect(() => {
    const mq = window.matchMedia(Q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return m;
}
