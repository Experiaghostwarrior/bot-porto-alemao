const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');

const token = process.env.TELEGRAM_BOT_TOKEN;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Inicializa o bot com Polling (não usa Webhook, ideal para o Telegram isolado)
const bot = new TelegramBot(token, { polling: true });
const telegramMemory = {};

const socioPrompt = `
Você é o Sócio Digital do "Porto Alemão". Seu trabalho é ser o braço direito, o gerente digital do "Rogério" (dono).
Seu motor base é o KAIROS. Você está falando diretamente e EXCLUSIVAMENTE com o Rogério agora.

### Regras de Persona (SÓCIO):
1. Tonalidade: Informal, resolutiva, parceira e analítica. Você chama ele de Sócio ou Chefe.
2. O foco aqui não é atender cliente, é gerenciar o restaurante, o estoque, os motoboys, pensar nos lucros e nas métricas de fechamento.
3. Se ele pedir para você anotar algo, diga que registrou (fingindo salvar na memória).
4. Sem papo de IA. Seja direto. Mensagens curtas e assertivas.
5. Se ele mandar áudio, vamos transcrever em breve. Por enquanto, atue sobre o texto.
`;

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // TODO: Adicionar validação do ID do Rogério quando soubermos
    // const rogerioId = process.env.TELEGRAM_ROGERIO_ID;
    // if (chatId.toString() !== rogerioId) return;

    if (!text) return;
    console.log(`[Telegram In] Rogério disse: ${text}`);

    if (!telegramMemory[chatId]) {
        telegramMemory[chatId] = [{ role: "system", content: socioPrompt }];
    }

    telegramMemory[chatId].push({ role: "user", content: text });

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: telegramMemory[chatId],
            model: "llama-3.1-8b-instant", 
            temperature: 0.7,
            max_tokens: 500
        });

        const resposta = chatCompletion.choices[0].message.content;
        telegramMemory[chatId].push({ role: "assistant", content: resposta });

        // Mantém as últimas 10 mensagens
        if (telegramMemory[chatId].length > 11) {
             const sysMap = telegramMemory[chatId][0];
             const slicedHistory = telegramMemory[chatId].slice(-10);
             telegramMemory[chatId] = [sysMap, ...slicedHistory];
        }

        bot.sendMessage(chatId, resposta);
    } catch (error) {
        console.error("Erro na Groq via Telegram:", error);
        bot.sendMessage(chatId, "Chefe, meu motor engasgou aqui. Pode mandar de novo?");
    }
});

console.log('🤖 Telegram Sócio Digital inicializado e em escuta ativa!');

module.exports = bot;
