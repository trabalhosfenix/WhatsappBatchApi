// 📁 services/unifiedTrackingService.js (substitui messageControlService + persistentTrackingService)
const TrackingConfig = require('../models/TrackingConfig');
const ContactCache = require('../models/ContactCache');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const ContactEnrichmentService = require('./contactEnrichmentService');

class UnifiedTrackingService {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
    this.contactEnrichmentService = new ContactEnrichmentService(whatsappService);
    this.activeListeners = new Map();
    this.messageCache = new Set();
    
    console.log('✅ UnifiedTrackingService inicializado');
  }

  // ✅ MÉTODOS DE TRACKING (do PersistentTrackingService)
  async initializeAllTrackings() {
    try {
      console.log('🔄 Inicializando trackings...');
      
      const trackings = await TrackingConfig.find({ 
        enabled: true,
        autoReenable: true 
      }).populate('whatsappInstanceId');
      
      console.log(`📋 ${trackings.length} trackings para reativar`);
      
      for (const tracking of trackings) {
        try {
          await this.initializeTrackingForSession(tracking.sessionName);
        } catch (error) {
          console.error(`❌ Erro ao reativar ${tracking.sessionName}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Erro na inicialização de trackings:', error);
    }
  }

  async enableTracking(sessionName, userId, instanceId, options = {}) {
    try {
      // Salvar configuração
      const trackingConfig = await TrackingConfig.findOneAndUpdate(
        { sessionName },
        {
          sessionName,
          userId,
          whatsappInstanceId: instanceId,
          enabled: true,
          autoReenable: true,
          ...options
        },
        { upsert: true, new: true }
      );
      
      // Inicializar tracking
      const success = await this.initializeTrackingForSession(sessionName);
      
      return {
        success,
        trackingConfig,
        message: success ? 
          `Tracking ativado para ${sessionName}` : 
          `Tracking configurado, aguardando conexão`
      };
      
    } catch (error) {
      console.error(`❌ Erro ao ativar tracking para ${sessionName}:`, error);
      throw error;
    }
  }

  async disableTracking(sessionName) {
    try {
      // Remover listener
      const socket = this.whatsappService.sockets.get(sessionName);
      if (socket && this.activeListeners.has(sessionName)) {
        const listener = this.activeListeners.get(sessionName);
        socket.ev.off("messages.upsert", listener);
        this.activeListeners.delete(sessionName);
      }
      
      // Atualizar banco
      await TrackingConfig.findOneAndUpdate(
        { sessionName },
        { 
          enabled: false,
          autoReenable: false,
          isListening: false
        }
      );
      
      return { success: true, message: `Tracking desativado para ${sessionName}` };
      
    } catch (error) {
      console.error(`❌ Erro ao desativar tracking para ${sessionName}:`, error);
      throw error;
    }
  }

  async getTrackingStatus(sessionName) {
    const trackingConfig = await TrackingConfig.findOne({ sessionName });
    const isListening = this.activeListeners.has(sessionName);
    const hasSocket = !!this.whatsappService.sockets.get(sessionName);
    
    return {
      sessionName,
      configured: !!trackingConfig,
      enabled: trackingConfig?.enabled || false,
      autoReenable: trackingConfig?.autoReenable || false,
      isListening,
      hasSocket,
      lastActive: trackingConfig?.lastActive
    };
  }

  async getActiveTrackings() {
    const activeSessions = Array.from(this.activeListeners.keys());
    const configuredTrackings = await TrackingConfig.find({ enabled: true });
    
    return {
      activeSessions,
      configuredTrackings: configuredTrackings.map(t => t.sessionName),
      count: activeSessions.length
    };
  }

  // ✅ MÉTODOS DE CONTATO (do ContactEnrichmentService)
  async processMessageForContactData(sessionName, msg) {
    return await this.contactEnrichmentService.processMessageForContactData(sessionName, msg);
  }

  async getAllEnrichedContacts(sessionName, filters = {}) {
    return await this.contactEnrichmentService.getAllEnrichedContacts(sessionName, filters);
  }

  async getEnrichedContact(sessionName, jid) {
    return await this.contactEnrichmentService.getEnrichedContact(sessionName, jid);
  }

  async forceRefreshContact(sessionName, jid) {
    // Implementação para forçar atualização
    console.log(`🔄 Forçando atualização do contato: ${jid}`);
    // Você pode implementar a lógica específica aqui
  }

  // ✅ MÉTODOS PRIVADOS
  async initializeTrackingForSession(sessionName) {
    try {
      const instance = await WhatsAppInstance.findOne({ sessionName });
      if (!instance || instance.status !== 'connected') {
        return false;
      }
      
      const socket = this.whatsappService.sockets.get(sessionName);
      if (!socket) return false;
      
      // Remover listener anterior
      if (this.activeListeners.has(sessionName)) {
        const previousListener = this.activeListeners.get(sessionName);
        socket.ev.off("messages.upsert", previousListener);
      }
      
      // Criar novo listener
      const messageListener = this.createMessageListener(sessionName);
      socket.ev.on("messages.upsert", messageListener);
      this.activeListeners.set(sessionName, messageListener);
      
      // Atualizar configuração
      await TrackingConfig.findOneAndUpdate(
        { sessionName },
        { 
          isListening: true,
          lastActive: new Date()
        },
        { upsert: true }
      );
      
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao inicializar tracking para ${sessionName}:`, error);
      await TrackingConfig.findOneAndUpdate(
        { sessionName },
        { isListening: false }
      );
      throw error;
    }
  }

  createMessageListener(sessionName) {
    const { handleMessage } = require("../controllers/messageController");
    
    return async ({ messages, type }) => {
      try {
        const msg = messages[0];
        if (!msg.message || !msg.key.id) return;

        const socket = this.whatsappService.sockets.get(sessionName);
        if (!socket) return;

        const uniqueId = `${msg.key.remoteJid}_${msg.key.id}_${type}`;
        
        // Prevenir duplicatas
        if (this.messageCache.has(uniqueId)) return;
        this.messageCache.add(uniqueId);
        setTimeout(() => this.messageCache.delete(uniqueId), 30000);

        // Processar mensagem
        await handleMessage(socket, msg);
        
        // Atualizar atividade
        await TrackingConfig.findOneAndUpdate(
          { sessionName },
          { lastActive: new Date() }
        );
        
      } catch (error) {
        console.error(`❌ Erro no listener de ${sessionName}:`, error);
      }
    };
  }

  setupInstanceMonitoring() {
    setInterval(async () => {
      try {
        const trackings = await TrackingConfig.find({ 
          enabled: true,
          autoReenable: true,
          isListening: false
        });
        
        for (const tracking of trackings) {
          const instance = await WhatsAppInstance.findOne({ 
            sessionName: tracking.sessionName,
            status: 'connected'
          });
          
          if (instance && !this.activeListeners.has(tracking.sessionName)) {
            await this.initializeTrackingForSession(tracking.sessionName);
          }
        }
      } catch (error) {
        console.error('❌ Erro no monitoramento:', error);
      }
    }, 30000);
  }
}

module.exports = UnifiedTrackingService;