import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { parseCSV, type UnrecognizedCSVResult } from '../../utils/csvParser';
import { guessCategory } from '../../utils/autoCategorize';
import { chaseCategoryId } from '../../utils/budget/chaseCategoryMap';
import { ImportSourceSheet } from './ImportSourceSheet';
import type { ImportReport } from '../../types/importHistory';
import { useTriageStore } from '../../store/useTriageStore';
import { useBudgetStore } from '../../store/useBudgetStore';
import { v4 as uuidv4 } from 'uuid';
import type { TriageTransaction } from '../../types/triage';
import { ThemedSelect } from '../ui/ThemedSelect';
import { Sheet } from '../ui/Sheet';
import { useIsDesktop } from '../../hooks/useMediaQuery';

export const CSVUploader: React.FC = () => {
  const isDesktop = useIsDesktop();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [mappingData, setMappingData] = useState<UnrecognizedCSVResult | null>(null);
  const [mapDate, setMapDate] = useState<string>('');
  const [mapAmount, setMapAmount] = useState<string>('');
  const [mapDesc, setMapDesc] = useState<string>('');
  const [sourceRows, setSourceRows] = useState<TriageTransaction[] | null>(null);
  const [reservedBindings, setReservedBindings] = useState<Record<string, string>>({});
  const remainingGroups = useRef<TriageTransaction[][]>([]);
  const sourcePlans = useRef<Array<{ rows: TriageTransaction[]; sourceId?: string; name?: string }>>([]);

  const categoryRules = useTriageStore((state) => state.categoryRules);
  const categories = useBudgetStore((state) => state.categories);
  const categoryGroups = useBudgetStore((state) => state.categoryGroups);

  const routeGroups = (groups: TriageTransaction[][]) => {
    const store = useTriageStore.getState();
    for (const [index, group] of groups.entries()) {
      const bank = group[0].bankSource;
      const source = bank && Object.values(store.importSources).find(s => s.bankKey === bank.key);
      if (!bank || (!source && Object.values(store.importSources).some(s => !s.bankKey))) {
        remainingGroups.current = groups.slice(index + 1);
        setReservedBindings(Object.fromEntries(sourcePlans.current.filter(plan => plan.sourceId && plan.rows[0].bankSource)
          .map(plan => [plan.sourceId!, plan.rows[0].bankSource!.key])));
        setSourceRows(group);
        return;
      }
      sourcePlans.current.push({ rows: group, sourceId: source ? source.id : undefined, name: bank.name });
    }
    // Check the complete selection before binding sources or importing rows.
    const bindings = new Map<string, string>();
    for (const plan of sourcePlans.current) {
      if (!plan.sourceId) continue;
      const source = store.importSources[plan.sourceId];
      const bankKey = plan.rows[0].bankSource?.key;
      if (!source) throw new Error('Choose an available card or account');
      const binding = bindings.get(source.id) ?? source.bankKey;
      if (bankKey && binding && binding !== bankKey) throw new Error('Each card needs its own import source');
      if (bankKey) bindings.set(source.id, bankKey);
    }
    const report: ImportReport = { addedIds: [], skippedIds: [], excludedIds: [], changedDays: [] };
    for (const plan of sourcePlans.current) {
      const bank = plan.rows[0].bankSource;
      const sourceId = plan.sourceId ?? store.createImportSource(plan.name!, bank?.key);
      if (bank && plan.sourceId) store.bindImportSource(sourceId, bank.key);
      const result = store.importTransactions(plan.rows, sourceId);
      report.addedIds.push(...result.addedIds);
      report.skippedIds.push(...result.skippedIds);
      report.excludedIds!.push(...(result.excludedIds ?? []));
      report.changedDays.push(...result.changedDays);
    }
    useTriageStore.setState({ lastImport: report });
    sourcePlans.current = [];
    remainingGroups.current = [];
    setSourceRows(null);
  };

  const handleTransactions = (transactions: TriageTransaction[]) => {
    // Auto-categorize
    const categorized = transactions.map(tx => {
      // The user's own learned rules are deliberate, so they win. Chase's own
      // category column is consulted only where no rule matched.
      const compatible = (id: string | undefined) => {
        const category = id ? categories[id] : undefined;
        return category && categoryGroups[category.groupId]?.kind === tx.type ? id : undefined;
      };
      const categoryId =
        compatible(guessCategory(tx.description, categories, categoryRules)) ??
        compatible(chaseCategoryId(tx.originalRowData?.['Category'], categories));
      return {
        ...tx,
        categoryId
      };
    });
    if (!categorized.length) return;
    sourcePlans.current = [];
    const groups = new Map<string, TriageTransaction[]>();
    for (const tx of categorized) {
      const key = tx.bankSource?.key ?? 'manual';
      groups.set(key, [...(groups.get(key) ?? []), tx]);
    }
    routeGroups([...groups.values()]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError(null);

    try {
      const result = await parseCSV(file);
      
      if ('unrecognized' in result && result.unrecognized) {
        setMappingData(result as UnrecognizedCSVResult);
      } else {
        handleTransactions(result as TriageTransaction[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleMappingSubmit = () => {
    if (!mappingData || !mapDate || !mapAmount || !mapDesc) return;
    
    const transactions: TriageTransaction[] = [];
    
    mappingData.rows.forEach(row => {
      const getVal = (header: string) => {
        const idx = mappingData.headers.indexOf(header);
        return Array.isArray(row) ? row[idx] : row[header];
      };

      const dateRaw = getVal(mapDate);
      const amountRawStr = getVal(mapAmount);
      const descRaw = getVal(mapDesc);

      if (!dateRaw || !amountRawStr) return;

      const amountRaw = parseFloat(String(amountRawStr).replace(/[^0-9.-]+/g,""));
      if (isNaN(amountRaw)) return;
      
      const type = amountRaw >= 0 ? 'income' : 'expense';
      const amount = Math.abs(amountRaw);
      
      let date = String(dateRaw);
      if (date && date.includes('/')) {
        const parts = date.split('/');
        if (parts.length === 3) {
          const [m, d, y] = parts;
          date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }

      transactions.push({
        id: uuidv4(),
        date,
        amount,
        description: String(descRaw || '').trim(),
        type,
        originalRowData: Array.isArray(row) ? Object.fromEntries(row.map((val, i) => [String(i), val])) : row
      });
    });

    handleTransactions(transactions);
    setMappingData(null);
    setMapDate('');
    setMapAmount('');
    setMapDesc('');
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept=".csv"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />
      {isDesktop ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isParsing}
          aria-label="Import CSV"
          className="flex items-center justify-center gap-2 h-10 px-4 bg-[var(--color-bg-secondary)] border control-border rounded-md text-[14px] font-medium hover:border-[var(--color-accent)] transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          <span className="hidden sm:inline">{isParsing ? 'Parsing...' : 'Import CSV'}</span>
        </button>
      ) : (
        // A bare icon with a 44px hit area: the phone controls row is chrome,
        // so the button carries no border or label.
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isParsing}
          aria-label="Import CSV"
          title="Import CSV"
          className="h-11 w-11 flex items-center justify-center rounded-md text-text-secondary hover:text-accent transition-colors disabled:opacity-50"
        >
          <Upload size={20} />
        </button>
      )}
      {error && <span className="text-[12px] text-error text-center">{error}</span>}
      {sourceRows && <ImportSourceSheet key={sourceRows[0].id} bankSource={sourceRows[0].bankSource}
      reservedBindings={reservedBindings} onClose={() => {
        setSourceRows(null); sourcePlans.current = []; remainingGroups.current = [];
      }} onImport={choice => {
        sourcePlans.current.push({ rows: sourceRows, ...choice });
        try { routeGroups(remainingGroups.current); }
        catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to import transactions');
          setSourceRows(null); sourcePlans.current = []; remainingGroups.current = [];
        }
      }} />}

      <Sheet
        open={!!mappingData}
        onClose={() => setMappingData(null)}
        desktop="modal"
        ariaLabel="Map CSV Columns"
        title="Map CSV Columns"
        panelClassName="bg-[var(--color-bg-primary)] desktop:p-6 desktop:rounded-lg w-full desktop:w-[400px] border border-[var(--color-border)] shadow-xl"
        contentClassName="flex flex-col gap-4"
      >
        {mappingData && (
          <>
            <div className="hidden desktop:flex justify-between items-center">
              <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Map CSV Columns</h2>
              <button onClick={() => setMappingData(null)} aria-label="Close" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"><X size={20} /></button>
            </div>
            <p className="text-[14px] text-[var(--color-text-secondary)]">We couldn't recognize this CSV format. Please select the correct columns.</p>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[var(--color-text-primary)]">Date Column</label>
                <ThemedSelect
                  value={mapDate}
                  onChange={setMapDate}
                  options={[{ value: '', label: 'Select...' }, ...mappingData.headers.map(h => ({ value: h, label: h }))]}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[var(--color-text-primary)]">Amount Column</label>
                <ThemedSelect
                  value={mapAmount}
                  onChange={setMapAmount}
                  options={[{ value: '', label: 'Select...' }, ...mappingData.headers.map(h => ({ value: h, label: h }))]}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[var(--color-text-primary)]">Description Column</label>
                <ThemedSelect
                  value={mapDesc}
                  onChange={setMapDesc}
                  options={[{ value: '', label: 'Select...' }, ...mappingData.headers.map(h => ({ value: h, label: h }))]}
                />
              </div>
            </div>

            <button 
              onClick={handleMappingSubmit}
              disabled={!mapDate || !mapAmount || !mapDesc}
              className="mt-2 w-full py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md font-medium disabled:opacity-50 transition-opacity"
            >
              Import Transactions
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
};
