const Groq = require('groq-sdk');
const { socioPrompt, clientePrompt } = require('../prompts/systemPrompt');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Mock simples em disco para armazenar o contexto da conversa (MVP)
const conversationMemory = {};

async function handleIncomingMessage(userMessage, userId, isBoss) {
    if (!conversationMemory[userId]) {
        // Se isBoss for true, injeta o Prompt de Sócio/Gerente. Se for false, injeta o de Cliente.
        const currentPrompt = isBoss ? socioPrompt : clientePrompt;
        
        conversationMemory[userId] = [
            { role: "system", content: currentPrompt }
        ];
    }

    // Adiciona o request atual
    conversationMemory[userId].push({ role: "user", content: userMessage });

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: conversationMemory[userId],
            model: "llama3-8b-8192", // Modelo hiper rápido para conversas dinâmicas
            temperature: 0.7,
            max_tokens: 500
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
        console.error("Erro na comunicação com a Groq (LLM):", error);
        return "Opa Rogério, meu motor do KAIROS teve um engasgo de conexão. Pode repetir?";
    }
}

// TODO: Preparar Whisper large-v3 da Groq
// async function transcribeAudio(audioBuffer) { 
//   const transcription = await groq.audio.transcriptions.create({ file: audioFile, model: "whisper-large-v3" }) 
// }

module.exports = { handleIncomingMessage };
