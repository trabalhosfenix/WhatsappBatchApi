const Queue = require('bull');

class WhatsAppCommandQueue {
  constructor() {
    this.queue = null;
    this.initialized = false;
  }

  isEnabled() {
    return Boolean(process.env.REDIS_URL);
  }

  getQueue() {
    if (!this.isEnabled()) {
      return null;
    }

    if (!this.initialized) {
      this.queue = new Queue('whatsapp.commands', process.env.REDIS_URL);
      this.queue.on('error', (error) => {
        console.error(`❌ [WhatsAppCommandQueue] Erro na fila: ${error.message}`);
      });
      this.initialized = true;
    }

    return this.queue;
  }

  async enqueue(command, payload, options = {}) {
    const queue = this.getQueue();

    if (!queue) {
      return { queued: false, reason: 'REDIS_URL não configurada' };
    }

    const job = await queue.add(command, payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
      ...options
    });

    return { queued: true, jobId: job.id, command };
  }
}

module.exports = new WhatsAppCommandQueue();
