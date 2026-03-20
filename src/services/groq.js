const Groq = require('groq-sdk');
const { generateAttendantPrompt } = require('../prompts/attendant');
const { loadEnv } = require('../config/env');
const memory = require('../utils/memory');

const config = loadEnv();
const groq = new Groq({ apiKey: config.groqApiKey });
const attendantPrompt = generateAttendantPrompt();

async function handleIncomingMessage(userMessage, userId) {
    memory.getOrCreate(userId, attendantPrompt);
    memory.addMessage(userId, 'user', userMessage);

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: memory.getMessages(userId),
            model: config.llm.model,
            temperature: config.llm.attendant.temperature,
            max_tokens: config.llm.attendant.maxTokens,
        });

        const resposta = chatCompletion.choices[0].message.content;
        memory.addMessage(userId, 'assistant', resposta);
        return resposta;
    } catch (error) {
        console.error('[Groq Attendant] Erro:', error.message || error);
        return 'Desculpe, estou com uma instabilidade momentânea. Pode repetir sua mensagem em alguns segundos? 🙏';
    }
}

module.exports = { handleIncomingMessage };
