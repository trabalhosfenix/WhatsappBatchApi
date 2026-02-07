require('dotenv').config();
const connectDB = require('../config/database');
const whatsappService = require('../services/whatsappService');
const WhatsAppCommandProcessor = require('../services/whatsappCommandProcessor');

const processor = new WhatsAppCommandProcessor(whatsappService);

async function bootstrap() {
  await connectDB();
  await processor.start();
  console.log('👷 WhatsApp worker ativo e aguardando comandos...');
}

async function shutdown(signal) {
  console.log(`\n🛑 Worker recebeu ${signal}, encerrando...`);
  try {
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
