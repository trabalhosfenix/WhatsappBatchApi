// 📁 backup-debug.js
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// ✅ Importar modelos
const User = require('./src/models/User');
const WhatsAppInstance = require('./src/models/WhatsAppInstance');
const ContactGroup = require('./src/models/ContactGroup');
const MessageBatch = require('./src/models/MessageBatch');
const MediaBatch = require('./src/models/MediaBatch');
const MessageLog = require('./src/models/MessageLog');

console.log('🚀 Iniciando script de backup com DEBUG...');

class MongoDBBackup {
    constructor() {
        this.backupDir = path.join(process.cwd(), 'backups');
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.workbook = new ExcelJS.Workbook();
        
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async connectToDatabase() {
        try {
            // ⚠️ VERIFIQUE SUA STRING DE CONEXÃO
            const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-batch-api';
            
            console.log(`🔗 Conectando ao: ${MONGODB_URI}`);
            
            await mongoose.connect(MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            
            console.log('✅ Conectado ao MongoDB');
            
            // ✅ VERIFICAR SE CONECTOU NA DB CORRETA
            const db = mongoose.connection.db;
            const dbName = db.databaseName;
            console.log(`📊 Banco de dados: ${dbName}`);
            
        } catch (error) {
            console.error('❌ Erro na conexão:', error.message);
            throw error;
        }
    }

    async listAllCollections() {
        try {
            const db = mongoose.connection.db;
            const collections = await db.listCollections().toArray();
            
            console.log('\n📋 COLECÕES DISPONÍVEIS:');
            collections.forEach(collection => {
                console.log(`   - ${collection.name}`);
            });
            
            return collections;
        } catch (error) {
            console.error('❌ Erro ao listar coleções:', error);
        }
    }

    async countAllDocuments() {
        console.log('\n🔢 CONTAGEM DE DOCUMENTOS:');
        
        try {
            const userCount = await User.countDocuments();
            console.log(`   👥 Users: ${userCount}`);
            
            const instanceCount = await WhatsAppInstance.countDocuments();
            console.log(`   📱 WhatsAppInstances: ${instanceCount}`);
            
            const groupCount = await ContactGroup.countDocuments();
            console.log(`   👥 ContactGroups: ${groupCount}`);
            
            const batchCount = await MessageBatch.countDocuments();
            console.log(`   ✉️ MessageBatches: ${batchCount}`);
            
            const mediaCount = await MediaBatch.countDocuments();
            console.log(`   🖼️ MediaBatches: ${mediaCount}`);
            
            const logCount = await MessageLog.countDocuments();
            console.log(`   📝 MessageLogs: ${logCount}`);
            
        } catch (error) {
            console.error('❌ Erro na contagem:', error.message);
        }
    }

    async backupAllCollections() {
        try {
            console.log('\n🔄 INICIANDO BACKUP...');
            
            await this.listAllCollections();
            await this.countAllDocuments();
            
            // Fazer backup de cada coleção
            await this.backupUsers();
            await this.backupWhatsAppInstances();
            await this.backupContactGroups();
            await this.backupMessageBatches();
            await this.backupMediaBatches();
            await this.backupMessageLogs();
            await this.generateSummary();

            // Salvar arquivo
            const filename = `mongo-backup-${this.timestamp}.xlsx`;
            const filepath = path.join(this.backupDir, filename);
            
            await this.workbook.xlsx.writeFile(filepath);
            
            console.log(`\n✅ BACKUP SALVO: ${filepath}`);
            return filepath;

        } catch (error) {
            console.error('❌ Erro no backup:', error);
            throw error;
        }
    }

    async backupUsers() {
        console.log('\n📊 Backup de Users...');
        
        try {
            const users = await User.find({}).lean();
            console.log(`   📨 Consulta retornou: ${users.length} usuários`);
            
            if (users.length > 0) {
                console.log('   👤 Primeiro usuário:', {
                    id: users[0]._id,
                    name: users[0].name,
                    email: users[0].email
                });
            }
            
            const worksheet = this.workbook.addWorksheet('Users');
            
            worksheet.columns = [
                { header: 'ID', key: '_id', width: 25 },
                { header: 'Nome', key: 'name', width: 20 },
                { header: 'Email', key: 'email', width: 25 },
                { header: 'Role', key: 'role', width: 10 },
                { header: 'Ativo', key: 'isActive', width: 8 },
                { header: 'Criado em', key: 'createdAt', width: 20 }
            ];

            users.forEach(user => {
                worksheet.addRow({
                    _id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    createdAt: user.createdAt
                });
            });

            if (users.length > 0) {
                worksheet.getRow(1).font = { bold: true };
            }
            
            console.log(`   ✅ ${users.length} usuários exportados`);
            
        } catch (error) {
            console.error('   ❌ Erro no backup de Users:', error.message);
        }
    }

    async backupWhatsAppInstances() {
        console.log('\n📊 Backup de WhatsAppInstances...');
        
        try {
            const instances = await WhatsAppInstance.find({})
                .populate('userId', 'name email')
                .lean();
                
            console.log(`   📨 Consulta retornou: ${instances.length} instâncias`);
            
            if (instances.length > 0) {
                console.log('   📱 Primeira instância:', {
                    id: instances[0]._id,
                    sessionName: instances[0].sessionName,
                    status: instances[0].status
                });
            }
            
            const worksheet = this.workbook.addWorksheet('WhatsAppInstances');
            
            worksheet.columns = [
                { header: 'ID', key: '_id', width: 25 },
                { header: 'Usuário', key: 'userName', width: 20 },
                { header: 'Session Name', key: 'sessionName', width: 25 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Número', key: 'phoneNumber', width: 15 },
                { header: 'Criado em', key: 'createdAt', width: 20 }
            ];

            instances.forEach(instance => {
                worksheet.addRow({
                    _id: instance._id.toString(),
                    userName: instance.userId?.name || 'N/A',
                    sessionName: instance.sessionName,
                    status: instance.status,
                    phoneNumber: instance.phoneNumber || 'N/A',
                    createdAt: instance.createdAt
                });
            });

            if (instances.length > 0) {
                worksheet.getRow(1).font = { bold: true };
            }
            
            console.log(`   ✅ ${instances.length} instâncias exportadas`);
            
        } catch (error) {
            console.error('   ❌ Erro no backup de Instâncias:', error.message);
        }
    }

    async backupContactGroups() {
        console.log('\n📊 Backup de ContactGroups...');
        
        try {
            const groups = await ContactGroup.find({})
                .populate('userId', 'name email')
                .populate('whatsappInstanceId', 'sessionName')
                .lean();
                
            console.log(`   📨 Consulta retornou: ${groups.length} grupos`);
            
            if (groups.length > 0) {
                console.log('   👥 Primeiro grupo:', {
                    id: groups[0]._id,
                    name: groups[0].name,
                    source: groups[0].source
                });
            }
            
            const worksheet = this.workbook.addWorksheet('ContactGroups');
            
            worksheet.columns = [
                { header: 'ID', key: '_id', width: 25 },
                { header: 'Usuário', key: 'userName', width: 20 },
                { header: 'Instância', key: 'instanceName', width: 20 },
                { header: 'Nome Grupo', key: 'name', width: 25 },
                { header: 'Fonte', key: 'source', width: 12 },
                { header: 'Total Contatos', key: 'contactCount', width: 12 },
                { header: 'Criado em', key: 'createdAt', width: 20 }
            ];

            groups.forEach(group => {
                worksheet.addRow({
                    _id: group._id.toString(),
                    userName: group.userId?.name || 'N/A',
                    instanceName: group.whatsappInstanceId?.sessionName || 'N/A',
                    name: group.name,
                    source: group.source,
                    contactCount: group.contactCount,
                    createdAt: group.createdAt
                });
            });

            if (groups.length > 0) {
                worksheet.getRow(1).font = { bold: true };
            }
            
            console.log(`   ✅ ${groups.length} grupos exportados`);
            
        } catch (error) {
            console.error('   ❌ Erro no backup de Grupos:', error.message);
        }
    }

    async backupMessageBatches() {
        console.log('\n📊 Backup de MessageBatches...');
        
        try {
            const batches = await MessageBatch.find({})
                .populate('userId', 'name email')
                .populate('whatsappInstanceId', 'sessionName')
                .populate('contactGroupIds', 'name')
                .lean();
                
            console.log(`   📨 Consulta retornou: ${batches.length} lotes`);
            
            const worksheet = this.workbook.addWorksheet('MessageBatches');
            
            worksheet.columns = [
                { header: 'ID', key: '_id', width: 25 },
                { header: 'Usuário', key: 'userName', width: 20 },
                { header: 'Nome Lote', key: 'name', width: 25 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Progresso', key: 'progress', width: 15 },
                { header: 'Criado em', key: 'createdAt', width: 20 }
            ];

            batches.forEach(batch => {
                worksheet.addRow({
                    _id: batch._id.toString(),
                    userName: batch.userId?.name || 'N/A',
                    name: batch.name,
                    status: batch.status,
                    progress: `${batch.progress?.sent || 0}/${batch.progress?.total || 0}`,
                    createdAt: batch.createdAt
                });
            });

            if (batches.length > 0) {
                worksheet.getRow(1).font = { bold: true };
            }
            
            console.log(`   ✅ ${batches.length} lotes de mensagens exportados`);
            
        } catch (error) {
            console.error('   ❌ Erro no backup de Lotes:', error.message);
        }
    }

    async backupMediaBatches() {
        console.log('\n📊 Backup de MediaBatches...');
        
        try {
            const batches = await MediaBatch.find({})
                .populate('userId', 'name email')
                .populate('whatsappInstanceId', 'sessionName')
                .lean();
                
            console.log(`   📨 Consulta retornou: ${batches.length} lotes de mídia`);
            
            const worksheet = this.workbook.addWorksheet('MediaBatches');
            
            worksheet.columns = [
                { header: 'ID', key: '_id', width: 25 },
                { header: 'Usuário', key: 'userName', width: 20 },
                { header: 'Nome Lote', key: 'name', width: 25 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Total Mídias', key: 'mediaCount', width: 12 },
                { header: 'Criado em', key: 'createdAt', width: 20 }
            ];

            batches.forEach(batch => {
                worksheet.addRow({
                    _id: batch._id.toString(),
                    userName: batch.userId?.name || 'N/A',
                    name: batch.name,
                    status: batch.status,
                    mediaCount: batch.mediaItems?.length || 0,
                    createdAt: batch.createdAt
                });
            });

            if (batches.length > 0) {
                worksheet.getRow(1).font = { bold: true };
            }
            
            console.log(`   ✅ ${batches.length} lotes de mídia exportados`);
            
        } catch (error) {
            console.error('   ❌ Erro no backup de Mídia:', error.message);
        }
    }

    async backupMessageLogs() {
        console.log('\n📊 Backup de MessageLogs...');
        
        try {
            const logs = await MessageLog.find({})
                .sort({ timestamp: -1 })
                .limit(5000)
                .lean();
                
            console.log(`   📨 Consulta retornou: ${logs.length} logs`);
            
            const worksheet = this.workbook.addWorksheet('MessageLogs');
            
            worksheet.columns = [
                { header: 'ID', key: '_id', width: 25 },
                { header: 'Session', key: 'sessionName', width: 20 },
                { header: 'JID', key: 'jid', width: 30 },
                { header: 'Direção', key: 'direction', width: 10 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Timestamp', key: 'timestamp', width: 20 }
            ];

            logs.forEach(log => {
                worksheet.addRow({
                    _id: log._id.toString(),
                    sessionName: log.sessionName,
                    jid: log.jid,
                    direction: log.direction,
                    status: log.status,
                    timestamp: log.timestamp
                });
            });

            if (logs.length > 0) {
                worksheet.getRow(1).font = { bold: true };
            }
            
            console.log(`   ✅ ${logs.length} logs exportados`);
            
        } catch (error) {
            console.error('   ❌ Erro no backup de Logs:', error.message);
        }
    }

    async generateSummary() {
        console.log('\n📈 Gerando resumo...');
        
        try {
            const summarySheet = this.workbook.addWorksheet('Resumo');
            
            const counts = {
                users: await User.countDocuments(),
                instances: await WhatsAppInstance.countDocuments(),
                groups: await ContactGroup.countDocuments(),
                messageBatches: await MessageBatch.countDocuments(),
                mediaBatches: await MediaBatch.countDocuments(),
                logs: await MessageLog.countDocuments()
            };

            summarySheet.columns = [
                { header: 'Coleção', key: 'collection', width: 25 },
                { header: 'Total Registros', key: 'count', width: 15 }
            ];

            Object.entries(counts).forEach(([key, count]) => {
                const name = this.getCollectionName(key);
                summarySheet.addRow({ collection: name, count });
            });

            summarySheet.getRow(1).font = { bold: true };
            
            console.log('   ✅ Resumo gerado');
            console.log('   📊 Estatísticas finais:', counts);
            
        } catch (error) {
            console.error('   ❌ Erro no resumo:', error.message);
        }
    }

    getCollectionName(key) {
        const names = {
            users: 'Usuários',
            instances: 'Instâncias WhatsApp',
            groups: 'Grupos de Contatos',
            messageBatches: 'Lotes de Mensagens',
            mediaBatches: 'Lotes de Mídia',
            logs: 'Logs de Mensagens'
        };
        return names[key] || key;
    }
}

// Execução principal
async function main() {
    console.log('=' .repeat(60));
    console.log('🔍 MONGODB BACKUP DEBUG');
    console.log('⏰', new Date().toLocaleString('pt-BR'));
    console.log('=' .repeat(60));
    
    const backup = new MongoDBBackup();
    
    try {
        await backup.connectToDatabase();
        await backup.backupAllCollections();
        await backup.disconnectFromDatabase();
        
        console.log('\n' + '=' .repeat(60));
        console.log('🎉 PROCESSO CONCLUÍDO');
        console.log('=' .repeat(60));
        
    } catch (error) {
        console.error('\n💥 ERRO CRÍTICO:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = MongoDBBackup;