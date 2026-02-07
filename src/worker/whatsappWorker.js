require('dotenv').config();
process.env.IS_WHATSAPP_WORKER = 'true';
const connectDB = require('../config/database');
const whatsappService = require('../services/whatsappService');
const WhatsAppCommandProcessor = require('../services/whatsappCommandProcessor');

const processor = new WhatsAppCommandProcessor(whatsappService);
let heartbeatTimer;

async function bootstrap() {
  await connectDB();
  await processor.start();

  heartbeatTimer = setInterval(async () => {
    try {
      await processor.refreshHeartbeat();
    } catch (error) {
      console.warn(`⚠️ Falha no heartbeat do worker: ${error.message}`);
    }
  }, 10000);

  console.log('👷 WhatsApp worker ativo e aguardando comandos...');
}

async function shutdown(signal) {
  console.log(`\n🛑 Worker recebeu ${signal}, encerrando...`);
  try {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    await processor.stop();
    await whatsappService.cleanupAllInstances();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao finalizar worker:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap().catch((error) => {
  console.error('❌ Falha ao iniciar WhatsApp worker:', error);
  process.exit(1);
});
