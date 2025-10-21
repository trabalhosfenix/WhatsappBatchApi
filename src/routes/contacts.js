// 📁 routes/contacts.js
const express = require('express');
const { auth } = require('../middleware/auth');
const contactGroupController = require('../controllers/contactGroupController');

const router = express.Router();
router.use(auth);

// Operações avançadas com contatos
router.get('/search', contactGroupController.searchAllContacts);
router.get('/statistics/overview', contactGroupController.getGlobalStatistics);
router.post('/import/csv', contactGroupController.importContactsFromCSV);
router.get('/export/csv', contactGroupController.exportContactsToCSV);

// Duplicatas opcionais - ou manter apenas no WhatsApp
router.post('/whatsapp/instances/:id/load-contacts', contactGroupController.loadContactsWithDetails);
router.get('/whatsapp/instances/:id/contacts/stats', contactGroupController.getContactsStatistics);

module.exports = router;