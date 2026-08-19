import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, TrendingUp, PiggyBank } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantProps {
  transactions: any[];
}

const Assistant: React.FC<AssistantProps> = ({ transactions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '¡Hola! Soy tu Especialista Financiero. Estoy aquí para ayudarte a ahorrar más y maximizar tus ingresos. ¿En qué puedo asesorarte hoy?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prioritize API_KEY (injected by platform) over GEMINI_API_KEY (manual env var)
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error('No se encontró una clave de API de Gemini. Por favor, asegúrate de tener una configurada en los ajustes.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Simplify transaction data for context
      const safeTransactions = Array.isArray(transactions) ? transactions : [];
      const transactionSummary = safeTransactions.slice(0, 30).map((t: any) => ({
        t: t.type === 'income' ? 'Ingreso' : t.type === 'expense' ? 'Gasto' : t.type === 'refund' ? 'Reembolso' : 'Ahorro',
        m: t.amount,
        c: t.category,
        d: t.description,
        f: t.date
      }));

      const systemInstruction = `Eres un Especialista Financiero experto en ahorro y maximización de ingresos para usuarios en Argentina. 
      Tu objetivo es ayudar al usuario a optimizar sus finanzas personales, sugiriendo formas de ahorrar, invertir (como Plazos Fijos, FCI, MEP, CEDEARs) y aumentar sus ingresos. 
      Tienes acceso a las últimas transacciones del usuario: ${JSON.stringify(transactionSummary)}. 
      Responde de forma profesional, motivadora y basada en el contexto económico argentino (ARS, inflación, tasas de interés). 
      Usa ARS para montos. 
      No menciones que recibes datos en JSON. 
      Si el usuario pregunta algo que no sabes, sé honesto. 
      Enfócate siempre en cómo puede el usuario gastar menos en categorías innecesarias y cómo puede hacer que su dinero rinda más.`;

      // Build history carefully
      const history = messages
        .slice(1) // Skip initial greeting
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));
      
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: [...history, { role: 'user', parts: [{ text: userMessage.content }] }],
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || 'Lo siento, no pude procesar tu solicitud.'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error calling Gemini:', error);
      
      let errorMessage = 'Hubo un error al conectar con el asistente. Por favor, intenta de nuevo más tarde.';
      
      if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('403')) {
        errorMessage = 'La clave de API de Gemini no es válida o no tiene permisos. Por favor, revísala en los ajustes.';
      } else if (error?.message?.includes('quota') || error?.message?.includes('429')) {
        errorMessage = 'Se ha superado el límite de consultas. Por favor, espera un momento e intenta de nuevo.';
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full shadow-xl hover:scale-110 transition-transform z-40 flex items-center gap-2"
      >
        <Bot size={24} />
        <span className="hidden sm:inline font-medium text-sm">Asesor Financiero</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[600px] bg-white dark:bg-zinc-900 sm:rounded-3xl shadow-2xl z-50 flex flex-col border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-2 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Especialista en Ahorro</h3>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-bold">En línea</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-tr-none'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 opacity-50">
                    {msg.role === 'user' ? <User size={12} /> : <PiggyBank size={12} />}
                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                      {msg.role === 'user' ? 'Tú' : 'Especialista'}
                    </span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl rounded-tl-none">
                  <Loader2 size={16} className="animate-spin text-zinc-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregúntame sobre ahorro o inversiones..."
                className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-[10px] text-center mt-3 text-zinc-400 dark:text-zinc-500">
              Asesoría financiera basada en tus transacciones. Consulta siempre con un profesional.
            </p>
          </form>
        </div>
      )}
    </>
  );
};

export default Assistant;
