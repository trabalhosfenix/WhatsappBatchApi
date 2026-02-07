// 📁 services/whatsappDataService.js - NOVO SERVIÇO
const ContactGroup = require('../models/ContactGroup');
const WhatsAppService = require('./whatsappService'); // Caminho correto

class WhatsAppDataService {
  constructor() {
    // Usar o singleton existente do WhatsAppService
    this.whatsappService = WhatsAppService;
  }

  async enrichContactInfo(sessionName, contactId) {
    try {
      // ✅ Usar socket do serviço principal
      const socket = this.whatsappService.sockets.get(sessionName);
      if (!socket) {
        throw new Error('Instância WhatsApp não encontrada ou não conectada');
      }

      const contact = await socket.getContact(contactId);
      if (!contact) return null;

      // Coleta informações do perfil
      const profilePicture = await this.getProfilePicture(sessionName, contactId);
      const status = await this.getStatus(sessionName, contactId);

      return {
        name: contact.name || contact.pushname || contact.verifiedName || '',
        pushName: contact.pushname || '',
        shortName: contact.shortName || '',
        phone: contact.id.user,
        whatsappId: contact.id._serialized,
        profilePicture: profilePicture || '',
        status: status || '',
        lastSeen: contact.lastSeen ? new Date(contact.lastSeen * 1000) : null,
        isBusiness: contact.business || false,
        businessName: contact.businessName || '',
        businessCategory: contact.businessCategory || '',
        verified: contact.verified || false,
        isGroup: contact.id.server === 'g.us',
        platform: 'whatsapp'
      };
    } catch (error) {
      console.error(`❌ Erro ao enriquecer contato ${contactId}:`, error);
      return null;
    }
  }

  // ✅ Coleta foto de perfil
  async getProfilePicture(sessionName, contactId) {
    try {
      const socket = this.sockets.get(sessionName);
      if (!socket) return null;

      const profilePic = await socket.getProfilePicture(contactId);
      return profilePic || null;
    } catch (error) {
      // Foto não disponível é comum, não logar como erro
      return null;
    }
  }

  // ✅ Coleta status
  async getStatus(sessionName, contactId) {
    try {
      const socket = this.sockets.get(sessionName);
      if (!socket) return null;

      const status = await socket.getStatus(contactId);
      return status || '';
    } catch (error) {
      return null;
    }
  }

  // ✅ Carrega contatos com informações completas
  async loadContactsWithDetails(sessionName, userId, instanceId) {
    try {
      const socket = this.sockets.get(sessionName);
      if (!socket) {
        throw new Error('Instância não conectada');
      }

      console.log(`📞 Coletando contatos com detalhes para: ${sessionName}`);

      // Buscar todos os contatos
      const contacts = await socket.getContacts();
      console.log(`📊 Total de contatos encontrados: ${contacts.length}`);

      const enrichedContacts = [];
      const batchSize = 10; // Processar em lotes para não sobrecarregar
      
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        console.log(`🔄 Processando lote ${i/batchSize + 1}/${Math.ceil(contacts.length/batchSize)}`);

        const batchPromises = batch.map(async (contact) => {
          try {
            // Pular contatos inválidos ou grupos
            if (!contact.id || contact.id.server === 'g.us' || contact.id.server === 'broadcast') {
              return null;
            }

            const enrichedContact = await this.enrichContactInfo(sessionName, contact.id._serialized);
            if (enrichedContact) {
              return enrichedContact;
            }
          } catch (error) {
            console.warn(`⚠️ Erro processando contato:`, error.message);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        enrichedContacts.push(...batchResults.filter(contact => contact !== null));
        
        // Delay entre lotes para evitar bloqueio
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`✅ ${enrichedContacts.length} contatos enriquecidos com sucesso`);

      // Salvar no grupo de contatos
      const contactGroup = await ContactGroup.findOneAndUpdate(
        {
          userId: userId,
          name: `Contatos ${sessionName}`,
          source: 'whatsapp'
        },
        {
          userId: userId,
          name: `Contatos ${sessionName}`,
          description: `Contatos importados da instância ${sessionName}`,
          contacts: enrichedContacts,
          source: 'whatsapp',
          whatsappInstanceId: instanceId,
          syncStatus: 'synced',
          lastSync: new Date(),
          groupType: 'personal'
        },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true 
        }
      );

      return {
        success: true,
        contactCount: enrichedContacts.length,
        groupId: contactGroup._id,
        sessionName: sessionName
      };

    } catch (error) {
      console.error('❌ Erro ao carregar contatos com detalhes:', error);
      throw error;
    }
  }

  // ✅ Carrega informações de um contato específico
  async refreshContactInfo(sessionName, contactId, userId) {
    try {
      const enrichedContact = await this.enrichContactInfo(sessionName, contactId);
      
      if (!enrichedContact) {
        throw new Error('Não foi possível atualizar informações do contato');
      }

      // Atualizar contato em todos os grupos do usuário
      await ContactGroup.updateMany(
        {
          userId: userId,
          'contacts.phone': enrichedContact.phone
        },
        {
          $set: {
            'contacts.$': enrichedContact
          }
        }
      );

      return enrichedContact;
    } catch (error) {
      console.error('❌ Erro ao atualizar contato:', error);
      throw error;
    }
  }

  // ✅ Coleta estatísticas dos contatos
  async getContactsStatistics(sessionName, userId) {
    try {
      const groups = await ContactGroup.find({
        userId: userId,
        source: 'whatsapp',
        'contacts.platform': 'whatsapp'
      });

      const allContacts = groups.flatMap(group => group.contacts);
      
      const stats = {
        totalContacts: allContacts.length,
        withProfilePicture: allContacts.filter(c => c.profilePicture).length,
        businessAccounts: allContacts.filter(c => c.isBusiness).length,
        verifiedAccounts: allContacts.filter(c => c.verified).length,
        withStatus: allContacts.filter(c => c.status && c.status.trim() !== '').length,
        lastSeenAvailable: allContacts.filter(c => c.lastSeen).length,
        byPlatform: {
          whatsapp: allContacts.filter(c => c.platform === 'whatsapp').length,
          manual: allContacts.filter(c => c.platform === 'manual').length,
          imported: allContacts.filter(c => c.platform === 'imported').length
        }
      };

      return stats;
    } catch (error) {
      console.error('❌ Erro ao coletar estatísticas:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppDataService();