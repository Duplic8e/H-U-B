export interface Synced {
  id: string;
  updatedAt: string;
  deletedAt?: string;
}

/** A word in the bank: French, English, part of speech, gender, pronunciation. */
export interface Word {
  /** Lower-cased French, unique in the bank. Custom cards use their own id. */
  id: string;
  fr: string;
  en: string;
  pos?: string;
  gen?: 'm' | 'f' | '';
  ipa?: string;
  /** Position in the frequency order (1 = most common); absent for custom cards. */
  rank?: number;
  custom?: boolean;
}

export type CardStage = 'learning' | 'review' | 'known';
export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** Your progress on one word. A word with no card has not been started. */
export interface Card extends Synced {
  stage: CardStage;
  /** Which learning step the card is on. */
  step: number;
  ease: number;
  /** Days until the next review once the card has graduated. */
  intervalDays: number;
  /** When it is next due (ISO date and time). */
  due: string;
  reps: number;
  lapses: number;
  /** Local date (YYYY-MM-DD) the card was first studied. */
  introducedOn: string;
}

export interface CustomWord extends Synced {
  fr: string;
  en: string;
}

/** One row per day studied, for the streak and the charts. `id` is the local date. */
export interface DayLog extends Synced {
  reviews: number;
  newCards: number;
  correct: number;
}

export interface Settings extends Synced {
  newPerDay: number;
  /** Which side is shown first. */
  direction: 'fr-en' | 'en-fr';
  /** Read the French aloud when it appears. */
  autoSpeak: boolean;
}

export const SETTINGS_ID = 'settings';

export interface Dump {
  cards: Card[];
  custom: CustomWord[];
  days: DayLog[];
  settings: Settings[];
}
