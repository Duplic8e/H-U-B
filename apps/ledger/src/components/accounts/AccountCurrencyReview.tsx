import { lazy, Suspense, useState } from 'react'
import { useAccountsStore } from '../../store/useAccountsStore'

const AccountCurrencyReviewSheet = lazy(() =>
  import('./AccountCurrencyReviewSheet').then((module) => ({ default: module.AccountCurrencyReviewSheet }))
)

export function AccountCurrencyReview(): React.ReactNode {
  const pendingIds = useAccountsStore((state) => state.pendingCurrencyReviewIds)
  const [open, setOpen] = useState(false)
  const [openedBefore, setOpenedBefore] = useState(false)
  if (!pendingIds.length) return null
  return <>
    <section aria-label="Account currency review" className="mb-4 rounded-xl border border-border bg-bg-primary p-4">
      <p className="text-[14px] text-text-primary">Review your account currencies. Until confirmed, totals assume CAD for unreviewed accounts.</p>
      <button type="button" onClick={() => { setOpenedBefore(true); setOpen(true) }} className="mt-2 rounded-md border control-border px-3 py-2 text-[13px] text-text-primary">Review Account Currencies</button>
    </section>
    {openedBefore && <Suspense fallback={null}>
      <AccountCurrencyReviewSheet open={open} onClose={() => setOpen(false)} />
    </Suspense>}
  </>
}
