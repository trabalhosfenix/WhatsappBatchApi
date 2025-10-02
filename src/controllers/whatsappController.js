const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const whatsappBaileysService = require('../services/whatsappService');

console.log('✅ WhatsAppController carregado - VERSÃO CORRIGIDA');

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

    const instance = await whatsappBaileysService.createClient(sessionName, req.user._id);
    const updatedInstance = await WhatsAppInstance.findById(instance._id);

    res.status(201).json({
      success: true,
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
    res.status(400).json({
      success: false,
      error: error.message
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

    res.json({
      success: true,
      instances: instances.map(instance => ({
        _id: instance._id,
        sessionName: instance.sessionName,
        status: instance.status,
        qrCode: instance.qrCode,
        phoneNumber: instance.phoneNumber,
        lastConnection: instance.lastConnection,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt
      }))
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

    res.json({
      success: true,
      instance: {
        _id: instance._id,
        sessionName: instance.sessionName,
        status: instance.status,
        qrCode: instance.qrCode,
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
      return res.status(400).json({
        success: false,
        error: 'QR Code não disponível. A instância pode já estar conectada.'
      });
    }

    res.json({
      success: true,
      qrCode: instance.qrCode,
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
        // Aguardar um pouco para reconexão
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (reconnectError) {
        return res.status(400).json({
          success: false,
          error: `Instância desconectada. Recarregue o QR Code. Erro: ${reconnectError.message}`
        });
      }
    }

    const groupCount = await whatsappBaileysService.loadGroupsFromWhatsApp(
      instance.sessionName,
      req.user._id
    );

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
      instanceId: instance._id
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

    const hasSocket = !!whatsappBaileysService.sockets.get(instance.sessionName);
    const socketStatus = hasSocket ? 'active' : 'inactive';

    res.json({
      success: true,
      instance: {
        _id: instance._id,
        sessionName: instance.sessionName,
        status: instance.status,
        phoneNumber: instance.phoneNumber,
        socketStatus: socketStatus,
        hasSocket: hasSocket
      }
    });
  } catch (error) {
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

    await whatsappBaileysService.disconnectClient(instance.sessionName);

    console.log(`✅ Instância desconectada: ${instance.sessionName}`);

    res.json({
      success: true,
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