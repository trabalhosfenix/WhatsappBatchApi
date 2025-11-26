const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const whatsappBaileysService = require('../services/whatsappService');
const messageControlService = require('../services/messageControlService');
const User = require('../models/User');
// const limite = require('../models/Limite');



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

    console.log(`🚀 [Baileys] Iniciando criação da instância: ${sessionName}`);

    // Verificar se já existe instância com mesmo nome
    const existingInstance = await WhatsAppInstance.findOne({
      sessionName,
      userId: req.user._id
    });

    if (existingInstance) {
      console.log(`❌ Instância já existe: ${sessionName}`);
      return res.status(400).json({
        success: false,
        error: 'Já existe uma instância com este nome'
      });
    }

    // Criar instância
    const instance = await whatsappBaileysService.createClient(sessionName, req.user._id);
    
    console.log(`✅ Instância criada no serviço:`, {
      id: instance._id,
      sessionName: instance.sessionName,
      status: instance.status,
      hasQRCode: !!instance.qrCode
    });

    // Buscar instância atualizada do banco
    const updatedInstance = await WhatsAppInstance.findById(instance._id);
    
    if (!updatedInstance) {
      throw new Error('Instância não encontrada após criação');
    }

    console.log(`📱 Status final da instância:`, {
      status: updatedInstance.status,
      qrCodeLength: updatedInstance.qrCode ? updatedInstance.qrCode.length : 0,
      phoneNumber: updatedInstance.phoneNumber
    });

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
    console.error('❌ [Baileys] Erro detalhado:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
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

exports.testQRGeneration = async (req, res) => {
    try {
        const { sessionName } = req.body;
        
        console.log(`🧪 TESTE DE QR CODE: ${sessionName}`);
        
        // Verificar instância
        const instance = await WhatsAppInstance.findOne({
            sessionName,
            userId: req.user._id
        });

        if (!instance) {
            return res.status(404).json({
                success: false,
                error: 'Instância não encontrada'
            });
        }

        // Forçar nova inicialização
        await whatsappBaileysService.deleteInstance(sessionName);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Recriar
        const newInstance = await whatsappBaileysService.createClient(sessionName, req.user._id);
        
        // Aguardar QR Code
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verificar resultado
        const updatedInstance = await WhatsAppInstance.findById(newInstance._id);

        res.json({
            success: true,
            testResult: {
                sessionName,
                status: updatedInstance.status,
                hasQRCode: !!updatedInstance.qrCode,
                qrCodeLength: updatedInstance.qrCode ? updatedInstance.qrCode.length : 0,
                timestamp: new Date()
            }
        });

    } catch (error) {
        console.error('❌ Erro no teste de QR Code:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};
// Adicione ao controller
exports.resetInstance = async (req, res) => {
    try {
        const { sessionName } = req.params;
        
        console.log(`🔄 RESET completo da instância: ${sessionName}`);

        const instance = await WhatsAppInstance.findOne({
            sessionName,
            userId: req.user._id
        });

        if (!instance) {
            return res.status(404).json({
                success: false,
                error: 'Instância não encontrada'
            });
        }

        // 1. Deletar completamente
        await whatsappBaileysService.deleteInstance(sessionName);
        
        // 2. Aguardar limpeza
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 3. Recriar do zero
        const newInstance = await whatsappBaileysService.createClient(sessionName, req.user._id);

        res.json({
            success: true,
            message: 'Instância resetada com sucesso',
            instance: {
                _id: newInstance._id,
                sessionName: newInstance.sessionName,
                status: newInstance.status
            }
        });

    } catch (error) {
        console.error('❌ Erro no reset:', error);
        res.status(400).json({
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

    // ✅ CORREÇÃO: Buscar todos os usuários de uma vez
    const userIds = [...new Set(instances.map(instance => instance.userId))];
    const users = await User.find({ _id: { $in: userIds } }).select('name email');
    
    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {});

    // ✅ ADIÇÃO: Buscar totais de grupos e contatos para cada instância
    const instancesWithDetails = await Promise.all(
      instances.map(async (instance) => {
        const user = userMap[instance.userId.toString()];
        
        // Buscar estatísticas de grupos
        const groupStats = await ContactGroup.aggregate([
          {
            $match: {
              userId: instance.userId,
              whatsappInstanceId: instance._id,
              source: 'whatsapp',
              isActive: true
            }
          },
          {
            $group: {
              _id: null,
              totalGroups: { $sum: 1 },
              totalContacts: { $sum: '$contactCount' },
              totalParticipants: { $sum: '$participantCount' },
              activeGroups: {
                $sum: {
                  $cond: [{ $eq: ['$syncStatus', 'synced'] }, 1, 0]
                }
              }
            }
          }
        ]);

        // Buscar estatísticas de contatos únicos (evitando duplicatas entre grupos)
        const uniqueContactsStats = await ContactGroup.aggregate([
          {
            $match: {
              userId: instance.userId,
              whatsappInstanceId: instance._id,
              source: 'whatsapp',
              isActive: true
            }
          },
          { $unwind: '$contacts' },
          {
            $group: {
              _id: '$contacts.phone', // Agrupa por telefone único
              contact: { $first: '$contacts' }
            }
          },
          {
            $group: {
              _id: null,
              uniqueContacts: { $sum: 1 },
              businessContacts: {
                $sum: {
                  $cond: [{ $eq: ['$contact.isBusiness', true] }, 1, 0]
                }
              }
            }
          }
        ]);

        const stats = groupStats.length > 0 ? groupStats[0] : {
          totalGroups: 0,
          totalContacts: 0,
          totalParticipants: 0,
          activeGroups: 0
        };

        const uniqueStats = uniqueContactsStats.length > 0 ? uniqueContactsStats[0] : {
          uniqueContacts: 0,
          businessContacts: 0
        };

        return {
          _id: instance._id,
          name: user?.name || 'Unknown',
          email: user?.email || 'Unknown',
          sessionName: instance.sessionName,
          status: instance.status,
          qrCode: instance.qrCode,
          phoneNumber: instance.phoneNumber,
          lastConnection: instance.lastConnection,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
          // ✅ NOVOS CAMPOS ADICIONADOS
          statistics: {
            groups: {
              total: stats.totalGroups,
              active: stats.activeGroups,
              participants: stats.totalParticipants
            },
            contacts: {
              total: stats.totalContacts,
              unique: uniqueStats.uniqueContacts,
              business: uniqueStats.businessContacts
            }
          }
        };
      })
    );

    res.json({
      success: true,
      instances: instancesWithDetails
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
    console.log(`✅ Tracking ativado automaticamente para: ${instance.sessionName}`);

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