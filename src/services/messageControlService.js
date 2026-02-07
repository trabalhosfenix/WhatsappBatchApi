// services/messageControlService.js
const { handleMessage } = require("../controllers/messageController");

class MessageControlService {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.messageCache = new Set();
        this.activeTrackers = new Map(); // sessionName -> { socket, listener }
    }

    // ✅ Ativar rastreio para uma sessão
    async enableMessageTracking(sessionName) {
        try {
            console.log(`🎯 [MessageControl] Ativando rastreio para: ${sessionName}`);
            
            const socket = this.whatsappService.getSocketBySessionName(sessionName);
            if (!socket) {
                throw new Error(`Socket não encontrado para: ${sessionName}`);
            }

            // Criar listener para mensagens
            const messageListener = async ({ messages, type }) => {
                const msg = messages[0];
                if (!msg.message || !msg.key.id) return;

                const uniqueId = `${msg.key.remoteJid}_${msg.key.id}_${type}`;
                
                // Prevenir duplicatas
                if (this.messageCache.has(uniqueId)) {
                    return;
                }
                this.messageCache.add(uniqueId);

                try {
                    await handleMessage(socket, msg);
                } catch (error) {
                    console.error('❌ Erro no processamento:', error);
                }
            };

            // Registrar listener
            socket.ev.on("messages.upsert", messageListener);
            
            // Salvar referência para poder remover depois
            this.activeTrackers.set(sessionName, {
                socket,
                listener: messageListener
            });

            console.log(`✅ [MessageControl] Rastreio ativado para: ${sessionName}`);
            return { success: true, message: 'Rastreio ativado' };

        } catch (error) {
            console.error(`❌ [MessageControl] Erro ao ativar rastreio:`, error);
            throw error;
        }
    }

    // ✅ Desativar rastreio para uma sessão
    async disableMessageTracking(sessionName) {
        try {
            console.log(`🚫 [MessageControl] Desativando rastreio para: ${sessionName}`);
            
            const tracker = this.activeTrackers.get(sessionName);
            if (tracker) {
                // Remover listener
                tracker.socket.ev.off("messages.upsert", tracker.listener);
                this.activeTrackers.delete(sessionName);
            }

            console.log(`✅ [MessageControl] Rastreio desativado para: ${sessionName}`);
            return { success: true, message: 'Rastreio desativado' };

        } catch (error) {
            console.error(`❌ [MessageControl] Erro ao desativar rastreio:`, error);
            throw error;
        }
    }

    // ✅ Verificar status do rastreio
    getTrackingStatus(sessionName) {
        const isActive = this.activeTrackers.has(sessionName);
        return {
            enabled: isActive,
            sessionName: sessionName
        };
    }

    // ✅ Listar todas as sessões com rastreio ativo
    getActiveTrackers() {
        const activeSessions = Array.from(this.activeTrackers.keys());
        return {
            activeSessions,
            count: activeSessions.length
        };
    }
}

module.exports = MessageControlService;