# French

Vocabulary trainer for the Hub, served at `/H-U-B/french/`.

- **6,000+ words**, most common first, each with English, part of speech, gender and pronunciation.
- **Spaced repetition** in the style of Anki's SM-2: a new word is shown twice in a sitting, then after a day,
  then at growing gaps. Again, Hard, Good and Easy set when it returns.
- **New words per day** you choose (15 to start); reviews are never limited.
- **French or English first**, and the phone's own French voice reads the word aloud.
- **Your own words**: add one, paste a list, or import a CSV, a text file or an Anki text export.
- **Offline first**, backed up to `french/data.json` in the Hub's private data repo. Only your progress and
  your own words sync; the bank ships with the app.

```sh
npm ci
npm test
npm run dev
```

## Word bank

`public/words.json` is built from two open datasets (see `public/WORDS-NOTICE.txt`):

- Translations, parts of speech, gender and pronunciation: the FreeDict French–English dictionary,
  GNU GPL version 2 or later.
- Ordering: the FrequencyWords French list (from OpenSubtitles 2018), CC BY-SA 4.0.

The most common function words (de, est, pas, que…) were given clearer glosses by hand, because a
dictionary lists them under senses a beginner does not need first.
