const MediaBatch = require('../models/MediaBatch');
const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const mediaService = require('../services/mediaService');
const whatsappBaileysService = require('../services/whatsappService');

// ✅ SERVIÇO DE RATE LIMITING - IMPLEMENTAÇÃO CRÍTICA
class RateLimitService {
  constructor() {
    this.limits = new Map(); // instanceId -> {messageCount, mediaCount, lastReset}
  }

  async checkRateLimit(instanceId, type = 'media') {
    const now = Date.now();
    const windowSize = 60000; // 1 minuto
    
    // Limites conservadores por tipo
    const maxLimits = {
      'message': 20,    // 20 mensagens/minuto
      'media': 10,      // 10 mídias/minuto  
      'group': 5        // 5 mensagens em grupo/minuto
    };

    const key = `${instanceId}-${type}`;
    
    // Inicializar ou resetar janela
    if (!this.limits.has(key) || (now - this.limits.get(key).lastReset) > windowSize) {
      this.limits.set(key, {
        count: 0,
        lastReset: now,
        type: type
      });
    }

    const limitData = this.limits.get(key);
    
    // Verificar se excedeu o limite
    if (limitData.count >= maxLimits[type]) {
      const waitTime = windowSize - (now - limitData.lastReset);
      return {
        allowed: false,
        waitTime,
        current: limitData.count,
        max: maxLimits[type],
        resetIn: Math.ceil(waitTime / 1000)
      };
    }

    // Incrementar contador
    limitData.count++;
    
    return {
      allowed: true,
      remaining: maxLimits[type] - limitData.count,
      current: limitData.count,
      max: maxLimits[type]
    };
  }

  // Limpar limites antigos (prevenção de memory leak)
  cleanupOldLimits() {
    const now = Date.now();
    const oneHour = 3600000;
    
    for (const [key, data] of this.limits.entries()) {
      if (now - data.lastReset > oneHour) {
        this.limits.delete(key);
      }
    }
  }
}

// ✅ INSTÂNCIA GLOBAL DO RATE LIMITER
const rateLimitService = new RateLimitService();

// ✅ FUNÇÃO AUXILIAR PARA DELAY INTELIGENTE
const smartDelay = async (instanceId, batchOptions) => {
  const baseDelay = batchOptions?.delayBetweenMessages || 2000;
  
  // Verificar rate limit
  const limitCheck = await rateLimitService.checkRateLimit(instanceId, 'media');
  
  if (!limitCheck.allowed) {
    console.log(`⏳ Rate limit excedido! Aguardando ${limitCheck.resetIn}s...`);
    await new Promise(resolve => setTimeout(resolve, limitCheck.waitTime + 1000));
    
    // Log de warning
    console.warn(`🚨 RATE LIMIT: Instância ${instanceId} - ${limitCheck.current}/${limitCheck.max} mídias no último minuto`);
    return true; // Indicar que houve delay por rate limit
  }
  
  // Delay normal entre mensagens
  if (baseDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, baseDelay));
  }
  
  return false;
};

// ✅ FUNÇÃO DE PROCESSAMENTO COM RATE LIMITING
const processMediaBatch = async (batchId) => {
  try {
    console.log(`🔄 Processando lote de mídia: ${batchId}`);

    const batch = await MediaBatch.findById(batchId)
      .populate('contactGroupIds')
      .populate('whatsappInstanceId');

    if (!batch) {
      throw new Error('Lote de mídia não encontrado');
    }

    // ✅ DEBUG: VERIFICAR CAPTION NO BATCH DO BANCO
    console.log('🔍 DEBUG - Caption no batch do banco:', {
      batchCaption: batch.caption,
      optionsCaption: batch.options?.caption,
      fullOptions: batch.options
    });

    // ✅ CORREÇÃO: BUSCAR CAPTION CORRETAMENTE
    const caption = batch.caption || batch.options?.caption || '';
    console.log(`🖋️ Legenda final a ser usada: "${caption}"`);

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
    await MediaBatch.findByIdAndUpdate(batchId, {
      status: 'processing'
    });

    // ✅ VERIFICAÇÃO ROBUSTA DA CONEXÃO
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

    console.log(`📨 Enviando ${batch.mediaItems.length} mídia(s) para ${allContacts.length} contato(s)`);
    console.log(`📊 Rate Limit configurado: Máximo 10 mídias/minuto por instância`);

    let sentCount = 0;
    let failedCount = 0;
    const results = [];
    let rateLimitHits = 0;

    // ✅ LOOP COM RATE LIMITING IMPLEMENTADO
    for (const contact of allContacts) {
      for (const mediaItem of batch.mediaItems) {
        try {
          // ✅ VERIFICAÇÃO DE RATE LIMIT ANTES DE CADA ENVIO
          const hadRateLimitDelay = await smartDelay(whatsappInstance._id, batch.options);
          if (hadRateLimitDelay) {
            rateLimitHits++;
          }

          let jid;
          if (contact.whatsappId && contact.whatsappId.includes('@')) {
            jid = contact.whatsappId;
          } else {
            const phone = contact.phone.replace(/\D/g, '');
            jid = `${phone}@s.whatsapp.net`;
          }

          console.log(`📤 Enviando ${mediaItem.originalName} para: ${contact.name} (${jid})`);

          // ✅ CORREÇÃO CRÍTICA: PASSAR OPTIONS COM CAPTION CORRETO
          const sendOptions = {
            ...(batch.options || {}),
            caption: caption // ← GARANTIR QUE O CAPTION VAI NAS OPTIONS
          };

          console.log('📦 Mídia:', {
            originalName: mediaItem.originalName,
            mimeType: mediaItem.mimeType,
            url: mediaItem.url
          });
          console.log('📝 Opções:', sendOptions);
          console.log('🖋️ Legenda:', `"${caption}"`);

          // ✅ ENVIO COM PROTEÇÃO DE RATE LIMITING
          const mediaResult = await whatsappBaileysService.sendMediaToContact(
            whatsappInstance.sessionName,
            jid,
            mediaItem,
            caption, // ← PASSAR CAPTION DIRETAMENTE TAMBÉM
            sendOptions // ← PASSAR OPTIONS COM CAPTION
          );

          sentCount++;
          results.push({
            contact: contact.name,
            phone: contact.phone,
            mediaItem: mediaItem.originalName,
            group: contact.groupName,
            status: 'sent',
            messageId: mediaResult?.messageId,
            timestamp: new Date(),
            caption: caption // ← REGISTRAR QUAL CAPTION FOI ENVIADO
          });

          console.log(`✅ Mídia enviada para ${contact.name} (${sentCount}/${batch.progress.total})`);

          // ✅ ATUALIZAR PROGRESSO NO BANCO
          await MediaBatch.findByIdAndUpdate(batchId, {
            'progress.sent': sentCount,
            'progress.failed': failedCount
          });

        } catch (error) {
          console.error(`❌ Erro ao enviar mídia para ${contact.name}:`, error.message);

          failedCount++;
          results.push({
            contact: contact.name,
            phone: contact.phone,
            mediaItem: mediaItem.originalName,
            group: contact.groupName,
            status: 'failed',
            error: error.message,
            timestamp: new Date()
          });

          await MediaBatch.findByIdAndUpdate(batchId, {
            'progress.failed': failedCount
          });

          // ✅ TRATAMENTO ESPECÍFICO PARA ERROS DE RATE LIMIT
          if (error.message.includes('rate limit') || error.message.includes('too many') || error.message.includes('429')) {
            console.warn(`🚨 DETECTADO RATE LIMIT DO WHATSAPP! Aguardando 2 minutos...`);
            await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutos
            rateLimitHits++;
          }
        }
      }
    }

    // ✅ STATUS FINAL COM INFORMAÇÕES DE RATE LIMIT
    const finalStatus = failedCount === (allContacts.length * batch.mediaItems.length) ? 'failed' : 'completed';

    await MediaBatch.findByIdAndUpdate(batchId, {
      status: finalStatus,
      'progress.sent': sentCount,
      'progress.failed': failedCount,
      results: results
    });

    console.log(`✅ Lote de mídia ${batch.name} finalizado: ${sentCount} enviados, ${failedCount} falhas`);
    if (rateLimitHits > 0) {
      console.log(`⚠️  Foram detectados ${rateLimitHits} hits de rate limit durante o processamento`);
    }

  } catch (error) {
    console.error(`❌ Erro no processamento do lote de mídia ${batchId}:`, error);

    await MediaBatch.findByIdAndUpdate(batchId, {
      status: 'failed',
      $push: {
        results: {
          contact: 'Sistema',
          phone: 'N/A',
          mediaItem: 'Sistema',
          group: 'Sistema',
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        }
      }
    });
  } finally {
    // ✅ LIMPEZA PERIÓDICA DOS LIMITES
    rateLimitService.cleanupOldLimits();
  }
};

// ✅ CONTROLLER CREATE MEDIA BATCH COM VALIDAÇÃO DE LIMITES
const createMediaBatch = async (req, res) => {
  console.log('📦 Criando novo lote de mídia...');
  console.log('Dados do lote:', req.body);

  try {
    const { name, mediaItems, contactGroupIds, whatsappInstanceId, caption, options } = req.body;

    // ✅ DEBUG: VERIFICAR O QUE CHEGA DO FRONTEND
    console.log('🔍 Dados recebidos do frontend:', {
      captionRecebido: caption,
      optionsRecebidas: options
    });

    if (!name || !mediaItems || !contactGroupIds || !whatsappInstanceId) {
      return res.status(400).json({
        success: false,
        error: 'Nome, mídias, grupos de contatos e instância WhatsApp são obrigatórios'
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
    const totalSends = totalContacts * mediaItems.length;

    if (totalContacts === 0) {
      return res.status(400).json({
        success: false,
        error: 'Os grupos selecionados não possuem contatos'
      });
    }

    // ✅ VALIDAÇÃO DE LIMITES ANTES DE CRIAR O LOTE
    if (totalSends > 100) {
      console.warn(`⚠️ Lote grande detectado: ${totalSends} envios`);
      // Poderia implementar confirmação para lotes muito grandes
    }

    // ✅ CORREÇÃO CRÍTICA: GARANTIR QUE CAPTION VÁ PARA AS OPTIONS
    const batchOptions = {
      ...(options || {}),
      caption: caption || options?.caption || '' // ← PRIORIDADE CORRETA
    };

    console.log('🔄 Opções finais do batch:', batchOptions);

    const batch = await MediaBatch.create({
      userId: req.user._id,
      whatsappInstanceId,
      name,
      mediaItems,
      contactGroupIds,
      caption: caption || '', // ← PRESERVAR NO BATCH TAMBÉM
      progress: {
        total: totalSends,
        sent: 0,
        failed: 0
      },
      options: batchOptions // ← USAR AS OPTIONS CORRIGIDAS
    });

    console.log('✅ Batch criado no banco:', {
      _id: batch._id,
      caption: batch.caption,
      options: batch.options
    });

    // ✅ INICIAR PROCESSAMENTO COM RATE LIMITING
    processMediaBatch(batch._id);

    res.status(201).json({
      success: true,
      message: 'Lote de mídia criado e processamento iniciado',
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        mediaCount: batch.mediaItems.length,
        totalContacts: totalContacts,
        totalSends: totalSends,
        caption: batch.caption, // ← INCLUIR CAPTION NA RESPOSTA
        options: batch.options,
        createdAt: batch.createdAt
      },
      rateLimitInfo: {
        maxPerMinute: 10,
        estimatedTime: Math.ceil(totalSends / 10) + ' minutos'
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar lote de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// ✅ FUNÇÕES EXISTENTES (mantidas conforme seu código)
const uploadMedia = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const mediaItems = [];

    for (const file of req.files) {
      const mediaItem = await mediaService.saveMediaFile(file, req.user._id);
      mediaItems.push(mediaItem);
    }

    res.json({
      success: true,
      message: `${mediaItems.length} arquivos de mídia salvos com sucesso`,
      mediaItems
    });

  } catch (error) {
    console.error('❌ Erro ao fazer upload de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

const checkInstanceAvailability = async (req, res) => {
  try {
    const { instanceId } = req.params;

    const instance = await WhatsAppInstance.findOne({
      _id: instanceId,
      userId: req.user._id
    });

    if (!instance) {
      return res.json({
        success: false,
        available: false,
        error: 'Instância não encontrada'
      });
    }

    const socket = whatsappBaileysService.sockets.get(instance.sessionName);
    const available = !!(socket && socket.user);

    res.json({
      success: true,
      available,
      status: instance.status,
      sessionName: instance.sessionName,
      phoneNumber: instance.phoneNumber
    });

  } catch (error) {
    console.error('❌ Erro ao verificar instância:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

const getMediaBatches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const batches = await MediaBatch.find({ userId: req.user._id })
      .populate('whatsappInstanceId', 'sessionName phoneNumber')
      .populate('contactGroupIds', 'name contactCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MediaBatch.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      batches: batches.map(batch => ({
        _id: batch._id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        mediaCount: batch.mediaItems.length,
        whatsappInstance: batch.whatsappInstanceId,
        contactGroups: batch.contactGroupIds,
        totalSends: batch.progress.total,
        sent: batch.progress.sent,
        failed: batch.progress.failed,
        createdAt: batch.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lotes de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

const getMediaBatch = async (req, res) => {
  try {
    const batch = await MediaBatch.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate('whatsappInstanceId', 'sessionName phoneNumber')
      .populate('contactGroupIds', 'name contactCount');

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote de mídia não encontrado'
      });
    }

    res.json({
      success: true,
      batch: {
        _id: batch._id,
        name: batch.name,
        mediaItems: batch.mediaItems,
        status: batch.status,
        progress: batch.progress,
        whatsappInstance: batch.whatsappInstanceId,
        contactGroups: batch.contactGroupIds,
        results: batch.results,
        options: batch.options,
        createdAt: batch.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lote de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

const cancelMediaBatch = async (req, res) => {
  try {
    const batch = await MediaBatch.findOneAndUpdate(
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
            mediaItem: 'Sistema',
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
      message: 'Lote de mídia cancelado com sucesso',
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status
      }
    });
  } catch (error) {
    console.error('❌ Erro ao cancelar lote de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// ✅ EXPORTAR TODAS AS FUNÇÕES
module.exports = {
  createMediaBatch,
  uploadMedia,
  checkInstanceAvailability,
  getMediaBatches,
  getMediaBatch,
  cancelMediaBatch,
  processMediaBatch,
  rateLimitService // Exportar para uso em outros controllers
};