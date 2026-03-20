const axios = require('axios');

async function sendMessage(to, text) {
    const defaultHeaders = {
        'apikey': process.env.EVOLUTION_GLOBAL_APIKEY,
        'Content-Type': 'application/json'
    };

    const instanceName = process.env.INSTANCE_NAME;
    const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`;

    try {
        await axios.post(url, {
            number: to,
            textMessage: { text }
        }, { headers: defaultHeaders });
        console.log(`[WhatsApp Out] Enviado para ${to}`);
    } catch (error) {
        console.error(`Erro ao disparar mensagem Evolution para ${to}:`, error.message);
    }
}

module.exports = { sendMessage };
