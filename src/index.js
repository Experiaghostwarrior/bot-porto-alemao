require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { loadEnv } = require('./config/env');
const business = require('./config/business.json');
const { handleIncomingMessage } = require('./services/groq');
const { sendMessage } = require('./services/evolution');
const telegramBot = require('./services/telegram');

const config = loadEnv();
const app = express();
app.use(express.json());

// Health check (monitoramento Railway / uptime)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        business: business.name,
        uptime: Math.floor(process.uptime()),
        telegram: !!telegramBot,
    });
});

// Webhook da Evolution API
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        // Segurança opcional
        if (config.webhookSecret) {
            const incomingToken = req.headers['x-webhook-secret'] || req.query.secret;
            if (incomingToken !== config.webhookSecret) {
                return res.status(401).send('Não autorizado');
            }
        }

        if (body.event === 'messages.upsert') {
            const messageData = body.data.message;
            let userText = '';

            if (messageData.conversation) {
                userText = messageData.conversation;
            } else if (messageData.extendedTextMessage) {
                userText = messageData.extendedTextMessage.text;
            } else if (messageData.audioMessage) {
                userText = '[Áudio recebido — transcrição em desenvolvimento]';
            }

            if (userText) {
                const remoteJid = body.data.key.remoteJid;
                console.log(`[WhatsApp In] ${remoteJid}: ${userText}`);

                const botResponse = await handleIncomingMessage(userText, remoteJid);
                await sendMessage(remoteJid, botResponse);
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Webhook] Erro:', error.message || error);
        res.status(500).send('Erro Interno');
    }
});

// Cron: notificação de fechamento via Telegram
cron.schedule('45 23 * * *', async () => {
    console.log('[CRON] Rotina de fechamento...');
    const ownerId = config.telegramOwnerId;
    if (ownerId && telegramBot) {
        telegramBot.sendMessage(ownerId, 'Chefe, fechamento! Como foi o movimento hoje? Faltou alguma coisa no estoque? 📊').catch(err => {
            console.error('[CRON] Falha Telegram:', err.message);
        });
    }
});

app.listen(config.port, () => {
    console.log(`🧠 ${business.name} Bot rodando na porta ${config.port}`);
    console.log(`   ├─ Atendente WhatsApp: ativo`);
    console.log(`   ├─ Sócio Digital Telegram: ${telegramBot ? 'ativo' : 'desativado'}`);
    console.log(`   └─ Health: /health`);
});
