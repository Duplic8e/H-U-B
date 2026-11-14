/** Turning a bank's description into the merchant it names.
 *
 *  Banks print the same store differently on every receipt:
 *    LOBLAWS #1234 TORONTO ON
 *    LOBLAWS #5678 NORTH YORK ON
 *    TIM HORTONS #2231 OTTAWA, ON
 *    AMZN Mktp CA*2K4HJ67T1
 *  A rule keyed on the full text only ever matched that one store, so almost
 *  nothing was categorized automatically. The merchant key drops store
 *  numbers, reference codes and the trailing city and province, so one choice
 *  covers every branch. */

const PROVINCES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])

/** First words of two-word city names, so NORTH YORK ON drops both words. */
const CITY_PREFIXES = new Set(['NORTH', 'EAST', 'WEST', 'SOUTH', 'NEW', 'PORT', 'SAINT', 'ST', 'STE', 'FORT', 'RICHMOND', 'NIAGARA', 'THUNDER', 'SAULT', 'GRANDE', 'RED', 'PRINCE', 'MEDICINE', 'DEEP', 'ELLIOT', 'OWEN', 'SAINTE', 'TROIS', 'QUEBEC'])

/** Card-network and channel words that carry no merchant meaning. */
const NOISE = new Set([
  'POS', 'PURCHASE', 'PURCH', 'DEBIT', 'VISA', 'MC', 'INTERAC', 'RETAIL', 'PREAUTH', 'PRE', 'AUTH', 'SQ', 'TST', 'SP', 'PAYPAL',
  // CIBC Visa Debit and refund wording: INTL VISA DEB, IC* INSTACART, PURCHASE
  // REVERSAL, MERCHANDISE RET REV, CORRECTION. A refund groups with the store.
  'INTL', 'DEB', 'IC', 'REVERSAL', 'CORRECTION', 'MERCHANDISE', 'RET', 'REV', 'DEPOSIT', 'PAY',
])

/** Weekday stamps some apps add (LYFT *RIDE THU), dropped unless they lead the name (SUN SUSHI). */
const WEEKDAYS = new Set(['MON', 'TUE', 'TUES', 'WED', 'THU', 'THUR', 'THURS', 'FRI', 'SAT', 'SUN'])

/** The bank's own entries. Each is one merchant however the rest of the line
 *  reads: SERVICE CHARGE CAPPED MONTHLY FEE, ATM WITHDRAWAL MAIN ST. */
const BANK_ENTRIES = [
  'ETRANSFER NETWORK FEE', 'NETWORK TRANSACTION FEE', 'SERVICE CHARGE', 'SMART INTEREST', 'BONUS INTEREST', 'INTEREST',
  'ATM WITHDRAWAL', 'ATM DEPOSIT', 'INTERNET TRANSFER', 'ETRANSFER RECLAIM',
]

/** How many words of the cleaned description make the merchant. Three keeps
 *  SHOPPERS DRUG MART and ETRANSFER JANE DOE apart from their neighbours without
 *  dragging a city in. */
const MAX_WORDS = 3

/** Upper-case words with digits, codes and punctuation removed. */
function words(description: string): string[] {
  return description
    .toUpperCase()
    // One word, so the person's name after it stays in the key.
    .replace(/\bE[-\s]?TRANSFER\b/g, ' ETRANSFER ')
    // T&T is one name; SMITH & SONS reads as SMITH AND SONS.
    .replace(/\b([A-Z])&([A-Z])\b/g, '$1$2')
    .replace(/&/g, ' AND ')
    // Store numbers and reference codes: #1234, CA*2K4HJ67T1, FARE/E3K7A9.
    .replace(/[A-Z]*\d[A-Z0-9]*/g, ' ')
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // Initials stay together: A. B. C. GROUP is ABC GROUP, not just GROUP.
    .reduce<{ out: string[]; initials: boolean }>((acc, w) => {
      if (w.length === 1 && acc.initials) acc.out[acc.out.length - 1] += w
      else acc.out.push(w)
      acc.initials = w.length === 1 || (acc.initials && w.length === 1)
      return acc
    }, { out: [], initials: false }).out
    .filter((w) => w.length >= 2)
}

/** How the money moved, which CIBC prints before the merchant on chequing
 *  rows: "Point of Sale - Interac RETAIL PURCHASE 000001039445 TIM HORTONS #24",
 *  "Electronic Funds Transfer PREAUTHORIZED DEBIT ROGERS". Removed so the
 *  merchant is what is left. */
const CHANNEL_PHRASES = [
  'POINT OF SALE', 'RETAIL PURCHASE', 'ELECTRONIC FUNDS TRANSFER', 'PREAUTHORIZED DEBIT', 'PREAUTHORIZED CREDIT',
  'PRE AUTHORIZED DEBIT', 'PRE AUTHORIZED CREDIT', 'PRE AUTHORIZED', 'INTERNET BILL PAYMENT', 'INTERNET BILL PAY',
  'INTERNET BANKING', 'BILL PAYMENT', 'VISA DEBIT PURCHASE', 'VISA DEBIT', 'INTERAC PURCHASE', 'DEBIT MEMO', 'CREDIT MEMO',
  'BRANCH TRANSACTION', 'AUTOMATED BANKING MACHINE',
]

function stripChannel(parts: string[]): string[] {
  let text = ` ${parts.join(' ')} `
  for (const phrase of CHANNEL_PHRASES) text = text.split(` ${phrase} `).join(' ')
  const rest = text.trim().split(/\s+/).filter(Boolean)
  // Nothing but channel words (an ATM row, a plain transfer): keep them.
  return rest.length ? rest : parts
}

/** The merchant a description names, lower case, for grouping and for rules. */
export function merchantKey(description: string): string {
  let parts = stripChannel(words(description))
  const joined = ` ${parts.join(' ')} `
  const bankEntry = BANK_ENTRIES.find((phrase) => joined.startsWith(` ${phrase} `))
  if (bankEntry) return bankEntry.toLowerCase()
  const meaningful = parts.filter((w, i) => !NOISE.has(w) && !(i > 0 && WEEKDAYS.has(w)))
  if (meaningful.length) parts = meaningful
  // A trailing province code means the word before it is a city, unless a
  // phone or store number sits in the city's place (ABC*FOODHUB 647-689-5083, ON).
  const numberBeforeProvince = /\d[\s,]*\b[A-Z]{2}\s*$/i.test(description.trim())
  if (parts.length > 2 && PROVINCES.has(parts[parts.length - 1])) {
    parts = parts.slice(0, -1)
    if (parts.length > 1 && !numberBeforeProvince) parts = parts.slice(0, -1)
    if (parts.length > 1 && CITY_PREFIXES.has(parts[parts.length - 1])) parts = parts.slice(0, -1)
  }
  const key = parts.slice(0, MAX_WORDS).join(' ').toLowerCase().trim()
  return key || description.trim().toLowerCase()
}

/** "tim hortons" → "Tim Hortons", for display. */
export function merchantLabel(key: string): string {
  return key.replace(/\b([a-z])([a-z]*)/g, (_m, first: string, rest: string) => first.toUpperCase() + rest)
}

/** Whether a categorization rule applies to a description. A rule is either a
 *  merchant key learned from the Categorize page or an older full-description
 *  rule; both match on the raw text and on the cleaned word form, so
 *  "etransfer jane doe" still matches "E-TRANSFER 1051 JANE DOE". */
export function matchesRule(description: string, rule: string): boolean {
  const needle = rule.trim().toLowerCase()
  if (!needle) return false
  if (description.toLowerCase().includes(needle)) return true
  const cleanedDescription = ` ${words(description).join(' ').toLowerCase()} `
  const cleanedRule = words(rule).join(' ').toLowerCase()
  return cleanedRule.length > 0 && cleanedDescription.includes(` ${cleanedRule} `)
}
