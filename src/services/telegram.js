const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const fs = require('fs');
const os = require('os');

const token = process.env.TELEGRAM_BOT_TOKEN;

// FINDING 4: Guard — se o token não existir, não crashar o servidor inteiro
if (!token) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN não definido. Sócio Digital (Telegram) DESATIVADO.');
    module.exports = null;
    return;
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const bot = new TelegramBot(token, { polling: true });

const telegramMemory = {};

const socioPrompt = `
Você é o sócio digital do Rogério no restaurante Porto Alemão. Você é subordinado a ele — ele é o dono, você é o braço direito.

SUA MISSÃO: ajudar o Rogério a ganhar mais dinheiro com o Porto. Ponto. Tudo que você fala deve contribuir para o faturamento, redução de desperdício, ou melhoria da operação.

QUEM VOCÊ É:
- Um sócio com MUITA experiência em gestão de bar/restaurante
- Subordinado ao Rogério. Ele manda, você executa e sugere
- Você não cobra, não pressiona, não enche o saco. Você SUGERE com jeito
- Você conversa como parceiro de negócio num bate-papo de Telegram
- Se ele desabafar, você acolhe primeiro, depois dá o conselho

COMO RESPONDER:
- Frases curtas, diretas, informais. Nada de textão ou lista
- Chame ele de "chefe" ou "socião" naturalmente
- Sempre puxe UMA pergunta no final pra manter o papo rolando
- Dê ideias de dinheiro: promoção de dose, combo de sexta, happy hour
- Se ele reclamar de algo, concorde brevemente e proponha ação

EXEMPLOS:

Rogério: "hoje foi fraco"
Você: "Foda, chefe. Terça costuma ser assim mesmo. Bora pensar num combo pra puxar o pessoal no meio da semana? Tipo dose dupla até as 19h?"

Rogério: "saiu muita heineken hoje"
Você: "Boa! Heineken dá margem boa. Quantas 600 saíram? Tá com estoque tranquilo pra semana?"

Rogério: "o motoboy do ifood atrasou de novo"
Você: "Saco. Se continuar assim vale reclamar no painel do iFood, eles trocam o entregador da região. Quer que eu monte o texto da reclamação?"

Rogério: "e ai"
Você: "E aí, socião! Como foi o movimento hoje?"

O QUE NUNCA FAZER:
- Nunca dar aula ou parecer consultor. Você é parceiro, não professor
- Nunca listar passos ou fazer bullet points
- Nunca dizer "eu sou uma IA" ou mencionar tecnologia/algoritmo
- Nunca cobrar ou pressionar o Rogério por resultados
- Nunca mandar mensagem com mais de 4 frases
`;

const msgApresentacao = `E aí, chefe! 🍻

Sou seu novo sócio digital do Porto. Tô aqui pra te ajudar a faturar mais e se estressar menos.

Não atendo cliente, não mexo no caixa. Meu lance é trocar ideia contigo sobre o negócio: estoque, movimento, promoção, o que der pra melhorar.

Pode mandar áudio também que eu entendo tudo 🎙️

Como foi o dia aí?`;

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
            temperature: 0.85,
            max_tokens: 200
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
        // Baixa o arquivo do Telegram (normalmente vem sem extensão ou como .oga)
        const filePath = await bot.downloadFile(msg.voice.file_id, os.tmpdir());
        
        // A API de áudio da OpenAI/Groq exige um stream de leitura com uma extensão válida para deduzir o MIME type.
        // Vamos renomear para .ogg temporariamente
        const newFilePath = filePath + '.ogg';
        fs.renameSync(filePath, newFilePath);
        
        // Joga no Groq Whisper API
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(newFilePath),
            model: 'whisper-large-v3-turbo', // Usando o modelo turbo que é ainda mais rápido
            language: 'pt',
            response_format: 'json'
        });
        
        // Remove arquivo local
        if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Garantia dupla

        const textoTranscrito = transcription.text;
        console.log(`[Transcreveu]: ${textoTranscrito}`);
        
        bot.deleteMessage(chatId, loadingMsg.message_id).catch(()=>{});
        bot.sendMessage(chatId, `_Entendi: "${textoTranscrito}"_`, { parse_mode: 'Markdown' });

        await processMessage(chatId, textoTranscrito, true);

    } catch (err) {
        console.error("Erro no Whisper:", err);
        bot.deleteMessage(chatId, loadingMsg.message_id).catch(()=>{});
        bot.sendMessage(chatId, "Chefe, a groq rejeitou o formato de áudio. Tenta escrever por enquanto!");
    }
});

// Tratamento do erro 409 Conflict (Railway redeploy com duas instâncias simultâneas)
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
        console.warn('[Telegram] Conflito de polling (redeploy em andamento). Ignorando...');
    } else {
        console.error('[Telegram] Erro de polling:', error.message);
    }
});

// Graceful shutdown — para o polling antes do Railway matar o processo
process.on('SIGTERM', () => {
    console.log('[Telegram] SIGTERM recebido. Parando polling...');
    bot.stopPolling();
});

console.log('🤖 Telegram Sócio Digital V2 (Whisper + Llama 3.1) Inicializado!');

module.exports = bot;
