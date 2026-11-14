/**
 * Every helper the Hub serves. Each lives in this repo under apps/<id>. To add one: add an
 * entry here, then add its build to .github/workflows/deploy.yml. The app is served at
 * `<hub>/<id>/`, and keeps its cloud data under `<id>/` in the data repo.
 */
export interface HubApp {
  /** URL segment and data-repo folder. Lowercase, no slashes. */
  id: string;
  name: string;
  tagline: string;
  /** Main file the app writes to the data repo, used for "last backed up". */
  dataFile: string;
  /** Tile accent. */
  color: string;
  /** App-icon fill, an iOS-style top-to-bottom gradient. */
  gradient: [string, string];
  /** Inner SVG markup for a 24x24 stroke icon. */
  icon: string;
}

export const APPS: HubApp[] = [
  {
    id: 'ledger',
    name: 'Ledger',
    tagline: 'Budget, investments and planning',
    dataFile: 'ledger/data.json',
    color: '#34c759',
    gradient: ['#3ddc6b', '#1f9e47'],
    icon: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  },
  {
    id: 'torque',
    name: 'Torque',
    tagline: 'Car maintenance and service history',
    dataFile: 'torque/data.json',
    color: '#ff9f0a',
    gradient: ['#ffb340', '#ff7a00'],
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 12 16.5 7.5"/><path d="M12 3v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 7l1.4-1.4"/>',
  },
  {
    id: 'lift',
    name: 'Lift',
    tagline: 'Gym workouts, records and progress',
    dataFile: 'lift/data.json',
    color: '#ff3b30',
    gradient: ['#ff5e6c', '#d70015'],
    icon: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  },
  {
    id: 'french',
    name: 'French',
    tagline: 'Vocabulary with spaced repetition',
    dataFile: 'french/data.json',
    color: '#3478f6',
    gradient: ['#4f8cff', '#1f4fd8'],
    icon: '<rect x="3" y="5" width="14" height="11" rx="2"/><path d="M7 19h12a2 2 0 0 0 2-2V9"/><path d="M7 12.5 9.5 8l2.5 4.5M8 11h3"/>',
  },
];
