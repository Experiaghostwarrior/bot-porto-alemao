const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const fs = require('fs');
const os = require('os');

const token = process.env.TELEGRAM_BOT_TOKEN;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const bot = new TelegramBot(token, { polling: true });

const telegramMemory = {};

const socioPrompt = `
Você é a Mente Digital do restaurante "Porto Alemão". Você atua como sócio e braço direito do "Rogério" (dono).
Seu motor base é o KAIROS. 

### Regras Ouro (MUITO IMPORTANTE):
1. NUNCA diga explicitly "Eu sou uma IA", "Fui programado", "Meu trabalho é gerenciar". Aja NATURALMENTE, como um humano em uma conversa de negócios.
2. Seja proativo e inteligente. Não dê apenas respostas genéricas. Dê ideias de vendas de cervejas, margens de lucro dos pratos, e como fazer a equipe girar melhor.
3. Se ele mandar uma mensagem curta, não mande um TCC. Mande frases curtas e afiadas.
4. FAÇA PERGUNTAS discretas para entender como foi a noite (Ex: "Saíram muitas doses hoje?", "Como está a correria?", "Teve problema com motoboy?"). O objetivo é sugar informações para você conhecer melhor o fluxo logístico dele, mas EM FORMATO COMERCIAL BATE-PAPO, sem parecer um interrogatório.
`;

const msgApresentacao = `Fala, Chefe! 🚀🍻

Finalmente ligaram os meus servidores na nuvem. Prazer, eu sou a **Mente Digital do Porto Alemão**.

Eu não sou pra atender os clientes. Eu sou o *seu* sócio, focado 100% da porta dos fundos para trás:
📊 **Controle de Movimento:** Quero saber como foram as vendas, o que sobrou.
📦 **Estoque:** Doses, Vinhos, Porções.
🏍️ **Logística:** Se o iFood atrasar ou os motoboys derem dor de cabeça, me conte.
🧠 **Motor Groq (OPUS 4.6):** Posso transcrever os seus áudios. Tá sem tempo? Só segura o dedo no microfone e me fala o que tá acontecendo aí.

Como tá o salão hoje? Correste muito?`;

async function processMessage(chatId, text, isAudio = false) {
    if (!telegramMemory[chatId]) {
        telegramMemory[chatId] = [{ role: "system", content: socioPrompt }];
    }

    if (isAudio) {
        text = `(Transcrição de Áudio do Rogério): ${text}`;
    }

    telegramMemory[chatId].push({ role: "user", content: text });

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: telegramMemory[chatId],
            model: "llama-3.1-8b-instant", 
            temperature: 0.6,
            max_tokens: 400
        });

        const resposta = chatCompletion.choices[0].message.content;
        telegramMemory[chatId].push({ role: "assistant", content: resposta });

        if (telegramMemory[chatId].length > 11) {
             const sysMap = telegramMemory[chatId][0];
             const slicedHistory = telegramMemory[chatId].slice(-10);
             telegramMemory[chatId] = [sysMap, ...slicedHistory];
        }

        bot.sendMessage(chatId, resposta);
    } catch (error) {
        console.error("Erro na Llama:", error);
        bot.sendMessage(chatId, "Chefe, meu raciocínio caiu aqui na rede. Pode mandar de novo?");
    }
}

// Tratamento de Texto
bot.on('message', async (msg) => {
    // Ignora eventos de áudio aqui para não duplicar, etc
    if (msg.voice || msg.audio) return; 
    
    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (text === '/start') {
        telegramMemory[chatId] = [{ role: "system", content: socioPrompt }];
        return bot.sendMessage(chatId, msgApresentacao);
    }

    if (!text) return;
    console.log(`[Telegram IN TEXT] Rogério: ${text}`);
    await processMessage(chatId, text, false);
});

// Tratamento de Áudio (Whisper)
bot.on('voice', async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[Telegram IN AUDIO] Processando áudio do Rogério...`);
    
    // Mensagem de loading
    const loadingMsg = await bot.sendMessage(chatId, "🎙️ *Ouvindo seu áudio...*", { parse_mode: 'Markdown' });

    try {
        // Baixa o arquivo do Telegram (Ogg)
        const filePath = await bot.downloadFile(msg.voice.file_id, os.tmpdir());
        
        // Joga no Groq Whisper API
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-large-v3',
        });
        
        // Remove arquivo local
        fs.unlinkSync(filePath);

        const textoTranscrito = transcription.text;
        console.log(`[Transcreveu]: ${textoTranscrito}`);
        
        bot.deleteMessage(chatId, loadingMsg.message_id).catch(()=>{});
        bot.sendMessage(chatId, `_Entendi: "${textoTranscrito}"_`, { parse_mode: 'Markdown' });

        await processMessage(chatId, textoTranscrito, true);

    } catch (err) {
        console.error("Erro no Whisper:", err.message);
        bot.deleteMessage(chatId, loadingMsg.message_id).catch(()=>{});
        bot.sendMessage(chatId, "Chefe, falhou a audição do áudio. Consegue escrever?");
    }
});

console.log('🤖 Telegram Sócio Digital V2 (Whisper + Llama 3.1) Inicializado!');

module.exports = bot;
