require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { handleIncomingMessage } = require('./services/groq');
const { sendMessage } = require('./services/evolution');
const telegramBot = require('./services/telegram'); // Inicializa o Sócio Digital (Telegram) em background

const app = express();
app.use(express.json());

// Webhook endpoint: A Evolution API fará o POST aqui
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        // FINDING 5: Validação de segurança — rejeita requests sem a apikey correta
        const webhookToken = req.headers['apikey'] || req.query.token;
        const expectedToken = process.env.EVOLUTION_GLOBAL_APIKEY;
        if (expectedToken && webhookToken !== expectedToken) {
            return res.status(401).send('Não autorizado');
        }
        
        // Verifica se é uma mensagem recebida (Permitindo fromMe para que o Rogério possa testar mandando mensagem para ele mesmo no WhatsApp)
        if (body.event === 'messages.upsert') {
            const messageData = body.data.message;
            let userText = '';

            // Extrai texto ou alerta sobre áudio (preparação para Whisper)
            if (messageData.conversation) {
                userText = messageData.conversation;
            } else if (messageData.extendedTextMessage) {
                userText = messageData.extendedTextMessage.text;
            } else if (messageData.audioMessage) {
                // TODO: Baixar o buffer do áudio via Evolution API e jogar no Whisper da Groq
                userText = "[Áudio recebido - Necessário conectar Whisper da Groq API para transcrever]";
            }

            if (userText) {
                console.log(`[WhatsApp In] Recebido de ${body.data.key.remoteJid}: ${userText}`);
                const remoteJid = body.data.key.remoteJid;
                
                // Processa na Groq API
                const botResponse = await handleIncomingMessage(userText, remoteJid);
                
                // Responde no WhatsApp
                await sendMessage(remoteJid, botResponse);
            }
        }
        res.status(200).send('Webhook Processado');
    } catch (error) {
        console.error('Erro no Webhook:', error);
        res.status(500).send('Erro Interno');
    }
});

// Pushes Proativos (Schedulers - Cron Jobs)
// Executa todos os dias às 23:45 — MIGRADO PARA TELEGRAM (Finding 3)
cron.schedule('45 23 * * *', async () => {
    console.log('[CRON] Iniciando rotina de fechamento via Telegram...');
    const rogerioTelegramId = process.env.TELEGRAM_ROGERIO_ID;
    if (rogerioTelegramId && telegramBot) {
        const notificacao = "Chefe, fechamento! Como foi o movimento hoje? Faltou alguma coisa no estoque? 📊";
        telegramBot.sendMessage(rogerioTelegramId, notificacao).catch(err => {
            console.error('[CRON] Falha ao notificar via Telegram:', err.message);
        });
    } else {
        console.warn('[CRON] TELEGRAM_ROGERIO_ID não configurado. Pulando notificação.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🧠 AIOS Noûs: Sócio Digital rodando na porta ${PORT}`);
});
