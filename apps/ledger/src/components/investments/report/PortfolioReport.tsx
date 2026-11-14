import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { usePortfolioReportStore } from '../../../store/usePortfolioReportStore'
import { ReportSummary } from './ReportSummary'
import { ReportAllocations } from './ReportAllocations'
import { ReportPerformance } from './ReportPerformance'
import { ReportContributors } from './ReportContributors'
import { ReportIncome } from './ReportIncome'
import { ReportFees } from './ReportFees'

export const PortfolioReport: React.FC = () => {
  const report = usePortfolioReportStore((s) => s.report)
  const uploadedAt = usePortfolioReportStore((s) => s.uploadedAt)
  const clearReport = usePortfolioReportStore((s) => s.clearReport)
  const [open, setOpen] = useState(false)
  if (!report) return null

  return (
    <div className="themed-card rounded-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-left min-w-0">
          {open ? <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-secondary shrink-0" />}
          <h2 className="text-[16px] font-semibold text-text-primary truncate">
            PortfolioAnalyst Report <span className="text-text-secondary font-normal text-[13px]">{report.period}</span>
          </h2>
        </button>
        <button onClick={clearReport} className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-error transition-colors shrink-0">
          <Trash2 className="w-3.5 h-3.5" /> Clear report
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-4">
          <ReportSummary report={report} />
          <ReportPerformance report={report} />
          <ReportAllocations report={report} />
          <ReportContributors report={report} />
          <ReportIncome report={report} />
          <ReportFees report={report} />
          <p className="text-[12px] text-text-secondary">
            Report uploaded {uploadedAt ? new Date(uploadedAt).toLocaleString() : ''} · base currency {report.baseCurrency}
          </p>
        </div>
      )}
    </div>
  )
}
