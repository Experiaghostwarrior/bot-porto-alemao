const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const fs = require('fs');
const os = require('os');
const { generatePartnerPrompt, generateGreeting } = require('../prompts/partner');
const { loadEnv } = require('../config/env');
const memory = require('../utils/memory');

const config = loadEnv();

// Guard: se o token não existir, não crashar o servidor inteiro
if (!config.telegramToken) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN não definido. Sócio Digital (Telegram) DESATIVADO.');
    module.exports = null;
    return;
}

const groq = new Groq({ apiKey: config.groqApiKey });
const bot = new TelegramBot(config.telegramToken, { polling: true });

const partnerPrompt = generatePartnerPrompt();
const greeting = generateGreeting();

async function processMessage(chatId, text, isAudio = false) {
    memory.getOrCreate(chatId, partnerPrompt);

    if (isAudio) {
        text = `(Transcrição de áudio): ${text}`;
    }

    memory.addMessage(chatId, 'user', text);

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: memory.getMessages(chatId),
            model: config.llm.model,
            temperature: config.llm.partner.temperature,
            max_tokens: config.llm.partner.maxTokens,
        });

        const resposta = chatCompletion.choices[0].message.content;
        memory.addMessage(chatId, 'assistant', resposta);
        bot.sendMessage(chatId, resposta);
    } catch (error) {
        console.error('[Groq Partner] Erro:', error.message || error);
        bot.sendMessage(chatId, 'Chefe, meu raciocínio caiu aqui na rede. Pode mandar de novo?');
    }
}

// Tratamento de Texto
bot.on('message', async (msg) => {
    if (msg.voice || msg.audio) return;

    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (text === '/start') {
        memory.reset(chatId, partnerPrompt);
        return bot.sendMessage(chatId, greeting);
    }

    if (!text) return;
    console.log(`[Telegram IN] ${msg.chat.first_name || 'User'}: ${text}`);
    await processMessage(chatId, text, false);
});

// Tratamento de Áudio (Whisper)
bot.on('voice', async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[Telegram AUDIO] Processando áudio...`);

    const loadingMsg = await bot.sendMessage(chatId, '🎙️ *Ouvindo seu áudio...*', { parse_mode: 'Markdown' });

    try {
        const filePath = await bot.downloadFile(msg.voice.file_id, os.tmpdir());
        const newFilePath = filePath + '.ogg';
        fs.renameSync(filePath, newFilePath);

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(newFilePath),
            model: 'whisper-large-v3-turbo',
            language: 'pt',
            response_format: 'json',
        });

        if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        const textoTranscrito = transcription.text;
        console.log(`[Transcreveu]: ${textoTranscrito}`);

        bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        bot.sendMessage(chatId, `_Entendi: "${textoTranscrito}"_`, { parse_mode: 'Markdown' });

        await processMessage(chatId, textoTranscrito, true);
    } catch (err) {
        console.error('[Whisper] Erro:', err.message || err);
        bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        bot.sendMessage(chatId, 'Chefe, não consegui ouvir o áudio. Tenta escrever por enquanto!');
    }
});

// Tratamento do erro 409 Conflict (Railway redeploy)
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
        console.warn('[Telegram] Conflito de polling (redeploy). Ignorando...');
    } else {
        console.error('[Telegram] Erro de polling:', error.message);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Telegram] SIGTERM recebido. Parando polling...');
    bot.stopPolling();
});

console.log(`🤖 Sócio Digital (Telegram) inicializado!`);

module.exports = bot;
