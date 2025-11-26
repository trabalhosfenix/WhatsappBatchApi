// 📁 routes/whatsapp.js
const express = require('express');
const { auth } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');


const router = express.Router();

// Todas as rotas exigem autenticação
router.use(auth);

// Instâncias
router.post('/instances', whatsappController.createInstance);
router.get('/instances', whatsappController.getInstances);
router.get('/instances/:id', whatsappController.getInstance);
router.delete('/instances/:sessionName', whatsappController.deleteInstance);

// QR Code e conexão
router.get('/instances/:id/qrcode', whatsappController.getQRCode);
router.put('/instances/:id/disconnect', whatsappController.disconnectInstance);

// Grupos
router.post('/instances/:id/load-groups', whatsappController.loadGroups);
router.get('/instances/:id/groups', whatsappController.getGroups);

// Status
router.get('/instances/:id/status', whatsappController.getInstanceStatus);

// ✅ NOVAS ROTAS PARA GRUPOS POR INSTÂNCIA
// router.get('/instances/:id/groups/sync', whatsappController.syncInstanceGroups);
// router.get('/instances/:id/groups/filtered', whatsappController.getFilteredGroups);

module.exports = router;