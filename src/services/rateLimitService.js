// 📁 services/rateLimitService.js
class RateLimitService {
  constructor() {
    this.limits = new Map();
    this.windows = new Map();
  }

  async checkLimit(instanceId, type = 'message') {
    const limits = {
      'message': { max: 20, window: 60000 }, // 20/min
      'media': { max: 10, window: 60000 },   // 10/min  
      'group': { max: 5, window: 60000 }     // 5/min
    };

    const key = `${instanceId}-${type}`;
    const now = Date.now();
    
    if (!this.windows.has(key)) {
      this.windows.set(key, { count: 0, start: now });
    }

    const window = this.windows.get(key);
    
    // Reset window if expired
    if (now - window.start > limits[type].window) {
      window.count = 0;
      window.start = now;
    }

    // Check if limit exceeded
    if (window.count >= limits[type].max) {
      const waitTime = limits[type].window - (now - window.start);
      return { allowed: false, waitTime };
    }

    window.count++;
    return { allowed: true, remaining: limits[type].max - window.count };
  }
}