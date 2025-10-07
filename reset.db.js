const mongoose = require('mongoose');
const connectDB = require('./src/config/database');

async function resetDatabase() {
  try {
    await connectDB();
    
    console.log('🔄 Reiniciando estrutura do banco...');
    
    // 1. Deletar coleção WhatsAppInstance
    await mongoose.connection.db.dropCollection('whatsappinstances');
    console.log('✅ Coleção WhatsAppInstance removida');
    
    // 2. Recriar o modelo (isso criará os índices corretos)
    const WhatsAppInstance = require('./models/WhatsAppInstance');
    
    // 3. Verificar se foi criada
    const collections = await mongoose.connection.db.listCollections({ name: 'whatsappinstances' }).toArray();
    console.log('✅ Coleção recriada:', collections.length > 0);
    
    // 4. Verificar índices
    const indexes = await WhatsAppInstance.collection.getIndexes();
    console.log('📊 Índices criados:');
    Object.keys(indexes).forEach(key => {
      console.log(`   - ${key}:`, indexes[key].key);
    });
    
  } catch (error) {
    console.error('❌ Erro no reset:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Reset concluído');
  }
}

resetDatabase();