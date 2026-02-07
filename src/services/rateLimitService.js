// 📁 services/rateLimitService.js
class RateLimitService {
  constructor() {
    this.windows = new Map();
  }

  async checkLimit(instanceId, type = 'media') {
    const limits = {
      message: { max: 40, window: 60000 }, // 40 mensagens/minuto
      media: { max: 40, window: 60000 },   // 40 mídias/minuto
      group: { max: 20, window: 60000 }    // 20 grupos/minuto
    };

    const key = `${instanceId}-${type}`;
    const now = Date.now();

    if (!this.windows.has(key)) {
      this.windows.set(key, { count: 0, start: now });
    }

    const window = this.windows.get(key);

    // Reset se a janela expirou
    if (now - window.start > limits[type].window) {
      window.count = 0;
      window.start = now;
    }

    // Excedeu o limite → pausa obrigatória
    if (window.count >= limits[type].max) {
      const waitTime = limits[type].window - (now - window.start);
      return { allowed: false, waitTime };
    }

    // Incrementa contagem
    window.count++;
    return { allowed: true, remaining: limits[type].max - window.count };
  }
}

module.exports = new RateLimitService();
