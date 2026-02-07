const whatsappCommandQueue = require('./whatsappCommandQueue');
const ownershipService = require('./ownershipService');
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

    const sessionKey = ownershipService.getSessionKey({ userId, sessionName });
    const resolvedOwner = ownershipService.resolveOwner(sessionKey);

    if (resolvedOwner !== this.workerNodeId) {
      throw new Error(`Worker ${this.workerNodeId} não é owner da sessão ${sessionName}. Owner atual: ${resolvedOwner}`);
    }

    await WhatsAppInstance.findOneAndUpdate(
      { sessionName, userId },
      {
        ownerNode: this.workerNodeId,
        lastHeartbeat: new Date()
      }
    );
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
