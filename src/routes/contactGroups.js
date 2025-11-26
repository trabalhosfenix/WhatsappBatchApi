// 📁 routes/contactGroups.js - ATUALIZAR
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const contactGroupController = require('../controllers/contactGroupController');

router.use(auth);

// Rotas existentes
router.get('/', contactGroupController.getContactGroups);
router.post('/', contactGroupController.createContactGroup);
router.get('/:id', contactGroupController.getContactGroup);
router.put('/:id', contactGroupController.updateContactGroup);
router.delete('/:id', contactGroupController.deleteContactGroup);
router.post('/:id/contacts', contactGroupController.addContactsToGroup);

// ✅ NOVAS ROTAS PARA GRUPOS POR INSTÂNCIA
router.get('/instance/:instanceId', contactGroupController.getGroupsByInstance);
router.post('/instance/:instanceId/sync', contactGroupController.syncInstanceGroups);
router.get('/filters/advanced', contactGroupController.getGroupsWithFilters);

// ✅ NOVAS ROTAS PARA GERENCIAR DUPLICAÇÃO
router.get('/debug/duplicates', contactGroupController.checkDuplicates);
router.delete('/cleanup/duplicates/instance/:instanceId', contactGroupController.cleanDuplicateGroups);
router.delete('/cleanup/duplicates', contactGroupController.cleanDuplicateGroups);

module.exports = router;