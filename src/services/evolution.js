const axios = require('axios');

async function sendMessage(to, text) {
    const defaultHeaders = {
        'apikey': process.env.EVOLUTION_GLOBAL_APIKEY,
        'Content-Type': 'application/json'
    };

    const instanceName = process.env.INSTANCE_NAME ? process.env.INSTANCE_NAME.trim() : 'porto-alemao';
    let baseUrl = process.env.EVOLUTION_API_URL ? process.env.EVOLUTION_API_URL.trim() : '';
    
    // Construtor automático de protocolo HTTPs caso falte no Railway ENV
    if (baseUrl && !baseUrl.startsWith('http')) {
        baseUrl = 'https://' + baseUrl;
    }
    
    // Limpeza de barras duplas // na junção da URL
    baseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/message/sendText/${instanceName}`;

    // A Evolution API V2 funciona melhor se limparmos o @s.whatsapp.net do número
    const cleanNumber = to.split('@')[0];

    try {
        await axios.post(url, {
            number: cleanNumber,
            text: text, // Evolution V2 padrão
            options: {
                delay: 1000,
                presence: "composing"
            }
        }, { headers: defaultHeaders });
        console.log(`[WhatsApp Out] Enviado para ${to}`);
    } catch (error) {
        console.error(`Erro ao disparar mensagem Evolution para ${to}:`, error.message);
    }
}

module.exports = { sendMessage };
