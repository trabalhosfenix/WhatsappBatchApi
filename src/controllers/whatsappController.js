const WhatsAppInstance = require('../models/WhatsAppInstance');
const whatsappService = require('../services/whatsappService');

exports.createInstance = async (req, res) => {
  try {
    const { sessionName } = req.body;

    const existingInstance = await WhatsAppInstance.findOne({
      sessionName,
      userId: req.user._id
    });

    if (existingInstance) {
      return res.status(400).json({ error: 'Já existe uma instância com este nome' });
    }

    const instance = await whatsappService.createClient(sessionName, req.user._id);

    res.status(201).json({
      success: true,
      instance,
      message: 'Instância criada. Escaneie o QR code para conectar.'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.getInstances = async (req, res) => {
  try {
    const instances = await WhatsAppInstance.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      instances
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.getInstanceStatus = async (req, res) => {
  try {
    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const status = await whatsappService.getClientStatus(instance.sessionName);

    res.json({
      success: true,
      instance: {
        ...instance.toObject(),
        realTimeStatus: status
      }
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.disconnectInstance = async (req, res) => {
  try {
    const instance = await WhatsAppInstance.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    // TODO: Implementar desconexão no serviço
    instance.status = 'disconnected';
    instance.qrCode = null;
    await instance.save();

    res.json({
      success: true,
      message: 'Instância desconectada com sucesso'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.deleteInstance = async (req, res) => {
  try {
    const instance = await WhatsAppInstance.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    // TODO: Implementar limpeza no serviço

    res.json({
      success: true,
      message: 'Instância deletada com sucesso'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};