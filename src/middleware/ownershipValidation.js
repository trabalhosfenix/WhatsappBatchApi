const mongoose = require('mongoose'); // ✅ ADICIONAR ESTA LINHA
const WhatsAppInstance = require('../models/WhatsAppInstance');
const ContactGroup = require('../models/ContactGroup');

class OwnershipValidation {
  
  static async validateInstanceOwnership(instanceId, userId) {
    if (!mongoose.Types.ObjectId.isValid(instanceId) || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('IDs inválidos fornecidos');
    }

    const instance = await WhatsAppInstance.findOne({
      _id: instanceId,
      userId: userId
    });

    if (!instance) {
      throw new Error('Instância não encontrada ou acesso negado');
    }

    return instance;
  }

  static async validateSessionOwnership(sessionName, userId) {
    if (!sessionName || !userId) {
      throw new Error('Nome da sessão e usuário são obrigatórios');
    }

    const instance = await WhatsAppInstance.findOne({
      sessionName: sessionName,
      userId: userId
    });

    if (!instance) {
      throw new Error('Sessão não encontrada ou acesso negado');
    }

    return instance;
  }

  static async validateGroupOwnership(groupId, userId) {
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('IDs inválidos fornecidos');
    }

    const group = await ContactGroup.findOne({
      _id: groupId,
      userId: userId
    });

    if (!group) {
      throw new Error('Grupo não encontrado ou acesso negado');
    }

    return group;
  }

  // ✅ VALIDAÇÃO EM MASSA PARA MÚLTIPLOS GRUPOS
  static async validateMultipleGroupsOwnership(groupIds, userId) {
    if (!Array.isArray(groupIds)) {
      throw new Error('Lista de IDs de grupos é obrigatória');
    }

    const validGroups = await ContactGroup.find({
      _id: { $in: groupIds },
      userId: userId
    });

    if (validGroups.length !== groupIds.length) {
      const validIds = validGroups.map(g => g._id.toString());
      const invalidIds = groupIds.filter(id => !validIds.includes(id.toString()));
      throw new Error(`Acesso negado para os grupos: ${invalidIds.join(', ')}`);
    }

    return validGroups;
  }
}

module.exports = OwnershipValidation;