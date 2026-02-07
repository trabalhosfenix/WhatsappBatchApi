require('dotenv').config();
const app = require('./src/app.js');
const whatsappService = require('./src/services/whatsappService');
const InstanceCleanup = require('./src/utils/instanceCleanup');
// server.js - ADICIONAR referência se quiser cleanup
const MessageControlService = require('./src/services/messageControlService');


// Inicializar serviço
const messageControlService = new MessageControlService(whatsappService);


const PORT = process.env.PORT || 3000;

console.log("CORS_ORIGIN:", process.env.CORS_ORIGIN);
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
console.log("Allowed origins:", allowedOrigins);

// Inicializar sistema de cleanup automático
const instanceCleanup = new InstanceCleanup(whatsappService);

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
 
  
  // Iniciar cleanup automático após 30 segundos
  setTimeout(() => {
    instanceCleanup.startAutoCleanup();
  }, 120000);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Recebido SIGINT, iniciando shutdown graceful...');
  
  try {
    // Parar cleanup automático
    instanceCleanup.stopAutoCleanup();
    
    // Limpar todas as instâncias do WhatsApp
    await whatsappService.cleanupAllInstances();

     const activeTrackers = messageControlService.getActiveTrackers();
        for (const sessionName of activeTrackers.activeSessions) {
            await messageControlService.disableMessageTracking(sessionName);
        }
    
    console.log('✅ Shutdown concluído com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recebido SIGTERM, iniciando shutdown graceful...');
  
  try {
    instanceCleanup.stopAutoCleanup();
    await whatsappService.cleanupAllInstances();
    console.log('✅ Shutdown concluído com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante shutdown:', error);
    process.exit(1);
  }
});