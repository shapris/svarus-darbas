/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, Loader2, User as UserIcon, Trash2, Mic, MicOff, Volume2, VolumeX, Brain, AlertTriangle, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { chatWithAssistant, getAiInstance, isOpenRouterKey, generateSpeech, stopAllAudio } from '../services/aiService';
import { Client, Order, Expense, AppSettings, Memory } from '../types';
import { addData, updateData, deleteData, subscribeToData, getData, TABLES } from '../supabase';
import { calculateOrderPrice } from '../utils';

import ReactMarkdown from 'react-markdown';

interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface ChatAssistantProps {
  user: LocalUser;
  clients: Client[];
  orders: Order[];
  expenses: Expense[];
  settings: AppSettings;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function ChatAssistant({ user, clients, orders, expenses, settings }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showMemories, setShowMemories] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiOffline, setIsAiOffline] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(localStorage.getItem('custom_api_key') || '');
  const [apiKeyProvider, setApiKeyProvider] = useState<'google' | 'openrouter' | 'default'>('default');
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>(localStorage.getItem('selected_voice') || 'Zephyr');
  const [voiceRate, setVoiceRate] = useState<number>(parseFloat(localStorage.getItem('voice_rate') || '1.0'));
  const [selectedLang, setSelectedLang] = useState<string>(localStorage.getItem('tts_language') || 'lt-LT');
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);

  // Available voices based on provider
  const availableVoices = {
    google: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede'],
    elevenlabs: ['rachel', 'domi', 'adam', 'sam', 'bella', 'josh'],
    openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    localStorage.setItem('selected_voice', voice);
    setShowVoiceSelector(false);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const tempTranscriptRef = useRef('');
  const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

  const checkApiKey = async () => {
    const storedKey = localStorage.getItem('custom_api_key');
    if (storedKey) {
      setHasApiKey(true);
      setApiKeyProvider(storedKey.startsWith('sk-or-v1-') ? 'openrouter' : 'google');
      return;
    }

    const aiStudio = (window as any).aistudio;
    if (aiStudio && aiStudio.hasSelectedApiKey) {
      const hasKey = await aiStudio.hasSelectedApiKey();
      setHasApiKey(hasKey);

      if (hasKey && aiStudio.getApiKey) {
        const key = aiStudio.getApiKey();
        if (key.startsWith('sk-or-v1-')) {
          setApiKeyProvider('openrouter');
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
      await generateSpeech(text, selectedVoice as 'Zephyr');
    } finally {
      setSpeakingMessageIndex(null);
    }
  };

  useEffect(() => {
    checkApiKey();

    const unsubscribe = subscribeToData<Memory>('memories', user.uid, (data) => {
      setMemories(data);
    });

    return () => {
      unsubscribe();
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [user.uid]);

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Jūsų naršyklė nepalaiko balso atpažinimo funkcijos. Naudokite Chrome ar Edge.');
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition', e);
          setIsRecording(false);
          recognitionRef.current = null;
        }
      } else {
        setIsRecording(false);
      }
    } else {
      // Stop any current speech before starting to record
      stopSpeaking();
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Allows manual stop
        recognition.interimResults = true;
        recognition.lang = 'lt-LT';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsRecording(true);
          tempTranscriptRef.current = '';
        };

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          tempTranscriptRef.current = transcript;
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          recognitionRef.current = null;

          // User-friendly error messages
          const errorMessages: Record<string, string> = {
            'not-allowed': 'Mikrofono prieiga neleista. Spauskite akutės ikoną URL juostoje ir leiskite prieigą.',
            'no-speech': 'Nebuvo girdimas joks balsas. Bandykite dar kartą.',
            'network': 'Tinklo klaida. Patikrinkite interneto ryšį.',
            'aborted': 'Įrašymas buvo nutrauktas.',
            'audio-capture': 'Mikrofonas nerastas. Prijunkite mikrofoną.',
            'service-not-allowed': 'Balso atpažinimo paslauga neleidžiama.'
          };

          const userMessage = errorMessages[event.error] || `Klaida: ${event.error}`;
          alert(userMessage);
        };

        recognition.onend = () => {
          setIsRecording(false);
          if (tempTranscriptRef.current) {
            const finalResult = tempTranscriptRef.current.trim();
            if (finalResult) {
              setInput(prev => prev + (prev ? ' ' : '') + finalResult);
            }
            tempTranscriptRef.current = '';
          }
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (error) {
        console.error('Failed to start recognition', error);
        setIsRecording(false);
        alert('Nepavyko pradėti balso atpažinimo. Patikrinkite ar mikrofonas prijungtas.');
        recognitionRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleToolCall = async (call: any) => {
    const { name, args } = call;

    try {
      if (name === 'add_client') {
        await addData(TABLES.CLIENTS, user.uid, {
          ...args,
          createdAt: new Date().toISOString(),
        });
        return `Klientas ${args.name} sėkmingai pridėtas.`;
      }

      if (name === 'update_client') {
        const { clientId, ...updates } = args;
        await updateData(TABLES.CLIENTS, clientId, updates as any);
        return `Kliento duomenys atnaujinti.`;
      }

      if (name === 'delete_client') {
        await deleteData(TABLES.CLIENTS, args.clientId);
        return `Klientas ištrintas.`;
      }

      if (name === 'add_order') {
        const clientName = args.clientName || "";
        const client = clients.find(c => (c.name || "").toLowerCase().includes(clientName.toLowerCase()));
        if (!client) return `Klaida: Klientas "${clientName}" nerastas. Pirmiausia pridėkite klientą.`;

        const additionalServices = {
          balkonai: args.additionalServices?.balkonai || false,
          vitrinos: args.additionalServices?.vitrinos || false,
          terasa: args.additionalServices?.terasa || false,
          kiti: args.additionalServices?.kiti || false
        };

        const totalPrice = calculateOrderPrice(args.windowCount, args.floor, additionalServices, settings);

        await addData(TABLES.ORDERS, user.uid, {
          clientId: client.id,
          clientName: client.name,
          address: args.address,
          date: args.date,
          time: args.time,
          windowCount: args.windowCount,
          floor: args.floor,
          estimatedDuration: args.estimatedDuration || 60,
          additionalServices,
          totalPrice,
          status: 'suplanuota',
          notes: args.notes || '',
          createdAt: new Date().toISOString(),
        });
        return `Užsakymas klientui ${client.name} sėkmingai sukurtas ${args.date} ${args.time}.`;
      }

      if (name === 'update_order') {
        const { orderId, ...updates } = args;
        const existingOrder = orders.find(o => o.id === orderId);

        if (existingOrder && (updates.windowCount !== undefined || updates.floor !== undefined || updates.additionalServices !== undefined)) {
          const newWindowCount = updates.windowCount ?? existingOrder.windowCount;
          const newFloor = updates.floor ?? existingOrder.floor;
          const newServices = {
            ...existingOrder.additionalServices,
            ...(updates.additionalServices || {})
          };

          if (updates.totalPrice === undefined) {
            updates.totalPrice = calculateOrderPrice(newWindowCount, newFloor, newServices, settings);
          }
          updates.additionalServices = newServices;
        }

        await updateData(TABLES.ORDERS, orderId, updates as any);
        return `Užsakymas atnaujintas.`;
      }

      if (name === 'delete_order') {
        await deleteData(TABLES.ORDERS, args.orderId);
        return `Užsakymas ištrintas.`;
      }

      if (name === 'add_expense') {
        await addData('expenses', user.uid, {
          ...args,
          createdAt: new Date().toISOString(),
        });
        return `Išlaidos "${args.title}" (${args.amount}€) užregistruotos.`;
      }

      if (name === 'update_expense') {
        const { expenseId, ...updates } = args;
        await updateData('expenses', expenseId, updates);
        return `Išlaidų įrašas atnaujintas.`;
      }

      if (name === 'delete_expense') {
        await deleteData('expenses', args.expenseId);
        return `Išlaidų įrašas ištrintas.`;
      }

      if (name === 'add_memory') {
        await addData('memories', user.uid, {
          ...args,
          createdAt: new Date().toISOString(),
        });
        // Manual refresh since realtime may not be enabled
        const freshMemories = await getData<Memory>('memories', user.uid);
        setMemories(freshMemories);
        return `Informacija įsiminta: "${args.content}"`;
      }

      if (name === 'update_memory') {
        const { memoryId, ...updates } = args;
        await updateData('memories', memoryId, updates);
        // Manual refresh since realtime may not be enabled
        const freshMemories = await getData<Memory>('memories', user.uid);
        setMemories(freshMemories);
        return `Atmintis atnaujinta.`;
      }

      if (name === 'delete_memory') {
        await deleteData('memories', args.memoryId);
        // Manual refresh since realtime may not be enabled
        const freshMemories = await getData<Memory>('memories', user.uid);
        setMemories(freshMemories);
        return `Atmintis ištrinta.`;
      }

      // ====== PROACTIVE ALERTS ======

      if (name === 'get_neglected_clients') {
        const days = args.days || 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // Find clients with no orders after cutoff date
        const neglected = clients.filter(client => {
          const clientOrders = orders.filter(o => o.clientId === client.id);
          const lastOrder = clientOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          return !lastOrder || lastOrder.date < cutoffStr;
        });

        return `Rasta ${neglected.length} klientų, neaplankytų per ${days} dienų: ${neglected.map(c => c.name).join(', ') || 'nėra'}`;
      }

      if (name === 'get_low_inventory') {
        // Note: inventory data would need to be passed to the component
        return `Norint patikrinti inventorių, reikia papildomų duomenų. Šiuo metu inventoriaus funkcija nepilnai įgyvendinta.`;
      }

      if (name === 'get_unpaid_orders') {
        const unpaid = orders.filter(o => o.status === 'atlikta');
        const total = unpaid.reduce((sum, o) => sum + o.totalPrice, 0);
        return `Rasta ${unpaid.length} atliktų užsakymų. Bendra neapmokėta suma: ${total}€`;
      }

      // ====== BUSINESS ANALYTICS ======

      if (name === 'get_business_summary') {
        const period = args.period || 'month';
        const now = new Date();
        let startDate = new Date();

        if (period === 'week') startDate.setDate(now.getDate() - 7);
        else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
        else startDate.setFullYear(now.getFullYear() - 1);

        const startStr = startDate.toISOString().split('T')[0];
        const periodOrders = orders.filter(o => o.date >= startStr);
        const periodExpenses = expenses.filter(e => e.date >= startStr);

        const revenue = periodOrders.filter(o => o.status === 'atlikta').reduce((sum, o) => sum + o.totalPrice, 0);
        const totalExp = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

        return `📊 **Verslo suvestinė (${period}):**\n- Užsakymų: ${periodOrders.length}\n- Pajamos: ${revenue}€\n- Išlaidos: ${totalExp}€\n- Pelnas: ${revenue - totalExp}€`;
      }

      if (name === 'get_top_clients') {
        const limit = args.limit || 5;
        const by = args.by || 'orders';

        const clientStats: Record<string, { name: string; orders: number; revenue: number }> = {};

        orders.filter(o => o.status === 'atlikta').forEach(o => {
          if (!clientStats[o.clientId]) {
            clientStats[o.clientId] = { name: o.clientName, orders: 0, revenue: 0 };
          }
          clientStats[o.clientId].orders++;
          clientStats[o.clientId].revenue += o.totalPrice;
        });

        const sorted = Object.values(clientStats).sort((a, b) =>
          by === 'revenue' ? b.revenue - a.revenue : b.orders - a.orders
        ).slice(0, limit);

        return `🏆 **Top ${limit} klientai (pagal ${by}):**\n` +
          sorted.map((c, i) => `${i + 1}. ${c.name}: ${c.orders} užs., ${c.revenue}€`).join('\n');
      }

      if (name === 'get_revenue_trends') {
        const months = args.months || 6;
        const now = new Date();
        const trends: string[] = [];

        for (let i = months - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStr = d.toISOString().slice(0, 7);
          const monthOrders = orders.filter(o => o.date.startsWith(monthStr) && o.status === 'atlikta');
          const revenue = monthOrders.reduce((sum, o) => sum + o.totalPrice, 0);
          const monthName = d.toLocaleString('lt-LT', { month: 'short' });
          trends.push(`${monthName}: ${revenue}€`);
        }

        return `📈 **Pajamų tendencijos (${months} mėn.):**\n` + trends.join('\n');
      }

      // ====== WORKFLOW AUTOMATION ======

      if (name === 'create_recurring_order') {
        const clientName = args.clientName || "";
        const client = clients.find(c => (c.name || "").toLowerCase().includes(clientName.toLowerCase()));
        if (!client) return `Klaida: Klientas "${clientName}" nerastas.`;

        const additionalServices = {
          balkonai: args.additionalServices?.balkonai || false,
          vitrinos: args.additionalServices?.vitrinos || false,
          terasa: args.additionalServices?.terasa || false,
          kiti: args.additionalServices?.kiti || false
        };

        const totalPrice = calculateOrderPrice(args.windowCount, args.floor, additionalServices, settings);

        await addData(TABLES.ORDERS, user.uid, {
          clientId: client.id,
          clientName: client.name,
          address: args.address,
          date: args.date,
          time: args.time,
          windowCount: args.windowCount,
          floor: args.floor,
          estimatedDuration: args.estimatedDuration || 60,
          additionalServices,
          totalPrice,
          status: 'suplanuota',
          isRecurring: true,
          recurringInterval: args.intervalMonths,
          notes: `Kartotinis užs kas ${args.intervalMonths} mėn.`,
          createdAt: new Date().toISOString(),
        });

        return `🔄 Kartotinis užsakymas sukurtas klientui ${client.name} kas ${args.intervalMonths} mėnesį!`;
      }

      if (name === 'generate_reminder_message') {
        const order = orders.find(o => o.id === args.orderId);
        if (!order) return `Užsakymas nerastas.`;

        const client = clients.find(c => c.id === order.clientId);
        const message = settings.smsTemplate
          .replace('{vardas}', client?.name || 'kliente')
          .replace('{data}', order.date)
          .replace('{laikas}', order.time)
          .replace('{kaina}', order.totalPrice + '€');

        return `📱 **Priminimo žinutė:**\n${message}`;
      }

      if (name === 'batch_update_order_status') {
        const { orderIds, status } = args;
        for (const orderId of orderIds) {
          updateData(TABLES.ORDERS, orderId, { status });
        }
        return `✅ ${orderIds.length} užsakymų būsena pakeista į "${status}".`;
      }

    } catch (error) {
      console.error("Tool execution error:", error);
      return `Klaida vykdant veiksmą: ${error instanceof Error ? error.message : 'Nežinoma klaida'}`;
    }
    return "Nežinomas veiksmas.";
  };

  const handleOpenKeySelector = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio && aiStudio.openSelectKey) {
      await aiStudio.openSelectKey();
      localStorage.removeItem('custom_api_key');
      setCustomApiKey('');
      setHasApiKey(true);
    }
  };

  const handleSaveCustomKey = () => {
    if (customApiKey.trim()) {
      localStorage.setItem('custom_api_key', customApiKey.trim());
      setHasApiKey(true);
      setApiKeyProvider(customApiKey.trim().startsWith('sk-or-v1-') ? 'openrouter' : 'google');
      setShowApiSettings(false);
    } else {
      localStorage.removeItem('custom_api_key');
      checkApiKey();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const apiKey = localStorage.getItem('custom_api_key') || (window as any).aistudio?.getApiKey?.() || process.env.GEMINI_API_KEY!;
      const result = await chatWithAssistant(userMsg, history, { clients, orders, expenses, memories });

      // Check if we hit fallback
      if (result.text?.includes("AI smegenys ilsisi") || result.text?.includes("modeliai yra perkrauti")) {
        setIsAiOffline(true);
      } else {
        setIsAiOffline(false);
      }

      let currentHistory = result.history;
      let finalResponse = result.text;

      if (result.functionCalls) {
        const functionResponses = [];
        for (const call of result.functionCalls) {
          const toolResult = await handleToolCall(call);
          functionResponses.push({
            role: 'function',
            parts: [{
              functionResponse: {
                name: call.name,
                response: { result: toolResult },
                id: call.id
              }
            }]
          });
        }

        // Add tool calls to history if not already there
        const toolCallHistory = result.functionCalls.map((call: any) => ({
          role: 'model',
          parts: [{
            functionCall: {
              name: call.name,
              args: call.args,
              id: call.id
            }
          }]
        }));

        const updatedHistory = [...currentHistory, ...toolCallHistory, ...functionResponses];

        // Send tool results back to get a natural language confirmation
        try {
          if (isOpenRouterKey(apiKey)) {
            // For OpenRouter, we just call chatWithAssistant again with the updated history
            // We use an empty message because the history now contains the tool responses
            const secondResult = await chatWithAssistant("", updatedHistory, { clients, orders, expenses, memories });
            finalResponse = secondResult.text;
            currentHistory = secondResult.history;
          } else {
            const ai = getAiInstance(apiKey);
            const modelsToTry = ["gemini-3-flash-preview", "gemini-2.0-flash-exp", "gemini-1.5-flash"];
            let secondResponseText = "";
            let secondHistory: any[] = [];
            let lastError: any = null;

            for (const modelName of modelsToTry) {
              try {
                const secondChat = ai.chats.create({
                  model: modelName,
                  history: updatedHistory,
                });
                const secondResponse = await secondChat.sendMessage({ message: "Apdorok veiksmų rezultatus ir patvirtink vartotojui." });
                secondResponseText = secondResponse.text;
                secondHistory = await secondChat.getHistory();
                break;
              } catch (e) {
                lastError = e;
                console.warn(`Second chat with ${modelName} failed:`, e);
              }
            }

            if (secondResponseText) {
              finalResponse = secondResponseText;
              currentHistory = secondHistory;
            } else {
              // Fallback if second call fails
              finalResponse = "Veiksmai atlikti sėkmingai, bet nepavyko sugeneruoti patvirtinimo teksto. Ar galiu dar kuo nors padėti?";
              currentHistory = updatedHistory;
            }
          }
        } catch (e) {
          console.error("Second chat error:", e);
          finalResponse = "Veiksmai atlikti, bet įvyko klaida generuojant atsakymą. Patikrinkite duomenis sąrašuose.";
          currentHistory = updatedHistory;
        }
      }

      if (finalResponse) {
        setMessages(prev => [...prev, { role: 'model', text: finalResponse! }]);
      }

      setHistory(currentHistory);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: `Atsiprašau, įvyko klaida: ${error instanceof Error ? error.message : 'Nežinoma klaida'}. Bandykite dar kartą.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-blue-700 transition-colors"
      >
        <Bot size={28} />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-0 md:inset-auto md:bottom-20 md:right-4 md:w-96 md:h-[600px] bg-white z-50 flex flex-col shadow-xl md:rounded-2xl overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="bg-blue-600 px-4 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                  <Bot size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Asistentas</h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[10px] opacity-80">Klausimai apie užsakymus ir duomenis</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-medium ${isAiOffline ? 'bg-amber-500/25 text-amber-100' :
                      apiKeyProvider === 'openrouter' ? 'bg-white/15 text-white' :
                        apiKeyProvider === 'google' ? 'bg-white/15 text-white' :
                          'bg-white/10 text-white/70'
                      }`}>
                      {isAiOffline ? 'Neprijungta' : apiKeyProvider === 'openrouter' ? 'OpenRouter' : apiKeyProvider === 'google' ? 'Google API' : 'Numatytasis'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={stopSpeaking}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  title="Sustabdyti visą garsą"
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
                    }}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                    title="Išvalyti pokalbį"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 relative">
              <AnimatePresence>
                {showApiSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute inset-x-0 top-0 bg-white z-30 border-b border-slate-100 p-6 shadow-xl"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-slate-900 text-xs flex items-center gap-2">
                        <Settings2 size={14} className="text-blue-600" />
                        API nustatymai (OpenRouter)
                      </h4>
                      <button onClick={() => setShowApiSettings(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <p className="text-[10px] text-blue-800 leading-relaxed mb-3">
                          Įklijuokite savo <strong>OpenRouter</strong> raktą (prasideda <code>sk-or-v1-</code>) tiesiai čia:
                        </p>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="password"
                            value={customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            placeholder="sk-or-v1-..."
                            className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button
                            onClick={handleSaveCustomKey}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                          >
                            Išsaugoti
                          </button>
                        </div>
                        <div className="relative py-2">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-blue-200/50"></div></div>
                          <div className="relative flex justify-center text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">arba numatytasis raktas</div>
                        </div>
                        <button
                          onClick={() => {
                            localStorage.removeItem('custom_api_key');
                            setCustomApiKey('');
                            checkApiKey();
                            setShowApiSettings(false);
                          }}
                          className="w-full mt-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Bot size={14} />
                          Naudoti numatytąjį raktą
                        </button>
                        <button
                          onClick={handleOpenKeySelector}
                          className="w-full mt-2 bg-white text-blue-700 border border-blue-200 px-4 py-3 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                        >
                          Pasirinkti savo Google raktą
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px] px-2">
                        <span className="text-slate-400">Dabartinis tiekėjas:</span>
                        <span className={`font-bold uppercase tracking-widest ${apiKeyProvider === 'openrouter' ? 'text-purple-600' :
                          apiKeyProvider === 'google' ? 'text-emerald-600' :
                            'text-slate-400'
                          }`}>
                          {apiKeyProvider === 'openrouter' ? 'OpenRouter' : apiKeyProvider === 'google' ? 'Mano API' : 'Standartinis'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

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
                      <button onClick={() => setShowMemories(false)} className="p-2 bg-slate-50 rounded-full text-slate-400">
                        <X size={16} />
                      </button>
                    </div>

                    {memories.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-xs text-slate-400">Atmintis tuščia. Pasakykite man kažką svarbaus ir aš tai įsiminsiu.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {memories.map(memory => (
                          <div key={memory.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mb-2 inline-block">
                                  {memory.category}
                                </span>
                                <p className="text-xs text-slate-700 leading-relaxed">{memory.content}</p>
                              </div>
                              <button
                                onClick={() => handleToolCall({ name: 'delete_memory', args: { memoryId: memory.id } })}
                                className="p-2 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
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
                    <p className="text-xs text-slate-400 px-10">Galiu padėti pridėti klientus, užsakymus ar išlaidas. Tiesiog parašykite man.</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-4">
                    {['Pridėk klientą', 'Sukurk užsakymą', 'Įrašyk išlaidas', 'Mano atmintis'].map(hint => (
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

              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'}`}>
                      {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed relative group ${msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white text-slate-900 shadow-sm border border-slate-100 rounded-tl-none'
                      }`}>
                      {msg.role === 'model' ? (
                        <>
                          <div className="markdown-body prose prose-sm max-w-none">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                          <div className="absolute -right-10 top-0 flex gap-1">
                            <button
                              onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                              className={`p-2 rounded-full transition-all ${showVoiceSelector
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-white text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 shadow-sm border border-slate-100'
                                }`}
                              title="Balso nustatymai"
                            >
                              <Bot size={14} />
                            </button>
                            <button
                              onClick={() => speak(msg.text, i)}
                              className={`p-2 rounded-full transition-all ${speakingMessageIndex === i
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-white text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 shadow-sm border border-slate-100'
                                }`}
                              title={speakingMessageIndex === i ? "Sustabdyti" : "Skaityti garsiai"}
                            >
                              {speakingMessageIndex === i ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                          </div>
                          {showVoiceSelector && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute right-0 top-10 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50"
                            >
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-slate-900">Balso nustatymai</h4>
                                <button onClick={() => setShowVoiceSelector(false)} className="text-slate-400 hover:text-slate-600">
                                  <X size={14} />
                                </button>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tiekėjas</label>
                                  <p className="text-xs font-medium text-slate-900 mt-1">
                                    {apiKeyProvider === 'openrouter' ? 'OpenRouter (nemokamas)' :
                                      apiKeyProvider === 'google' ? 'Google Gemini' : 'Numatytasis (Google)'}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Balsas</label>
                                  <select
                                    value={selectedVoice}
                                    onChange={(e) => {
                                      setSelectedVoice(e.target.value);
                                      localStorage.setItem('selected_voice', e.target.value);
                                    }}
                                    className="w-full mt-1 text-xs border border-slate-200 rounded-lg p-2"
                                  >
                                    <option value="Zephyr">Zephyr (šiltas)</option>
                                    <option value="Puck">Puck (vyriškas)</option>
                                    <option value="Charon">Charon (gilus)</option>
                                    <option value="Kore">Kore (neutralus)</option>
                                    <option value="Fenrir">Fenrir (stiprus)</option>
                                    <option value="Aoede">Aoede (švelnus)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Kalba</label>
                                  <select
                                    value={selectedLang}
                                    onChange={(e) => {
                                      setSelectedLang(e.target.value);
                                      localStorage.setItem('tts_language', e.target.value);
                                    }}
                                    className="w-full mt-1 text-xs border border-slate-200 rounded-lg p-2"
                                  >
                                    <option value="lt-LT">Lietuvių (Lietuva)</option>
                                    <option value="en-US">English (US)</option>
                                    <option value="en-GB">English (UK)</option>
                                    <option value="de-DE">Deutsch</option>
                                    <option value="fr-FR">Français</option>
                                    <option value="pl-PL">Polski</option>
                                    <option value="ru-RU">Русский</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Greitis</label>
                                    <span className="text-[10px] text-blue-600 font-bold">{voiceRate}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={voiceRate}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setVoiceRate(val);
                                      localStorage.setItem('voice_rate', val.toString());
                                    }}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                  />
                                  <div className="flex justify-between text-[9px] text-slate-400">
                                    <span>lėtas</span>
                                    <span>normalus</span>
                                    <span>greitas</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center animate-pulse">
                      <Bot size={14} />
                    </div>
                    <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                      <Loader2 size={16} className="animate-spin text-blue-600" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 bg-white border-t border-slate-100">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isRecording ? "Klausausi..." : "Rašykite čia..."}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-4 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <div className="absolute right-2 top-2 bottom-2 flex gap-1">
                  <button
                    onClick={toggleRecording}
                    className={`w-10 rounded-xl flex items-center justify-center transition-all ${isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-slate-100 text-slate-400 hover:text-blue-600'
                      }`}
                    title={isRecording ? "Sustabdyti įrašymą" : "Įrašyti balsu"}
                  >
                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="w-10 bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:scale-95 transition-all"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
