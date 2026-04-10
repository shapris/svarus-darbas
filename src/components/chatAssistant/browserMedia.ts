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
  onresult:
    | ((ev: {
        resultIndex?: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
      }) => void)
    | null;
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

/** Greita diagnostika telefone — kodėl mic gali neveikti (UI patarimams). */
export type MicDictationChecklist = {
  secureContext: boolean;
  hasWebSpeech: boolean;
  /** Viena eilutė lietuviškai — ką daryti pirmiausia */
  primaryHintLt: string;
};

export function getMicDictationChecklist(): MicDictationChecklist {
  if (typeof window === 'undefined') {
    return {
      secureContext: false,
      hasWebSpeech: false,
      primaryHintLt: '—',
    };
  }
  const secureContext = window.isSecureContext;
  const hasWebSpeech = getSpeechRecognitionCtor() !== undefined;

  let primaryHintLt =
    'Paspauskite mikrofoną ir leiskite prieigą. Jei nutrūksta — „Tęsti klausymą“. Reikia interneto (debesų atpažinimas).';

  if (!secureContext) {
    primaryHintLt =
      'Atidarykite tą patį puslapį per HTTPS (pvz. jūsų Vercel nuorodą), ne kaip failą ir ne http://.';
  } else if (!hasWebSpeech) {
    primaryHintLt =
      'Ši naršyklė neturi Web Speech API. Android: Chrome. iPhone: Chrome iš App Store (Safari dažnai neįrašo balso).';
  }

  return { secureContext, hasWebSpeech, primaryHintLt };
}
