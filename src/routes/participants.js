// 📁 routes/participants.js
const express = require('express');
const { auth } = require('../middleware/auth.js');
const participantController = require('../controllers/participantController.js');

const router = express.Router();
router.use(auth);

// Rota principal para todos os participants do usuário
router.get('/', participantController.getParticipants);

// Participants por instância específica
router.get('/instances/:sessionName', participantController.getParticipantsByInstance);

// Estatísticas
router.get('/stats', participantController.getParticipantStats);

// Criar contato manual
router.post('/manual', participantController.createManualParticipant);

// Busca rápida
router.get('/search', participantController.searchParticipants);

module.exports = router;