// services/whatsapp/MessageTracker.js
const EventEmitter = require('events');

class MessageTracker extends EventEmitter {
    constructor() {
        super();
        this.trackingEnabled = new Map(); // sessionName -> boolean
        this.messageHandlers = new Map(); // sessionName -> handler function
        this.messageCache = new Set();
    }

    // ✅ Ativar rastreio para uma sessão específica
    enableTracking(sessionName, socket, options = {}) {
        console.log(`🎯 [Tracker] Ativando rastreio para: ${sessionName}`);
        
        this.trackingEnabled.set(sessionName, true);
        
        // Configurar handler de mensagens no socket
        socket.ev.on("messages.upsert", async ({ messages, type }) => {
            await this.handleIncomingMessage(sessionName, socket, messages, type);
        });

        this.emit('trackingEnabled', { sessionName, options });
    }

    // ✅ Desativar rastreio
    disableTracking(sessionName, socket) {
        console.log(`🚫 [Tracker] Desativando rastreio para: ${sessionName}`);
        this.trackingEnabled.set(sessionName, false);
        
        // Remover listener (simplificado - em produção seria mais complexo)
        socket.ev.removeAllListeners("messages.upsert");
        
        this.emit('trackingDisabled', { sessionName });
    }

    // ✅ Processar mensagens recebidas
    async handleIncomingMessage(sessionName, socket, messages, type) {
        // Verificar se o rastreio está ativo
        if (!this.trackingEnabled.get(sessionName)) {
            return;
        }

        const msg = messages[0];
        if (!msg.message || !msg.key.id) return;

        // Prevenir duplicatas
        const uniqueId = `${msg.key.remoteJid}_${msg.key.id}_${type}`;
        if (this.messageCache.has(uniqueId)) {
            return;
        }
        this.messageCache.add(uniqueId);

        try {
            // Emitir evento para handlers externos
            this.emit('messageReceived', {
                sessionName,
                socket,
                message: msg,
                type,
                timestamp: new Date()
            });

        } catch (error) {
            console.error(`❌ [Tracker] Erro ao processar mensagem:`, error);
        }
    }

    // ✅ Registrar handler customizado
    setMessageHandler(sessionName, handler) {
        this.messageHandlers.set(sessionName, handler);
    }

    // ✅ Status do rastreio
    getTrackingStatus(sessionName) {
        return {
            enabled: this.trackingEnabled.get(sessionName) || false,
            hasCustomHandler: this.messageHandlers.has(sessionName)
        };
    }
}

module.exports = MessageTracker;