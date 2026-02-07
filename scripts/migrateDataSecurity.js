const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User.js');
const WhatsAppInstance = require('../src/models/WhatsAppInstance.js');
const ContactGroup = require('../src/models/ContactGroup.js');

class DataMigration {
  constructor() {
    this.migrationLog = [];
  }

  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-batch-api');
      console.log('✅ Conectado ao MongoDB para migração');
    } catch (error) {
      console.error('❌ Erro ao conectar:', error);
      process.exit(1);
    }
  }

  async migrateInstances() {
    console.log('🔄 Migrando instâncias...');
    
    // Encontrar instâncias duplicadas entre usuários
    const duplicateInstances = await WhatsAppInstance.aggregate([
      {
        $group: {
          _id: "$sessionName",
          count: { $sum: 1 },
          instances: { $push: { _id: "$_id", userId: "$userId", sessionName: "$sessionName" } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    for (const duplicate of duplicateInstances) {
      console.log(`⚠️ Instância duplicada: ${duplicate._id} (${duplicate.count} ocorrências)`);
      
      // Manter apenas a primeira ocorrência, deletar as demais
      const [keepInstance, ...deleteInstances] = duplicate.instances;
      
      for (const instance of deleteInstances) {
        await WhatsAppInstance.findByIdAndDelete(instance._id);
        console.log(`🗑️ Deletada instância duplicada: ${instance._id} do usuário ${instance.userId}`);
        
        this.migrationLog.push({
          type: 'instance_deleted',
          instanceId: instance._id,
          userId: instance.userId,
          sessionName: instance.sessionName,
          reason: 'duplicata'
        });
      }
    }

    console.log(`✅ Migração de instâncias concluída: ${duplicateInstances.length} duplicatas tratadas`);
  }

  async migrateGroups() {
    console.log('🔄 Migrando grupos...');
    
    // Encontrar grupos com userId incorreto ou duplicados
    const allGroups = await ContactGroup.find().populate('whatsappInstanceId');
    
    let fixedCount = 0;
    let deletedCount = 0;

    for (const group of allGroups) {
      try {
        // Se o grupo tem instância, verificar se o userId bate
        if (group.whatsappInstanceId) {
          const instanceUserId = group.whatsappInstanceId.userId.toString();
          const groupUserId = group.userId.toString();

          if (instanceUserId !== groupUserId) {
            console.log(`⚠️ Correção necessária: Grupo ${group._id} - userId ${groupUserId} não bate com instância ${instanceUserId}`);
            
            // Corrigir o userId do grupo
            group.userId = group.whatsappInstanceId.userId;
            await group.save();
            
            fixedCount++;
            this.migrationLog.push({
              type: 'group_fixed',
              groupId: group._id,
              oldUserId: groupUserId,
              newUserId: instanceUserId,
              name: group.name
            });
          }
        }

        // Verificar duplicatas por jid
        if (group.jid && group.source === 'whatsapp') {
          const duplicates = await ContactGroup.find({
            jid: group.jid,
            userId: group.userId,
            _id: { $ne: group._id }
          });

          if (duplicates.length > 0) {
            console.log(`⚠️ Duplicatas encontradas para jid ${group.jid}: ${duplicates.length}`);
            
            // Manter apenas o grupo mais recente
            const [keepGroup, ...deleteGroups] = [group, ...duplicates]
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            for (const dupGroup of deleteGroups) {
              if (dupGroup._id.toString() !== keepGroup._id.toString()) {
                await ContactGroup.findByIdAndDelete(dupGroup._id);
                deletedCount++;
                
                this.migrationLog.push({
                  type: 'group_deleted',
                  groupId: dupGroup._id,
                  userId: dupGroup.userId,
                  jid: dupGroup.jid,
                  reason: 'duplicata'
                });
              }
            }
          }
        }

      } catch (error) {
        console.error(`❌ Erro ao migrar grupo ${group._id}:`, error.message);
      }
    }

    console.log(`✅ Migração de grupos concluída: ${fixedCount} corrigidos, ${deletedCount} deletados`);
  }

  async run() {
    try {
      await this.connect();
      
      console.log('🚀 INICIANDO MIGRAÇÃO DE SEGURANÇA DE DADOS...');
      
      await this.migrateInstances();
      await this.migrateGroups();
      
      // Salvar log de migração
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      fs.writeFileSync(
        `migration_log_${timestamp}.json`, 
        JSON.stringify(this.migrationLog, null, 2)
      );
      
      console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log(`📊 Total de operações: ${this.migrationLog.length}`);
      console.log(`📁 Log salvo em: migration_log_${timestamp}.json`);
      
    } catch (error) {
      console.error('❌ ERRO NA MIGRAÇÃO:', error);
    } finally {
      await mongoose.connection.close();
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const migration = new DataMigration();
  migration.run();
}

module.exports = DataMigration;