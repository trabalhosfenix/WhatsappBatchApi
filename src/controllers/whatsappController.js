const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const whatsappBaileysService = require('../services/whatsappService');
const messageControlService = require('../services/messageControlService');
const whatsappCommandQueue = require('../services/whatsappCommandQueue');
const ownershipService = require('../services/ownershipService');
const fs = require('fs');
const path = require('path');


console.log('✅ WhatsAppController carregado - VERSÃO CORRIGIDA');


const hasSavedSession = (sessionName) => {
  try {
    const sessionDir = path.join(__dirname, '..', 'auth_sessions', sessionName);
    if (!fs.existsSync(sessionDir)) return false;

    const entries = fs.readdirSync(sessionDir);
    return entries.length > 0;
  } catch (error) {
    console.warn(`⚠️ Não foi possível validar sessão salva para ${sessionName}:`, error.message);
    return false;
  }
};


exports.createInstance = async (req, res) => {
  console.log('📍 POST /api/whatsapp/instances chamado');
  console.log('📦 Body:', req.body);
  console.log('👤 User:', req.user._id);

  try {
    const { sessionName } = req.body;

    if (!sessionName) {
      return res.status(400).json({
        success: false,
        error: 'Nome da sessão é obrigatório'
      });
    }

    console.log(`🚀 [Baileys] Criando instância: ${sessionName}`);

    if (whatsappCommandQueue.isEnabled()) {
      const userId = String(req.user._id);
      const ownerNode = ownershipService.resolveOwner({ userId, sessionName });
      const queueName = ownershipService.getQueueNameForOwner(ownerNode);

      const enqueueResult = await whatsappCommandQueue.enqueue('connect', {
        sessionName,
        userId,
        ownerNode
      }, { queueName });

      return res.status(202).json({
        success: true,
        queued: true,
        command: 'connect',
        ownerNode,
        queueName,
        jobId: enqueueResult.jobId,
        message: 'Comando de conexão enfileirado. Aguarde e consulte o status da instância.'
      });
    }

    const instance = await whatsappBaileysService.createClient(sessionName, req.user._id);
    const updatedInstance = await WhatsAppInstance.findById(instance._id);

    res.status(201).json({
      success: true,
      queued: false,
      instance: {
        _id: updatedInstance._id,
        sessionName: updatedInstance.sessionName,
        status: updatedInstance.status,
        qrCode: updatedInstance.qrCode,
        phoneNumber: updatedInstance.phoneNumber,
        createdAt: updatedInstance.createdAt
      },
      message: 'Instância criada com Baileys. Escaneie o QR code para conectar.'
    });

  } catch (error) {
    console.error('❌ [Baileys] Erro:', error);

    const isUserInstanceConflict = error.message?.includes('Usuário já possui instância ativa');
    const isDuplicateKey = error.code === 11000;

    const statusCode = isUserInstanceConflict || isDuplicateKey ? 409 : 400;
    const errorMessage = isDuplicateKey
      ? 'Usuário já possui uma instância cadastrada. Remova a existente antes de criar outra.'
      : error.message;

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
};

// ✅ CORREÇÃO: APENAS UMA FUNÇÃO deleteInstance
exports.deleteInstance = async (req, res) => {
  try {
    const { sessionName } = req.params;

    if (!sessionName) {
      return res.status(400).json({
        success: false,
        error: 'Nome da sessão é obrigatório'
      });
    }

    console.log(`🗑️ [Baileys] Solicitação para deletar instância: ${sessionName}`);

    // Verificar se a instância existe
    const instance = await WhatsAppInstance.findOne({
      sessionName,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada ou não pertence ao usuário'
      });
    }

    // Deletar a instância usando o serviço
    await whatsappBaileysService.deleteInstance(sessionName);

    res.status(200).json({
      success: true,
      message: `Instância ${sessionName} deletada com sucesso`
    });

  } catch (error) {
    console.error('❌ [Baileys] Erro ao deletar instância:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getInstances = async (req, res) => {
  try {
    console.log('📋 GET /api/whatsapp/instances chamado');

    const instances = await WhatsAppInstance.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    console.log(`📊 Encontradas ${instances.length} instâncias`);

    
    const enrichedInstances = await Promise.all(instances.map(async (instance) => {
      const socketStatus = await whatsappBaileysService.getSocketStatus(instance.sessionName);
      const sessionPersisted = hasSavedSession(instance.sessionName);
      const canAttemptRecovery = sessionPersisted && instance.status !== 'connected';

      return {
        _id: instance._id,
        sessionName: instance.sessionName,
        status: instance.status,
        qrCode: instance.qrCode,
        qrCodeReady: Boolean(instance.qrCode),
        sessionPersisted,
        canAttemptRecovery,
        recoveryPriority: canAttemptRecovery ? 'recover_session' : 'read_qr',
        socketState: socketStatus.connectionState || 'unknown',
        reconnecting: socketStatus.reconnecting,
        reconnectAttempts: socketStatus.reconnectAttempts,
        phoneNumber: instance.phoneNumber,
        lastConnection: instance.lastConnection,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt
      };
    }));

    res.json({
      success: true,
      instances: enrichedInstances
    });




  } catch (error) {
    console.error('❌ Erro ao buscar instâncias:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getInstance = async (req, res) => {
  try {
    console.log(`🔍 GET /api/whatsapp/instances/${req.params.id} chamado`);

    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }
    // await messageControlService.enableMessageTracking(instance.sessionName);
    // console.log(`✅ Tracking ativado automaticamente para: ${instance.sessionName}`);

    res.json({
      success: true,
      instance: {
        _id: instance._id,
        sessionName: instance.sessionName,
        status: instance.status,
        qrCode: instance.qrCode,
        qrCodeReady: Boolean(instance.qrCode),
        sessionPersisted: hasSavedSession(instance.sessionName),
        canAttemptRecovery: hasSavedSession(instance.sessionName) && instance.status !== 'connected',
        phoneNumber: instance.phoneNumber,
        lastConnection: instance.lastConnection,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar instância:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getQRCode = async (req, res) => {
  try {
    console.log(`📱 GET /api/whatsapp/instances/${req.params.id}/qrcode chamado`);

    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    if (!instance.qrCode) {
      if (instance.status !== 'connected') {
        try {
          const socketStatus = await whatsappBaileysService.getSocketStatus(instance.sessionName);
          const shouldReconnect = !socketStatus.hasSocket || ['disconnected', 'failed'].includes(socketStatus.connectionState);

          if (shouldReconnect) {
            await whatsappBaileysService.reconnectInstance(instance.sessionName, req.user._id);
          }
        } catch (reconnectError) {
          console.warn(`⚠️ Não foi possível iniciar reconexão para gerar QR: ${reconnectError.message}`);
        }
      }

      return res.json({
        success: true,
        pending: true,
        qrCode: null,
        qrCodeReady: false,
        status: instance.status,
        message: 'QR Code ainda não disponível. Tentando gerar em tempo real...'
      });
    }

    res.json({
      success: true,
      pending: false,
      qrCode: instance.qrCode,
      qrCodeReady: Boolean(instance.qrCode),
      status: instance.status,
      message: 'QR Code gerado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao buscar QR Code:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.loadGroups = async (req, res) => {
  try {
    console.log(`🔄 POST /api/whatsapp/instances/${req.params.id}/load-groups chamado`);

    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    if (instance.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada'
      });
    }

    console.log(`📞 Carregando grupos para instância: ${instance.sessionName}`);

    // VERIFICAR CONEXÃO ANTES
    const socketStatus = await whatsappBaileysService.getSocketStatus(instance.sessionName);
    console.log(`🔍 Status do socket:`, socketStatus);

    if (!socketStatus.connected) {
      console.log(`🔄 Tentando reconectar instância...`);
      try {
        await whatsappBaileysService.reconnectInstance(instance.sessionName, req.user._id);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (reconnectError) {
        return res.status(400).json({
          success: false,
          error: `Instância desconectada. Recarregue o QR Code. Erro: ${reconnectError.message}`
        });
      }
    }

    // ✅ CORREÇÃO: Capturar o objeto retornado e extrair o total
    const result = await whatsappBaileysService.loadGroupsFromWhatsApp(
      instance.sessionName,
      req.user._id
    );

    const groupCount = result.total || 0; // Extrair o número de grupos

    // Atualizar grupos com a instância do WhatsApp
    await ContactGroup.updateMany(
      {
        userId: req.user._id,
        source: 'whatsapp'
      },
      {
        whatsappInstanceId: instance._id
      }
    );

    console.log(`✅ ${groupCount} grupos carregados com sucesso`);

    res.json({
      success: true,
      message: `Grupos carregados com sucesso`,
      groupCount: groupCount,
      instanceId: instance._id,
      details: result // ✅ Incluir detalhes adicionais se necessário
    });

  } catch (error) {
    console.error('❌ Erro ao carregar grupos:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getGroups = async (req, res) => {
  try {
    console.log(`📋 GET /api/whatsapp/instances/${req.params.id}/groups chamado`);

    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const groups = await ContactGroup.find({
      userId: req.user._id,
      source: 'whatsapp',
      whatsappInstanceId: instance._id
    }).sort({ name: 1 });

    console.log(`📊 Encontrados ${groups.length} grupos`);

    res.json({
      success: true,
      groups: groups.map(group => ({
        _id: group._id,
        name: group.name,        
        description: group.description,
        contactCount: group.contactCount,
        participantCount: group.participantCount,
        contacts: group.contacts.slice(0, 20),
        source: group.source,
        createdAt: group.createdAt
      })),
      totalGroups: groups.length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar grupos:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getInstanceStatus = async (req, res) => {
  try {
    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const socketStatus = await whatsappBaileysService.getSocketStatus(instance.sessionName);
    const sessionPersisted = hasSavedSession(instance.sessionName);
    const canAttemptRecovery = sessionPersisted && instance.status !== 'connected';

    res.json({
      success: true,
      instance: {
        _id: instance._id,
        sessionName: instance.sessionName,
        status: instance.status,
        phoneNumber: instance.phoneNumber,
        qrCodeReady: Boolean(instance.qrCode),
        sessionPersisted,
        canAttemptRecovery,
        recoveryPriority: canAttemptRecovery ? 'recover_session' : 'read_qr',
        socketStatus: socketStatus.connectionState || 'inactive',
        hasSocket: socketStatus.hasSocket,
        reconnecting: socketStatus.reconnecting,
        reconnectAttempts: socketStatus.reconnectAttempts
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};


exports.recoverInstance = async (req, res) => {
  try {
    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    if (instance.status === 'connected') {
      return res.json({
        success: true,
        message: 'Instância já está conectada',
        instance: {
          _id: instance._id,
          sessionName: instance.sessionName,
          status: instance.status,
          sessionPersisted: hasSavedSession(instance.sessionName)
        }
      });
    }

    const sessionPersisted = hasSavedSession(instance.sessionName);
    if (!sessionPersisted) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma sessão salva encontrada para recuperação. Gere um novo QR Code.'
      });
    }

    const socketStatus = await whatsappBaileysService.getSocketStatus(instance.sessionName);
    if (socketStatus.reconnecting) {
      return res.json({
        success: true,
        message: 'Reconexão já está em andamento para esta instância.',
        instance: {
          _id: instance._id,
          sessionName: instance.sessionName,
          status: 'connecting',
          sessionPersisted: true,
          canAttemptRecovery: true,
          reconnecting: true,
          reconnectAttempts: socketStatus.reconnectAttempts
        }
      });
    }

    if (whatsappCommandQueue.isEnabled()) {
      const userId = String(req.user._id);
      const ownerNode = ownershipService.resolveOwner({ userId, sessionName: instance.sessionName });
      const queueName = ownershipService.getQueueNameForOwner(ownerNode);

      await WhatsAppInstance.findByIdAndUpdate(instance._id, { ownerNode });

      const enqueueResult = await whatsappCommandQueue.enqueue('recover', {
        sessionName: instance.sessionName,
        userId,
        ownerNode
      }, { queueName });

      return res.status(202).json({
        success: true,
        queued: true,
        command: 'recover',
        ownerNode,
        queueName,
        jobId: enqueueResult.jobId,
        message: 'Recuperação enfileirada. Aguarde e atualize o status.',
        instance: {
          _id: instance._id,
          sessionName: instance.sessionName,
          status: 'connecting',
          sessionPersisted: true,
          canAttemptRecovery: true
        }
      });
    }

    await whatsappBaileysService.reconnectInstance(instance.sessionName, req.user._id);

    res.json({
      success: true,
      message: 'Recuperação de sessão iniciada. Aguarde alguns segundos e atualize o status.',
      instance: {
        _id: instance._id,
        sessionName: instance.sessionName,
        status: 'connecting',
        sessionPersisted: true,
        canAttemptRecovery: true
      }
    });
  } catch (error) {
    console.error('❌ Erro ao recuperar sessão:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.disconnectInstance = async (req, res) => {
  try {
    console.log(`🔌 PUT /api/whatsapp/instances/${req.params.id}/disconnect chamado`);

    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    if (whatsappCommandQueue.isEnabled()) {
      const userId = String(req.user._id);
      const ownerNode = ownershipService.resolveOwner({ userId, sessionName: instance.sessionName });
      const queueName = ownershipService.getQueueNameForOwner(ownerNode);

      await WhatsAppInstance.findByIdAndUpdate(instance._id, { ownerNode });

      const enqueueResult = await whatsappCommandQueue.enqueue('disconnect', {
        sessionName: instance.sessionName,
        userId,
        ownerNode
      }, { queueName });

      return res.status(202).json({
        success: true,
        queued: true,
        command: 'disconnect',
        ownerNode,
        queueName,
        jobId: enqueueResult.jobId,
        message: 'Comando de desconexão enfileirado com sucesso'
      });
    }

    await whatsappBaileysService.disconnectClient(instance.sessionName);

    console.log(`✅ Instância desconectada: ${instance.sessionName}`);

    res.json({
      success: true,
      queued: false,
      message: 'Instância desconectada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao desconectar instância:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};
