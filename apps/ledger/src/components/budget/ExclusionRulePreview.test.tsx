import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, it, expect } from 'vitest'
import { ExclusionRulePreview } from './ExclusionRulePreview'
import type { ExclusionPreview } from '../../types/exclusionRules'
afterEach(cleanup)
it('shows movement totals, coverage, identity badges and paginated original rows',()=>{
 const preview:ExclusionPreview={count:21,moneyInCents:5000,moneyOutCents:1000,pendingCount:19,acceptedCount:1,ignoredCount:1,eligiblePendingCount:19,legacyUnavailableCount:2,rows:Array.from({length:21},(_,i)=>({recordId:String(i),sourceId:'a',description:'Bank '+i,date:'2026-06-10',movementCents:50,decision:'pending',identityNeedsReview:i===0,overridden:i===1}))}
 render(<ExclusionRulePreview preview={preview} />)
 expect(screen.getByText('21 matching imports')).toBeInTheDocument(); expect(screen.getByText(/Money in.*50/)).toBeInTheDocument()
 expect(screen.getByText(/2 legacy/)).toBeInTheDocument(); expect(screen.getByText('Identity needs review')).toBeInTheDocument()
 expect(screen.queryByText('Bank 20')).toBeNull(); fireEvent.click(screen.getByRole('button',{name:'Show 20 more'})); expect(screen.getByText('Bank 20')).toBeInTheDocument()
})
it('shows a clear no-match state with historical coverage',()=>{
 render(<ExclusionRulePreview preview={{rows:[],count:0,moneyInCents:0,moneyOutCents:0,pendingCount:0,acceptedCount:0,ignoredCount:0,eligiblePendingCount:0,legacyUnavailableCount:0}} />)
 expect(screen.getByText('No matching imports.')).toBeInTheDocument()
 expect(screen.getByText(/including accepted and ignored records/)).toBeInTheDocument()
})

const paginatedPreview:ExclusionPreview={count:21,moneyInCents:0,moneyOutCents:0,pendingCount:21,acceptedCount:0,ignoredCount:0,eligiblePendingCount:21,legacyUnavailableCount:0,rows:Array.from({length:21},(_,i)=>({recordId:String(i),sourceId:'a',description:'Bank '+i,date:'2026-06-10',movementCents:50,decision:'pending',identityNeedsReview:false,overridden:false}))}
it('resets expanded pagination on criteria-only changes including A to B to A',()=>{
 const preview=paginatedPreview
 const view=render(<ExclusionRulePreview preview={preview} criteriaKey="exact" />)
 fireEvent.click(screen.getByRole('button',{name:'Show 20 more'}))
 view.rerender(<ExclusionRulePreview preview={preview} criteriaKey="contains" />)
 expect(screen.queryByText('Bank 20')).toBeNull()
 view.rerender(<ExclusionRulePreview preview={preview} criteriaKey="exact" />)
 expect(screen.queryByText('Bank 20')).toBeNull()
})
it('resets expanded pagination on result-only changes with supplied criteria unchanged',()=>{
 const preview=paginatedPreview
 const view=render(<ExclusionRulePreview preview={preview} criteriaKey="exact" />)
 fireEvent.click(screen.getByRole('button',{name:'Show 20 more'}))
 expect(screen.getByText('Bank 20')).toBeInTheDocument()
 view.rerender(<ExclusionRulePreview preview={{...preview,rows:preview.rows.map(row=>({...row,description:'Changed '+row.recordId}))}} criteriaKey="exact" />)
 expect(screen.getByText('Changed 0')).toBeInTheDocument()
 expect(screen.queryByText('Changed 20')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Show 20 more'}))
 expect(screen.getByText('Changed 20')).toBeInTheDocument()
})
