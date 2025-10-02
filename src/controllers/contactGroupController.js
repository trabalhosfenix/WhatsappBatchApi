// 📁 controllers/contactGroupController.js - VERIFICAR SE ESTÁ COMPLETO
const ContactGroup = require('../models/ContactGroup');

exports.createContactGroup = async (req, res) => {
  try {
    const { name, description, contacts } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome do grupo é obrigatório' });
    }

    const existingGroup = await ContactGroup.findOne({
      name,
      userId: req.user._id
    });

    if (existingGroup) {
      return res.status(400).json({ error: 'Já existe um grupo com este nome' });
    }

    const contactGroup = await ContactGroup.create({
      userId: req.user._id,
      name,
      description: description || '',
      contacts: contacts || []
    });

    res.status(201).json({
      success: true,
      message: 'Grupo de contatos criado com sucesso',
      contactGroup
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ VERIFICAR SE ESTA FUNÇÃO EXISTE:
exports.getContactGroups = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const contactGroups = await ContactGroup.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ContactGroup.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      contactGroups,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.getContactGroup = async (req, res) => {
  try {
    const contactGroup = await ContactGroup.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!contactGroup) {
      return res.status(404).json({ error: 'Grupo de contatos não encontrado' });
    }

    res.json({
      success: true,
      contactGroup
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.updateContactGroup = async (req, res) => {
  try {
    const { name, description, contacts } = req.body;

    const contactGroup = await ContactGroup.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name, description, contacts },
      { new: true, runValidators: true }
    );

    if (!contactGroup) {
      return res.status(404).json({ error: 'Grupo de contatos não encontrado' });
    }

    res.json({
      success: true,
      message: 'Grupo de contatos atualizado com sucesso',
      contactGroup
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.deleteContactGroup = async (req, res) => {
  try {
    const contactGroup = await ContactGroup.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!contactGroup) {
      return res.status(404).json({ error: 'Grupo de contatos não encontrado' });
    }

    res.json({
      success: true,
      message: 'Grupo de contatos deletado com sucesso'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.addContactsToGroup = async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Lista de contatos é obrigatória' });
    }

    const contactGroup = await ContactGroup.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!contactGroup) {
      return res.status(404).json({ error: 'Grupo de contatos não encontrado' });
    }

    // Adicionar novos contatos
    contactGroup.contacts.push(...contacts);
    await contactGroup.save();

    res.json({
      success: true,
      message: `${contacts.length} contatos adicionados ao grupo`,
      contactGroup
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};