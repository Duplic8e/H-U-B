import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTriageStore } from '../../store/useTriageStore';
import { captureTriageUndo } from '../../utils/budget/triageUndo';
import { Sheet } from '../ui/Sheet';

type Part = 'skipped' | 'excluded';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const decisionLabel = (d: string) => (d === 'ignored' ? 'Ignored' : d === 'pending' ? 'Awaiting review' : d === 'duplicate' ? 'Matched to an existing charge' : 'Accepted');

// Phone version of ImportSummary: one card with a row per outcome. Skipped and
// Excluded open a sheet with the detail, so the card itself stays three lines.
export const ImportSummaryMobile: React.FC<{ onViewExcluded?: () => void }> = ({ onViewExcluded }) => {
  const report = useTriageStore((s) => s.lastImport);
  const records = useTriageStore((s) => s.importRecords);
  const sources = useTriageStore((s) => s.importSources);
  const restore = useTriageStore((s) => s.restoreImportRecord);
  const [limit, setLimit] = useState(50);
  const [sheet, setSheet] = useState<Part | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  if (!report) return null;

  const skipped = report.skippedIds.map((id) => records[id]).filter(Boolean);
  const excludedIds = report.excludedIds ?? [];
  const excluded = excludedIds.map((id) => records[id]).filter(Boolean);
  const review = report.addedIds.filter((id) => !excludedIds.includes(id)).length;
  const changed = report.changedDays;
  const restoreWithUndo = (id: string) => {
    const offer = captureTriageUndo({ pendingIds: [id], recordIds: [id] });
    restore(id);
    offer('Restored 1 transaction to review');
  };
  const closeSheet = () => { setSheet(null); setInfoOpen(false); };

  const item = (record: (typeof skipped)[number], index: number, action?: React.ReactNode) => (
    <li key={`${record.id}:${index}`} className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-t-0">
      <div className="min-w-0 break-words flex-1">
        <p className="text-[14px]">{record.original.description} · ${record.original.amount.toFixed(2)}</p>
        <p className="text-[12px] text-text-secondary">{sources[record.sourceId]?.name} · {record.original.date} · {decisionLabel(record.decision)}</p>
      </div>
      {action}
    </li>
  );

  const line = (n: number, label: string, sub: string, hot?: boolean, part?: Part) => {
    const content = (
      <>
        <span className={`min-w-[44px] h-8 px-2 rounded-full flex items-center justify-center text-[14px] font-semibold tabular-nums ${hot ? 'bg-accent/15 text-accent' : 'bg-bg-primary/60 text-text-primary'}`}>{n}</span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-[14px] font-medium">{label}</span>
          <span className="block text-[12px] text-text-secondary">{sub}</span>
        </span>
        {part && n > 0 && <ChevronRight size={18} className="text-text-secondary shrink-0" aria-hidden="true" />}
      </>
    );
    return part && n > 0
      ? <button key={label} onClick={() => setSheet(part)} className="w-full min-h-[60px] px-3 py-2 flex items-center gap-3">{content}</button>
      : <div key={label} className="w-full min-h-[60px] px-3 py-2 flex items-center gap-3">{content}</div>;
  };

  return (
    <>
      <div data-testid="import-summary-mobile" className="min-w-0 rounded-xl border border-border bg-bg-secondary divide-y divide-border overflow-hidden" role="status" aria-live="polite">
        {(report.autoAddedIds?.length ?? 0) > 0 && line(report.autoAddedIds!.length, 'Filed Automatically', 'Stores you have categorized before')}
        {line(review - (report.autoAddedIds?.length ?? 0), 'To Categorize', 'Open Categorize when you are ready', true)}
        {line(skipped.length, 'Skipped', 'Already handled in an earlier import', false, 'skipped')}
        {line(excludedIds.length, 'Excluded', 'Matched one of your exclusion rules', false, 'excluded')}
      </div>
      <Sheet open={!!sheet} onClose={closeSheet} ariaLabel={sheet === 'excluded' ? 'Excluded' : 'Skipped'}>
        {sheet === 'skipped' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center min-h-8">
              <p className="text-[16px] font-semibold">Skipped ({skipped.length})</p>
              {changed.length > 0 && (
                <button aria-label="What does this mean?" aria-expanded={infoOpen} onClick={() => setInfoOpen(!infoOpen)} className="h-11 w-11 shrink-0 flex items-center justify-center text-accent">
                  <span className="h-[22px] w-[22px] rounded-full border border-accent flex items-center justify-center text-[13px] italic font-bold font-serif">i</span>
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto flex flex-col gap-2">
              {infoOpen && (
                <div className="rounded-lg bg-bg-primary/60 p-3 flex flex-col gap-2 text-[13px] text-text-secondary">
                  {changed.map((day) => (
                    <p key={`${day.sourceId}:${day.date}`}>
                      Your earlier import of {sources[day.sourceId]?.name} included {plural(day.missingCount, 'charge')} dated {day.date} that this file does not have.
                    </p>
                  ))}
                  <p>Banks sometimes drop or change pending charges between downloads. Nothing was deleted from your transactions.</p>
                </div>
              )}
              <ul>
                {skipped.slice(0, limit).map((record, index) => item(record, index, record.decision === 'ignored' && (
                  <button onClick={() => restoreWithUndo(record.id)} className="min-h-11 px-3 shrink-0 text-[13px] text-accent border border-border rounded-lg">Review again</button>
                )))}
              </ul>
              {skipped.length > limit && <button onClick={() => setLimit(limit + 50)} className="min-h-11 text-[13px] text-accent">Show 50 more</button>}
            </div>
          </div>
        )}
        {sheet === 'excluded' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between min-h-8">
              <p className="text-[16px] font-semibold">Excluded ({excludedIds.length})</p>
              {onViewExcluded && (
                <button aria-label="Manage Excluded Imports" onClick={() => { closeSheet(); onViewExcluded(); }} className="min-h-11 pl-3 text-[13px] text-accent flex items-center gap-0.5">
                  Manage <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <ul>{excluded.map((record, index) => item(record, index))}</ul>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
};
