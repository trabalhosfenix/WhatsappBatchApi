require('dotenv').config();
const app = require('./src/app.js');
const whatsappService = require('./src/services/whatsappService');
const InstanceCleanup = require('./src/utils/instanceCleanup');

const PORT = process.env.PORT || 3000;

// Inicializar sistema de cleanup automático
const instanceCleanup = new InstanceCleanup(whatsappService);

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Iniciar cleanup automático após 30 segundos
  setTimeout(() => {
    instanceCleanup.startAutoCleanup();
  }, 30000);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Recebido SIGINT, iniciando shutdown graceful...');
  
  try {
    // Parar cleanup automático
    instanceCleanup.stopAutoCleanup();
    
    // Limpar todas as instâncias do WhatsApp
    await whatsappService.cleanupAllInstances();
    
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