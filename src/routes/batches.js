// 📁 routes/batches.js
const express = require('express');
const { 
  createBatch, 
  getBatches, 
  getBatch, 
  cancelBatch 
} = require('../controllers/batchController');
const { auth } = require('../middleware/auth');
// ✅ CORREÇÃO: Adicionar imports faltantes
const WhatsAppInstance = require('../models/WhatsAppInstance');
const whatsappBaileysService = require('../services/whatsappService');

const router = express.Router();

router.use(auth);

router.post('/', createBatch);
router.get('/', getBatches);
router.get('/:id', getBatch);
router.put('/:id/cancel', cancelBatch);

// ✅ CORREÇÃO: Rota de debug com imports corretos
router.get('/debug/socket/:instanceId', async (req, res) => {
  try {
    const instance = await WhatsAppInstance.findOne({
      _id: req.params.instanceId,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({ 
        success: false,
        error: 'Instância não encontrada' 
      });
    }

    const socketInfo = await whatsappBaileysService.debugSocket(instance.sessionName);
    
    res.json({
      success: true,
      instance: instance.sessionName,
      socketInfo: socketInfo ? 'Socket encontrado' : 'Socket não encontrado',
      socketsAvailable: Array.from(whatsappBaileysService.sockets.keys())
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;