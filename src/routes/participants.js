// 📁 routes/participants.js
const express = require('express');
const { auth } = require('../middleware/auth.js');
const participantController = require('../controllers/participantController.js');
const Participant = require('../models/Participants.js'); // ✅ ADICIONAR
const WhatsAppInstance = require('../models/WhatsAppInstance.js'); // ✅ ADICIONAR

const router = express.Router();
router.use(auth);

// Rota principal para todos os participants do usuário
router.get('/', participantController.getParticipants);

// Participants por instância específica
router.get('/instances/:sessionName', participantController.getParticipantsByInstance);

// Estatísticas
router.get('/stats', participantController.getParticipantStats);

// Grupos específicos do participante
router.get('/:participantId/groups', participantController.getParticipantGroups);
// Sincronizar grupos do participante
router.post('/:participantId/groups/sync', participantController.syncParticipantGroups);

// Criar contato manual
router.post('/manual', participantController.createManualParticipant);

// Busca rápida
router.get('/search', participantController.searchParticipants);

// Rota temporária para debug - REMOVER DEPOIS
// Rota temporária para debug - ADICIONAR ESTA
router.get('/debug/check-data', async (req, res) => {
  try {
    const userId = req.user._id;    
    console.log('🔍 DEBUG - Verificando dados para userId:', userId);
        
    // Contar todos os participants do usuário
    const userParticipantsCount = await Participant.countDocuments({ user: userId });
    
    // Verificar alguns participants
    const sampleParticipants = await Participant.find({ user: userId }).limit(5);
    
    // Verificar todas as instâncias do usuário
    const userInstances = await WhatsAppInstance.find({ userId });
    
    res.json({
      success: true,
      debug: {
        userId: userId.toString(),
        userParticipantsCount,
        sampleParticipants: sampleParticipants.map(p => ({
          _id: p._id,
          participantId: p.participantId,
          pushName: p.pushName,
          phoneNumber: p.phoneNumber,
          user: p.user
        })),
        userInstances: userInstances.map(inst => ({
          sessionName: inst.sessionName,
          status: inst.status
        })),
        allParticipantsCount: await Participant.countDocuments({}),
        allInstancesCount: await WhatsAppInstance.countDocuments({})
      }
    });
  } catch (error) {
    console.error('❌ Erro na rota de debug:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// participants.js - adicione temporariamente
router.post('/debug/create-test', participantController.createTestParticipants);

router.get('/debug/test', (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Rota básica funcionando',
      userId: req.user._id.toString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;