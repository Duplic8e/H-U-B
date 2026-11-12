import { useEffect, useState } from 'preact/hooks';

export type Tab = 'today' | 'history' | 'progress' | 'routines';
export const TABS: readonly Tab[] = ['today', 'history', 'progress', 'routines'];

export interface Route { name: Tab | 'workout' | 'settings'; id?: string; query: URLSearchParams }

export function parseHash(hash: string): Route {
  const [path = '', q = ''] = hash.replace(/^#\/?/, '').split('?');
  const [name = '', id] = path.split('/');
  const query = new URLSearchParams(q);
  if (name === 'workout' || name === 'settings') return { name, query };
  if ((TABS as readonly string[]).includes(name)) return { name: name as Tab, id: id ? decodeURIComponent(id) : undefined, query };
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

export function go(hash: string) {
  location.hash = hash;
}
