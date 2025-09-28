const express = require('express');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Controladores temporários - vamos implementar depois
const createInstance = async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Instância WhatsApp criada (em desenvolvimento)',
      data: req.body 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getInstances = async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Lista de instâncias WhatsApp (em desenvolvimento)',
      data: [] 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getInstanceStatus = async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Status da instância (em desenvolvimento)',
      instanceId: req.params.id 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

router.use(auth);

router.post('/instances', createInstance);
router.get('/instances', getInstances);
router.get('/instances/:id/status', getInstanceStatus);

module.exports = router;