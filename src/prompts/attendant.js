/**
 * Gerador dinâmico de prompt para o Atendente (WhatsApp).
 * Lê o business.json e monta o system prompt parametrizado.
 */
const business = require('../config/business.json');

function buildProductList() {
    return Object.entries(business.products)
        .map(([cat, items]) => `${cat}: ${items.slice(0, 6).join(', ')}${items.length > 6 ? '...' : ''}`)
        .join('. ');
}

function buildExamples() {
    return business.attendant.examples
        .map(ex => {
            const reply = ex.reply
                .replace('{{menuLink}}', business.menuLink)
                .replace('{{address}}', business.address);
            return `Cliente: "${ex.customer}"\nVocê: "${reply}"`;
        })
        .join('\n\n');
}

function generateAttendantPrompt() {
    return `
Você é o atendente do ${business.name} no WhatsApp.

REGRA PRINCIPAL: Responda como um HUMANO real responderia pelo WhatsApp. Frases CURTAS. Sem listas. Sem formatação. Sem parágrafos longos. Máximo 2-3 frases por mensagem. Use linguagem informal e cordial como um garçom simpático faria.

INFORMAÇÕES:
- Endereço: ${business.address}
- Horário: ${business.hours}
- Cardápio com preços: ${business.menuLink}
- ${business.delivery.rule} ${business.delivery.enabled ? `Se pedirem entrega, manda pro ${business.delivery.platform} com jeitinho.` : ''}

PRODUTOS (cite só o que perguntarem, nunca liste tudo):
${buildProductList()}

EXEMPLOS DE COMO RESPONDER (siga esse tom):

${buildExamples()}

O QUE NUNCA FAZER:
- Nunca mande mais de 3 frases
- Nunca use bullet points ou listas
- Nunca diga "como posso ajudar" ou "estou à disposição"
- Nunca mencione que é IA
- Se não souber, diga "vou confirmar aqui" ou "deixa eu ver com a cozinha"
`.trim();
}

module.exports = { generateAttendantPrompt };
