const MediaBatch = require('../models/MediaBatch');
const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const mediaService = require('../services/mediaService');


// ✅ SERVIÇO DE RATE LIMITING ULTRA CONSERVADOR + LIMITE DIÁRIO
// ✅ NOVO RATE LIMIT SERVICE COMPLETO COM BANCO DE DADOS E MEMÓRIA
const Limit = require('../models/Limit'); // 📁 novo modelo persistente


class RateLimitService {
  constructor() {
    // Memória rápida para controle imediato (1 min)
    this.limits = new Map(); // key = instanceId-type
  }

  // 🔐 Define o contexto do usuário antes de cada verificação
  setUserContext(userId) {
    this.currentUserId = userId;
  }

  // 🗓️ Busca ou cria registro persistente de limite diário

  async getOrCreateLimit(userId, instanceId) {
    if (!userId) throw new Error('❌ getOrCreateLimit: userId não definido');
    if (!instanceId) throw new Error('❌ getOrCreateLimit: instanceId não definido');

    // Normaliza o ID (pode vir como objeto Mongoose)
    const instanceIdValue = instanceId._id ? instanceId._id : instanceId;

    let limit = await Limit.findOne({ userId, instanceId: instanceIdValue });

    if (!limit) {
      console.log(`🆕 Criando novo registro de limite para instância ${instanceIdValue}`);
      limit = await Limit.create({
        userId,
        instanceId: instanceIdValue,
        remaining: 150,
        lastReset: new Date()
      });
    }

    const now = Date.now();
    const lastReset = new Date(limit.lastReset).getTime();
    const dailyWindow = 24 * 60 * 60 * 1000;

    // Reset automático se passou 1 dia
    if (now - lastReset > dailyWindow) {
      console.log(`♻️ Resetando limite diário para instância ${instanceIdValue}`);
      limit.remaining = 150;
      limit.lastReset = new Date();
      await limit.save();
    }

    return limit;
  }


  // ⚖️ Verifica se o envio pode ser feito (por minuto e por dia)

  async checkRateLimit(instanceId, type = 'media') {
    if (!this.currentUserId) {
      throw new Error('Contexto de usuário não definido para RateLimitService');
    }

    if (!instanceId) {
      console.warn('⚠️ [RateLimit] instanceId ausente na chamada de checkRateLimit');
      throw new Error('instanceId é obrigatório para verificação de limite');
    }

    const userId = this.currentUserId;
    const now = Date.now();
    const windowSize = 60 * 1000; // 1 minuto
    const dailyWindow = 24 * 60 * 60 * 1000;

    // 🔢 Limites ultra conservadores por minuto
    const maxLimits = {
      message: 2,
      media: 1,
      group: 1
    };

    const key = `${instanceId}-${type}`;

    // ⏱️ Controle por minuto (em memória)
    if (!this.limits.has(key) || (now - this.limits.get(key).lastReset) > windowSize) {
      this.limits.set(key, { count: 0, lastReset: now });
    }

    const limitData = this.limits.get(key);

    // 🧮 Controle diário (no banco)
    const limit = await this.getOrCreateLimit(userId, instanceId);

    // 🚫 Verifica se atingiu limite diário
    if (limit.remaining <= 0) {
      const nextReset = new Date(limit.lastReset.getTime() + dailyWindow);
      return {
        allowed: false,
        reason: 'daily_limit',
        waitTime: nextReset - now,
        resetTime: nextReset,
        current: 0,
        max: 150,
        message: `Limite diário de 150 mensagens excedido. Próximo reset em ${nextReset.toLocaleTimeString()}`
      };
    }

    // 🚫 Verifica se atingiu limite por minuto
    if (limitData.count >= maxLimits[type]) {
      const waitTime = windowSize - (now - limitData.lastReset);
      return {
        allowed: false,
        reason: 'minute_limit',
        waitTime,
        current: limitData.count,
        max: maxLimits[type],
        resetIn: Math.ceil(waitTime / 1000)
      };
    }

    // ✅ Incrementa contadores em memória
    limitData.count++;

    return {
      allowed: true,
      remaining: maxLimits[type] - limitData.count,
      dailyRemaining: limit.remaining,
      current: limitData.count,
      dailyCurrent: 150 - limit.remaining,
      max: maxLimits[type],
      dailyMax: 150
    };
  }


  // ✅ Decrementa limite diário no banco após envio bem-sucedido
  async decrementDailyLimit(instanceId) {
    if (!this.currentUserId) {
      throw new Error('Contexto de usuário não definido para RateLimitService');
    }

    if (!instanceId) {
      console.warn('⚠️ [RateLimit] instanceId ausente na chamada de decrementDailyLimit');
      throw new Error('instanceId é obrigatório para decrementar limite');
    }

    const userId = this.currentUserId;
    const limit = await this.getOrCreateLimit(userId, instanceId);

    limit.remaining = Math.max(0, limit.remaining - 1);
    await limit.save();

    console.log(`📉 [RateLimit] Decremento realizado: usuário ${userId}, instância ${instanceId}, restante ${limit.remaining}`);

    return limit.remaining;
  }

  // 📊 Retorna status atual dos limites
  async getLimitStatus(userId, instanceId) {
    const now = Date.now();
    const limit = await this.getOrCreateLimit(userId, instanceId);
    const nextReset = new Date(limit.lastReset.getTime() + 24 * 60 * 60 * 1000);

    return {
      daily: {
        current: 150 - limit.remaining,
        max: 150,
        remaining: limit.remaining,
        resetTime: nextReset,
        resetIn: nextReset - now
      },
      minute: {
        media: this.limits.get(`${instanceId}-media`)?.count || 0,
        message: this.limits.get(`${instanceId}-message`)?.count || 0
      }
    };
  }

  // 🧹 Limpa registros antigos da memória
  cleanupOldLimits() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    for (const [key, data] of this.limits.entries()) {
      if ((now - data.lastReset) > oneDay) {
        this.limits.delete(key);
      }
    }
  }
}

// ✅ Instância global
const rateLimitService = new RateLimitService();
module.exports = rateLimitService;


// ✅ FUNÇÃO PARA VERIFICAR INSTÂNCIA WHATSAPP
// ✅ VERIFICAÇÃO E RECONEXÃO AUTOMÁTICA DE INSTÂNCIA WHATSAPP
const checkWhatsAppInstance = async (instanceId, userId) => {
  try {
    console.log(`🔍 Verificando instância WhatsApp: ${instanceId}`);

    const instance = await WhatsAppInstance.findOne({ _id: instanceId, userId });

    if (!instance) {
      throw new Error('Instância WhatsApp não encontrada');
    }

    const whatsappService = require('../services/whatsappService');
    const socket = whatsappService.sockets.get(instance.sessionName);

    // 🧠 1️⃣ CASO 1: Socket ativo e usuário logado → OK
    if (socket && socket.user) {
      console.log(`✅ Socket ativo para: ${instance.sessionName}`);
      return {
        instance,
        socket,
        isConnected: true,
        sessionName: instance.sessionName,
        phoneNumber: instance.phoneNumber
      };
    }

    // ⚠️ 2️⃣ CASO 2: Socket ausente, mas instância no banco está marcada como conectada
    if (instance.status === 'connected' && !socket) {
      console.warn(`⚠️ Socket ausente, mas status é "connected". Tentando reconectar...`);

      try {
        await whatsappService.reconnectInstance(instance.sessionName, userId);
        await new Promise(resolve => setTimeout(resolve, 3000)); // aguarda estabilização

        const newSocket = whatsappService.sockets.get(instance.sessionName);
        if (newSocket && newSocket.user) {
          console.log(`♻️ Reconexão bem-sucedida para: ${instance.sessionName}`);
          return {
            instance,
            socket: newSocket,
            isConnected: true,
            sessionName: instance.sessionName,
            phoneNumber: instance.phoneNumber
          };
        } else {
          console.warn(`⚠️ Reconexão falhou, socket ainda inativo.`);
          await WhatsAppInstance.findByIdAndUpdate(instanceId, { status: 'disconnected' });
        }
      } catch (reconnectError) {
        console.error(`❌ Falha ao tentar reconectar ${instance.sessionName}:`, reconnectError.message);
        await WhatsAppInstance.findByIdAndUpdate(instanceId, { status: 'disconnected' });
      }
    }

    // 🚫 3️⃣ CASO 3: Instância está desconectada ou falha persistente
    if (instance.status !== 'connected') {
      throw new Error(`Instância "${instance.sessionName}" não está conectada. Status: ${instance.status}`);
    }

    // 🧩 4️⃣ CASO 4: Socket não ativo, mas continuar se status for "connected"
    console.warn(`⚠️ Continuando sem socket ativo (modo tolerante): ${instance.sessionName}`);

    return {
      instance,
      socket: null,
      isConnected: true,
      sessionName: instance.sessionName,
      phoneNumber: instance.phoneNumber
    };

  } catch (error) {
    console.error(`❌ Erro na verificação da instância:`, error);
    throw error;
  }
};

// ✅ UPLOAD DE MÍDIA COM VERIFICAÇÃO DE INSTÂNCIA
const uploadMedia = async (req, res) => {
  try {
    console.log('📤 Iniciando upload de mídia...');

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    // ✅ VERIFICAR SE VEIO INSTÂNCIA ID NO BODY (para validação)
    const { whatsappInstanceId } = req.body;

    if (whatsappInstanceId) {
      console.log(`🔍 Validando instância antes do upload: ${whatsappInstanceId}`);
      await checkWhatsAppInstance(whatsappInstanceId, req.user._id);
      console.log('✅ Instância validada - prosseguindo com upload');
    } else {
      console.log('⚠️ Upload sem validação de instância (whatsappInstanceId não fornecido)');
    }

    const mediaItems = [];

    console.log(`📁 Processando ${req.files.length} arquivo(s)...`);

    for (const file of req.files) {
      console.log(`💾 Salvando arquivo: ${file.originalname}`);
      const mediaItem = await mediaService.saveMediaFile(file, req.user._id);
      mediaItems.push(mediaItem);
      console.log(`✅ Arquivo salvo: ${mediaItem.fileName}`);
    }

    res.json({
      success: true,
      message: `${mediaItems.length} arquivo(s) de mídia salvos com sucesso`,
      mediaItems
    });

  } catch (error) {
    console.error('❌ Erro no upload de mídia:', error);

    // ✅ TRATAMENTO ESPECÍFICO PARA ERROS DE INSTÂNCIA
    if (error.message.includes('Instância') || error.message.includes('conectada')) {
      return res.status(400).json({
        success: false,
        error: `Não foi possível validar a instância WhatsApp: ${error.message}`
      });
    }

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};


// ✅ FUNÇÃO DE DELAY INTELIGENTE COM RATE LIMIT PERSISTENTE

// ✅ FUNÇÃO DE DELAY INTELIGENTE COM RATE LIMIT PERSISTENTE
const smartDelay = async (userId, instanceId, batchOptions = {}) => {
  try {
    // 🔒 Verificações iniciais
    if (!userId) {
      throw new Error('userId ausente no smartDelay');
    }
    if (!instanceId) {
      throw new Error('instanceId ausente no smartDelay');
    }

    // 🔧 Configurar contexto de usuário antes de verificar limite
    rateLimitService.setUserContext(userId);

    // ⏱️ Delay base configurável (padrão: 5 segundos)
    const baseDelay = batchOptions?.delayBetweenMessages || 5000;

    // ✅ Verifica e aplica limites
    const limitCheck = await rateLimitService.checkRateLimit(instanceId, 'media');

    // 🚫 Se limite diário foi atingido
    if (!limitCheck.allowed && limitCheck.reason === 'daily_limit') {
      throw new Error(limitCheck.message);
    }

    // 🚫 Se limite por minuto foi atingido → aguarda
    if (!limitCheck.allowed && limitCheck.reason === 'minute_limit') {
      console.log(`⚠️ Rate limit atingido (${limitCheck.current}/${limitCheck.max}). Aguardando ${limitCheck.resetIn}s...`);
      await new Promise(resolve => setTimeout(resolve, limitCheck.waitTime + 1500));
      return { hadDelay: true, reason: 'minute_limit', wait: limitCheck.waitTime };
    }

    // ✅ Delay normal (com jitter aleatório ±1.5s)
    const jitter = Math.random() * 3000 - 1500;
    const dynamicDelay = Math.max(3000, baseDelay + jitter);
    await new Promise(resolve => setTimeout(resolve, dynamicDelay));

    return {
      hadDelay: true,
      reason: 'normal_delay',
      delay: dynamicDelay,
      dailyRemaining: limitCheck.dailyRemaining
    };
  } catch (error) {
    console.error('❌ Erro no smartDelay:', error.message);
    throw error;
  }
};




// ✅ FUNÇÃO PRINCIPAL DE PROCESSAMENTO (REVISTA E CORRIGIDA)

const processMediaBatch = async (batchId) => {
  try {
    console.log(`🔄 Processando lote de mídia: ${batchId}`);

    const batch = await MediaBatch.findById(batchId)
      .populate('contactGroupIds')
      .populate('whatsappInstanceId');

    if (!batch) throw new Error('Lote de mídia não encontrado');

    // ✅ Validação forte antes de continuar
    if (!batch.userId) {
      throw new Error('userId ausente no lote');
    }
    if (!batch.whatsappInstanceId || !batch.whatsappInstanceId._id) {
      throw new Error('Instância WhatsApp ausente ou inválida no lote');
    }

    // ✅ Configurar contexto do RateLimitService
    rateLimitService.setUserContext(batch.userId);

    const whatsappInstance = batch.whatsappInstanceId;
    const instanceId = whatsappInstance._id;
    const InstancePhoneNumber =whatsappInstance.phoneNumber

    // ✅ Verificar limite diário antes de iniciar
    const limitStatus = await rateLimitService.getLimitStatus(batch.userId, instanceId);
    if (limitStatus && limitStatus.daily.remaining <= 0) {
      throw new Error(
        `LIMITE_DIARIO_EXCEDIDO: ${limitStatus.daily.current}/${limitStatus.daily.max} mensagens hoje. Retome amanhã.`
      );
    }

    const caption = batch.caption || batch.options?.caption || '';
    console.log(`🔍 Iniciando: ${batch.mediaItems.length} mídias para ${batch.contactGroupIds.length} grupos`);
    console.log(`📊 Limite diário restante: ${limitStatus.daily.remaining} mensagens`);

    // ✅ Verificar instância WhatsApp antes de processar
    await checkWhatsAppInstance(instanceId, batch.userId);

    // ✅ Atualizar status
    await MediaBatch.findByIdAndUpdate(batchId, { status: 'processing' });

    // ✅ Coletar contatos
    const allContacts = [];
    const contactMap = new Map();

    for (const group of batch.contactGroupIds) {
      const contactGroup = await ContactGroup.findById(group._id);
      if (contactGroup?.contacts) {
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

    console.log(`📨 Total de contatos únicos: ${allContacts.length}`);

    let sentCount = 0;
    let failedCount = 0;
    const results = [];
    let dailyLimitExceeded = false;

    // ✅ Loop principal de envio
    for (const contact of allContacts) {
      if (dailyLimitExceeded) break;

      for (const mediaItem of batch.mediaItems) {
        try {
          // ✅ Verificar limites antes de cada envio
          const delayResult = await smartDelay(batch.userId, instanceId, batch.options);

          if (delayResult.hadDelay) {
            console.log(`⏳ Aguardando ${delayResult.delay}ms antes do próximo envio...`);
          }

          const jid = contact.whatsappId && contact.whatsappId.includes('@')
            ? contact.whatsappId
            : `${contact.phone.replace(/\D/g, '')}@s.whatsapp.net`;

          console.log(`📤 Enviando ${mediaItem.originalName} para: ${contact.name}`);

          // ✅ Envio via mediaService
          const sendResult = await mediaService.sendMediaToContact(
            whatsappInstance.sessionName,
            InstancePhoneNumber,
            jid,
            mediaItem,
            caption,
            batch.options
          );

          sentCount++;
          results.push({
            contact: contact.name,
            phone: contact.phone,
            mediaItem: mediaItem.originalName,
            status: 'sent',
            messageId: sendResult?.messageId,
            timestamp: new Date()
          });

          // ✅ Atualizar progresso do lote
          await MediaBatch.findByIdAndUpdate(batchId, {
            'progress.sent': sentCount,
            'progress.failed': failedCount
          });

          // ✅ Decrementar limite diário persistente
          const remaining = await rateLimitService.decrementDailyLimit(instanceId);
          if (remaining <= 0) {
            console.log('🚨 LIMITE DIÁRIO ATINGIDO - PARANDO LOTE');
            dailyLimitExceeded = true;
            break;
          }

          console.log(`✅ ${sentCount}/${batch.progress.total} - ${contact.name} (Restam ${remaining})`);

        } catch (error) {
          console.error(`❌ Erro para ${contact.name}:`, error.message);

          if (error.message.includes('LIMITE_DIARIO_EXCEDIDO')) {
            console.log('🚨 LIMITE DIÁRIO ATINGIDO - PARANDO LOTE');
            dailyLimitExceeded = true;
            break;
          }

          failedCount++;
          results.push({
            contact: contact.name,
            phone: contact.phone,
            mediaItem: mediaItem.originalName,
            status: 'failed',
            error: error.message,
            timestamp: new Date()
          });

          await MediaBatch.findByIdAndUpdate(batchId, {
            'progress.failed': failedCount
          });
        }
      }
    }

    // ✅ Status final
    let finalStatus = 'completed';
    if (dailyLimitExceeded) finalStatus = 'paused_daily_limit';
    else if (failedCount === batch.progress.total) finalStatus = 'failed';
    else if (failedCount > 0) finalStatus = 'completed_with_errors';

    await MediaBatch.findByIdAndUpdate(batchId, {
      status: finalStatus,
      'progress.sent': sentCount,
      'progress.failed': failedCount,
      results
    });

    console.log(`✅ Lote ${batch.name} finalizado: ${sentCount} enviados, ${failedCount} falhas`);

  } catch (error) {
    console.error(`❌ Erro no processamento:`, error);

    await MediaBatch.findByIdAndUpdate(batchId, {
      status: error.message.includes('LIMITE_DIARIO') ? 'paused_daily_limit' : 'failed',
      $push: {
        results: {
          contact: 'Sistema',
          phone: 'N/A',
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        }
      }
    });
  } finally {
    rateLimitService.cleanupOldLimits();
  }
};


// ✅ CONTROLLER CREATE MEDIA BATCH COM VALIDAÇÃO DE INSTÂNCIA

const createMediaBatch = async (req, res) => {
  try {
    console.log('📦 Criando novo lote de mídia...');
    const { name, mediaItems, contactGroupIds, whatsappInstanceId, caption, options } = req.body;

    if (!name || !mediaItems || !contactGroupIds || !whatsappInstanceId) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios faltando'
      });
    }

    // ✅ VALIDAR INSTÂNCIA ANTES DE CRIAR O LOTE
    console.log(`🔍 Validando instância: ${whatsappInstanceId}`);
    const instanceCheck = await checkWhatsAppInstance(whatsappInstanceId, req.user._id);
    console.log(`✅ Instância validada: ${instanceCheck.sessionName}`);

    // ✅ VERIFICAR GRUPOS DE CONTATOS
    const contactGroups = await ContactGroup.find({
      _id: { $in: contactGroupIds },
      userId: req.user._id
    });

    if (contactGroups.length !== contactGroupIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Grupos de contatos não encontrados'
      });
    }

    const totalContacts = contactGroups.reduce((total, group) => total + group.contactCount, 0);
    const totalSends = totalContacts * mediaItems.length;

    if (totalContacts === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum contato disponível'
      });
    }

    // ✅ CONFIGURA CONTEXTO DO RATE LIMIT SERVICE
    rateLimitService.setUserContext(req.user._id);

    // ✅ VERIFICAR LIMITE DIÁRIO ANTES DE CRIAR LOTE
    const limitStatus = await rateLimitService.getLimitStatus(req.user._id, whatsappInstanceId);

    if (limitStatus?.daily.remaining <= 0) {
      return res.status(400).json({
        success: false,
        error: `Limite diário de ${limitStatus.daily.max} mensagens excedido. Retome amanhã.`
      });
    }

    // ✅ CRIAR LOTE DE MÍDIA
    const batch = await MediaBatch.create({
      userId: req.user._id,
      whatsappInstanceId,
      name,
      mediaItems,
      contactGroupIds,
      caption: caption || '',
      progress: { total: totalSends, sent: 0, failed: 0 },
      options: {
        ...options,
        caption: caption || options?.caption || ''
      }
    });

    // ✅ INICIAR PROCESSAMENTO ASSÍNCRONO
    processMediaBatch(batch._id);

    res.status(201).json({
      success: true,
      message: 'Lote criado e processamento iniciado',
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        mediaCount: batch.mediaItems.length,
        totalContacts,
        totalSends,
        caption: batch.caption,
        instance: {
          sessionName: instanceCheck.sessionName,
          phoneNumber: instanceCheck.phoneNumber
        }
      },
      rateLimitInfo: {
        dailyLimit: limitStatus.daily.max,
        dailyRemaining: limitStatus.daily.remaining,
        maxPerMinute: 1
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar lote:', error);

    if (error.message.includes('Instância') || error.message.includes('conectada')) {
      return res.status(400).json({
        success: false,
        error: `Não foi possível criar o lote: ${error.message}`
      });
    }

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// ✅ NOVO ENDPOINT: STATUS DOS LIMITES
// ✅ NOVO ENDPOINT: STATUS DOS LIMITES (corrigido)
const getRateLimitStatus = async (req, res) => {
  try {
    const { instanceId } = req.params;

    // ⚠️ Adiciona o userId corretamente
    const userId = req.user?._id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // ✅ Chamada correta com dois parâmetros
    const limitStatus = await rateLimitService.getLimitStatus(userId, instanceId);

    res.json({
      success: true,
      data: limitStatus || {
        daily: {
          current: 0,
          max: 150,
          remaining: 150,
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        minute: {
          media: 0,
          message: 0
        }
      }
    });
  } catch (error) {
    console.error('❌ Erro em getRateLimitStatus:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// ✅ FUNÇÕES EXISTENTES (MANTIDAS)
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
        createdAt: batch.createdAt
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lotes:', error);
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
        error: 'Lote não encontrado'
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
    console.error('❌ Erro ao buscar lote:', error);
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
            status: 'cancelled',
            error: 'Cancelado pelo usuário',
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
      message: 'Lote cancelado',
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status
      }
    });
  } catch (error) {
    console.error('❌ Erro ao cancelar:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

const deleteMediaBatch = async (req, res) => {
  try {
    const batch = await MediaBatch.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Lote excluído',
      deletedBatch: {
        _id: batch._id,
        name: batch.name
      }
    });
  } catch (error) {
    console.error('❌ Erro ao excluir:', error);
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
  getMediaBatches,
  getMediaBatch,
  cancelMediaBatch,
  deleteMediaBatch,
  getRateLimitStatus,
  processMediaBatch,
  rateLimitService,
  checkWhatsAppInstance // ✅ Exportar para uso em outros lugares
};