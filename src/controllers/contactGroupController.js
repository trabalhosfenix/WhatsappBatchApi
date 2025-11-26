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
    const { instanceId } = req.params;
    const userId = req.user._id;

    const instance = await WhatsAppInstance.findOne({
      _id: instanceId,
      userId: userId
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    if (instance.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: 'Instância não está conectada'
      });
    }

    // ✅ VERIFICAR SE JÁ EXISTEM GRUPOS DESTA INSTÂNCIA
    const existingGroupsCount = await ContactGroup.countDocuments({
      userId: userId,
      whatsappInstanceId: instanceId,
      source: 'whatsapp'
    });

    console.log(`📊 [Sync] ${existingGroupsCount} grupos existentes para a instância ${instance.sessionName}`);

    // ✅ CHAMAR O SERVIÇO DO WHATSAPP PARA SINCRONIZAR
    const whatsappService = require('../services/whatsappService');
    const result = await whatsappService.loadGroupsFromWhatsApp(
      instance.sessionName,
      userId
    );

    // ✅ BUSCAR ESTATÍSTICAS ATUALIZADAS
    const totalGroups = await ContactGroup.countDocuments({
      userId: userId,
      whatsappInstanceId: instanceId,
      source: 'whatsapp'
    });

    res.json({
      success: true,
      message: `Sincronização concluída: ${result.total} grupos processados`,
      data: {
        ...result,
        existingBefore: existingGroupsCount,
        totalAfter: totalGroups,
        instance: {
          _id: instance._id,
          sessionName: instance.sessionName,
          status: instance.status
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao sincronizar grupos:', error);

    // ✅ TRATAR ERRO DE DUPLICATA DE FORMA ESPECÍFICA
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Conflito de duplicação detectado. Grupo já existe para esta instância.'
      });
    }

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

// 📁 controllers/contactGroupController.js - ADICIONAR MÉTODO DE LIMPEZA

/**
 * Limpar grupos duplicados (para uso administrativo)
 */
exports.cleanDuplicateGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const { instanceId } = req.params;

    console.log(`🧹 [Cleanup] Iniciando limpeza de duplicados para usuário: ${userId}`);

    // ✅ ENCONTRAR GRUPOS DUPLICADOS
    const duplicates = await ContactGroup.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          ...(instanceId && { whatsappInstanceId: mongoose.Types.ObjectId(instanceId) }),
          jid: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: { jid: "$jid", whatsappInstanceId: "$whatsappInstanceId" },
          count: { $sum: 1 },
          docs: { $push: "$_id" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`📊 [Cleanup] Encontrados ${duplicates.length} grupos com duplicatas`);

    let deletedCount = 0;

    // ✅ MANTER APENAS O GRUPO MAIS RECENTE DE CADA DUPLICATA
    for (const duplicate of duplicates) {
      // Manter o documento mais recente, deletar os outros
      const docsToKeep = duplicate.docs.slice(0, 1); // Primeiro documento (mais recente)
      const docsToDelete = duplicate.docs.slice(1); // Restante para deletar

      if (docsToDelete.length > 0) {
        await ContactGroup.deleteMany({
          _id: { $in: docsToDelete }
        });

        deletedCount += docsToDelete.length;
        console.log(`🗑️ [Cleanup] Deletados ${docsToDelete.length} duplicados do grupo ${duplicate._id.jid}`);
      }
    }

    res.json({
      success: true,
      message: `Limpeza concluída: ${deletedCount} grupos duplicados removidos`,
      data: {
        duplicatesFound: duplicates.length,
        deletedCount: deletedCount,
        remainingGroups: await ContactGroup.countDocuments({ userId: userId })
      }
    });

  } catch (error) {
    console.error('❌ Erro na limpeza de duplicados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Verificar duplicatas (para debug)
 */
exports.checkDuplicates = async (req, res) => {
  try {
    const userId = req.user._id;
    const { instanceId } = req.query;

    const duplicates = await ContactGroup.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          ...(instanceId && { whatsappInstanceId: mongoose.Types.ObjectId(instanceId) }),
          jid: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: { jid: "$jid", whatsappInstanceId: "$whatsappInstanceId" },
          count: { $sum: 1 },
          groups: {
            $push: {
              _id: "$_id",
              name: "$name",
              createdAt: "$createdAt",
              updatedAt: "$updatedAt"
            }
          }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalDuplicates: duplicates.length,
        duplicates: duplicates
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar duplicatas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};