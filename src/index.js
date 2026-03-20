require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { handleIncomingMessage } = require('./services/groq');
const { sendMessage } = require('./services/evolution');

const app = express();
app.use(express.json());

// Webhook endpoint: A Evolution API fará o POST aqui quando o Rogério enviar mensagem
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        
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
                
                // Valida se o remetente é o número pessoal do Rogério (Sócio) usando a variável do .env
                // O número chega no formato 5511999999999@s.whatsapp.net
                const rogerioPhone = process.env.ROGERIO_PHONE_NUMBER + '@s.whatsapp.net';
                const isBoss = (remoteJid === rogerioPhone);
                
                // Processa na Groq API enviando a flag isBoss para o roteamento
                const botResponse = await handleIncomingMessage(userText, remoteJid, isBoss);
                
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
// Executa todos os dias às 23:45 
cron.schedule('45 23 * * *', async () => {
    console.log('[CRON] Iniciando rotina de fechamento...');
    const rogerioPhone = process.env.ROGERIO_PHONE_NUMBER + '@s.whatsapp.net';
    const notificacao = "Mestre Rogério! Tudo certo para o fechamento de hoje? Tivemos algum gargalo ou alguma falta de estoque no balcão de última hora?";
    await sendMessage(rogerioPhone, notificacao);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🧠 AIOS Noûs: Sócio Digital rodando na porta ${PORT}`);
});
