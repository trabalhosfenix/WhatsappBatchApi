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

// 📁 controllers/contactGroupController.js - ADICIONAR ESTES MÉTODOS

/**
 * Buscar grupos por instância do WhatsApp
 */
exports.getGroupsByInstance = async (req, res) => {
  try {
    const { instanceId } = req.params;
    const userId = req.user._id;

    const groups = await ContactGroup.find({
      userId: userId,
      whatsappInstanceId: instanceId,
      source: 'whatsapp' // Apenas grupos do WhatsApp
    }).select('name description contactCount participantCount jid syncStatus lastSync')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: groups,
      total: groups.length
    });

  } catch (error) {
    console.error('❌ Erro ao buscar grupos por instância:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar grupos'
    });
  }
};

/**
 * Sincronizar grupos de uma instância específica
 */
// 📁 controllers/whatsappController.js - ADICIONAR MÉTODOS

/**
 * Sincronizar grupos de uma instância específica
 */
exports.syncInstanceGroups = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const instance = await WhatsAppInstance.findOne({
      _id: id,
      userId: userId
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const result = await whatsappService.loadGroupsFromWhatsApp(
      instance.sessionName,
      userId
    );

    res.json({
      success: true,
      message: `${result.total} grupos sincronizados`,
      data: result
    });

  } catch (error) {
    console.error('❌ Erro ao sincronizar grupos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Buscar grupos filtrados por instância
 */
exports.getFilteredGroups = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { search, page = 1, limit = 50 } = req.query;

    const filters = {
      userId: userId,
      whatsappInstanceId: id
    };

    if (search) {
      filters.name = { $regex: search, $options: 'i' };
    }

    const groups = await ContactGroup.find(filters)
      .select('name description contactCount participantCount jid syncStatus lastSync')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ContactGroup.countDocuments(filters);

    res.json({
      success: true,
      data: groups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar grupos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar grupos'
    });
  }
};

/**
 * Buscar grupos com filtros avançados
 */
exports.getGroupsWithFilters = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      instanceId,
      source,
      search,
      page = 1,
      limit = 50
    } = req.query;

    // Construir filtros
    const filters = { userId };

    if (instanceId) {
      filters.whatsappInstanceId = instanceId;
    }

    if (source) {
      filters.source = source;
    }

    if (search) {
      filters.name = { $regex: search, $options: 'i' };
    }

    // Paginação
    const skip = (page - 1) * limit;

    const groups = await ContactGroup.find(filters)
      .select('name description contactCount participantCount jid source syncStatus lastSync whatsappInstanceId')
      .populate('whatsappInstanceId', 'sessionName status')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ContactGroup.countDocuments(filters);

    res.json({
      success: true,
      data: groups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar grupos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar grupos'
    });
  }
};