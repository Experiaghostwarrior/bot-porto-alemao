/**
 * Validação e carregamento centralizado de variáveis de ambiente.
 * Se faltar algo crítico, o servidor nem sobe — fail fast.
 */

const required = [
    'GROQ_API_KEY',
    'EVOLUTION_API_URL',
    'EVOLUTION_GLOBAL_APIKEY',
];

const optional = {
    PORT: '3000',
    INSTANCE_NAME: 'default',
    WEBHOOK_SECRET: '',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_OWNER_ID: '',
    LLM_MODEL: 'llama-3.1-8b-instant',
    LLM_TEMPERATURE_ATTENDANT: '0.8',
    LLM_TEMPERATURE_PARTNER: '0.85',
    LLM_MAX_TOKENS_ATTENDANT: '150',
    LLM_MAX_TOKENS_PARTNER: '200',
};

function loadEnv() {
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`❌ Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`);
        console.error('Configure-as no painel do Railway ou no .env local.');
        process.exit(1);
    }

    // Preenche opcionais com defaults
    for (const [key, defaultValue] of Object.entries(optional)) {
        if (!process.env[key]) {
            process.env[key] = defaultValue;
        }
    }

    return {
        port: parseInt(process.env.PORT),
        groqApiKey: process.env.GROQ_API_KEY,
        evolutionUrl: process.env.EVOLUTION_API_URL,
        evolutionApiKey: process.env.EVOLUTION_GLOBAL_APIKEY,
        instanceName: process.env.INSTANCE_NAME,
        webhookSecret: process.env.WEBHOOK_SECRET,
        telegramToken: process.env.TELEGRAM_BOT_TOKEN,
        telegramOwnerId: process.env.TELEGRAM_OWNER_ID,
        llm: {
            model: process.env.LLM_MODEL,
            attendant: {
                temperature: parseFloat(process.env.LLM_TEMPERATURE_ATTENDANT),
                maxTokens: parseInt(process.env.LLM_MAX_TOKENS_ATTENDANT),
            },
            partner: {
                temperature: parseFloat(process.env.LLM_TEMPERATURE_PARTNER),
                maxTokens: parseInt(process.env.LLM_MAX_TOKENS_PARTNER),
            },
        },
    };
}

module.exports = { loadEnv };
