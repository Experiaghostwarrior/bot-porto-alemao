const Groq = require('groq-sdk');
const { systemPrompt } = require('../prompts/systemPrompt');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Mock simples em disco para armazenar o contexto da conversa (MVP)
const conversationMemory = {};

async function handleIncomingMessage(userMessage, userId) {
    if (!conversationMemory[userId]) {
        conversationMemory[userId] = [
            { role: "system", content: systemPrompt }
        ];
    }

    // Adiciona o request atual
    conversationMemory[userId].push({ role: "user", content: userMessage });

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: conversationMemory[userId],
            model: "llama-3.1-8b-instant",
            temperature: 0.8,  // Mais variação natural
            max_tokens: 150    // Força respostas curtas de WhatsApp
        });

        const resposta = chatCompletion.choices[0].message.content;
        
        // Adiciona a resposta do bot à memória
        conversationMemory[userId].push({ role: "assistant", content: resposta });

        // Manter o contexto curto (apenas as últimas 10 mensagens) para economizar tokens
        if (conversationMemory[userId].length > 11) {
             const sysMap = conversationMemory[userId][0];
             const slicedHistory = conversationMemory[userId].slice(-10);
             conversationMemory[userId] = [sysMap, ...slicedHistory];
        }

        return resposta;
    } catch (error) {
        console.error("Erro na comunicação com a Groq (LLM):", error.message || error);
        return "Desculpe, estou com uma instabilidade momentânea. Pode repetir sua mensagem em alguns segundos? 🙏";
    }
}

// TODO: Preparar Whisper large-v3 da Groq
// async function transcribeAudio(audioBuffer) { 
//   const transcription = await groq.audio.transcriptions.create({ file: audioFile, model: "whisper-large-v3" }) 
// }

module.exports = { handleIncomingMessage };
