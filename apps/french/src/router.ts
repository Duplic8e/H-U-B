import { useEffect, useState } from 'preact/hooks';

export type Tab = 'today' | 'words' | 'add';
export const TABS: readonly Tab[] = ['today', 'words', 'add'];
export interface Route { name: Tab | 'study' | 'settings'; query: URLSearchParams }

export function parseHash(hash: string): Route {
  const [path = '', q = ''] = hash.replace(/^#\/?/, '').split('?');
  const name = path.split('/')[0] ?? '';
  const query = new URLSearchParams(q);
  if (name === 'study' || name === 'settings' || (TABS as readonly string[]).includes(name)) return { name: name as Route['name'], query };
  return { name: 'today', query };
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
export const go = (hash: string) => { location.hash = hash; };
