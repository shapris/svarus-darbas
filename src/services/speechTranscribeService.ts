/**
 * Balso transkripcija per Google Gemini (multimodal audio) — patikimesnis kelias nei Web Speech API telefone.
 */
import { getAiInstance } from './aiService';

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
  const mimeType = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'audio/webm';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: 'Transkribuok šį garsą. Atsakyk TIK transkribuotu tekstu: be kabučių, be „Štai transkripcija“. Kalba dažniausiai lietuvių.',
          },
        ],
      },
    ],
  });

  const text = response.text?.trim();
  if (!text || text.length < 1) return null;
  return text;
}
