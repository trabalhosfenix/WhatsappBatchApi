const whatsappCommandQueue = require('./whatsappCommandQueue');

class WhatsAppCommandProcessor {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
    this.queue = null;
    this.started = false;
  }

  async start() {
    if (this.started) return;

    this.queue = whatsappCommandQueue.getQueue();
    if (!this.queue) {
      console.warn('⚠️ [WhatsAppCommandProcessor] REDIS_URL não configurada, processor desativado.');
      return;
    }

    this.queue.process(2, async (job) => {
      const { sessionName, userId } = job.data;
      console.log(`📥 [WhatsAppCommandProcessor] Processando ${job.name} (${job.id}) para ${sessionName}`);

      switch (job.name) {
        case 'connect':
          return this.whatsappService.createClient(sessionName, userId);
        case 'recover':
          return this.whatsappService.reconnectInstance(sessionName, userId);
        case 'disconnect':
          return this.whatsappService.disconnectClient(sessionName);
        default:
          throw new Error(`Comando não suportado: ${job.name}`);
      }
    });

    this.queue.on('completed', (job) => {
      console.log(`✅ [WhatsAppCommandProcessor] Job ${job.id} (${job.name}) concluído`);
    });

    this.queue.on('failed', (job, error) => {
      console.error(`❌ [WhatsAppCommandProcessor] Job ${job?.id} (${job?.name}) falhou: ${error.message}`);
    });

    this.started = true;
    console.log('🚀 [WhatsAppCommandProcessor] Consumer iniciado em whatsapp.commands');
  }

  async stop() {
    if (this.queue) {
      await this.queue.close();
    }
    this.started = false;
  }
}

module.exports = WhatsAppCommandProcessor;
