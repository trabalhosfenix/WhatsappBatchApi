// 📁 routes/contactRoutes.js (unificado)
const express = require('express');
const { auth } = require('../middleware/auth');
const ContactEnrichmentService = require('../services/contactEnrichmentService');
const whatsappService = require('../services/whatsappService');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const ContactCache = require('../models/ContactCache');

const router = express.Router();
const contactEnrichmentService = new ContactEnrichmentService(whatsappService);

router.use(auth);

// ✅ CONTATOS DA INSTÂNCIA (do contactCache.js)
router.get('/instances/:sessionName/contacts', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user._id;

    // Buscar contatos enriquecidos do tracking
    const contacts = await contactEnrichmentService.getAllEnrichedContacts(sessionName);
    
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

// ✅ ESTATÍSTICAS (unifica contactCache + contactTracker)
router.get('/instances/:sessionName/stats', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user._id;

    const instance = await WhatsAppInstance.findOne({ sessionName, userId });
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada'
      });
    }
    
    const contactCache = await ContactCache.findOne({
      sessionName,
      userId
    });
    
    // Contatos enriquecidos do tracking
    const enrichedContacts = await contactEnrichmentService.getAllEnrichedContacts(sessionName);
    
    const stats = {
      // Do cache
      totalContacts: contactCache?.totalContacts || 0,
      contactsWithProfile: contactCache?.contactsWithProfile || 0,
      businessContacts: contactCache?.businessContacts || 0,
      lastSynced: contactCache?.lastSynced,
      
      // Do tracking em tempo real
      trackedContacts: enrichedContacts.length,
      contactsWithRecentActivity: enrichedContacts.filter(c => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return c.lastActivity && c.lastActivity > oneDayAgo;
      }).length,
      
      sessionStatus: instance.status
    };
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ BUSCAR CONTATO ESPECÍFICO (do contactTracker.js)
router.get('/instances/:sessionName/contacts/:jid', async (req, res) => {
  try {
    const { sessionName, jid } = req.params;
    
    const contact = await contactEnrichmentService.getEnrichedContact(sessionName, jid);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }
    
    res.json({
      success: true,
      contact
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ LIMPAR CACHE (do contactCache.js)
router.delete('/instances/:sessionName/cache', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user._id;

    await ContactCache.findOneAndDelete({ sessionName, userId });
    
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

// ✅ FORÇAR ATUALIZAÇÃO DE CONTATO (do contactTracker.js)
router.post('/instances/:sessionName/contacts/:jid/refresh', async (req, res) => {
  try {
    const { sessionName, jid } = req.params;
    
    // Implementação simplificada - você pode expandir depois
    await contactEnrichmentService.forceRefreshContact(sessionName, jid);
    
    res.json({
      success: true,
      message: 'Contato atualizado com sucesso'
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;