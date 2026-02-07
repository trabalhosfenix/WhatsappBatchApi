const whatsappCommandQueue = require('./whatsappCommandQueue');
const ownershipService = require('./ownershipService');
const sessionStorageProvider = require('./sessionStorageProvider');
const WhatsAppInstance = require('../models/WhatsAppInstance');

class WhatsAppCommandProcessor {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
    this.queue = null;
    this.started = false;
    this.workerNodeId = process.env.WORKER_NODE_ID || process.env.HOSTNAME || 'api-node';
  }

  async refreshHeartbeat() {
    await WhatsAppInstance.updateMany(
      { ownerNode: this.workerNodeId },
      { lastHeartbeat: new Date() }
    );
  }

  async assertOwnership(job) {
    const { sessionName, userId, ownerNode } = job.data;

    if (ownerNode && ownerNode !== this.workerNodeId) {
      throw new Error(`Owner inválido no job. Esperado ${ownerNode}, worker atual ${this.workerNodeId}`);
    }

    const instance = await WhatsAppInstance.findOne({ sessionName, userId });
    if (!instance) {
      throw new Error(`Instância não encontrada para ${sessionName}`);
    }

    const sessionKey = ownershipService.getSessionKey({ userId, sessionName });
    const resolvedOwner = ownershipService.resolveOwner(sessionKey);

    const canReclaim = ownershipService.canReclaimOwnership({
      currentOwner: instance.ownerNode,
      lastHeartbeat: instance.lastHeartbeat,
      resolvedOwner,
      currentWorker: this.workerNodeId
    });

    if (!canReclaim) {
      throw new Error(`Worker ${this.workerNodeId} não é owner da sessão ${sessionName}. Owner atual: ${instance.ownerNode || resolvedOwner}`);
    }

    await WhatsAppInstance.findByIdAndUpdate(instance._id, {
      ownerNode: this.workerNodeId,
      lastHeartbeat: new Date()
    });

    return instance;
  }

  async recoverOwnedSessionsOnStartup() {
    const candidates = await WhatsAppInstance.find({
      $or: [
        { ownerNode: this.workerNodeId },
        { ownerNode: null },
        { lastHeartbeat: { $lt: new Date(Date.now() - ownershipService.getHeartbeatTimeoutMs()) } }
      ]
    });

    for (const instance of candidates) {
      const userId = String(instance.userId);
      const sessionKey = ownershipService.getSessionKey({ userId, sessionName: instance.sessionName });
      const resolvedOwner = ownershipService.resolveOwner(sessionKey);

      const canReclaim = ownershipService.canReclaimOwnership({
        currentOwner: instance.ownerNode,
        lastHeartbeat: instance.lastHeartbeat,
        resolvedOwner,
        currentWorker: this.workerNodeId
      });

      if (!canReclaim) continue;

      await WhatsAppInstance.findByIdAndUpdate(instance._id, {
        ownerNode: this.workerNodeId,
        lastHeartbeat: new Date()
      });

      const hasSession = sessionStorageProvider.hasSavedSession(instance.sessionName);
      const shouldRecover = hasSession && instance.status !== 'connected';

      if (shouldRecover) {
        const queueName = ownershipService.getQueueNameForOwner(this.workerNodeId);
        await whatsappCommandQueue.enqueue('recover', {
          sessionName: instance.sessionName,
          userId,
          ownerNode: this.workerNodeId
        }, {
          queueName,
          jobId: `recover:${instance.sessionName}:${instance.version || 1}`
        });
      }
    }
  }

  async reclaimStaleOwnership() {
    const stale = await WhatsAppInstance.find({
      ownerNode: { $ne: this.workerNodeId },
      lastHeartbeat: { $lt: new Date(Date.now() - ownershipService.getHeartbeatTimeoutMs()) }
    });

    for (const instance of stale) {
      const userId = String(instance.userId);
      const sessionKey = ownershipService.getSessionKey({ userId, sessionName: instance.sessionName });
      const resolvedOwner = ownershipService.resolveOwner(sessionKey);

      if (resolvedOwner !== this.workerNodeId) continue;

      await WhatsAppInstance.findByIdAndUpdate(instance._id, {
        ownerNode: this.workerNodeId,
        lastHeartbeat: new Date()
      });
    }
  }

  async start() {
    if (this.started) return;

    const queueName = ownershipService.getQueueNameForOwner(this.workerNodeId);
    this.queue = whatsappCommandQueue.getQueue(queueName);

    if (!this.queue) {
      console.warn('⚠️ [WhatsAppCommandProcessor] REDIS_URL não configurada, processor desativado.');
      return;
    }

    this.queue.process(2, async (job) => {
      const { sessionName } = job.data;
      console.log(`📥 [WhatsAppCommandProcessor] Processando ${job.name} (${job.id}) para ${sessionName} em ${this.workerNodeId}`);

      await this.assertOwnership(job);

      switch (job.name) {
        case 'connect':
          return this.whatsappService.createClient(job.data.sessionName, job.data.userId);
        case 'recover':
          return this.whatsappService.reconnectInstance(job.data.sessionName, job.data.userId);
        case 'disconnect':
          return this.whatsappService.disconnectClient(job.data.sessionName);
        case 'delete':
          return this.whatsappService.deleteInstance(job.data.sessionName);
        default:
          throw new Error(`Comando não suportado: ${job.name}`);
      }
    });

    this.queue.on('completed', async (job) => {
      await this.refreshHeartbeat();
      console.log(`✅ [WhatsAppCommandProcessor] Job ${job.id} (${job.name}) concluído`);
    });

    this.queue.on('failed', (job, error) => {
      console.error(`❌ [WhatsAppCommandProcessor] Job ${job?.id} (${job?.name}) falhou: ${error.message}`);
    });

    this.started = true;
    console.log(`🚀 [WhatsAppCommandProcessor] Consumer iniciado em ${queueName}`);
  }

  async stop() {
    if (this.queue) {
      await this.queue.close();
    }
    this.started = false;
  }
}

module.exports = WhatsAppCommandProcessor;
