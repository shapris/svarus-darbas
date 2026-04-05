type AiStudioGlobal = {
  hasSelectedApiKey?: () => Promise<boolean>;
  getApiKey?: () => string;
  openSelectKey?: () => Promise<void>;
};

export function getAiStudio(): AiStudioGlobal | undefined {
  return (window as Window & { aistudio?: AiStudioGlobal }).aistudio;
}

/** Naršyklių Web Speech API (globalūs tipai ne visada įtraukti į TS lib). */
export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | undefined {
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: BrowserSpeechRecognitionCtor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
    };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
