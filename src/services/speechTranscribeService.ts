/**
 * Balso transkripcija per Google Gemini (multimodal audio) — patikimesnis kelias nei Web Speech API telefone.
 */
import { getAiInstance } from './aiService';
import { logDevError } from '../utils/devConsole';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result as string;
      const parts = r.split(',');
      resolve(parts[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const TRANSCRIBE_PROMPT =
  'Transkribuok šį garsą. Atsakyk TIK transkribuotu tekstu: be kabučių, be „Štai transkripcija“. Kalba dažniausiai lietuvių.';

/** API dažnai tikisi paprasto tipo be „;codecs=…“ (ypač WebM iš Android Chrome). */
function normalizeMimeForGeminiApi(mime: string): string {
  const t = (mime || '').trim().toLowerCase();
  if (!t || t === 'application/octet-stream') return 'audio/webm';
  if (t.startsWith('audio/webm')) return 'audio/webm';
  if (t.startsWith('audio/ogg')) return 'audio/ogg';
  if (t.includes('mp4')) return 'audio/mp4';
  return mime || 'audio/webm';
}

/**
 * Įkelia garso įrašą į Gemini ir grąžina tik tekstą.
 * Reikia tikro Gemini rakto (ne OpenRouter).
 */
export async function transcribeAudioBlobWithGemini(
  blob: Blob,
  apiKey: string
): Promise<string | null> {
  const key = String(apiKey ?? '').trim();
  if (!key || blob.size < 80) return null;

  const ai = getAiInstance(key);
  const data = await blobToBase64(blob);
  const raw = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'audio/webm';
  const primaryMime = normalizeMimeForGeminiApi(raw);

  const run = async (mimeType: string) => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType, data } }, { text: TRANSCRIBE_PROMPT }],
        },
      ],
    });
    return String(response.text ?? '').trim();
  };

  let text = '';
  try {
    text = await run(primaryMime);
  } catch (e) {
    logDevError('transcribeAudioBlobWithGemini primary', e);
  }
  if (text) return text;

  if (primaryMime !== 'audio/webm') {
    try {
      text = await run('audio/webm');
    } catch (e) {
      logDevError('transcribeAudioBlobWithGemini webm fallback', e);
    }
  }
  return text && text.length > 0 ? text : null;
}
