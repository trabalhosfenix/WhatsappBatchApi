const MessageBatch = require('../models/MessageBatch');
const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const whatsappBaileysService = require('../services/whatsappService');

// ✅ CORREÇÃO: Função auxiliar separada para evitar referência circular
const processBatch = async (batchId) => {
  try {
    console.log(`🔄 Processando lote: ${batchId}`);
    
    const batch = await MessageBatch.findById(batchId)
      .populate('contactGroupIds')
      .populate('whatsappInstanceId');
      
    if (!batch) {
      throw new Error('Lote não encontrado');
    }

    // Verificar se a instância ainda existe e está conectada
    if (!batch.whatsappInstanceId) {
      throw new Error('Instância WhatsApp associada ao lote não encontrada');
    }

    const whatsappInstance = batch.whatsappInstanceId;
    
    console.log(`🔍 Verificando instância: ${whatsappInstance.sessionName} (Status: ${whatsappInstance.status})`);

    if (whatsappInstance.status !== 'connected') {
      throw new Error(`Instância WhatsApp não está conectada. Status atual: ${whatsappInstance.status}`);
    }

    // Atualizar status para processando
    await MessageBatch.findByIdAndUpdate(batchId, {
      status: 'processing'
    });

    // OBTER SOCKET DIRETAMENTE - método mais confiável
    let socket = whatsappBaileysService.sockets.get(whatsappInstance.sessionName);
    
    if (!socket) {
      console.log(`❌ Socket não encontrado para: ${whatsappInstance.sessionName}`);
      console.log(`📋 Sockets ativos: ${Array.from(whatsappBaileysService.sockets.keys())}`);
      
      try {
        console.log(`🔄 Tentando reconectar instância: ${whatsappInstance.sessionName}`);
        await whatsappBaileysService.reconnectInstance(
          whatsappInstance.sessionName, 
          batch.userId
        );
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const reconnectedSocket = whatsappBaileysService.sockets.get(whatsappInstance.sessionName);
        if (!reconnectedSocket) {
          throw new Error('Falha na reconexão automática da instância');
        }
        
        console.log(`✅ Instância reconectada com sucesso`);
        socket = reconnectedSocket;
      } catch (reconnectError) {
        throw new Error(`Instância não disponível e falha na reconexão: ${reconnectError.message}`);
      }
    }

    if (!socket || !socket.user) {
      console.log(`⚠️ Socket encontrado mas não está autenticado: ${whatsappInstance.sessionName}`);
      try {
        await whatsappBaileysService.recreateInstance(whatsappInstance.sessionName, batch.userId);
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        socket = whatsappBaileysService.sockets.get(whatsappInstance.sessionName);
        if (!socket || !socket.user) {
          throw new Error(`Instância WhatsApp não está autenticada após tentativas: ${whatsappInstance.sessionName}`);
        }
      } catch (authError) {
        throw new Error(`Falha na autenticação da instância: ${authError.message}`);
      }
    }

    console.log(`✅ Socket válido encontrado para: ${whatsappInstance.sessionName}`);

    // Coletar todos os contatos únicos dos grupos
    const allContacts = [];
    const contactMap = new Map();

    for (const group of batch.contactGroupIds) {
      const contactGroup = await ContactGroup.findById(group._id);
      if (contactGroup && contactGroup.contacts) {
        for (const contact of contactGroup.contacts) {
          const contactKey = `${contact.phone}-${contact.whatsappId || contact.phone}`;
          if (!contactMap.has(contactKey)) {
            contactMap.set(contactKey, true);
            allContacts.push({
              ...contact.toObject(),
              groupName: contactGroup.name
            });
          }
        }
      }
    }

    console.log(`📨 Enviando ${allContacts.length} mensagens do lote ${batch.name}`);

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (const contact of allContacts) {
      try {
        let jid;
        if (contact.whatsappId && contact.whatsappId.includes('@')) {
          jid = contact.whatsappId;
        } else {
          const phone = contact.phone.replace(/\D/g, '');
          jid = `${phone}@s.whatsapp.net`;
        }

        console.log(`📤 Tentando enviar para: ${contact.name} (${jid})`);

        const messageResult = await whatsappBaileysService.sendMessageToContact(
          whatsappInstance.sessionName,
          jid,
          batch.message
        );

        sentCount++;
        results.push({
          contact: contact.name,
          phone: contact.phone,
          group: contact.groupName,
          status: 'sent',
          messageId: messageResult?.key?.id,
          timestamp: new Date()
        });

        console.log(`✅ Mensagem enviada para ${contact.name} (${contact.phone})`);

        await MessageBatch.findByIdAndUpdate(batchId, {
          'progress.sent': sentCount,
          'progress.failed': failedCount
        });

        if (batch.options?.delayBetweenMessages) {
          await new Promise(resolve => setTimeout(resolve, batch.options.delayBetweenMessages));
        }

      } catch (error) {
        console.error(`❌ Erro ao enviar para ${contact.name}:`, error.message);

        failedCount++;
        results.push({
          contact: contact.name,
          phone: contact.phone,
          group: contact.groupName,
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        });

        await MessageBatch.findByIdAndUpdate(batchId, {
          'progress.failed': failedCount
        });
      }
    }

    const finalStatus = failedCount === allContacts.length ? 'failed' : 'completed';

    await MessageBatch.findByIdAndUpdate(batchId, {
      status: finalStatus,
      'progress.sent': sentCount,
      'progress.failed': failedCount,
      results: results
    });

    console.log(`✅ Lote ${batch.name} finalizado: ${sentCount} enviadas, ${failedCount} falhas`);

  } catch (error) {
    console.error(`❌ Erro no processamento do lote ${batchId}:`, error);

    await MessageBatch.findByIdAndUpdate(batchId, {
      status: 'failed',
      $push: {
        results: {
          contact: 'Sistema',
          phone: 'N/A',
          group: 'Sistema',
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        }
      }
    });
  }
};

// ✅ CORREÇÃO: Exportar a função
exports.processBatch = processBatch;

exports.createBatch = async (req, res) => {
  try {
    const { name, message, contactGroupIds, whatsappInstanceId, options } = req.body;

    if (!name || !message || !contactGroupIds || !whatsappInstanceId) {
      return res.status(400).json({
        success: false,
        error: 'Nome, mensagem, grupos de contatos e instância WhatsApp são obrigatórios'
      });
    }

    const whatsappInstance = await WhatsAppInstance.findOne({
      _id: whatsappInstanceId,
      userId: req.user._id
    });

    if (!whatsappInstance) {
      return res.status(404).json({
        success: false,
        error: 'Instância WhatsApp não encontrada'
      });
    }

    if (whatsappInstance.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: 'Instância WhatsApp não está conectada'
      });
    }

    const contactGroups = await ContactGroup.find({
      _id: { $in: contactGroupIds },
      userId: req.user._id
    });

    if (contactGroups.length !== contactGroupIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Um ou mais grupos de contatos não foram encontrados'
      });
    }

    const totalContacts = contactGroups.reduce((total, group) => total + group.contactCount, 0);

    if (totalContacts === 0) {
      return res.status(400).json({
        success: false,
        error: 'Os grupos selecionados não possuem contatos'
      });
    }

    const batch = await MessageBatch.create({
      userId: req.user._id,
      whatsappInstanceId,
      name,
      message,
      contactGroupIds,
      progress: {
        total: totalContacts,
        sent: 0,
        failed: 0
      },
      options: options || {
        delayBetweenMessages: 1000,
        maxRetries: 3
      }
    });

    // ✅ CORREÇÃO: Chamar a função diretamente
    processBatch(batch._id);

    res.status(201).json({
      success: true,
      message: 'Lote criado e processamento iniciado',
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        createdAt: batch.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar lote:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getBatches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const batches = await MessageBatch.find({ userId: req.user._id })
      .populate('whatsappInstanceId', 'sessionName phoneNumber')
      .populate('contactGroupIds', 'name contactCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MessageBatch.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      batches: batches.map(batch => ({
        _id: batch._id,
        name: batch.name,
        message: batch.message.substring(0, 100) + (batch.message.length > 100 ? '...' : ''),
        status: batch.status,
        progress: batch.progress,
        whatsappInstance: batch.whatsappInstanceId,
        contactGroups: batch.contactGroupIds,
        totalContacts: batch.progress.total,
        sent: batch.progress.sent,
        failed: batch.progress.failed,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lotes:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getBatch = async (req, res) => {
  try {
    const batch = await MessageBatch.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate('whatsappInstanceId', 'sessionName phoneNumber')
      .populate('contactGroupIds', 'name contactCount');

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado'
      });
    }

    res.json({
      success: true,
      batch: {
        _id: batch._id,
        name: batch.name,
        message: batch.message,
        status: batch.status,
        progress: batch.progress,
        whatsappInstance: batch.whatsappInstanceId,
        contactGroups: batch.contactGroupIds,
        results: batch.results,
        options: batch.options,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lote:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.cancelBatch = async (req, res) => {
  try {
    const batch = await MessageBatch.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        status: { $in: ['pending', 'processing'] }
      },
      {
        status: 'cancelled',
        $push: {
          results: {
            contact: 'Sistema',
            phone: 'N/A',
            group: 'Sistema',
            status: 'cancelled',
            error: 'Lote cancelado pelo usuário',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado ou não pode ser cancelado'
      });
    }

    res.json({
      success: true,
      message: 'Lote cancelado com sucesso',
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status
      }
    });
  } catch (error) {
    console.error('❌ Erro ao cancelar lote:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};