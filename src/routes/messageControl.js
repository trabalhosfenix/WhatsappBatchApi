// routes/messageControl.js
const express = require('express');
const router = express.Router();
const MessageControlService = require('../services/messageControlService');
const whatsappService = require('../services/whatsappService');

// Inicializar serviço
const messageControlService = new MessageControlService(whatsappService);

// ✅ ATIVAR RASTREIO DE MENSAGENS
router.post('/:sessionName/enable', async (req, res) => {
    try {
        const { sessionName } = req.params;
        
        const result = await messageControlService.enableMessageTracking(sessionName);
        
        res.json({
            success: true,
            message: `Rastreio de mensagens ativado para ${sessionName}`,
            ...result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// ✅ DESATIVAR RASTREIO DE MENSAGENS
router.post('/:sessionName/disable', async (req, res) => {
    try {
        const { sessionName } = req.params;
        
        const result = await messageControlService.disableMessageTracking(sessionName);
        
        res.json({
            success: true,
            message: `Rastreio de mensagens desativado para ${sessionName}`,
            ...result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// ✅ VERIFICAR STATUS DO RASTREIO
router.get('/:sessionName/status', async (req, res) => {
    try {
        const { sessionName } = req.params;
        
        const status = messageControlService.getTrackingStatus(sessionName);
        const connectionStatus = await whatsappService.isConnected(sessionName);
        
        res.json({
            success: true,
            sessionName,
            messageTracking: status,
            connectionStatus: connectionStatus
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// ✅ LISTAR TODOS OS RASTREIOS ATIVOS
router.get('/active', async (req, res) => {
    try {
        const activeTrackers = messageControlService.getActiveTrackers();
        
        res.json({
            success: true,
            ...activeTrackers
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;