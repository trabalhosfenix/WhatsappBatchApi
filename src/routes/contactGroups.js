const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const contactGroupController = require('../controllers/contactGroupController');

// Aplicar middleware de autenticação em todas as rotas
router.get('/', auth, contactGroupController.getContactGroups);
router.post('/', auth, contactGroupController.createContactGroup);
router.get('/:id', auth, contactGroupController.getContactGroup);
router.put('/:id', auth, contactGroupController.updateContactGroup);
router.delete('/:id', auth, contactGroupController.deleteContactGroup);
router.post('/:id/contacts', auth, contactGroupController.addContactsToGroup);

module.exports = router;