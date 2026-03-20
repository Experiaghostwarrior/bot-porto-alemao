/**
 * Memória de conversa centralizada com sliding window.
 * Usado tanto pelo Atendente (WhatsApp) quanto pelo Sócio (Telegram).
 */

const stores = {};

function getOrCreate(userId, systemPrompt) {
    if (!stores[userId]) {
        stores[userId] = [{ role: 'system', content: systemPrompt }];
    }
    return stores[userId];
}

function addMessage(userId, role, content) {
    if (!stores[userId]) return;
    stores[userId].push({ role, content });

    // Sliding window: mantém system prompt + últimas 10 mensagens
    if (stores[userId].length > 11) {
        const sys = stores[userId][0];
        stores[userId] = [sys, ...stores[userId].slice(-10)];
    }
}

function reset(userId, systemPrompt) {
    stores[userId] = [{ role: 'system', content: systemPrompt }];
}

function getMessages(userId) {
    return stores[userId] || [];
}

module.exports = { getOrCreate, addMessage, reset, getMessages };
