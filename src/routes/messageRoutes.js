// 📁 routes/messageRoutes.js - CORRIGIR
const express = require('express');
const router = express.Router();
const UnifiedTrackingService = require('../services/unifiedTrackingService'); // ✅ MUDAR AQUI
const whatsappService = require('../services/whatsappService');
const { auth } = require('../middleware/auth');
const WhatsAppInstance = require('../models/WhatsAppInstance');

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

module.exports = router;