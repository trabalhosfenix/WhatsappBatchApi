// 📁 routes/messageRoutes.js - CORRIGIR
const express = require('express');
const router = express.Router();
const UnifiedTrackingService = require('../services/unifiedTrackingService'); // ✅ MUDAR AQUI
const whatsappService = require('../services/whatsappService');
const { auth } = require('../middleware/auth');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const MessageLog = require('../models/MessageLog');

// ✅ USAR UNIFIED TRACKING SERVICE
const unifiedTrackingService = new UnifiedTrackingService(whatsappService);

router.use(auth);

// ✅ ATIVAR/REATIVAR TRACKING
router.post('/instances/:sessionName/tracking/enable', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user._id;
    
    const instance = await WhatsAppInstance.findOne({ sessionName, userId });
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const result = await unifiedTrackingService.enableTracking(
      sessionName,
      userId,
      instance._id,
      req.body.options || {}
    );
    
    res.json({
      success: true,
      message: `Tracking ${result.success ? 'ativado' : 'configurado'} para ${sessionName}`,
      ...result
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ DESATIVAR TRACKING
router.post('/instances/:sessionName/tracking/disable', async (req, res) => {
  try {
    const { sessionName } = req.params;
    
    const result = await unifiedTrackingService.disableTracking(sessionName);
    
    res.json({
      success: true,
      message: `Tracking desativado para ${sessionName}`,
      ...result
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ STATUS DO TRACKING
router.get('/instances/:sessionName/tracking/status', async (req, res) => {
  try {
    const { sessionName } = req.params;
    
    const trackingStatus = await unifiedTrackingService.getTrackingStatus(sessionName);
    const connectionStatus = await whatsappService.isConnected(sessionName);
    
    res.json({
      success: true,
      sessionName,
      tracking: trackingStatus,
      connection: connectionStatus
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ LISTAR TRACKINGS ATIVOS
router.get('/tracking/active', async (req, res) => {
  try {
    const activeTrackings = await unifiedTrackingService.getActiveTrackings();
    
    res.json({
      success: true,
      ...activeTrackings
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ ENVIAR MENSAGEM ÚNICA
router.post('/send', async (req, res) => {
  try {
    const { jid, message, instanceId, sessionName } = req.body;
    if (!jid || !message) {
      return res.status(400).json({ success: false, error: 'jid e message são obrigatórios' });
    }
    const userId = req.user._id;
    let instance = null;
    if (sessionName) {
      instance = await WhatsAppInstance.findOne({ sessionName, userId });
    } else if (instanceId) {
      instance = await WhatsAppInstance.findOne({ _id: instanceId, userId });
    }
    if (!instance) {
      return res.status(404).json({ success: false, error: 'Instância não encontrada' });
    }
    if (instance.status !== 'connected') {
      return res.status(400).json({ success: false, error: 'Instância não está conectada' });
    }
    const isConnected = await whatsappService.isConnected(instance.sessionName);
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Instância não está conectada (socket indisponível)' });
    }
    const result = await whatsappService.sendMessage(instance.sessionName, jid, message);
    try {
      await MessageLog.create({
        sessionName: instance.sessionName,
        jid,
        message,
        direction: 'outgoing',
        status: 'sent',
        messageId: result?.key?.id,
        senderName: 'me',
        timestamp: new Date()
      });
    } catch {}
    res.json({ success: true, messageId: result?.key?.id });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ✅ HISTÓRICO DE MENSAGENS
router.get('/history', async (req, res) => {
  try {
    const { jid, instanceId, sessionName } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    if (!jid) {
      return res.status(400).json({ success: false, error: 'jid é obrigatório' });
    }
    const userId = req.user._id;
    let instance = null;
    if (sessionName) {
      instance = await WhatsAppInstance.findOne({ sessionName, userId });
    } else if (instanceId) {
      instance = await WhatsAppInstance.findOne({ _id: instanceId, userId });
    }
    const filter = { jid };
    if (instance) filter.sessionName = instance.sessionName;
    const logs = await MessageLog.find(filter).sort({ timestamp: 1 }).limit(limit).lean();
    res.json({ success: true, messages: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;