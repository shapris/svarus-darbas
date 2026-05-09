/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  X,
  Bot,
  User as UserIcon,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Brain,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  chatWithAssistant,
  getAiInstance,
  getGeminiApiKeyForSdk,
  isOpenRouterKey,
  consumeAiBudget,
  shouldApplyClientAiDailyBudget,
} from '../services/aiService';
import { transcribeAudioBlobWithGemini } from '../services/speechTranscribeService';
import { generateSpeech, stopAllAudio } from '../services/ttsService';
import { getOpenCodeKey, isOpenCodeKey } from '../services/opencodeService';
import { getInvoiceApiBaseUrl } from '../utils/invoiceApiBase';
import { shouldSuggestMemory } from '../services/memoryPriority';
import { getGeminiKeyFromEnv } from '../utils/geminiEnv';
import { Client, Order, Expense, AppSettings, Memory, Employee } from '../types';
import { addData, TABLES } from '../supabase';

import ReactMarkdown from 'react-markdown';
import { useToast } from '../hooks/useToast';
import { useOrgAccess } from '../contexts/OrgAccessContext';
import { useCrmWorkspace } from '../contexts/CrmWorkspaceContext';
import { logDevError } from '../utils/devConsole';
import {
  CRM_TAB_LABEL_LT,
  chatPanelOpenKey,
  chatPanelMessagesKey,
  type ChatHistoryMessage,
  type AssistantToolCall,
  type Message,
  type LocalUser,
} from './chatAssistant/types';
import {
  getAiStudio,
  decideVoiceFallback,
  getGeminiDictationAudioConstraints,
  getSpeechRecognitionCtor,
  isAndroidUserAgent,
  pickRecorderMimeTypeForDevice,
  type BrowserSpeechRecognition,
} from './chatAssistant/browserMedia';
import { ChatApiSettings } from './chatAssistant/ChatApiSettings';
import { MessageList } from './chatAssistant/MessageList';
import { VoiceRecorder } from './chatAssistant/VoiceRecorder';
import { AssistantVoice } from './chatAssistant/VoiceSettingsPanel';
import {
  sanitizeHistoryForGemini,
  detectMemoryCategory,
  detectOrderInConversation,
} from './chatAssistant/conversationHelpers';
import { runAssistantToolCall } from './chatAssistant/toolHandler';

interface ChatAssistantProps {
  user: LocalUser;
  clients: Client[];
  orders: Order[];
  expenses: Expense[];
  employees: Employee[];
  settings: AppSettings;
  /** AI ā€˛memoriesā€ sinchronizuojami su App.tsx (viena realtime prenumerata ā€” be Supabase kanalo konflikto). */
  memories: Memory[];
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
  /** Aktyvi CRM skiltis ā€” rodoma asistente ir perduodama AI kaip kontekstas */
  activeTab: string;
  /** Po ÄÆrankiÅ³ mutacijÅ³ ā€” tas pats lokalus atnaujinimas kaip uÅ¾sakymÅ³ skiltyje */
  patchOrder?: (id: string, patch: Partial<Order>) => void;
  removeOrderFromState?: (id: string) => void;
  upsertOrder?: (order: Order) => void;
}

const ASSISTANT_VOICE_OPTIONS: AssistantVoice[] = [
  'Zephyr',
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Aoede',
];

function toAssistantVoice(value: string | null): AssistantVoice {
  if (value && ASSISTANT_VOICE_OPTIONS.includes(value as AssistantVoice)) {
    return value as AssistantVoice;
  }
  return 'Zephyr';
}

export default function ChatAssistant({
  user,
  clients,
  orders,
  expenses,
  employees,
  settings,
  memories,
  setMemories,
  activeTab,
  patchOrder,
  removeOrderFromState,
  upsertOrder,
}: ChatAssistantProps) {
  const { dataOwnerId, authUid } = useCrmWorkspace();
  const { isRestrictedStaff } = useOrgAccess();
  const { showToast } = useToast();
  const activeViewLabel = CRM_TAB_LABEL_LT[activeTab] ?? activeTab;

  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem(chatPanelOpenKey(user.uid)) === '1';
    } catch {
      return false;
    }
  });
  const [input, setInput] = useState('');
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = sessionStorage.getItem(chatPanelMessagesKey(user.uid));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (m): m is Message =>
          m &&
          typeof m === 'object' &&
          (m as Message).role !== undefined &&
          ['user', 'model'].includes((m as Message).role) &&
          typeof (m as Message).text === 'string'
      );
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState<ChatHistoryMessage[]>(() => {
    const saved = localStorage.getItem('chat_history_' + user.uid);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as unknown;
      return Array.isArray(parsed) ? (parsed as ChatHistoryMessage[]) : [];
    } catch {
      return [];
    }
  });
  const [showMemories, setShowMemories] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiOffline, setIsAiOffline] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingMic, setIsTranscribingMic] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(
    localStorage.getItem('custom_api_key') || ''
  );
  const [apiKeyProvider, setApiKeyProvider] = useState<
    'google' | 'openrouter' | 'opencode' | 'default'
  >('default');
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<AssistantVoice>(() =>
    toAssistantVoice(localStorage.getItem('selected_voice'))
  );
  const [voiceRate, setVoiceRate] = useState<number>(
    parseFloat(localStorage.getItem('voice_rate') || '1.0')
  );
  const [selectedLang, setSelectedLang] = useState<string>(
    localStorage.getItem('tts_language') || 'lt-LT'
  );
  const [draftVoice, setDraftVoice] = useState<AssistantVoice>(() =>
    toAssistantVoice(localStorage.getItem('selected_voice'))
  );
  const [draftLang, setDraftLang] = useState<string>(
    localStorage.getItem('tts_language') || 'lt-LT'
  );
  const [draftRate, setDraftRate] = useState<number>(
    parseFloat(localStorage.getItem('voice_rate') || '1.0')
  );
  const [voiceSettingsAnchorIndex, setVoiceSettingsAnchorIndex] = useState<number | null>(null);
  const [draftTtsModel, setDraftTtsModel] = useState<string>(
    localStorage.getItem('openrouter_tts_model') || 'openai/gpt-4o-mini-tts'
  );
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [showPreviewMicHint, setShowPreviewMicHint] = useState(false);
  /** Mobilus: narÅyklÄ— nutraukÄ— klausymÄ… ā€” reikia naujo paspaudimo (gesto), kad vÄ—l leistÅ³ start(). */
  const [micNeedsGestureContinue, setMicNeedsGestureContinue] = useState(false);
  const [showListeningHint, setShowListeningHint] = useState(false);
  const [showRetryingHint, setShowRetryingHint] = useState(false);
  const [showSilenceHint, setShowSilenceHint] = useState(false);
  const [showNoTranscriptMessage, setShowNoTranscriptMessage] = useState(false);
  const [showUnsupportedMessage, setShowUnsupportedMessage] = useState(false);
  const [showPermissionDeniedMessage, setShowPermissionDeniedMessage] = useState(false);

  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);

  const assistantDataContext = useMemo(
    () => ({
      clients,
      orders,
      expenses,
      employees,
      memories,
      activeViewLabel,
      dataOwnerId,
      userId: user.uid,
      patchOrder,
      removeOrderFromState,
      upsertOrder,
    }),
    [
      clients,
      orders,
      expenses,
      employees,
      memories,
      activeViewLabel,
      dataOwnerId,
      user.uid,
      patchOrder,
      removeOrderFromState,
      upsertOrder,
    ]
  );

  const lastUserMessageRef = useRef<string>('');
  /** Saugiklis nuo keliÅ³ Enter / mygtuko paspaudimÅ³ iÅ eilÄ—s (ta pati Å¾inutÄ—). */
  const lastSendAtMsRef = useRef(0);
  const lastSpeechErrorAlertAtRef = useRef<number>(0);
  const micRetryCountRef = useRef(0);
  const micLastErrorRef = useRef<string | null>(null);
  const micHasTranscriptRef = useRef(false);
  const MIC_MAX_RETRY_COUNT = 1;
  const SEND_DEBOUNCE_MS = 650;

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const tempTranscriptRef = useRef('');
  const finalTranscriptRef = useRef('');
  const latestTranscriptRef = useRef('');
  /** Vartotojas nori klausyti, kol pats paspaus ā€˛stopā€ (ne narÅyklÄ—s automatinis nutraukimas). */
  const micSessionWantedRef = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMicToggleAtRef = useRef(0);
  const MIC_TOGGLE_DEBOUNCE_MS = 280;
  /** PaskutinÄ— startOneInstance funkcija ā€” ā€˛TÄ™stiā€ mygtukas kvieÄ¨ia iÅ tiesioginio paspaudimo. */
  const startSpeechInstanceRef = useRef<(() => void) | null>(null);
  /** Tekstas laukelyje pradÄ—jus diktuoti (prie jo prijungiame atpaÅ¾intÄ… tekstÄ…). */
  const micDictationBaseRef = useRef('');
  /** Ar jau atnaujinome laukÄ… gyvai iÅ onresult (kad finalize nedubliuotÅ³). */
  const micLiveUpdatedRef = useRef(false);
  const geminiMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const geminiMediaChunksRef = useRef<Blob[]>([]);
  const geminiMediaStreamRef = useRef<MediaStream | null>(null);
  const geminiMimeRef = useRef('');
  const geminiRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLikelyMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  const checkApiKey = async () => {
    const storedKey = localStorage.getItem('custom_api_key');
    if (storedKey?.trim()) {
      setApiKeyProvider(
        storedKey.startsWith('sk-or-v1-')
          ? 'openrouter'
          : storedKey.startsWith('sk-')
            ? 'opencode'
            : 'google'
      );
      return;
    }

    const hasServerApiBase = !!getInvoiceApiBaseUrl().trim();
    if (hasServerApiBase) {
      setApiKeyProvider('opencode');
      return;
    }

    const envOpenRouter = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (envOpenRouter && String(envOpenRouter).trim().startsWith('sk-or-v1-')) {
      setApiKeyProvider('openrouter');
      return;
    }

    const envGem = getGeminiKeyFromEnv();
    if (envGem) {
      setApiKeyProvider('google');
      return;
    }

    const aiStudio = getAiStudio();
    if (aiStudio?.hasSelectedApiKey) {
      const hasKey = await aiStudio.hasSelectedApiKey();

      if (hasKey && aiStudio.getApiKey) {
        const key = aiStudio.getApiKey();
        if (key.startsWith('sk-or-v1-')) {
          setApiKeyProvider('openrouter');
        } else if (key.startsWith('sk-')) {
          setApiKeyProvider('opencode');
        } else {
          setApiKeyProvider('google');
        }
      } else {
        setApiKeyProvider('default');
      }
    }
  };

  const stopSpeaking = () => {
    stopAllAudio();
    setSpeakingMessageIndex(null);
  };

  const speak = async (text: string, index: number) => {
    if (speakingMessageIndex === index) {
      stopSpeaking();
      return;
    }

    stopSpeaking();
    setSpeakingMessageIndex(index);

    try {
      await generateSpeech(text, selectedVoice);
    } finally {
      setSpeakingMessageIndex(null);
    }
  };

  useEffect(() => {
    void checkApiKey();
    return () => {
      stopSpeaking();
      micSessionWantedRef.current = false;
      if (geminiRecordTimerRef.current) {
        clearTimeout(geminiRecordTimerRef.current);
        geminiRecordTimerRef.current = null;
      }
      geminiMediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (geminiMediaRecorderRef.current && geminiMediaRecorderRef.current.state !== 'inactive') {
        try {
          geminiMediaRecorderRef.current.stop();
        } catch {
          /* */
        }
      }
      geminiMediaRecorderRef.current = null;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* jau sustabdytas */
        }
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    };
  }, [user.uid]);

  useEffect(() => {
    if (showVoiceSelector) {
      setDraftVoice(selectedVoice);
      setDraftLang(selectedLang);
      setDraftRate(voiceRate);
    }
  }, [showVoiceSelector, selectedVoice, selectedLang, voiceRate]);

  useEffect(() => {
    if (showApiSettings) {
      setDraftVoice(selectedVoice);
      setDraftLang(selectedLang);
      setDraftRate(voiceRate);
      setDraftTtsModel(localStorage.getItem('openrouter_tts_model') || 'openai/gpt-4o-mini-tts');
    }
  }, [showApiSettings, selectedVoice, selectedLang, voiceRate]);

  const saveVoiceSettings = useCallback(() => {
    const safeRate = Number.isFinite(draftRate) ? Math.min(1.35, Math.max(0.75, draftRate)) : 1;
    setSelectedVoice(draftVoice);
    setSelectedLang(draftLang || 'lt-LT');
    setVoiceRate(safeRate);
    setDraftVoice(draftVoice);
    setDraftLang(draftLang || 'lt-LT');
    setDraftRate(safeRate);
    localStorage.setItem('selected_voice', draftVoice);
    localStorage.setItem('tts_language', draftLang || 'lt-LT');
    localStorage.setItem('voice_rate', String(safeRate));
    showToast.success('Balso nustatymai iÅsaugoti');
  }, [draftVoice, draftLang, draftRate, showToast]);

  const resetVoiceSettings = useCallback(() => {
    setDraftVoice('Zephyr');
    setDraftLang('lt-LT');
    setDraftRate(1);
  }, []);

  const saveVoiceSettingsWithModel = useCallback(() => {
    localStorage.setItem(
      'openrouter_tts_model',
      (draftTtsModel || 'openai/gpt-4o-mini-tts').trim()
    );
    saveVoiceSettings();
  }, [draftTtsModel, saveVoiceSettings]);

  const dirtyVoiceSettings =
    draftVoice !== selectedVoice ||
    draftLang !== selectedLang ||
    Math.abs(draftRate - voiceRate) > 0.001;
  const dirtyVoiceSettingsAll =
    dirtyVoiceSettings ||
    (draftTtsModel || '').trim() !==
      (localStorage.getItem('openrouter_tts_model') || 'openai/gpt-4o-mini-tts');

  useEffect(() => {
    if (!showVoiceSelector) {
      setVoiceSettingsAnchorIndex(null);
    }
  }, [showVoiceSelector]);

  const previewVoice = useCallback(async () => {
    try {
      await generateSpeech(
        draftLang.startsWith('lt')
          ? 'Sveiki, Ä¨ia jÅ«sÅ³ CRM asistento balso testas.'
          : 'Hello, this is your CRM assistant voice test.',
        draftVoice
      );
    } catch (e) {
      logDevError('previewVoice failed', e);
      showToast.error('Nepavyko paleisti balso testo.');
    }
  }, [draftLang, draftVoice, showToast]);

  useEffect(() => {
    try {
      sessionStorage.setItem(chatPanelOpenKey(user.uid), isOpen ? '1' : '0');
    } catch {
      /* narÅyklÄ—s privatumo reÅ¾imas */
    }
  }, [isOpen, user.uid]);

  useEffect(() => {
    try {
      const trimmed = messages.slice(-50);
      const serial = JSON.stringify(trimmed);
      if (serial.length > 500_000) return;
      sessionStorage.setItem(chatPanelMessagesKey(user.uid), serial);
    } catch {
      /* kvota / privatumas */
    }
  }, [messages, user.uid]);

  const handleConfirmTranscript = () => {
    if (pendingTranscript) {
      const base = micDictationBaseRef.current;
      const trimmedBase = base.replace(/\s+$/, '');
      setInput(trimmedBase ? `${trimmedBase} ${pendingTranscript}`.trim() : pendingTranscript);
      setPendingTranscript(null);
    }
  };

  const handleEditTranscript = () => {
    if (pendingTranscript) {
      const base = micDictationBaseRef.current;
      const trimmedBase = base.replace(/\s+$/, '');
      setInput(trimmedBase ? `${trimmedBase} ${pendingTranscript}`.trim() : pendingTranscript);
      setPendingTranscript(null);
    }
  };

  const handleRetryVoice = () => {
    setPendingTranscript(null);
    // Restart voice recording
    toggleRecording();
  };

  const finalizeMicTranscriptToInput = () => {
    if (micLiveUpdatedRef.current) {
      micLiveUpdatedRef.current = false;
      tempTranscriptRef.current = '';
      finalTranscriptRef.current = '';
      latestTranscriptRef.current = '';
      return;
    }
    const finalResult =
      `${finalTranscriptRef.current} ${tempTranscriptRef.current} ${latestTranscriptRef.current}`.trim();
    if (finalResult) {
      // Instead of directly setting, show for confirmation
      setPendingTranscript(finalResult);
    } else {
      // Show failure message
      setPendingTranscript(null);
      showToast.error(
        'Balso atpažinimas nepavyko. Įveskite tekstą ranka arba bandykite dar kartą.'
      );
    }
    tempTranscriptRef.current = '';
    finalTranscriptRef.current = '';
    latestTranscriptRef.current = '';
  };

  const continueMobileSpeechRecognition = useCallback(() => {
    setMicNeedsGestureContinue(false);
    if (!micSessionWantedRef.current) return;
    try {
      startSpeechInstanceRef.current?.();
    } catch (e) {
      logDevError('continueMobileSpeechRecognition', e);
      micSessionWantedRef.current = false;
      setIsRecording(false);
    }
  }, []);

  const clearGeminiMicTimer = () => {
    if (geminiRecordTimerRef.current) {
      clearTimeout(geminiRecordTimerRef.current);
      geminiRecordTimerRef.current = null;
    }
  };

  const stopGeminiDictation = async () => {
    clearGeminiMicTimer();
    const rec = geminiMediaRecorderRef.current;
    const stream = geminiMediaStreamRef.current;
    geminiMediaRecorderRef.current = null;
    geminiMediaStreamRef.current = null;

    if (rec && rec.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        rec.addEventListener('stop', () => resolve(), { once: true });
        try {
          if (typeof rec.requestData === 'function') rec.requestData();
          rec.stop();
        } catch {
          resolve();
        }
      });
    }
    stream?.getTracks().forEach((t) => t.stop());

    const mime = geminiMimeRef.current || 'audio/webm';
    const chunks = geminiMediaChunksRef.current;
    geminiMediaChunksRef.current = [];
    const blob = new Blob(chunks, { type: mime });

    setIsRecording(false);
    if (blob.size < 200) {
      micSessionWantedRef.current = false;
      showToast.error('Ä®raÅas per trumpas ā€” kalbÄ—kite ilgiau arba patikrinkite mikrofonÄ….');
      return;
    }

    const gk = getGeminiApiKeyForSdk();
    if (!gk.trim()) {
      micSessionWantedRef.current = false;
      showToast.error('TrÅ«ksta Google Gemini rakto transkripcijai.');
      return;
    }
    if (shouldApplyClientAiDailyBudget(gk) && !consumeAiBudget(1)) {
      micSessionWantedRef.current = false;
      showToast.error('Pasiektas AI dienos limitas. Transkripcija neÄÆvyko.');
      return;
    }

    setIsTranscribingMic(true);
    try {
      const text = await transcribeAudioBlobWithGemini(blob, gk);
      if (text) {
        const base = micDictationBaseRef.current.replace(/\s+$/, '');
        setInput(base ? `${base} ${text}`.trim() : text);
        micLiveUpdatedRef.current = true;
      } else {
        showToast.error('Nepavyko atpaÅ¾inti balso. Bandykite aiÅkiau arba trumpesnis sakinys.');
      }
    } catch (e) {
      logDevError('transcribeAudioBlobWithGemini', e);
      showToast.error(
        'Transkripcijos klaida. Bandykite trumpesnÄÆ ÄÆraÅÄ… arba kitÄ… narÅyklÄ™ (Chrome).'
      );
    } finally {
      setIsTranscribingMic(false);
      micSessionWantedRef.current = false;
    }
  };

  const startGeminiDictation = async () => {
    if (!window.isSecureContext) {
      showToast.error('Balso ÄÆvedimas veikia tik per saugÅ³ ryÅÄÆ (HTTPS arba localhost).');
      return;
    }
    if (isTranscribingMic) return;

    stopSpeaking();
    setMicNeedsGestureContinue(false);
    micSessionWantedRef.current = true;
    micDictationBaseRef.current = inputRef.current;
    micLiveUpdatedRef.current = false;

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: getGeminiDictationAudioConstraints(),
        });
      } catch (e) {
        const name =
          e && typeof e === 'object' && 'name' in e ? String((e as DOMException).name) : '';
        if (name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw e;
        }
      }
      geminiMediaStreamRef.current = stream;

      const mime = pickRecorderMimeTypeForDevice();
      const recOpts: MediaRecorderOptions = {};
      if (mime) recOpts.mimeType = mime;
      if (isAndroidUserAgent() && mime && /webm/i.test(mime)) {
        recOpts.audioBitsPerSecond = 128000;
      }
      const rec =
        Object.keys(recOpts).length > 0
          ? new MediaRecorder(stream, recOpts)
          : new MediaRecorder(stream);
      geminiMimeRef.current = mime || rec.mimeType || 'audio/webm';
      geminiMediaChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) geminiMediaChunksRef.current.push(e.data);
      };
      rec.start(100);
      geminiMediaRecorderRef.current = rec;
      setIsRecording(true);

      clearGeminiMicTimer();
    } catch (e) {
      logDevError('startGeminiDictation', e);
      micSessionWantedRef.current = false;
      showToast.error('Nepavyko pasiekti mikrofono ā€” leiskite prieigÄ… nustatymuose.');
    }
  };

  const toggleRecording = () => {
    const now = Date.now();
    if (now - lastMicToggleAtRef.current < MIC_TOGGLE_DEBOUNCE_MS) return;
    lastMicToggleAtRef.current = now;

    const SpeechRecognition = getSpeechRecognitionCtor();

    // Prioritetas: tikras ā€˛liveā€ klausymas kaip ChatGPT.
    // Recorder+transcribe naudojame tik kaip avarinÄÆ fallback, kai Web Speech nÄ—ra.
    if (!SpeechRecognition) {
      setShowUnsupportedMessage(true);
      setTimeout(() => setShowUnsupportedMessage(false), 5000);
      showToast.error(
        isLikelyMobile
          ? 'Å i mobilioji narÅyklÄ— nepalaiko balso atpaÅ¾inimo. Rekomenduojama Chrome (Android) arba Safari su ÄÆjungtu mikrofono leidimu.'
          : 'JÅ«sÅ³ narÅyklÄ— nepalaiko balso atpaÅ¾inimo funkcijos. Naudokite Chrome ar Edge.'
      );
      return;
    }

    if (isRecording) {
      micSessionWantedRef.current = false;
      setMicNeedsGestureContinue(false);
      setShowListeningHint(false);
      setShowRetryingHint(false);
      setShowSilenceHint(false);
      setShowNoTranscriptMessage(false);
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          logDevError('Error stopping recognition', e);
          setIsRecording(false);
          recognitionRef.current = null;
        }
      } else {
        setIsRecording(false);
      }
    } else {
      if (!window.isSecureContext) {
        showToast.error('Balso ÄÆvedimas veikia tik per saugÅ³ ryÅÄÆ (HTTPS arba localhost).');
        return;
      }

      stopSpeaking();
      setMicNeedsGestureContinue(false);
      setShowRetryingHint(false);
      micSessionWantedRef.current = true;
      micRetryCountRef.current = 0;
      micLastErrorRef.current = null;
      micHasTranscriptRef.current = false;

      const startOneInstance = () => {
        const Ctor = getSpeechRecognitionCtor();
        if (!Ctor) {
          micSessionWantedRef.current = false;
          setIsRecording(false);
          return;
        }
        try {
          const recognition = new Ctor();
          /* Mobilus Chrome: continuous+async prieÅ start() daÅ¾nai duoda tuÅÄ¨iÄ… rezultatÄ… ā€” start() turi bÅ«ti tame paÄ¨iame paspaudime. */
          recognition.continuous = !isLikelyMobile;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          const preferredLang = (selectedLang || 'lt-LT').trim() || 'lt-LT';
          recognition.lang = preferredLang;

          recognition.onstart = () => {
            setMicNeedsGestureContinue(false);
            setShowRetryingHint(micRetryCountRef.current > 0);
            setShowListeningHint(micRetryCountRef.current === 0);
            setShowSilenceHint(false);
            setShowNoTranscriptMessage(false);
            setShowUnsupportedMessage(false);
            setShowPermissionDeniedMessage(false);
            micLastErrorRef.current = null;
            micDictationBaseRef.current = inputRef.current;
            tempTranscriptRef.current = '';
            finalTranscriptRef.current = '';
            latestTranscriptRef.current = '';
            micLiveUpdatedRef.current = false;
            setIsRecording(true);
            silenceTimeoutRef.current = setTimeout(() => {
              setShowSilenceHint(true);
            }, 3000);
          };

          recognition.onresult = (event: {
            resultIndex?: number;
            results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
          }) => {
            const allResultsTranscript = Array.from(event.results)
              .map((r) => (r?.[0]?.transcript ?? '').trim())
              .filter(Boolean)
              .join(' ')
              .trim();
            if (allResultsTranscript) {
              latestTranscriptRef.current = allResultsTranscript;
            }

            const startAt = event.resultIndex ?? 0;
            let interimChunk = '';
            for (let i = startAt; i < event.results.length; i++) {
              const result = event.results[i];
              const chunk = (result?.[0]?.transcript ?? '').trim();
              if (!chunk) continue;
              if (result?.isFinal) {
                finalTranscriptRef.current = `${finalTranscriptRef.current} ${chunk}`.trim();
              } else {
                interimChunk = `${interimChunk} ${chunk}`.trim();
              }
            }
            tempTranscriptRef.current = interimChunk;

            const spokenPiece = `${finalTranscriptRef.current} ${tempTranscriptRef.current}`.trim();
            if (spokenPiece) {
              micHasTranscriptRef.current = true;
              micLiveUpdatedRef.current = true;
              setShowRetryingHint(false);
              setShowSilenceHint(false);
              // Instead of directly setting input, show for confirmation
              setPendingTranscript(spokenPiece);
            }
          };

          recognition.onerror = (event: { error: string }) => {
            recognitionRef.current = null;
            micSessionWantedRef.current = false;
            setMicNeedsGestureContinue(false);
            setIsRecording(false);
            setShowListeningHint(false);
            setShowRetryingHint(false);
            micLastErrorRef.current = event.error;
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              setShowPermissionDeniedMessage(true);
              return;
            }
            if (event.error === 'no-speech') {
              return;
            }
            if (event.error === 'network' || event.error === 'aborted') {
              lastSpeechErrorAlertAtRef.current = Date.now();
              return;
            }
          };

          recognition.onend = () => {
            recognitionRef.current = null;
            const finalTranscript =
              `${finalTranscriptRef.current} ${tempTranscriptRef.current}`.trim();
            const hasTranscript = micHasTranscriptRef.current || Boolean(finalTranscript);
            const decision = decideVoiceFallback({
              retryCount: micRetryCountRef.current,
              maxRetries: MIC_MAX_RETRY_COUNT,
              hasTranscript,
              errorType: micLastErrorRef.current,
            });
            if (decision.retry) {
              micRetryCountRef.current += 1;
              setShowListeningHint(false);
              setShowRetryingHint(true);
              setShowNoTranscriptMessage(false);
              setShowSilenceHint(false);
              startSpeechInstanceRef.current?.();
              return;
            }
            setIsRecording(false);
            setMicNeedsGestureContinue(false);
            setShowListeningHint(false);
            setShowRetryingHint(false);
            setShowSilenceHint(false);
            micSessionWantedRef.current = false;
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }
            finalizeMicTranscriptToInput();
            if (decision.finalFallback) {
              setShowNoTranscriptMessage(true);
              setTimeout(() => setShowNoTranscriptMessage(false), 5000);
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (error) {
          logDevError('Failed to start recognition', error);
          micSessionWantedRef.current = false;
          setMicNeedsGestureContinue(false);
          setIsRecording(false);
          showToast.error(
            'Nepavyko pradÄ—ti balso atpaÅ¾inimo. Patikrinkite ar mikrofonas prijungtas.'
          );
          recognitionRef.current = null;
        }
      };

      startSpeechInstanceRef.current = startOneInstance;
      startOneInstance();

      if (isLikelyMobile && navigator.mediaDevices?.getUserMedia) {
        void navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            stream.getTracks().forEach((t) => t.stop());
          })
          .catch(() => {
            /* Speech API gali vis tiek veikti; jei ne ā€” onerror parodys */
          });
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleToolCall = useCallback(
    (call: unknown) =>
      runAssistantToolCall(call, {
        user,
        dataOwnerId,
        clients,
        orders,
        expenses,
        employees,
        settings,
        isRestrictedStaff,
        setMemories,
        patchOrder,
        removeOrderFromState,
        upsertOrder,
      }),
    [
      user,
      dataOwnerId,
      clients,
      orders,
      expenses,
      employees,
      settings,
      isRestrictedStaff,
      setMemories,
      patchOrder,
      removeOrderFromState,
      upsertOrder,
    ]
  );

  const handleOpenKeySelector = async () => {
    const aiStudio = getAiStudio();
    if (aiStudio?.openSelectKey) {
      await aiStudio.openSelectKey();
      localStorage.removeItem('custom_api_key');
      setCustomApiKey('');
    }
  };

  const handleSaveCustomKey = () => {
    if (customApiKey.trim()) {
      const trimmed = customApiKey.trim();
      localStorage.setItem('custom_api_key', trimmed);
      if (trimmed.startsWith('sk-or-v1-')) {
        localStorage.setItem('openrouter_api_key', trimmed);
      } else {
        localStorage.removeItem('openrouter_api_key');
      }
      setApiKeyProvider(
        trimmed.startsWith('sk-or-v1-')
          ? 'openrouter'
          : trimmed.startsWith('sk-')
            ? 'opencode'
            : 'google'
      );
      setShowApiSettings(false);
    } else {
      localStorage.removeItem('custom_api_key');
      checkApiKey();
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    if (!messageText) {
      const now = Date.now();
      if (now - lastSendAtMsRef.current < SEND_DEBOUNCE_MS) return;
      lastSendAtMsRef.current = now;
    }

    lastUserMessageRef.current = textToSend;
    if (!messageText) setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: textToSend, timestamp: Date.now() }]);
    setIsLoading(true);

    try {
      const apiKey =
        localStorage.getItem('custom_api_key') ||
        getAiStudio()?.getApiKey?.() ||
        getGeminiKeyFromEnv();
      const result = await chatWithAssistant(textToSend, history, assistantDataContext);

      // Check if we hit fallback
      if (
        result.text?.includes('AI smegenys ilsisi') ||
        result.text?.includes('modeliai yra perkrauti')
      ) {
        setIsAiOffline(true);
      } else {
        setIsAiOffline(false);
      }

      let currentHistory = result.history;
      let finalResponse = result.text;

      const rawFunctionCalls =
        'functionCalls' in result
          ? (result as { functionCalls?: unknown }).functionCalls
          : undefined;
      const toolCalls = Array.isArray(rawFunctionCalls) ? rawFunctionCalls : undefined;
      if (toolCalls?.length) {
        const functionResponses = [];
        for (const call of toolCalls) {
          const toolResult = await handleToolCall(call);
          functionResponses.push({
            role: 'function',
            parts: [
              {
                functionResponse: {
                  name: call.name,
                  response: { result: toolResult },
                  id: call.id,
                },
              },
            ],
          });
        }

        // Add tool calls to history if not already there
        const toolCallHistory = toolCalls.map((tc) => {
          const c = tc as AssistantToolCall;
          return {
            role: 'model',
            parts: [
              {
                functionCall: {
                  name: c.name,
                  args: c.args,
                  id: c.id,
                },
              },
            ],
          };
        });

        const updatedHistory = [...currentHistory, ...toolCallHistory, ...functionResponses];

        // Send tool results back to get a natural language confirmation
        try {
          const hasInvoiceApiBase = !!getInvoiceApiBaseUrl().trim();
          const useOpenCodeSecond =
            hasInvoiceApiBase ||
            !!getOpenCodeKey() ||
            (typeof apiKey === 'string' && apiKey.trim() !== '' && isOpenCodeKey(apiKey));

          if (isOpenRouterKey(apiKey) || useOpenCodeSecond) {
            // OpenRouter arba OpenCode (serverio proxy / sk-): tas pats kelias kaip pirmame Å¾ingsnyje
            const secondResult = await chatWithAssistant('', updatedHistory, assistantDataContext);
            finalResponse = secondResult.text;
            currentHistory = secondResult.history;
          } else {
            const geminiKey = getGeminiApiKeyForSdk();
            if (!geminiKey) {
              finalResponse =
                finalResponse || 'TrÅ«ksta Google Gemini rakto antram uÅ¾klausos Å¾ingsniui.';
            } else {
              const ai = getAiInstance(geminiKey);
              const modelsToTry = [
                'gemini-2.0-flash',
                'gemini-2.5-flash',
                'gemini-flash-latest',
                'gemini-1.5-flash',
                'gemini-1.5-flash-8b',
              ];
              let secondResponseText = '';
              let secondHistory: ChatHistoryMessage[] = [];

              for (const modelName of modelsToTry) {
                try {
                  const secondChat = ai.chats.create({
                    model: modelName,
                    history: sanitizeHistoryForGemini(updatedHistory) as ReturnType<
                      typeof sanitizeHistoryForGemini
                    >,
                  });
                  const secondResponse = await secondChat.sendMessage({
                    message: 'Apdorok veiksmÅ³ rezultatus ir patvirtink vartotojui.',
                  });
                  secondResponseText = secondResponse.text;
                  secondHistory = await secondChat.getHistory();
                  break;
                } catch (err) {
                  console.warn(`Second chat with ${modelName} failed:`, err);
                }
              }

              if (secondResponseText) {
                finalResponse = secondResponseText;
                currentHistory = secondHistory;
              } else {
                // Fallback if second call fails
                finalResponse =
                  'Veiksmai atlikti sÄ—kmingai, bet nepavyko sugeneruoti patvirtinimo teksto. Ar galiu dar kuo nors padÄ—ti?';
                currentHistory = updatedHistory;
              }
            }
          }
        } catch (e) {
          logDevError('Second chat error:', e);
          finalResponse =
            'Veiksmai atlikti, bet ÄÆvyko klaida generuojant atsakymÄ…. Patikrinkite duomenis sÄ…raÅuose.';
          currentHistory = updatedHistory;
        }
      }

      if (toolCalls?.length && !String(finalResponse ?? '').trim()) {
        finalResponse =
          'Ä®rankiai vykdyti, bet atsakymo tekstas nebuvo sugeneruotas. Bandykite trumpai pakartoti klausimÄ… arba atnaujinkite puslapÄÆ.';
      }

      if (finalResponse) {
        if (finalResponse.startsWith('[QUOTA_EXCEEDED]')) {
          const cleanMsg = finalResponse.replace('[QUOTA_EXCEEDED]', '').trim();
          showToast.error(cleanMsg);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'model', text: finalResponse!, timestamp: Date.now() },
          ]);
        }
      }

      setHistory(currentHistory);
      localStorage.setItem('chat_history_' + user.uid, JSON.stringify(currentHistory));
      setLastFailedMessage(null);

      if (finalResponse && textToSend) {
        // Check if should create a memory
        const memoryCheck = shouldSuggestMemory(textToSend, finalResponse, memories);
        if (memoryCheck.shouldRemember && memoryCheck.suggestedContent) {
          const category = detectMemoryCategory(textToSend, finalResponse);
          try {
            const saved = (await addData('memories', dataOwnerId, {
              content: memoryCheck.suggestedContent,
              category,
              importance: 3,
              uid: authUid,
              createdAt: new Date().toISOString(),
              isActive: true,
            } as Record<string, unknown>)) as unknown as Memory;
            setMemories((prev) => [...prev, saved]);
          } catch (memError) {
            console.warn('Failed to auto-save memory:', memError);
          }
        }

        // Check if should create an order from conversation
        const orderDetection = detectOrderInConversation(textToSend, finalResponse, clients);
        if (orderDetection.shouldCreate && orderDetection.clientId) {
          try {
            const client = clients.find((c) => c.id === orderDetection.clientId);
            if (client) {
              const newOrder = {
                clientId: orderDetection.clientId,
                clientName: client.name,
                address: client.address,
                date: orderDetection.date || new Date().toISOString().split('T')[0],
                time: orderDetection.time || '10:00',
                windowCount: orderDetection.windowCount || 5,
                floor: 1,
                additionalServices: {
                  balkonai: false,
                  vitrinos: false,
                  terasa: false,
                  kiti: false,
                },
                totalPrice: (orderDetection.windowCount || 5) * 5,
                status: 'suplanuota' as const,
                notes: `Sukurta iÅ pokalbio: ${textToSend.slice(0, 100)}`,
                createdAt: new Date().toISOString(),
              };
              await addData(TABLES.ORDERS, dataOwnerId, newOrder);
              console.log('Auto-created order from conversation');
            }
          } catch (orderError) {
            console.warn('Failed to auto-create order:', orderError);
          }
        }
      }
    } catch (error) {
      logDevError('Chat Error:', error);
      const detail =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'nenumatyta tinklo ar serverio klaida ā€” patikrinkite ryÅÄÆ ir API nustatymus';
      const errorMsg = `AtsipraÅau, asistentas Åiuo metu neatsakÄ—: ${detail}. Bandykite trumpesnÄ™ uÅ¾klausÄ… arba pakartokite po keliÅ³ sekundÅ¾iÅ³.`;
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: errorMsg, timestamp: Date.now(), failed: true },
      ]);
      setLastFailedMessage(textToSend);
    } finally {
      setIsLoading(false);
    }
  };

  // Timeout fallback ā€” OpenRouter free tier + tool round-trips can exceed 30s
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn('AI request timeout - resetting loading state');
          setIsLoading(false);
          setMessages((prev) => [
            ...prev,
            {
              role: 'model',
              text: 'AtsipraÅau, atsakymas uÅ¾truko per ilgai. Bandykite trumpesnÄ™ uÅ¾klausÄ…, palaukite ir bandykite vÄ—l, arba patikrinkite API raktÄ… / tinklÄ….',
              timestamp: Date.now(),
            },
          ]);
          setLastFailedMessage(lastUserMessageRef.current);
        }
      }, 90000);
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        title="Atidaryti asistentÄ…"
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-blue-700 transition-colors"
      >
        <Bot size={28} />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="fixed z-50 left-0 right-0 bottom-0 h-[min(92dvh,640px)] flex flex-col bg-white shadow-2xl border-t border-slate-200 rounded-t-2xl overflow-hidden md:left-auto md:right-4 md:bottom-20 md:top-auto md:w-96 md:h-[600px] md:rounded-2xl md:border"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-assistant-title"
          >
            {/* Header */}
            <div className="bg-blue-600 px-4 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                  <Bot size={22} />
                </div>
                <div>
                  <h3 id="chat-assistant-title" className="font-semibold text-sm">
                    Asistentas
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[10px] opacity-80">Klausimai apie uÅ¾sakymus ir duomenis</p>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-md font-medium bg-white/20 text-white max-w-[11rem] truncate"
                      title={`Dabar atidaryta: ${activeViewLabel}`}
                    >
                      {activeViewLabel}
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-md font-medium ${
                        isAiOffline
                          ? 'bg-amber-500/25 text-amber-100'
                          : apiKeyProvider === 'opencode'
                            ? 'bg-white/15 text-white'
                            : apiKeyProvider === 'openrouter'
                              ? 'bg-white/15 text-white'
                              : apiKeyProvider === 'google'
                                ? 'bg-white/15 text-white'
                                : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {isAiOffline
                        ? 'Neprijungta'
                        : apiKeyProvider === 'opencode'
                          ? 'OpenCode'
                          : apiKeyProvider === 'openrouter'
                            ? 'OpenRouter'
                            : apiKeyProvider === 'google'
                              ? 'Google API'
                              : 'Numatytasis'}
                    </span>
                  </div>
                  <p className="text-[9px] opacity-85 mt-1.5 leading-snug pr-2">
                    NarÅykite kitas skiltis ā€” langas ir pokalbis lieka. Apie ā€˛Ä¨ia matomÄ…ā€
                    galite klausti pagal virÅuje rodomÄ… skiltÄÆ.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={stopSpeaking}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  title="Sustabdyti visÄ… garsÄ…"
                >
                  <VolumeX size={16} />
                </button>
                <button
                  onClick={() => setShowApiSettings(!showApiSettings)}
                  className={`p-2 rounded-full transition-colors ${showApiSettings ? 'bg-white text-blue-600' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
                  title="API nustatymai"
                >
                  <Settings2 size={16} />
                </button>
                <button
                  onClick={() => setShowMemories(!showMemories)}
                  className={`p-2 rounded-full transition-colors ${showMemories ? 'bg-white text-blue-600' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
                  title="Asistento atmintis"
                >
                  <Brain size={16} />
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      setMessages([]);
                      setHistory([]);
                      setLastFailedMessage(null);
                      localStorage.removeItem('chat_history_' + user.uid);
                      try {
                        sessionStorage.removeItem(chatPanelMessagesKey(user.uid));
                      } catch {
                        /* */
                      }
                    }}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                    title="IÅvalyti pokalbÄÆ"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {lastFailedMessage && (
                  <button
                    onClick={() => {
                      setInput(lastFailedMessage);
                      setLastFailedMessage(null);
                      // Automatically send the message
                      setTimeout(() => {
                        const sendButton = document.getElementById('chat-send-btn');
                        if (sendButton) sendButton.click();
                      }, 100);
                    }}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-yellow-300 hover:text-yellow-200"
                    title="Pakartoti paskutinÄÆ"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  title="UÅ¾daryti asistentÄ…"
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 relative"
            >
              <AnimatePresence>
                <ChatApiSettings
                  showSettings={showApiSettings}
                  setShowSettings={setShowApiSettings}
                  customApiKey={customApiKey}
                  setCustomApiKey={setCustomApiKey}
                  apiKeyProvider={apiKeyProvider}
                  onSave={handleSaveCustomKey}
                  onUseDefault={() => {
                    localStorage.removeItem('custom_api_key');
                    localStorage.removeItem('openrouter_api_key');
                    setCustomApiKey('');
                    checkApiKey();
                    setShowApiSettings(false);
                  }}
                  onOpenKeySelector={handleOpenKeySelector}
                  hasEnvKey={
                    !!getGeminiKeyFromEnv() ||
                    !!(import.meta.env.VITE_OPENROUTER_API_KEY || '').trim()
                  }
                  selectedVoice={draftVoice}
                  onVoiceChange={setDraftVoice}
                  selectedLang={draftLang}
                  onLangChange={setDraftLang}
                  voiceRate={draftRate}
                  onRateChange={setDraftRate}
                  ttsModel={draftTtsModel}
                  onTtsModelChange={setDraftTtsModel}
                  onPreviewVoice={previewVoice}
                  onSaveVoiceSettings={saveVoiceSettingsWithModel}
                  dirtyVoiceSettings={dirtyVoiceSettingsAll}
                />

                {showMemories && (
                  <motion.div
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    className="absolute inset-0 bg-white z-20 overflow-y-auto p-6"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-black text-slate-900 flex items-center gap-2">
                        <Brain size={18} className="text-blue-600" />
                        Asistento atmintis
                      </h4>
                      <button
                        onClick={() => setShowMemories(false)}
                        title="UÅ¾daryti atmintÄÆ"
                        className="p-2 bg-slate-50 rounded-full text-slate-400"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {memories.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-xs text-slate-400">
                          Atmintis tuÅÄ¨ia. Pasakykite man kaÅ¾kÄ… svarbaus ir aÅ tai ÄÆsiminsiu.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {memories.map((memory) => (
                          <div
                            key={memory.id}
                            className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group"
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mb-2 inline-block">
                                  {memory.category}
                                </span>
                                <p className="text-xs text-slate-700 leading-relaxed">
                                  {memory.content}
                                </p>
                              </div>
                              {!isRestrictedStaff && (
                                <button
                                  onClick={() =>
                                    handleToolCall({
                                      name: 'delete_memory',
                                      args: { memoryId: memory.id },
                                    })
                                  }
                                  title="IÅtrinti atminties ÄÆraÅÄ…"
                                  className="p-2 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {messages.length === 0 && (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto text-blue-600">
                    <Bot size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">Sveiki, vadove!</p>
                    <p className="text-xs text-slate-400 px-10">
                      Galiu padÄ—ti pridÄ—ti klientus, uÅ¾sakymus ar iÅlaidas. Tiesiog paraÅykite
                      man.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-4">
                    {[
                      'PridÄ—k klientÄ…',
                      'Sukurk uÅ¾sakymÄ…',
                      'Ä®raÅyk iÅlaidas',
                      'Mano atmintis',
                    ].map((hint) => (
                      <button
                        key={hint}
                        onClick={() => {
                          if (hint === 'Mano atmintis') {
                            setShowMemories(true);
                          } else {
                            setInput(hint);
                          }
                        }}
                        className="text-[10px] font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <MessageList
                messages={messages}
                isLoading={isLoading}
                speakingMessageIndex={speakingMessageIndex}
                onSpeak={speak}
                showVoiceSelector={showVoiceSelector}
                setShowVoiceSelector={setShowVoiceSelector}
                selectedVoice={draftVoice}
                onVoiceChange={setDraftVoice}
                selectedLang={draftLang}
                onLangChange={setDraftLang}
                voiceRate={draftRate}
                onRateChange={setDraftRate}
                dirtyVoiceSettings={dirtyVoiceSettings}
                onSaveVoiceSettings={saveVoiceSettings}
                onResetVoiceSettings={resetVoiceSettings}
                voiceSettingsAnchorIndex={voiceSettingsAnchorIndex}
                setVoiceSettingsAnchorIndex={setVoiceSettingsAnchorIndex}
                scrollRef={scrollRef}
              />
            </div>

            {/* Transcript Confirmation */}
            {pendingTranscript && (
              <div className="p-4 bg-blue-50 border-t border-blue-100">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-2">Balsas atpažintas:</div>
                    <div className="text-sm text-blue-800 bg-white p-3 rounded-lg border border-blue-200">
                      {pendingTranscript}
                    </div>
                    <div className="text-xs text-blue-600 mt-2">
                      Balsas įvestis veikia per naršyklę ir gali būti nestabili. (beta)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmTranscript}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Siųsti
                    </button>
                    <button
                      onClick={handleEditTranscript}
                      className="px-4 py-2 bg-white text-blue-600 text-sm rounded-lg border border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      Redaguoti
                    </button>
                    <button
                      onClick={handleRetryVoice}
                      className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Bandyti dar kartą
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-6 bg-white border-t border-slate-100">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={
                    isTranscribingMic ? '…' : isRecording ? 'Klausausi…' : 'Rašykite čia…'
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-4 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <div className="absolute right-2 top-2 bottom-2 flex gap-1">
                  <VoiceRecorder
                    isRecording={isRecording}
                    isTranscribingMic={isTranscribingMic}
                    micNeedsGestureContinue={micNeedsGestureContinue}
                    onToggle={toggleRecording}
                    onContinueGesture={continueMobileSpeechRecognition}
                    showPreviewMicHint={showPreviewMicHint}
                    showListeningHint={showListeningHint}
                    showRetryingHint={showRetryingHint}
                    showSilenceHint={showSilenceHint}
                    showNoTranscriptMessage={showNoTranscriptMessage}
                    showUnsupportedMessage={showUnsupportedMessage}
                    showPermissionDeniedMessage={showPermissionDeniedMessage}
                  />

                  {isLoading ? (
                    <button
                      onClick={() => {
                        setIsLoading(false);
                        setMessages((prev) => [
                          ...prev,
                          { role: 'model', text: 'UÅ¾klausa sustabdyta.', timestamp: Date.now() },
                        ]);
                      }}
                      className="w-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-all"
                      title="Sustabdyti"
                    >
                      <X size={18} />
                    </button>
                  ) : (
                    <button
                      id="chat-send-btn"
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      title="SiÅ³sti Å¾inutÄ™"
                      className="w-10 bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:scale-95 transition-all"
                    >
                      <Send size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
