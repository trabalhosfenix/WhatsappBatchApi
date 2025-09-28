// src/services/whatsappService.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const qrcode = require('qrcode');

class WhatsAppService {
  constructor() {
    this.clients = new Map();
  }

  async createClient(sessionName, userId) {
    try {
      const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionName }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // Salvar instância no banco
      const instance = await WhatsAppInstance.create({
        userId,
        sessionName,
        status: 'connecting'
      });

      client.on('qr', async (qr) => {
        const qrImage = await qrcode.toDataURL(qr);
        await WhatsAppInstance.findByIdAndUpdate(instance._id, {
          qrCode: qrImage,
          status: 'connecting'
        });
      });

      client.on('ready', async () => {
        console.log(`WhatsApp client ${sessionName} está pronto!`);
        await WhatsAppInstance.findByIdAndUpdate(instance._id, {
          status: 'connected',
          lastConnection: new Date(),
          qrCode: null
        });
      });

      client.on('disconnected', async (reason) => {
        console.log(`WhatsApp client ${sessionName} desconectado:`, reason);
        await WhatsAppInstance.findByIdAndUpdate(instance._id, {
          status: 'disconnected'
        });
        this.clients.delete(sessionName);
      });

      await client.initialize();
      this.clients.set(sessionName, client);

      return instance;
    } catch (error) {
      throw new Error(`Erro ao criar cliente WhatsApp: ${error.message}`);
    }
  }

  async sendMessage(sessionName, phoneNumber, message) {
    try {
      const client = this.clients.get(sessionName);
      
      if (!client) {
        throw new Error('Cliente WhatsApp não encontrado');
      }

      // Formatar número para padrão internacional
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      const chatId = `${formattedNumber}@c.us`;

      const result = await client.sendMessage(chatId, message);
      return { success: true, messageId: result.id.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getClientStatus(sessionName) {
    const instance = await WhatsAppInstance.findOne({ sessionName });
    return instance ? instance.status : 'not_found';
  }
}

module.exports = new WhatsAppService();