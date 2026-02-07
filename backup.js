// 📁 backup.js (na raiz do projeto)
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// ✅ CORREÇÃO: Importar modelos com caminhos absolutos
const User = require('./src/models/User');
const WhatsAppInstance = require('./src/models/WhatsAppInstance');
const ContactGroup = require('./src/models/ContactGroup');
const MessageBatch = require('./src/models/MessageBatch');
const MediaBatch = require('./src/models/MediaBatch');
const MessageLog = require('./src/models/MessageLog');

console.log('🚀 Iniciando script de backup...');

class MongoDBBackup {
    constructor() {
        this.backupDir = path.join(process.cwd(), 'backups');
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.workbook = new ExcelJS.Workbook();
        
        // Garantir que o diretório de backups existe
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log(`📁 Diretório de backups criado: ${this.backupDir}`);
        }
    }

    async connectToDatabase() {
        try {
            // ✅ Use sua string de conexão do MongoDB
            const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-batch-api';
            
            console.log(`🔗 Conectando ao MongoDB: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
            
            await mongoose.connect(MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            
            console.log('✅ Conectado ao MongoDB com sucesso');
        } catch (error) {
            console.error('❌ Erro ao conectar ao MongoDB:', error.message);
            throw error;
        }
    }

    async disconnectFromDatabase() {
        await mongoose.disconnect();
        console.log('✅ Desconectado do MongoDB');
    }

    async backupAllCollections() {
        try {
            console.log('🔄 Iniciando backup de todas as coleções...');

            // Backup de cada coleção
            await this.backupUsers();
            await this.backupWhatsAppInstances();
            await this.backupContactGroups();
            await this.backupMessageBatches();
            await this.backupMediaBatches();
            await this.backupMessageLogs();
            await this.generateSummary();

            // Salvar o arquivo Excel
            const filename = `mongo-backup-${this.timestamp}.xlsx`;
            const filepath = path.join(this.backupDir, filename);
            
            await this.workbook.xlsx.writeFile(filepath);
            
            console.log(`\n🎉 BACKUP CONCLUÍDO: ${filepath}`);
            return filepath;

        } catch (error) {
            console.error('❌ Erro durante o backup:', error);
            throw error;
        }
    }

    async backupUsers() {
        console.log('📊 Fazendo backup de usuários...');
        
        const worksheet = this.workbook.addWorksheet('Users');
        const users = await User.find({}).lean();

        // Cabeçalhos
        worksheet.columns = [
            { header: 'ID', key: '_id', width: 25 },
            { header: 'Nome', key: 'name', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Role', key: 'role', width: 10 },
            { header: 'Ativo', key: 'isActive', width: 8 },
            { header: 'Criado em', key: 'createdAt', width: 20 },
            { header: 'Atualizado em', key: 'updatedAt', width: 20 }
        ];

        // Dados
        users.forEach(user => {
            worksheet.addRow({
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            });
        });

        // Estilizar cabeçalho
        worksheet.getRow(1).font = { bold: true };
        console.log(`✅ ${users.length} usuários exportados`);
    }

    async backupWhatsAppInstances() {
        console.log('📊 Fazendo backup de instâncias WhatsApp...');
        
        const worksheet = this.workbook.addWorksheet('WhatsAppInstances');
        const instances = await WhatsAppInstance.find({})
            .populate('userId', 'name email')
            .lean();

        worksheet.columns = [
            { header: 'ID', key: '_id', width: 25 },
            { header: 'Usuário ID', key: 'userId', width: 25 },
            { header: 'Nome Usuário', key: 'userName', width: 20 },
            { header: 'Session Name', key: 'sessionName', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Número', key: 'phoneNumber', width: 15 },
            { header: 'Ativa', key: 'isActive', width: 8 },
            { header: 'Última Conexão', key: 'lastConnection', width: 20 },
            { header: 'Criado em', key: 'createdAt', width: 20 }
        ];

        instances.forEach(instance => {
            worksheet.addRow({
                _id: instance._id.toString(),
                userId: instance.userId?._id?.toString() || 'N/A',
                userName: instance.userId?.name || 'N/A',
                sessionName: instance.sessionName,
                status: instance.status,
                phoneNumber: instance.phoneNumber || 'N/A',
                isActive: instance.isActive,
                lastConnection: instance.lastConnection,
                createdAt: instance.createdAt
            });
        });

        worksheet.getRow(1).font = { bold: true };
        console.log(`✅ ${instances.length} instâncias exportadas`);
    }

    async backupContactGroups() {
        console.log('📊 Fazendo backup de grupos de contatos...');
        
        const worksheet = this.workbook.addWorksheet('ContactGroups');
        const groups = await ContactGroup.find({})
            .populate('userId', 'name email')
            .populate('whatsappInstanceId', 'sessionName')
            .lean();

        worksheet.columns = [
            { header: 'ID', key: '_id', width: 25 },
            { header: 'Usuário ID', key: 'userId', width: 25 },
            { header: 'Nome Usuário', key: 'userName', width: 20 },
            { header: 'Instância ID', key: 'whatsappInstanceId', width: 25 },
            { header: 'Nome Instância', key: 'instanceName', width: 20 },
            { header: 'Nome Grupo', key: 'name', width: 25 },
            { header: 'Descrição', key: 'description', width: 30 },
            { header: 'JID', key: 'jid', width: 30 },
            { header: 'Fonte', key: 'source', width: 12 },
            { header: 'Total Contatos', key: 'contactCount', width: 12 },
            { header: 'Total Participantes', key: 'participantCount', width: 15 },
            { header: 'Criado em', key: 'createdAt', width: 20 }
        ];

        groups.forEach(group => {
            worksheet.addRow({
                _id: group._id.toString(),
                userId: group.userId?._id?.toString() || 'N/A',
                userName: group.userId?.name || 'N/A',
                whatsappInstanceId: group.whatsappInstanceId?._id?.toString() || 'N/A',
                instanceName: group.whatsappInstanceId?.sessionName || 'N/A',
                name: group.name,
                description: this.truncateText(group.description || '', 100),
                jid: group.jid || 'N/A',
                source: group.source,
                contactCount: group.contactCount,
                participantCount: group.participantCount,
                createdAt: group.createdAt
            });
        });

        worksheet.getRow(1).font = { bold: true };
        console.log(`✅ ${groups.length} grupos de contatos exportados`);
    }

    async backupMessageBatches() {
        console.log('📊 Fazendo backup de lotes de mensagens...');
        
        const worksheet = this.workbook.addWorksheet('MessageBatches');
        const batches = await MessageBatch.find({})
            .populate('userId', 'name email')
            .populate('whatsappInstanceId', 'sessionName')
            .populate('contactGroupIds', 'name')
            .lean();

        worksheet.columns = [
            { header: 'ID', key: '_id', width: 25 },
            { header: 'Usuário', key: 'userName', width: 20 },
            { header: 'Instância', key: 'instanceName', width: 20 },
            { header: 'Nome Lote', key: 'name', width: 25 },
            { header: 'Mensagem', key: 'message', width: 40 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Progresso (Enviadas/Total)', key: 'progress', width: 20 },
            { header: 'Grupos', key: 'groups', width: 30 },
            { header: 'Agendamento', key: 'schedule', width: 20 },
            { header: 'Criado em', key: 'createdAt', width: 20 }
        ];

        batches.forEach(batch => {
            const groupNames = batch.contactGroupIds?.map(g => g.name).join(', ') || 'N/A';
            
            worksheet.addRow({
                _id: batch._id.toString(),
                userName: batch.userId?.name || 'N/A',
                instanceName: batch.whatsappInstanceId?.sessionName || 'N/A',
                name: batch.name,
                message: this.truncateText(batch.message || '', 100),
                status: batch.status,
                progress: `${batch.progress?.sent || 0}/${batch.progress?.total || 0}`,
                groups: groupNames,
                schedule: batch.schedule || 'Imediato',
                createdAt: batch.createdAt
            });
        });

        worksheet.getRow(1).font = { bold: true };
        console.log(`✅ ${batches.length} lotes de mensagens exportados`);
    }

    async backupMediaBatches() {
        console.log('📊 Fazendo backup de lotes de mídia...');
        
        const worksheet = this.workbook.addWorksheet('MediaBatches');
        const batches = await MediaBatch.find({})
            .populate('userId', 'name email')
            .populate('whatsappInstanceId', 'sessionName')
            .populate('contactGroupIds', 'name')
            .lean();

        worksheet.columns = [
            { header: 'ID', key: '_id', width: 25 },
            { header: 'Usuário', key: 'userName', width: 20 },
            { header: 'Instância', key: 'instanceName', width: 20 },
            { header: 'Nome Lote', key: 'name', width: 25 },
            { header: 'Total Mídias', key: 'mediaCount', width: 12 },
            { header: 'Legenda', key: 'caption', width: 30 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Progresso', key: 'progress', width: 15 },
            { header: 'Grupos', key: 'groups', width: 30 },
            { header: 'Criado em', key: 'createdAt', width: 20 }
        ];

        batches.forEach(batch => {
            const groupNames = batch.contactGroupIds?.map(g => g.name).join(', ') || 'N/A';
            
            worksheet.addRow({
                _id: batch._id.toString(),
                userName: batch.userId?.name || 'N/A',
                instanceName: batch.whatsappInstanceId?.sessionName || 'N/A',
                name: batch.name,
                mediaCount: batch.mediaItems?.length || 0,
                caption: this.truncateText(batch.caption || '', 50),
                status: batch.status,
                progress: `${batch.progress?.sent || 0}/${batch.progress?.total || 0}`,
                groups: groupNames,
                createdAt: batch.createdAt
            });
        });

        worksheet.getRow(1).font = { bold: true };
        console.log(`✅ ${batches.length} lotes de mídia exportados`);
    }

    async backupMessageLogs() {
        console.log('📊 Fazendo backup de logs de mensagens...');
        
        const worksheet = this.workbook.addWorksheet('MessageLogs');
        
        // Limitar a 10.000 registros para não sobrecarregar
        const logs = await MessageLog.find({})
            .sort({ timestamp: -1 })
            .limit(10000)
            .lean();

        worksheet.columns = [
            { header: 'ID', key: '_id', width: 25 },
            { header: 'Session Name', key: 'sessionName', width: 20 },
            { header: 'JID', key: 'jid', width: 30 },
            { header: 'Mensagem', key: 'message', width: 30 },
            { header: 'Direção', key: 'direction', width: 10 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Tipo Mídia', key: 'mediaType', width: 15 },
            { header: 'Remetente', key: 'senderName', width: 20 },
            { header: 'Timestamp', key: 'timestamp', width: 20 },
            { header: 'Criado em', key: 'createdAt', width: 20 }
        ];

        logs.forEach(log => {
            worksheet.addRow({
                _id: log._id.toString(),
                sessionName: log.sessionName,
                jid: log.jid,
                message: this.truncateText(log.message || '', 50),
                direction: log.direction,
                status: log.status,
                mediaType: log.mediaType || 'Texto',
                senderName: log.senderName || 'N/A',
                timestamp: log.timestamp,
                createdAt: log.createdAt
            });
        });

        worksheet.getRow(1).font = { bold: true };
        console.log(`✅ ${logs.length} logs de mensagens exportados (limitado a 10.000)`);
    }

    async generateSummary() {
        console.log('📈 Gerando resumo do backup...');
        
        const summarySheet = this.workbook.addWorksheet('Resumo');
        
        const userCount = await User.countDocuments();
        const instanceCount = await WhatsAppInstance.countDocuments();
        const groupCount = await ContactGroup.countDocuments();
        const messageBatchCount = await MessageBatch.countDocuments();
        const mediaBatchCount = await MediaBatch.countDocuments();
        const logCount = await MessageLog.countDocuments();

        summarySheet.columns = [
            { header: 'Coleção', key: 'collection', width: 25 },
            { header: 'Total Registros', key: 'count', width: 15 },
            { header: 'Backup Realizado', key: 'backupTime', width: 25 }
        ];

        summarySheet.addRow({ 
            collection: 'Usuários', 
            count: userCount,
            backupTime: new Date().toLocaleString('pt-BR')
        });
        summarySheet.addRow({ 
            collection: 'Instâncias WhatsApp', 
            count: instanceCount 
        });
        summarySheet.addRow({ 
            collection: 'Grupos de Contatos', 
            count: groupCount 
        });
        summarySheet.addRow({ 
            collection: 'Lotes de Mensagens', 
            count: messageBatchCount 
        });
        summarySheet.addRow({ 
            collection: 'Lotes de Mídia', 
            count: mediaBatchCount 
        });
        summarySheet.addRow({ 
            collection: 'Logs de Mensagens', 
            count: logCount 
        });

        summarySheet.getRow(1).font = { bold: true };
        console.log('✅ Resumo gerado');
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }
}

// Função principal
async function main() {
    console.log('🚀 INICIANDO BACKUP DO MONGODB');
    console.log('⏰', new Date().toLocaleString('pt-BR'));
    console.log('=' .repeat(50));
    
    const backup = new MongoDBBackup();
    
    try {
        await backup.connectToDatabase();
        const filepath = await backup.backupAllCollections();
        await backup.disconnectFromDatabase();
        
        console.log('\n' + '=' .repeat(50));
        console.log('🎉 BACKUP CONCLUÍDO COM SUCESSO!');
        console.log(`📁 Arquivo salvo em: ${filepath}`);
        console.log('⏰', new Date().toLocaleString('pt-BR'));
        
    } catch (error) {
        console.error('\n💥 ERRO DURANTE O BACKUP:');
        console.error(error.message);
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = MongoDBBackup;