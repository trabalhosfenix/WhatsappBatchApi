// 📁 services/contactEnrichmentService.js
const ContactCache = require('../models/ContactCache');
const WhatsAppInstance = require('../models/WhatsAppInstance');

class ContactEnrichmentService {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
    this.enrichmentQueue = new Map(); // Fila por sessão
  }

  /**
   * Processa uma mensagem para extrair informações de usuários
   */
  async processMessageForContactData(sessionName, msg) {
    try {
      console.log(`🔍 [Enrichment] Processando mensagem para dados de contato: ${sessionName}`);
      
      const contactsToUpdate = new Set();
      
      // 1. Extrair remetente
      const senderJid = msg.key.participant || msg.key.remoteJid;
      if (senderJid && !senderJid.includes('@g.us') && !senderJid.includes('@broadcast')) {
        contactsToUpdate.add(senderJid);
      }
      
      // 2. Extrair menções
      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      mentionedJids.forEach(jid => {
        if (jid && !jid.includes('@g.us')) {
          contactsToUpdate.add(jid);
        }
      });
      
      // 3. Extrair de reações
      if (msg.message?.reactionMessage) {
        const reactorJid = msg.message.reactionMessage.key.participant;
        if (reactorJid && !reactorJid.includes('@g.us')) {
          contactsToUpdate.add(reactorJid);
        }
      }
      
      // 4. Extrair de citações
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedParticipant && !quotedParticipant.includes('@g.us')) {
        contactsToUpdate.add(quotedParticipant);
      }
      
      console.log(`📋 [Enrichment] ${contactsToUpdate.size} contatos para processar`);
      
      // Processar cada contato
      for (const jid of contactsToUpdate) {
        await this.enrichContactFromMessage(sessionName, jid, msg);
      }
      
      return Array.from(contactsToUpdate);
      
    } catch (error) {
      console.error(`❌ [Enrichment] Erro ao processar mensagem:`, error);
    }
  }

  /**
   * Enriquece um contato específico a partir dos dados da mensagem
   */
  async enrichContactFromMessage(sessionName, jid, msg) {
    try {
      const socket = this.whatsappService.getSocketBySessionName(sessionName);
      if (!socket) {
        throw new Error('Socket não disponível');
      }
      
      // Buscar cache existente
      const instance = await WhatsAppInstance.findOne({ sessionName });
      if (!instance) return;
      
      let contactCache = await ContactCache.findOne({
        sessionName,
        userId: instance.userId
      });
      
      if (!contactCache) {
        contactCache = new ContactCache({
          sessionName,
          whatsappInstanceId: instance._id,
          userId: instance.userId,
          contacts: new Map()
        });
      }
      
      const existingContact = contactCache.contacts.get(jid);
      
      // Coletar dados básicos da mensagem
      const contactData = {
        jid: jid,
        lastActivity: new Date(),
        messageCount: (existingContact?.messageCount || 0) + 1
      };
      
      // Extrair nome do pushName se disponível
      if (msg.pushName && !existingContact?.pushName) {
        contactData.pushName = msg.pushName;
        contactData.displayName = msg.pushName;
      }
      
      // Determinar se é admin (em contexto de grupo)
      if (msg.key.remoteJid?.includes('@g.us')) {
        // Aqui você pode adicionar lógica para detectar admins
        // baseado em mensagens administrativas
      }
      
      // Se é um contato novo ou precisa de enriquecimento
      if (!existingContact || this.needsEnrichment(existingContact)) {
        await this.enrichWithWhatsAppAPI(sessionName, jid, contactData, contactCache);
      } else {
        // Apenas atualizar dados básicos
        this.updateExistingContact(existingContact, contactData, contactCache, jid);
      }
      
      await contactCache.save();
      console.log(`✅ [Enrichment] Contato atualizado: ${jid}`);
      
    } catch (error) {
      console.error(`❌ [Enrichment] Erro ao enriquecer ${jid}:`, error);
    }
  }

  /**
   * Usa a API do WhatsApp para obter informações completas
   */
  async enrichWithWhatsAppAPI(sessionName, jid, contactData, contactCache) {
    try {
      const socket = this.whatsappService.getSocketBySessionName(sessionName);
      if (!socket) return;
      
      console.log(`🔍 [Enrichment] Buscando dados completos para: ${jid}`);
      
      // Buscar contato via WhatsApp
      const contact = await socket.getContact(jid).catch(() => null);
      if (!contact) return;
      
      // Preencher com dados do contato
      contactData.name = contact.name || '';
      contactData.pushName = contact.pushname || contactData.pushName;
      contactData.shortName = contact.shortName || '';
      contactData.verifiedName = contact.verifiedName || '';
      contactData.displayName = contactData.pushName || contactData.name || contactData.verifiedName;
      
      contactData.isBusiness = contact.business || false;
      contactData.businessName = contact.businessName || '';
      contactData.businessCategory = contact.businessCategory || '';
      contactData.verified = contact.verified || false;
      
      // Extrair telefone do JID
      if (jid.includes('@s.whatsapp.net')) {
        contactData.phone = jid.replace('@s.whatsapp.net', '');
      } else if (jid.includes('@lid')) {
        contactData.phone = jid.replace('@lid', '');
      }
      
      contactData.whatsappId = jid;
      
      // Buscar foto de perfil (opcional)
      if (contactCache.trackingConfig.collectProfilePictures) {
        try {
          const profilePic = await socket.getProfilePicture(jid).catch(() => null);
          if (profilePic) {
            contactData.profilePicture = profilePic;
          }
        } catch (picError) {
          // Silencioso - foto não disponível é comum
        }
      }
      
      // Buscar status
      if (contactCache.trackingConfig.trackPresence) {
        try {
          const status = await socket.getStatus(jid).catch(() => null);
          if (status) {
            contactData.status = status;
          }
        } catch (statusError) {
          // Silencioso
        }
      }
      
      // Atualizar no cache
      const existing = contactCache.contacts.get(jid) || {};
      contactCache.contacts.set(jid, {
        ...existing,
        ...contactData,
        lastUpdate: new Date()
      });
      
    } catch (error) {
      console.error(`❌ [Enrichment] Erro na API WhatsApp para ${jid}:`, error.message);
    }
  }

  /**
   * Verifica se um contato precisa de enriquecimento
   */
  needsEnrichment(contact) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return !contact.lastUpdate || contact.lastUpdate < oneDayAgo || 
           !contact.name && !contact.pushName;
  }

  /**
   * Atualiza contato existente
   */
  updateExistingContact(existing, newData, contactCache, jid) {
    contactCache.contacts.set(jid, {
      ...existing,
      ...newData,
      lastUpdate: existing.lastUpdate // Mantém o último update completo
    });
  }

  /**
   * Busca contato enriquecido
   */
  async getEnrichedContact(sessionName, jid) {
    const instance = await WhatsAppInstance.findOne({ sessionName });
    if (!instance) return null;
    
    const contactCache = await ContactCache.findOne({
      sessionName,
      userId: instance.userId
    });
    
    return contactCache?.contacts.get(jid) || null;
  }

  /**
   * Lista todos os contatos enriquecidos
   */
  async getAllEnrichedContacts(sessionName, filters = {}) {
    const instance = await WhatsAppInstance.findOne({ sessionName });
    if (!instance) return [];
    
    const contactCache = await ContactCache.findOne({
      sessionName,
      userId: instance.userId
    });
    
    if (!contactCache) return [];
    
    let contacts = Array.from(contactCache.contacts.values());
    
    // Aplicar filtros
    if (filters.hasName) {
      contacts = contacts.filter(c => c.name || c.pushName || c.verifiedName);
    }
    
    if (filters.isBusiness) {
      contacts = contacts.filter(c => c.isBusiness);
    }
    
    if (filters.recentActivity) {
      const cutoff = new Date(Date.now() - filters.recentActivity * 60 * 60 * 1000);
      contacts = contacts.filter(c => c.lastActivity && c.lastActivity > cutoff);
    }
    
    return contacts.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
  }
}

module.exports = ContactEnrichmentService;