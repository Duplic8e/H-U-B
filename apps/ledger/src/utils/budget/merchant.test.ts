import { describe, expect, it } from 'vitest'
import { matchesRule, merchantKey, merchantLabel } from './merchant'

describe('merchantKey', () => {
  it.each([
    ['LOBLAWS #1234 TORONTO ON', 'loblaws'],
    ['LOBLAWS #5678 NORTH YORK ON', 'loblaws'],
    ['TIM HORTONS #2231 OTTAWA, ON', 'tim hortons'],
    ['SHOPPERS DRUG MART #0812 NORTH YORK ON', 'shoppers drug mart'],
    ['AMZN Mktp CA*2K4HJ67T1', 'amzn mktp ca'],
    ['AMZN Mktp CA*9ZZ11AB22', 'amzn mktp ca'],
    ['UBER CANADA/UBERTRIP TORONTO ON', 'uber canada ubertrip'],
    ['SQ *BLUE BOTTLE COFFEE', 'blue bottle coffee'],
    ['NETFLIX.COM', 'netflix com'],
    ['E-TRANSFER 105112233 JANE DOE', 'etransfer jane doe'],
    ['PRESTO FARE/E3K7A9 TORONTO ON', 'presto fare'],
    // CIBC chequing rows lead with how the money moved.
    ['Point of Sale - Interac RETAIL PURCHASE 000001039445 TIM HORTONS #24', 'tim hortons'],
    ['Electronic Funds Transfer PREAUTHORIZED DEBIT ROGERS', 'rogers'],
    ['Internet Banking INTERNET BILL PAY 000000123456 TORONTO HYDRO', 'toronto hydro'],
    ['INTERNET TRANSFER 000000123456', 'internet transfer'],
    ['Automated Banking Machine ATM WITHDRAWAL 2H3K', 'atm withdrawal'],
    ['Automated Banking Machine ATM WITHDRAWAL KING ST (CITY MALL 4G68', 'atm withdrawal'],
    ['Automated Banking Machine ATM DEPOSIT MAIN ST 3F0N', 'atm deposit'],
    // CIBC's own entries collapse to one merchant each.
    ['Branch Transaction SERVICE CHARGE', 'service charge'],
    ['Branch Transaction SERVICE CHARGE CAPPED MONTHLY FEE$16.95 RECORD-KEEPING N/A', 'service charge'],
    ['Branch Transaction INTEREST', 'interest'],
    ['Branch Transaction SMART INTEREST', 'smart interest'],
    ['Branch Transaction E-TRANSFER NETWORK FEE', 'etransfer network fee'],
    ['Electronic Funds Transfer NETWORK TRANSACTION FEE ATM-CANADA/GAB-CANADA', 'network transaction fee'],
    ['Internet Banking INTERNET TRANSFER 000000111111 TO ACCOUNT 00000/****000', 'internet transfer'],
    // Visa Debit purchases and their refunds share the store.
    ['Point of Sale - Visa Debit INTL VISA DEB RETAIL PURCHASE IC* INSTACART 123456789 25.84 CAD @ 1.000000', 'instacart cad'],
    ['Point of Sale - Visa Debit VISA DEBIT MERCHANDISE RET REV IC* INSTACART*3 123456789', 'instacart'],
    ['Point of Sale - Visa Debit VISA DEBIT PURCHASE REVERSAL AMAZON* 532SY7P 123456789', 'amazon'],
    ['Point of Sale - Visa Debit CORRECTION UBER CANADA/UBE 123456789', 'uber canada ube'],
    ['Point of Sale - Visa Debit VISA DEBIT RETAIL PURCHASE UBER CANADA/UBE 123456789', 'uber canada ube'],
    ['Point of Sale - Interac RETAIL PURCHASE AB12CD34EF00 A. B. C. Group', 'abc group'],
    ['Electronic Funds Transfer PAY Acme Corp Pay', 'acme corp'],
    ['Electronic Funds Transfer PREAUTHORIZED DEBIT SAMPLE AUTO. SAMPLE INS/ASS.', 'sample auto sample'],
    ['Internet Banking E-TRANSFER 104889000000 Pat Example', 'etransfer pat example'],
    // Credit card rows.
    ["MCDONALD'S #12345 TORONTO, ON", 'mcdonald'],
    ['T&T SUPERMARKET #039 TORONTO, ON', 'tt supermarket'],
    ['ABC*FOODHUB 555-555-0100, ON', 'abc foodhub'],
    ['LYFT   *RIDE THU 4PM', 'lyft ride'],
    ['LYFT   *RIDE FRI 11AM', 'lyft ride'],
    ['SUN SUSHI OTTAWA, ON', 'sun sushi'],
  ])('%s → %s', (description, key) => {
    expect(merchantKey(description)).toBe(key)
  })

  it('gives every branch of one store the same key', () => {
    const keys = new Set(['TIM HORTONS #1 TORONTO ON', 'TIM HORTONS #22 OTTAWA ON', 'TIM HORTONS #333 KINGSTON ON'].map(merchantKey))
    expect(keys.size).toBe(1)
  })

  it('keeps different people apart in e-transfers', () => {
    expect(merchantKey('E-TRANSFER 1 JANE DOE')).not.toBe(merchantKey('E-TRANSFER 2 JOHN SMITH'))
  })

  it('never returns an empty key', () => {
    expect(merchantKey('#1234 5678')).toBe('#1234 5678')
  })
})

describe('matchesRule', () => {
  it('matches a learned merchant key at any branch', () => {
    expect(matchesRule('LOBLAWS #9999 BARRIE ON', 'loblaws')).toBe(true)
    expect(matchesRule('TIM HORTONS #4 OTTAWA ON', 'tim hortons')).toBe(true)
    expect(matchesRule('E-TRANSFER 77 JANE DOE', 'etransfer jane doe')).toBe(true)
  })

  it('still honours an older full-description rule', () => {
    expect(matchesRule('Spotify P1234 Stockholm', 'spotify')).toBe(true)
    expect(matchesRule('LOBLAWS #1234 TORONTO ON', 'LOBLAWS #1234 TORONTO ON')).toBe(true)
  })

  it('does not match inside another word', () => {
    expect(matchesRule('BARBERSHOP ON QUEEN', 'bar')).toBe(true) // raw substring rules behave as before
    expect(matchesRule('E-TRANSFER 1 JOHN SMITH', 'etransfer jane doe')).toBe(false)
  })
})

describe('merchantLabel', () => {
  it('title-cases the key', () => {
    expect(merchantLabel('shoppers drug mart')).toBe('Shoppers Drug Mart')
  })
})
