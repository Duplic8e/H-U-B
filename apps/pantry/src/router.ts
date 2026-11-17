import { useEffect, useState } from 'preact/hooks';

export type Route = 'list' | 'settings';

export function parseHash(hash: string): Route {
  return hash.replace(/^#\/?/, '').split(/[/?]/)[0] === 'settings' ? 'settings' : 'list';
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => { setRoute(parseHash(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
