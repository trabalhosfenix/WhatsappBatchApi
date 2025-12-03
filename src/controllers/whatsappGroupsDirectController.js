// 📁 controllers/whatsappGroupsDirectController.js
const WhatsAppInstance = require('../models/WhatsAppInstance');
const whatsappBaileysService = require('../services/whatsappService');

console.log('✅ WhatsAppGroupsDirectController carregado');

/**
 * Busca grupos do WhatsApp diretamente via Baileys (sem salvar no banco)
 * Retorna apenas os dados em tempo real da conexão
 */
exports.getWhatsAppGroupsDirect = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log(`📡 [DIRETO] Buscando grupos WhatsApp para instância: ${id}`);

    // 1. Buscar instância
    const instance = await WhatsAppInstance.findOne({
      _id: id,
      userId,
      deleted: false
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    // 2. Verificar se está conectada
    if (instance.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada ao WhatsApp'
      });
    }

    // 3. Buscar socket da instância
    const socket = whatsappBaileysService.getSocketBySessionName(instance.sessionName);
    
    if (!socket) {
      console.log(`⚠️ Socket não encontrado para: ${instance.sessionName}`);
      
      // Tentar reconectar
      try {
        console.log(`🔄 Tentando reconectar instância...`);
        await whatsappBaileysService.reconnectInstance(instance.sessionName, userId);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Tentar novamente após reconexão
        const socketAfterReconnect = whatsappBaileysService.getSocketBySessionName(instance.sessionName);
        if (!socketAfterReconnect) {
          throw new Error('Falha ao reconectar instância');
        }
      } catch (reconnectError) {
        return res.status(400).json({
          success: false,
          error: `Instância desconectada. Recarregue o QR Code. Erro: ${reconnectError.message}`
        });
      }
    }

    // 4. Buscar grupos diretamente do WhatsApp
    console.log(`📞 Buscando grupos do WhatsApp para: ${instance.sessionName}`);
    
    try {
      // Método do Baileys para buscar todos os grupos
      const groups = await socket.groupFetchAllParticipating();
      
      console.log(`✅ Encontrados ${Object.keys(groups).length} grupos no WhatsApp`);

      // 5. Formatar resposta
      const formattedGroups = Object.entries(groups).map(([jid, group]) => {
        // Extrair participantes
        const participants = (group.participants || []).map(participant => {
          const whatsappId = participant.id || '';
          let phone = '';
          let name = '';

          // Determinar tipo de ID
          if (whatsappId.endsWith('@s.whatsapp.net')) {
            phone = whatsappId.replace('@s.whatsapp.net', '');
            name = participant.name || participant.notify || phone || 'Contato';
          } else if (whatsappId.endsWith('@lid')) {
            phone = whatsappId.replace('@lid', '');
            name = participant.name || participant.notify || `User-${phone.substring(0, 8)}` || 'Contato';
          } else {
            phone = whatsappId;
            name = participant.name || participant.notify || 'Contato';
          }

          return {
            id: whatsappId,
            name: name.substring(0, 50),
            phone: phone,
            isAdmin: !!(participant.admin ||
                      participant.admin === 'admin' ||
                      participant.admin === 'superadmin')
          };
        });

        // Extrair estatísticas
        const adminCount = participants.filter(p => p.isAdmin).length;
        const regularCount = participants.length - adminCount;

        return {
          jid: jid,
          name: group.subject || 'Sem nome',
          description: group.desc || '',
          participants: participants,
          participantCount: participants.length,
          adminCount: adminCount,
          regularCount: regularCount,
          metadata: {
            creation: group.creation,
            owner: group.owner,
            restrict: group.restrict,
            announce: group.announce,
            participantsCount: participants.length,
            isCommunity: group.isCommunity || false,
            size: this.getGroupSizeLabel(participants.length)
          }
        };
      });

      // 6. Ordenar grupos por número de participantes (do maior para o menor)
      formattedGroups.sort((a, b) => b.participantCount - a.participantCount);

      // 7. Calcular estatísticas totais
      const totalStats = formattedGroups.reduce((stats, group) => {
        return {
          totalGroups: stats.totalGroups + 1,
          totalParticipants: stats.totalParticipants + group.participantCount,
          totalAdmins: stats.totalAdmins + group.adminCount,
          totalRegular: stats.totalRegular + group.regularCount
        };
      }, { totalGroups: 0, totalParticipants: 0, totalAdmins: 0, totalRegular: 0 });

      // 8. Responder com os dados
      res.json({
        success: true,
        instance: {
          _id: instance._id,
          sessionName: instance.sessionName,
          phoneNumber: instance.phoneNumber
        },
        groups: formattedGroups,
        statistics: {
          ...totalStats,
          averageParticipants: totalStats.totalGroups > 0 
            ? Math.round(totalStats.totalParticipants / totalStats.totalGroups) 
            : 0,
          largestGroup: formattedGroups.length > 0 
            ? formattedGroups[0].participantCount 
            : 0,
          smallestGroup: formattedGroups.length > 0 
            ? formattedGroups[formattedGroups.length - 1].participantCount 
            : 0,
          groupsBySize: this.getGroupsBySizeDistribution(formattedGroups)
        },
        timestamp: new Date().toISOString(),
        source: 'whatsapp-direct'
      });

    } catch (fetchError) {
      console.error('❌ Erro ao buscar grupos do WhatsApp:', fetchError);
      
      // Verificar se é erro de desconexão
      if (fetchError.message?.includes('not connected') || 
          fetchError.message?.includes('timeout') ||
          fetchError.message?.includes('socket')) {
        
        // Marcar instância como desconectada
        await WhatsAppInstance.findByIdAndUpdate(instance._id, {
          status: 'disconnected'
        });
        
        return res.status(400).json({
          success: false,
          error: 'Conexão perdida com o WhatsApp. Por favor, reconecte a instância.',
          requiresReconnect: true
        });
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('❌ [DIRETO] Erro ao buscar grupos WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno ao buscar grupos do WhatsApp'
    });
  }
};

/**
 * Busca grupos com filtros específicos
 */
exports.getWhatsAppGroupsFiltered = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { 
      minParticipants, 
      maxParticipants, 
      hasAdminsOnly,
      search 
    } = req.query;

    console.log(`🔍 [FILTERED] Buscando grupos com filtros para: ${id}`);

    // Primeiro buscar todos os grupos
    const result = await this.getWhatsAppGroupsDirect(req, res, true);
    
    if (!result.success) {
      return result;
    }

    let filteredGroups = result.groups;

    // Aplicar filtros
    if (minParticipants) {
      filteredGroups = filteredGroups.filter(
        group => group.participantCount >= parseInt(minParticipants)
      );
    }

    if (maxParticipants) {
      filteredGroups = filteredGroups.filter(
        group => group.participantCount <= parseInt(maxParticipants)
      );
    }

    if (hasAdminsOnly === 'true') {
      filteredGroups = filteredGroups.filter(
        group => group.adminCount > 0
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredGroups = filteredGroups.filter(
        group => 
          group.name.toLowerCase().includes(searchLower) ||
          group.description.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      groups: filteredGroups,
      originalCount: result.groups.length,
      filteredCount: filteredGroups.length,
      filtersApplied: {
        minParticipants,
        maxParticipants,
        hasAdminsOnly,
        search
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar grupos filtrados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Busca detalhes de um grupo específico
 */
exports.getWhatsAppGroupDetails = async (req, res) => {
  try {
    const { id, groupJid } = req.params;
    const userId = req.user._id;

    console.log(`🔍 [DETAILS] Buscando detalhes do grupo: ${groupJid}`);

    // Buscar instância
    const instance = await WhatsAppInstance.findOne({
      _id: id,
      userId,
      deleted: false
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    // Buscar socket
    const socket = whatsappBaileysService.getSocketBySessionName(instance.sessionName);
    
    if (!socket) {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada'
      });
    }

    // Buscar grupo específico
    const groupMetadata = await socket.groupMetadata(groupJid);
    
    if (!groupMetadata) {
      return res.status(404).json({
        success: false,
        error: 'Grupo não encontrado'
      });
    }

    // Buscar foto do grupo (se disponível)
    let groupPicture = null;
    try {
      groupPicture = await socket.getProfilePicture(groupJid);
    } catch (error) {
      console.log(`⚠️ Foto do grupo não disponível: ${error.message}`);
    }

    // Formatar resposta
    const response = {
      success: true,
      group: {
        jid: groupJid,
        name: groupMetadata.subject || 'Sem nome',
        description: groupMetadata.desc || '',
        picture: groupPicture,
        creation: groupMetadata.creation,
        owner: groupMetadata.owner,
        restrict: !!groupMetadata.restrict,
        announce: !!groupMetadata.announce,
        isCommunity: groupMetadata.isCommunity || false,
        participantsCount: groupMetadata.participants?.length || 0,
        participants: (groupMetadata.participants || []).map(p => ({
          id: p.id,
          isAdmin: !!(p.admin || p.admin === 'admin' || p.admin === 'superadmin'),
          isSuperAdmin: p.admin === 'superadmin'
        }))
      },
      instance: {
        _id: instance._id,
        sessionName: instance.sessionName
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Erro ao buscar detalhes do grupo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Métodos auxiliares
 */

// Classificar tamanho do grupo
exports.getGroupSizeLabel = (participantCount) => {
  if (participantCount <= 10) return 'pequeno';
  if (participantCount <= 50) return 'médio';
  if (participantCount <= 100) return 'grande';
  return 'muito grande';
};

// Distribuição por tamanho
exports.getGroupsBySizeDistribution = (groups) => {
  const distribution = {
    pequeno: 0,
    medio: 0,
    grande: 0,
    'muito grande': 0
  };

  groups.forEach(group => {
    const sizeLabel = this.getGroupSizeLabel(group.participantCount);
    distribution[sizeLabel]++;
  });

  return distribution;
};

/**
 * Teste de conexão com o WhatsApp
 */
exports.testWhatsAppConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const instance = await WhatsAppInstance.findOne({
      _id: id,
      userId,
      deleted: false
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const socket = whatsappBaileysService.getSocketBySessionName(instance.sessionName);
    
    if (!socket) {
      return res.json({
        success: false,
        connected: false,
        message: 'Instância não está conectada'
      });
    }

    // Testar conexão tentando buscar o próprio usuário
    const user = socket.user;
    
    if (!user) {
      return res.json({
        success: false,
        connected: false,
        message: 'Socket existe mas não está autenticado'
      });
    }

    // Testar se consegue fazer uma operação simples
    try {
      // Tentar buscar alguns contatos (limitado para teste rápido)
      const contacts = await socket.getContacts();
      
      return res.json({
        success: true,
        connected: true,
        message: 'Conexão ativa com o WhatsApp',
        details: {
          phoneNumber: user.id?.replace(/:\d+$/, '') || 'N/A',
          contactsCount: contacts?.length || 0,
          sessionName: instance.sessionName,
          connectionTime: instance.lastConnection
        }
      });
    } catch (testError) {
      return res.json({
        success: false,
        connected: false,
        message: `Conexão instável: ${testError.message}`
      });
    }

  } catch (error) {
    console.error('❌ Erro no teste de conexão:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;