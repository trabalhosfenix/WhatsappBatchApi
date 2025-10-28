// 📁 services/humanSchedulerService.js

//🧠 Estratégia de “Human Delay Engine”
// Mensagens individuais: delay aleatório de 4–7 segundos;
// Entre grupos (5 msgs): pausa aleatória de 25–40 segundos;
// Pausa longa (a cada 20 msgs): pausa aleatória de 55–90 segundos;
// Pausa ocasional extra: 5% de chance de “descanso” extra (ex: 2 minutos), simulando alguém “deixando o celular”.

const whatsappService = require('./whatsappService');
const mediaService = require('./mediaService');
const rateLimitService = require('./rateLimitService');

class HumanSchedulerService {
  constructor() {
    // Configurações base — você pode ajustar facilmente
    this.config = {
      messagesPerGroup: 5,           // Envia 5 mensagens por grupo
      groupsBeforeLongPause: 4,      // Após 4 grupos (20 msgs) -> pausa longa
      baseDelayBetweenMessages: 5000, // 5s
      baseDelayBetweenGroups: 30000,  // 30s
      baseLongPause: 60000,           // 1 min
      randomVariation: 0.4            // 40% de variação aleatória
    };
  }

  // Gera delay aleatório com variação proporcional
  randomDelay(base, variation = this.config.randomVariation) {
    const min = base * (1 - variation);
    const max = base * (1 + variation);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Envio geral (mensagem ou mídia)
   * @param {string} sessionName - Nome da sessão WhatsApp
   * @param {Array} tasks - Lista de objetos { contact, message?, mediaItem?, caption? }
   * @param {object} options - Configurações adicionais (sendAsDocument, etc.)
   */
  async sendBatch(sessionName, tasks, options = {}) {
    const {
      messagesPerGroup,
      groupsBeforeLongPause,
      baseDelayBetweenMessages,
      baseDelayBetweenGroups,
      baseLongPause
    } = this.config;

    console.log(`🚀 [${sessionName}] Iniciando envio humanizado de ${tasks.length} itens...`);

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const jid = task.contact.includes('@')
        ? task.contact
        : `${task.contact.replace(/\D/g, '')}@s.whatsapp.net`;

      // Verifica o rate limit antes de cada envio
      const limitCheck = await rateLimitService.checkLimit(sessionName, 'media');
      if (!limitCheck.allowed) {
        console.log(`⚠️ Limite atingido — aguardando ${Math.ceil(limitCheck.waitTime / 1000)}s...`);
        await this.delay(limitCheck.waitTime + 1000);
      }

      try {
        // Escolher método de envio
        if (task.mediaItem) {
          // Mídia com ou sem legenda
          await mediaService.sendMediaToContact(
            sessionName,
            jid,
            task.mediaItem,
            options.caption || task.caption || '',
            options
          );
        } else {
          // Apenas texto
          await whatsappService.sendMessageToContact(sessionName, jid, task.message);
        }

        sentCount++;
        console.log(`✅ [${sessionName}] Envio ${sentCount}/${tasks.length} concluído.`);

      } catch (error) {
        failedCount++;
        console.error(`❌ [${sessionName}] Falha ao enviar para ${jid}: ${error.message}`);
      }

      // Delay aleatório entre mensagens
      await this.delay(this.randomDelay(baseDelayBetweenMessages));

      // Pausa curta entre grupos
      if ((i + 1) % messagesPerGroup === 0 && (i + 1) < tasks.length) {
        const wait = this.randomDelay(baseDelayBetweenGroups, 0.3);
        console.log(`⏳ Pausa curta de ${(wait / 1000).toFixed(1)}s entre grupos...`);
        await this.delay(wait);
      }

      // Pausa longa a cada 20 mensagens (4 grupos)
      if ((i + 1) % (messagesPerGroup * groupsBeforeLongPause) === 0 && (i + 1) < tasks.length) {
        const wait = this.randomDelay(baseLongPause, 0.5);
        console.log(`🕐 Pausa longa de ${(wait / 1000).toFixed(1)}s após 20 mensagens...`);
        await this.delay(wait);
      }

      // 5% de chance de pausa aleatória extra (2–3 minutos)
      if (Math.random() < 0.05) {
        const extraPause = this.randomDelay(120000, 0.3);
        console.log(`😴 Pausa aleatória extra de ${(extraPause / 1000 / 60).toFixed(1)} min...`);
        await this.delay(extraPause);
      }
    }

    console.log(`🎉 [${sessionName}] Envio humanizado concluído. ✅ Enviados: ${sentCount}, ❌ Falhas: ${failedCount}`);
  }
}

module.exports = new HumanSchedulerService();
