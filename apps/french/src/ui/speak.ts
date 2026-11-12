/** Reads French aloud with the phone's own voice, so it works offline. */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string) {
  if (!canSpeak()) return;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/'$/, ''));
    u.lang = 'fr-FR';
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('fr'));
    if (voice) u.voice = voice;
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    // No voice available: the card still shows the pronunciation.
  }
}
