// No seu routes/admin.js ou similar:

// 📁 routes/admin.js
const express = require('express');
const { auth } = require('../middleware/auth.js');
const User = require('../models/User');
const WhatsAppInstance = require('../models/WhatsAppInstance.js');
const Batch = require('../models/MediaBatch.js');

const router = express.Router();

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'Acesso negado. Apenas administradores.' 
        });
    }
    next();
};

router.use(auth);
router.use(requireAdmin);

// Estatísticas de usuários
router.get('/users/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ status: 'active' });
        const newUsers = await User.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });

        res.json({
            success: true,
            stats: {
                total: totalUsers,
                active: activeUsers,
                new: newUsers,
                growth: calculateGrowth() // Implementar cálculo de crescimento
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar todos os usuários
router.get('/users', async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            users: users
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Estatísticas de mensagens
router.get('/messages/stats', async (req, res) => {
    try {
        const batches = await Batch.find();
        
        let totalSent = 0;
        let totalFailed = 0;
        let totalContacts = 0;

        batches.forEach(batch => {
            totalSent += batch.sent || 0;
            totalFailed += batch.failed || 0;
            totalContacts += batch.totalContacts || 0;
        });

        const successRate = totalContacts > 0 ? 
            Math.round(((totalSent - totalFailed) / totalContacts) * 100) : 0;

        res.json({
            success: true,
            total: totalSent,
            failed: totalFailed,
            successRate: successRate
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Estatísticas gerais do sistema
router.get('/system/stats', async (req, res) => {
    try {
        const [
            totalUsers,
            totalInstances,
            connectedInstances,
            totalBatches,
            activeBatches
        ] = await Promise.all([
            User.countDocuments(),
            WhatsAppInstance.countDocuments(),
            WhatsAppInstance.countDocuments({ status: 'connected' }),
            Batch.countDocuments(),
            Batch.countDocuments({ status: { $in: ['pending', 'processing'] } })
        ]);

        res.json({
            success: true,
            stats: {
                users: totalUsers,
                instances: {
                    total: totalInstances,
                    connected: connectedInstances
                },
                batches: {
                    total: totalBatches,
                    active: activeBatches
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// routes/admin.js - Adicionar estas rotas

// Estatísticas de instâncias
router.get('/instances/stats', async (req, res) => {
    try {
        const totalInstances = await WhatsAppInstance.countDocuments();
        const connectedInstances = await WhatsAppInstance.countDocuments({ status: 'connected' });
        
        res.json({
            success: true,
            stats: {
                total: totalInstances,
                connected: connectedInstances,
                disconnected: totalInstances - connectedInstances
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar todas as instâncias com detalhes
router.get('/instances/detailed', async (req, res) => {
    try {
        const instances = await WhatsAppInstance.find()
            .populate('userId', 'name email')
            .select('sessionName status userId createdAt')
            .sort({ createdAt: -1 });

        // Adicionar contadores de grupos e contatos
        const instancesWithCounts = await Promise.all(
            instances.map(async (instance) => {
                const groupsCount = await ContactGroup.countDocuments({ 
                    whatsappInstanceId: instance._id 
                });
                const contactsCount = await ContactCache.countDocuments({
                    sessionName: instance.sessionName
                });

                return {
                    ...instance.toObject(),
                    groupsCount,
                    contactsCount
                };
            })
        );

        res.json({
            success: true,
            instances: instancesWithCounts
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;