const Queue = require('bull');

class WhatsAppCommandQueue {
  constructor() {
    this.queues = new Map();
  }

  isEnabled() {
    return Boolean(process.env.REDIS_URL);
  }

  getQueue(queueName = 'whatsapp.commands.default') {
    if (!this.isEnabled()) {
      return null;
    }

    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, process.env.REDIS_URL);
      queue.on('error', (error) => {
        console.error(`❌ [WhatsAppCommandQueue] Erro na fila ${queueName}: ${error.message}`);
      });
      this.queues.set(queueName, queue);
    }

    return this.queues.get(queueName);
  }

  async enqueue(command, payload, options = {}) {
    const { queueName = 'whatsapp.commands.default', ...jobOptions } = options;
    const queue = this.getQueue(queueName);

    if (!queue) {
      return { queued: false, reason: 'REDIS_URL não configurada' };
    }

    const job = await queue.add(command, payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
      ...jobOptions
    });

    return { queued: true, jobId: job.id, command, queueName };
  }
}

module.exports = new WhatsAppCommandQueue();
