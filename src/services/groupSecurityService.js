const mongoose = require('mongoose'); // ✅ ADICIONAR ESTA LINHA
const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const OwnershipValidation = require('../middleware/ownershipValidation');

class GroupSecurityService {
  
  // ✅ CARREGAR GRUPOS COM VERIFICAÇÃO COMPLETA
  async loadGroupsSecurely(sessionName, userId) {
    try {
      console.log(`🔒 [Security] Validando acesso: ${sessionName} para usuário ${userId}`);
      
      const instance = await OwnershipValidation.validateSessionOwnership(sessionName, userId);
      
      const groups = await ContactGroup.find({
        userId: userId,
        whatsappInstanceId: instance._id,
        source: 'whatsapp'
      }).populate('whatsappInstanceId', 'sessionName status phoneNumber');

      console.log(`✅ [Security] ${groups.length} grupos carregados com segurança`);
      
      return {
        success: true,
        data: groups,
        instance: instance.sessionName,
        total: groups.length
      };

    } catch (error) {
      console.error(`❌ [Security] Erro de segurança: ${error.message}`);
      throw error;
    }
  }

  // ✅ SINCRONIZAR GRUPOS COM PROTEÇÃO TOTAL (VERSÃO SIMPLIFICADA)
  async syncGroupsSecurely(instanceId, userId, groupsData) {
    try {
      // 1. Validar ownership SEM transação complexa inicialmente
      const instance = await OwnershipValidation.validateInstanceOwnership(instanceId, userId);

      const results = [];
      const errors = [];

      for (const groupData of groupsData) {
        try {
          // 2. Garantir dados seguros
          const secureGroupData = {
            ...groupData,
            userId: userId, // ✅ FORÇAR userId CORRETO
            whatsappInstanceId: instanceId,
            source: 'whatsapp'
          };

          // 3. Upsert com filtro de segurança (sem session inicialmente)
          const savedGroup = await ContactGroup.findOneAndUpdate(
            {
              userId: userId,
              jid: groupData.jid,
              whatsappInstanceId: instanceId
            },
            secureGroupData,
            {
              upsert: true,
              new: true,
              runValidators: true
            }
          );

          results.push(savedGroup);
          console.log(`✅ [Security] Grupo sincronizado: ${savedGroup.name}`);
          
        } catch (groupError) {
          errors.push({
            jid: groupData.jid,
            error: groupError.message
          });
          console.error(`❌ [Security] Erro no grupo ${groupData.jid}:`, groupError.message);
        }
      }

      console.log(`✅ [Security] Sincronização segura concluída: ${results.length} sucessos, ${errors.length} erros`);
      
      return {
        success: true,
        synced: results.length,
        errors: errors.length,
        results: results.map(g => ({ jid: g.jid, name: g.name, id: g._id }))
      };

    } catch (error) {
      console.error(`❌ [Security] Erro na sincronização: ${error.message}`);
      throw error;
    }
  }

  // ✅ BUSCAR GRUPOS COM FILTROS SEGUROS
  async getGroupsByInstance(instanceId, userId, filters = {}) {
    try {
      await OwnershipValidation.validateInstanceOwnership(instanceId, userId);

      const query = {
        userId: userId,
        whatsappInstanceId: instanceId,
        ...filters
      };

      const groups = await ContactGroup.find(query)
        .populate('whatsappInstanceId', 'sessionName status phoneNumber')
        .sort({ name: 1 });

      return {
        success: true,
        data: groups,
        total: groups.length,
        instanceId: instanceId
      };

    } catch (error) {
      console.error(`❌ [Security] Erro ao buscar grupos: ${error.message}`);
      throw error;
    }
  }

  // ✅ VERIFICAR INTEGRIDADE DOS DADOS (VERSÃO SIMPLIFICADA)
  async checkDataIntegrity(userId) {
    try {
      // Buscar grupos que podem ter vazamento (versão simplificada)
      const userGroups = await ContactGroup.find({ userId: userId });
      const otherGroups = await ContactGroup.find({ 
        userId: { $ne: mongoose.Types.ObjectId(userId) }
      }).limit(10); // Apenas uma amostra

      return {
        hasLeaks: otherGroups.length > 0,
        userGroupsCount: userGroups.length,
        potentialLeaksCount: otherGroups.length,
        checkedAt: new Date()
      };
    } catch (error) {
      console.error(`❌ [Security] Erro na verificação de integridade: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new GroupSecurityService();