// 📁 routes/contactCache.js (novo arquivo)
const express = require('express');
const { auth } = require('../middleware/auth');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

// Buscar contatos de uma instância
router.get('/instances/:sessionName/contacts', auth, async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user._id;

    const contacts = await whatsappService.getInstanceContacts(sessionName, userId);
    
    res.json({
      success: true,
      contacts: contacts,
      total: contacts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Estatísticas dos contatos
router.get('/instances/:sessionName/contacts/stats', auth, async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user._id;

    const stats = await whatsappService.getContactsStats(sessionName, userId);
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Limpar cache de contatos
router.delete('/instances/:sessionName/contacts/cache', auth, async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user._id;

    await whatsappService.clearContactsCache(sessionName, userId);
    
    res.json({
      success: true,
      message: 'Cache de contatos limpo com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;