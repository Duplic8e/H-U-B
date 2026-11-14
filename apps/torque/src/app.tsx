import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { useSyncExternalStore } from 'preact/compat';
import { AppDataContext, UiContext, type AppData, type SheetState, type Toast as ToastData, type UiApi } from './core/context';
import { Fab } from './core/components/Fab';
import { TabBar } from './core/components/TabBar';
import { Toast } from './core/components/Toast';
import { applyBadge } from './core/badge';
import { todayLocal } from './core/dates';
import { useLive } from './core/useLive';
import { getRepo } from './data/repo';
import { getSync } from './sync';
import { HUB_URL, readHubConfig } from './sync/hub';
import { computeDue } from './engine/due';
import { attentionCount } from './engine/health';
import { Costs } from './features/costs/Costs';
import { Dashboard } from './features/dashboard/Dashboard';
import { History } from './features/history/History';
import { Onboarding } from './features/onboarding/Onboarding';
import { Schedule } from './features/schedule/Schedule';
import { Settings } from './features/settings/Settings';
import { VehicleSheet } from './features/sheets/VehicleSheet';
import { AddItemSheet } from './features/sheets/AddItemSheet';
import { ItemSheet } from './features/sheets/ItemSheet';
import { ImportSheet } from './features/sheets/ImportSheet';
import { LogServiceSheet } from './features/sheets/LogServiceSheet';
import { OdometerSheet } from './features/sheets/OdometerSheet';
import { RecordSheet } from './features/sheets/RecordSheet';
import { useRoute, type Route } from './router';

const TITLES: Record<Route, string> = {
  dashboard: 'Torque',
  schedule: 'Schedule',
  history: 'History',
  costs: 'Costs',
  settings: 'Settings',
};

const repo = getRepo();

/** Everything the UI needs, read once and kept live; the due engine runs on render so `today` is never stale. */
async function loadAll() {
  const vehicle = await repo.getVehicle();
  if (!vehicle) return { vehicle: null } as const;
  const [items, records, readings, settings] = await Promise.all([
    repo.listItems(vehicle.id),
    repo.listRecords(vehicle.id),
    repo.listReadings(vehicle.id),
    repo.getSettings(),
  ]);
  return { vehicle, items, records, readings, settings } as const;
}

export function App() {
  const route = useRoute();
  const syncSnap = useSyncExternalStore(getSync().subscribe, getSync().getSnapshot);
  const raw = useLive(loadAll);

  // Each tab opens at its top, not at the previous tab's scroll position.
  useEffect(() => {
    document.querySelector('.app-main')?.scrollTo(0, 0);
  }, [route]);

  // Ask iOS to keep our data under storage pressure; the result is shown in Settings > About.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  // Cloud sync: pull on launch, then again whenever the app returns to the foreground or the network comes back.
  useEffect(() => {
    const sync = getSync();
    void sync.start();
    const detach = sync.attachBrowserListeners();
    return () => {
      detach();
      sync.dispose();
    };
  }, []);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Statuses depend on today's date, so recompute when the day changes while the app sits open or suspended.
  const [day, setDay] = useState(todayLocal());
  useEffect(() => {
    const refresh = () => setDay(todayLocal());
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(timer);
    };
  }, []);

  const ui: UiApi = useMemo(
    () => ({ openSheet: setSheet, closeSheet: () => setSheet(null), showToast: setToast }),
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  const data: AppData | null = useMemo(() => {
    if (!raw || !raw.vehicle) return null;
    const today = day;
    const { vehicle, items, records, readings, settings } = raw;
    return { repo, vehicle, items, records, readings, settings, today, due: computeDue({ today, vehicle, items, records, readings, settings }) };
  }, [raw, day]);

  // Move installs made on the old default schedule to Mazda Canada's, once.
  const vehicleId = raw && raw.vehicle ? raw.vehicle.id : null;
  useEffect(() => {
    if (!vehicleId) return;
    void repo.upgradeSchedule(vehicleId).then((kept) => {
      if (kept === null) return;
      setToast({
        message: kept.length
          ? `Schedule updated to Mazda Canada. Your edits to ${kept.join(', ')} were kept.`
          : 'Schedule updated to Mazda Canada’s maintenance schedule.',
      });
    });
  }, [vehicleId]);

  const badgeEnabled = data?.settings.badgeEnabled ?? false;
  const attention = data ? attentionCount(data.due.items) : 0;
  useEffect(() => {
    if (data) void applyBadge(badgeEnabled, attention);
  }, [data !== null, badgeEnabled, attention]);

  if (!raw) return <div class="splash" aria-busy="true">Torque</div>;
  // A fresh install inside the Hub: hold onboarding until the first pull says whether the cloud has a car already.
  const restoring = !data && readHubConfig() !== null && !syncSnap.state.lastSyncedAt && !syncSnap.state.lastError;
  if (restoring) return <div class="splash" aria-busy="true">Restoring from cloud…</div>;
  if (!data) return <Onboarding repo={repo} />;

  return (
    <AppDataContext.Provider value={data}>
      <UiContext.Provider value={ui}>
        <header class="app-header">
          <h1>{route === 'dashboard' ? data.vehicle.nickname : TITLES[route]}</h1>
          {HUB_URL && (
            <a class="hub-link" href={HUB_URL} aria-label="Back to Hub">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </a>
          )}
        </header>
        <main class="app-main">
          {route === 'dashboard' && <Dashboard />}
          {route === 'schedule' && <Schedule />}
          {route === 'history' && <History />}
          {route === 'costs' && <Costs />}
          {route === 'settings' && <Settings />}
        </main>
        <Fab />
        <TabBar current={route} />
        {sheet?.type === 'odometer' && <OdometerSheet />}
        {sheet?.type === 'log' && <LogServiceSheet key={sheet.editId ?? sheet.duplicateId ?? 'new'} mode={sheet.mode ?? 'service'} presetKeys={sheet.presetKeys ?? []} editId={sheet.editId} duplicateId={sheet.duplicateId} />}
        {sheet?.type === 'record' && <RecordSheet id={sheet.id} />}
        {sheet?.type === 'import' && <ImportSheet file={sheet.file} />}
        {sheet?.type === 'item' && <ItemSheet itemKey={sheet.key} />}
        {sheet?.type === 'addItem' && <AddItemSheet />}
        {sheet?.type === 'vehicle' && <VehicleSheet />}
        {toast && <Toast toast={toast} onDismiss={dismissToast} />}
      </UiContext.Provider>
    </AppDataContext.Provider>
  );
}
