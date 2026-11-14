import { describe, expect, it } from 'vitest'
import { PARSERS, parseCSV } from './csvParser'

const cibc = () => {
  const p = PARSERS.find((x) => x.name === 'CIBC Credit Card (Headerless)')
  if (!p) throw new Error('CIBC parser not registered')
  return p
}

const cibcRow = (debit = '15.99', credit = '', description = 'SHOP, OTTAWA ON') =>
  ['2026-10-06', description, debit, credit, '1234********5678']

describe('CIBC credit card import', () => {
  it('recognizes only the five-column ISO-date masked-card shape', () => {
    expect(cibc().detect([], cibcRow())).toBe(true)
    expect(cibc().detect([], ['10/06/2026', 'SHOP', '15.99', '', '100'])).toBe(false)
    expect(cibc().detect([], ['2026-10-06', 'SHOP', '15.99', '', '100'])).toBe(false)
    expect(cibc().detect([], cibcRow().slice(0, 4))).toBe(false)
    expect(cibc().detect(['Date'], { Date: '2026-10-06' })).toBe(false)
  })

  it('imports a debit as a positive expense with original metadata', () => {
    expect(cibc().parse(cibcRow())).toMatchObject({
      date: '2026-10-06', description: 'SHOP, OTTAWA ON', amount: 15.99, type: 'expense',
      originalRowData: { '4': '1234********5678' },
      bankSource: { key: 'cibc:1234:5678', name: 'CIBC card 5678' },
    })
  })

  it('imports merchant credits as negative expenses', () => {
    expect(cibc().parse(cibcRow('', '27.11'))).toMatchObject({ amount: -27.11, type: 'expense' })
    expect(cibc().parse(cibcRow('', '27.11'))?.flag).toBeUndefined()
  })

  it.each(['PAYMENT THANK YOU/PAIEMEN T MERCI', 'PRE AUTHORIZED PAYMENT - THANK YOU'])(
  'flags the payment credit %s for review', (description) => {
    expect(cibc().parse(cibcRow('', '2166.20', description))).toMatchObject({
      amount: 2166.2, type: 'income', flag: 'card-payment',
    })
  })

  it('does not flag a merchant merely containing PAYMENT', () => {
    expect(cibc().parse(cibcRow('', '4.00', 'PAYMENT SERVICES SHOP'))?.flag).toBeUndefined()
  })

  it('keeps the first row and handles quoted commas, BOM, CRLF and blank lines', async () => {
    const text = '\uFEFF2026-10-06,"SHOP, OTTAWA ON",,27.11,1234********5678\r\n' +
      '\r\n2026-10-06,SHOP,15.99,,1234********5678\r\n'
    const result = await parseCSV(new File([text], 'download.csv'))
    expect(result).toMatchObject([
      { description: 'SHOP, OTTAWA ON', amount: -27.11, type: 'expense' },
      { description: 'SHOP', amount: 15.99, type: 'expense' },
    ])
  })

  it.each([
    ['2026-02-30', 'SHOP', '1.00', '', '1234********5678'],
    ['2026-10-06', 'SHOP', '1.00oops', '', '1234********5678'],
    ['2026-10-06', 'SHOP', 'Infinity', '', '1234********5678'],
    ['2026-10-06', 'SHOP', '-1.00', '', '1234********5678'],
    ['2026-10-06', 'SHOP', '1.00', '2.00', '1234********5678'],
    ['2026-10-06', 'SHOP', '', '', '1234********5678'],
    ['2026-10-06', 'SHOP', '1.00', ''],
  ])('rejects malformed rows without partially importing: %j', async (...invalid) => {
    const text = [cibcRow().join(',').replace('SHOP, OTTAWA ON', 'SHOP'), invalid.join(',')].join('\n')
    await expect(parseCSV(new File([text], 'cibc.csv'))).rejects.toThrow(/CIBC.*row 2/i)
  })

  it('preserves the existing slash-date headerless bank format', async () => {
    expect(await parseCSV(new File(['10/06/2026,DEPOSIT,,25.00,100.00'], 'bank.csv')))
      .toMatchObject([{ date: '2026-10-06', amount: 25, type: 'income' }])
  })

  it('leaves unknown ISO-date headerless formats available for mapping', async () => {
    const result = await parseCSV(new File(['2026-10-06,SHOP,-10.00'], 'other.csv'))
    expect(result).toMatchObject({ unrecognized: true, headers: ['Column 1', 'Column 2', 'Column 3'],
      rows: [['2026-10-06', 'SHOP', '-10.00']] })
  })
})

const CHASE_HEADERS = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo']

const chase = () => {
  const p = PARSERS.find((x) => x.name === 'Chase Credit Card')
  if (!p) throw new Error('Chase Credit Card parser not registered')
  return p
}

const row = (over: Record<string, string> = {}) => ({
  'Transaction Date': '08/22/2026',
  'Post Date': '08/23/2026',
  Description: 'LIDL #1590',
  Category: 'Groceries',
  Type: 'Sale',
  Amount: '-4.29',
  Memo: '',
  ...over,
})

describe('Chase Credit Card parser detection', () => {
  it('detects the Chase header shape', () => {
    expect(chase().detect(CHASE_HEADERS, row())).toBe(true)
  })

  it('does not claim a Visa download file', () => {
    const visa = ['Account Type', 'Transaction Date', 'Description 1', 'CAD$']
    expect(chase().detect(visa, undefined)).toBe(false)
  })

  it('is registered ahead of Standard Ledger CSV', () => {
    const chaseIdx = PARSERS.findIndex((p) => p.name === 'Chase Credit Card')
    const stdIdx = PARSERS.findIndex((p) => p.name === 'Standard Ledger CSV')
    expect(chaseIdx).toBeGreaterThanOrEqual(0)
    expect(chaseIdx).toBeLessThan(stdIdx)
  })
})

describe('Chase Credit Card parser rows', () => {
  it('converts the transaction date and ignores the post date', () => {
    expect(chase().parse(row())?.date).toBe('2026-08-22')
  })

  it('reads a Sale as a positive expense', () => {
    const r = chase().parse(row())
    expect(r?.type).toBe('expense')
    expect(r?.amount).toBe(4.29)
  })

  it('reads a Return as a negative expense', () => {
    const r = chase().parse(
      row({ Description: 'AMAZON MKTPLACE PMTS', Category: 'Shopping', Type: 'Return', Amount: '39.99' }),
    )
    expect(r?.type).toBe('expense')
    expect(r?.amount).toBe(-39.99)
  })

  it('flags a Payment instead of importing it as plain income', () => {
    const r = chase().parse(
      row({ Description: 'Payment Thank You-Mobile', Category: '', Type: 'Payment', Amount: '50.00' }),
    )
    expect(r?.type).toBe('income')
    expect(r?.amount).toBe(50)
    expect(r?.flag).toBe('card-payment')
  })

  it('falls back to the sign for an unrecognized Type rather than dropping the row', () => {
    const r = chase().parse(row({ Type: 'Fee', Amount: '-1.50' }))
    expect(r?.type).toBe('expense')
    expect(r?.amount).toBe(1.5)
    expect(r?.flag).toBeUndefined()
  })

  it('decodes HTML entities in the description', () => {
    expect(chase().parse(row({ Description: 'H&amp;M  0500NEW YORK' }))?.description).toBe('H&M  0500NEW YORK')
  })

  it('returns null when the amount is not a number', () => {
    expect(chase().parse(row({ Amount: '' }))).toBeNull()
  })
})

// Made-up rows in the shape of a CIBC chequing or savings download: Date,
// Description, Debit, Credit, no header row and no account number.
describe('CIBC chequing and savings import', () => {
  const file = (lines: string[]) => new File([lines.join('\n')], 'cibc.csv')
  const sample = [
    '2026-11-09,Point of Sale - Interac RETAIL PURCHASE 000000000001 COSTCO WHOLESAL,50.10,',
    '2026-11-03,Electronic Funds Transfer DEPOSIT PAYPAL,,25.89',
    '2026-11-01,Internet Banking INTERNET TRANSFER 000000000002 TO CARD 4500********0000,300.00,',
    '2026-10-30,Branch Transaction INTEREST,,0.01',
    '2026-10-28,Point of Sale - Visa Debit VISA DEBIT PURCHASE REVERSAL AMAZON* 5AB1CD2 000000000003,,19.99',
    '2026-10-27,Internet Banking INTERNET TRANSFER 000000000004 FROM ACCOUNT 00000/****000,,8000.00',
  ]

  it('is recognized and reads every row', async () => {
    const rows = await parseCSV(file(sample))
    expect(Array.isArray(rows) && rows.length).toBe(6)
  })

  it('reads a debit as spending and a credit as income', async () => {
    const rows = (await parseCSV(file(sample))) as Awaited<ReturnType<typeof parseCSV>> & Array<{ description: string; amount: number; type: string; flag?: string }>
    expect(rows[0]).toMatchObject({ date: '2026-11-09', amount: 50.1, type: 'expense' })
    expect(rows[1]).toMatchObject({ amount: 25.89, type: 'income' })
    expect(rows[3]).toMatchObject({ amount: 0.01, type: 'income' })
    expect(rows[0].flag).toBeUndefined()
  })

  it('sets transfers between your own accounts aside, both directions', async () => {
    const rows = (await parseCSV(file(sample))) as Array<{ amount: number; type: string; flag?: string }>
    expect(rows[2]).toMatchObject({ amount: 300, type: 'expense', flag: 'card-payment' })
    expect(rows[5]).toMatchObject({ amount: 8000, type: 'income', flag: 'card-payment' })
  })

  it('reads a reversal as money back on that store, not income', async () => {
    const rows = (await parseCSV(file(sample))) as Array<{ amount: number; type: string }>
    expect(rows[4]).toMatchObject({ amount: -19.99, type: 'expense' })
  })

  it('still leaves the credit card five-column shape to its own parser', async () => {
    const rows = (await parseCSV(new File(['2026-11-09,"COFFEE #1 TORONTO, ON",2.10,,4500********0000'], 'cc.csv'))) as Array<{ bankSource?: { name: string } }>
    expect(rows[0].bankSource?.name).toBe('CIBC card 0000')
  })

  it('rejects a row with both a debit and a credit', async () => {
    await expect(parseCSV(file([sample[0], '2026-11-09,SHOP,1.00,2.00']))).rejects.toThrow(/CIBC Bank Account.*row 2/)
  })
})
