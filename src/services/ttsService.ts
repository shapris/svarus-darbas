// Text-to-Speech services for AI assistant
import { Modality } from '@google/genai';
import { getAiInstance } from './aiService';
import { isOpenRouterKey } from './openRouterService';
import { getGeminiKeyFromEnv } from '../utils/geminiEnv';

let currentAudio: HTMLAudioElement | null = null;

export function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function wrapPcmInWav(base64Pcm: string, sampleRate: number = 24000): string {
  const pcmData = Uint8Array.from(atob(base64Pcm), (c) => c.charCodeAt(0));
  const dataSize = pcmData.length;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, dataSize, true);

  const wavData = new Uint8Array(44 + dataSize);
  wavData.set(new Uint8Array(header), 0);
  wavData.set(pcmData, 44);

  let binary = '';
  const bytes = new Uint8Array(wavData);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to map voice names to Google voices
function mapToGoogleVoice(voice: string): string {
  const googleVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede'];
  return googleVoices.includes(voice) ? voice : 'Zephyr';
}

// ElevenLabs TTS
export async function getElevenLabsSpeech(
  text: string,
  voice: string = 'bella'
): Promise<HTMLAudioElement | null> {
  const apiKey = localStorage.getItem('custom_api_key') || '';
  if (!apiKey || !apiKey.startsWith('sk_')) return null;

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return new Audio(url);
  } catch {
    return null;
  }
}

// OpenAI TTS via OpenRouter
export async function getOpenAITSViaOpenRouter(
  text: string,
  voice: string = 'alloy'
): Promise<HTMLAudioElement | null> {
  const apiKey = localStorage.getItem('custom_api_key') || '';
  if (!apiKey) return null;

  // Map common voice names to OpenAI voices
  const voiceMap: Record<string, string> = {
    Puck: 'onyx',
    Charon: 'onyx',
    Kore: 'nova',
    Fenrir: 'shimmer',
    Zephyr: 'alloy',
    Aoede: 'alloy',
    rachel: 'nova',
    domi: 'nova',
    adam: 'onyx',
    sam: 'shimmer',
    bella: 'shimmer',
    josh: 'onyx',
  };
  const openAIVoice = voiceMap[voice] || 'alloy';

  // OpenRouter deprecated their audio/speech endpoint, use browser TTS as fallback
  return null;
}

// Extended voice types for all providers
export type VoiceProvider = 'google' | 'elevenlabs' | 'openai' | 'browser';
export type GoogleVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Aoede';
export type ElevenLabsVoice = 'rachel' | 'domi' | 'adam' | 'sam' | 'bella' | 'josh';
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export async function getSpeechAudio(
  text: string,
  voice: string = 'Zephyr',
  provider: VoiceProvider = 'google'
): Promise<HTMLAudioElement | null> {
  // Check for dedicated TTS API key first
  let apiKey = localStorage.getItem('tts_api_key') || '';

  // Fall back to main API key if no dedicated TTS key
  if (!apiKey) {
    apiKey =
      localStorage.getItem('custom_api_key') ||
      (window as any).aistudio?.getApiKey?.() ||
      getGeminiKeyFromEnv();
  }

  // If using OpenRouter key without dedicated TTS key, try browser TTS instead
  if (isOpenRouterKey(apiKey) && !localStorage.getItem('tts_api_key')) {
    return null;
  }

  const keyTrim = String(apiKey ?? '').trim();
  if (!keyTrim) {
    return null;
  }

  // Try ElevenLabs if API key looks like ElevenLabs (starts with sk_ but not sk-or-)
  if (keyTrim.startsWith('sk_') && !keyTrim.startsWith('sk-or-')) {
    const elevenResult = await getElevenLabsSpeech(text, voice);
    if (elevenResult) return elevenResult;
  }

  // Default to Google Gemini TTS (reikia tikro Gemini rakto, ne OpenRouter)
  if (isOpenRouterKey(keyTrim)) {
    return null;
  }

  let ai: ReturnType<typeof getAiInstance>;
  try {
    ai = getAiInstance(keyTrim);
  } catch {
    return null;
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [
        {
          parts: [
            {
              text: `Perskaityk šį tekstą kaip gyvas, šiltas, modernus ir itin profesionalus asistentas. Naudok natūralią, žmogišką intonaciją, daryk logines pauzes, skambėk užtikrintai ir maloniai. Svarbu: venk bet kokio robotiškumo ar senamadiško tono. Tekstas: ${text}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: mapToGoogleVoice(voice) },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const wavBase64 = wrapPcmInWav(base64Audio);
      return new Audio(`data:audio/wav;base64,${wavBase64}`);
    }
  } catch (error: any) {
    const isQuotaError =
      error?.status === 'RESOURCE_EXHAUSTED' ||
      error?.code === 429 ||
      error?.error?.code === 429 ||
      error?.error?.status === 'RESOURCE_EXHAUSTED' ||
      (typeof error === 'string' && error.includes('429'));

    if (isQuotaError) {
      // Quota exceeded, will fallback to browser TTS
    }
  }
  return null;
}

export async function generateSpeech(
  text: string,
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Zephyr'
) {
  // Get voice rate from localStorage or use default
  const rate = parseFloat(localStorage.getItem('voice_rate') || '1.0');
  const selectedLang = localStorage.getItem('tts_language') || 'lt-LT';

  stopAllAudio();

  // Map selected voice to browser voice parameters (with Lithuanian language support)
  const voiceMap: Record<string, { lang: string; rate: number; pitch: number }> = {
    Zephyr: { lang: selectedLang, rate: 1.0, pitch: 1.0 }, // warm
    Puck: { lang: selectedLang, rate: 0.9, pitch: 0.8 }, // masculine
    Charon: { lang: selectedLang, rate: 0.85, pitch: 0.7 }, // deep
    Kore: { lang: selectedLang, rate: 1.0, pitch: 1.0 }, // neutral
    Fenrir: { lang: selectedLang, rate: 0.95, pitch: 0.9 }, // strong
    Aoede: { lang: selectedLang, rate: 1.1, pitch: 1.2 }, // gentle
  };
  const voiceSettings = voiceMap[voice] || voiceMap['Zephyr'];

  // Use browser TTS by default - it supports rate changes
  if (window.speechSynthesis) {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Smart voice selection based on language
      const voices = window.speechSynthesis.getVoices();

      // Priority: exact language match > broad language match > any available
      const langCode = selectedLang.split('-')[0]; // e.g., 'lt' from 'lt-LT'

      // Try exact match first (lt-LT)
      let selectedVoice = voices.find((v) => v.lang === selectedLang);

      // Try broad match (lt)
      if (!selectedVoice) {
        selectedVoice = voices.find((v) => v.lang.startsWith(langCode));
      }

      // Try any voice that might work for this language
      if (!selectedVoice) {
        // For Lithuanian, try Polish or Russian as fallback (similar Slavic)
        if (langCode === 'lt') {
          selectedVoice = voices.find((v) => v.lang.startsWith('pl') || v.lang.startsWith('ru'));
        }
      }

      // Last resort: use default English voice but set language anyway
      if (!selectedVoice) {
        selectedVoice = voices[0];
      }

      utterance.voice = selectedVoice;
      utterance.lang = selectedLang;
      utterance.rate = rate;
      utterance.pitch = voiceSettings.pitch;

      utterance.onend = () => {
        resolve();
      };
      utterance.onerror = (e) => {
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  // Fallback to AI TTS if browser TTS is not available
  try {
    const audio = await getSpeechAudio(text, voice);
    if (audio) {
      currentAudio = audio;
      return new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          currentAudio = null;
          resolve();
        };
        audio.onerror = (e) => {
          currentAudio = null;
          reject(e);
        };
        audio.play().catch(reject);
      });
    }
  } catch {
    /* tyčia ignoruojame TTS atkūrimo klaidas — UI jau gali rodyti būseną kitur */
  }
}
