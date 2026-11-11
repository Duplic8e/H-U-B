/**
 * Every helper the Hub serves. To add one: add an entry here, then add its build to
 * .github/workflows/deploy.yml (the same three lines as the others). The app is served at
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
  /** Inner SVG markup for a 24x24 stroke icon. */
  icon: string;
}

export const APPS: HubApp[] = [
  {
    id: 'ledger',
    name: 'Ledger',
    tagline: 'Budget, investments and planning',
    dataFile: 'ledger/data.json',
    color: '#4fbf8b',
    icon: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  },
  {
    id: 'torque',
    name: 'Torque',
    tagline: 'Car maintenance and service history',
    dataFile: 'torque/data.json',
    color: '#f2a03d',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 12 16.5 7.5"/><path d="M12 3v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 7l1.4-1.4"/>',
  },
];
