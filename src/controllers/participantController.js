// 📁 controllers/participantController.js
// 📁 controllers/participantController.js - ATUALIZAR
const Participant = require('../models/Participants.js');
const WhatsAppInstance = require('../models/WhatsAppInstance.js');
const ContactGroup = require('../models/ContactGroup.js'); // ✅ ADICIONAR IMPORT

exports.getParticipants = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log('🔍 DEBUG - Buscando participants para userId:', userId);

    const { 
      search = '',
      platform = '',
      group = '',
      sort = 'name',
      sessionName = '',
      source = '', // ✅ NOVO: Filtro por source
      page = 1,
      limit = 50
    } = req.query;

    // Converter para números
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Construir query base
    let query = { user: userId };

    console.log('🔍 DEBUG - Query base:', query);

    // ✅ NOVO: Filtro por source (manual/whatsapp)
    if (source) {
      if (source === 'manual') {
        query.remoteJid = { $regex: '@manual', $options: 'i' };
      } else if (source === 'whatsapp') {
        query.remoteJid = { $not: { $regex: '@manual', $options: 'i' } };
      }
      console.log('🔍 DEBUG - Query com source filter:', query);
    }

    // Filtro por sessão específica
    if (sessionName && sessionName.trim() !== '') {
      query.remoteJid = { $regex: sessionName, $options: 'i' };
      console.log('🔍 DEBUG - Query com sessionName:', query);
    }

    // Filtro de busca
    if (search && search.trim() !== '') {
      query.$or = [
        { pushName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { participantId: { $regex: search, $options: 'i' } }
      ];
      console.log('🔍 DEBUG - Query com search:', query);
    }

    // Ordenação
    let sortOptions = {};
    switch (sort) {
      case 'name':
        sortOptions.pushName = 1;
        break;
      case 'recent':
        sortOptions.lastMessageTimestamp = -1;
        break;
      case 'activity':
        sortOptions.messageCount = -1;
        break;
      default:
        sortOptions.pushName = 1;
    }

    console.log('🔍 DEBUG - Ordenação:', sortOptions);
    console.log('🔍 DEBUG - Paginação:', { page: pageNum, limit: limitNum, skip });

    // Executar query com paginação
    const [participants, totalCount] = await Promise.all([
      Participant.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select('-__v'),
      Participant.countDocuments(query)
    ]);

    console.log('🔍 DEBUG - Participants encontrados:', participants.length);
    console.log('🔍 DEBUG - Total count:', totalCount);

    // Calcular total de páginas
    const totalPages = Math.ceil(totalCount / limitNum);

    // Processar participantes
    const participantsWithGroupsAndSource = await Promise.all(
      participants.map(async (participant) => {
        try {
          // Determinar se é manual ou whatsapp baseado no remoteJid
          const isManual = participant.remoteJid.includes('@manual');
          const source = isManual ? 'manual' : 'whatsapp';
          
          // Buscar grupos apenas para contatos do WhatsApp
          let groups = [];
          let groupCount = 0;
          let adminGroups = 0;
          
          if (!isManual) {
            const whatsappGroups = await ContactGroup.find({
              userId: userId,
              'contacts.whatsappId': participant.participantId,
              source: 'whatsapp'
            }).select('name jid groupMetadata.participants');

            groups = whatsappGroups.map(group => {
              const groupParticipant = (group.groupMetadata?.participants || []).find(
                p => p.id === participant.participantId
              );
              
              return {
                id: group._id,
                jid: group.jid,
                name: group.name,
                role: groupParticipant?.type || 'member'
              };
            });

            groupCount = groups.length;
            adminGroups = groups.filter(g => 
              g.role === 'admin' || g.role === 'superadmin'
            ).length;
          }

          return {
            id: participant._id,
            participantId: participant.participantId,
            name: participant.pushName,
            phone: participant.phoneNumber,
            whatsappId: participant.participantId,
            remoteJid: participant.remoteJid,
            lastActivity: participant.lastMessageTimestamp,
            messageCount: participant.messageCount,
            isActive: participant.isActive,
            source: source,
            isBusiness: false,
            groups: groups,
            groupCount: groupCount,
            adminGroups: adminGroups
          };
        } catch (error) {
          console.error(`❌ Erro ao processar participante ${participant.participantId}:`, error);
          
          // Determinar source mesmo em caso de erro
          const isManual = participant.remoteJid.includes('@manual');
          const source = isManual ? 'manual' : 'whatsapp';
          
          return {
            id: participant._id,
            participantId: participant.participantId,
            name: participant.pushName,
            phone: participant.phoneNumber,
            whatsappId: participant.participantId,
            remoteJid: participant.remoteJid,
            lastActivity: participant.lastMessageTimestamp,
            messageCount: participant.messageCount,
            isActive: participant.isActive,
            source: source,
            isBusiness: false,
            groups: [],
            groupCount: 0,
            adminGroups: 0
          };
        }
      })
    );

    // Estatísticas atualizadas
    const totalContacts = totalCount;
    const whatsappContacts = await Participant.countDocuments({ 
      user: userId, 
      remoteJid: { $not: { $regex: '@manual', $options: 'i' } } 
    });
    const manualContacts = await Participant.countDocuments({ 
      user: userId, 
      remoteJid: { $regex: '@manual', $options: 'i' } 
    });
    const activeContacts = await Participant.countDocuments({ 
      user: userId, 
      isActive: true 
    });
    const recentContacts = await Participant.countDocuments({ 
      user: userId,
      lastMessageTimestamp: { 
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
      }
    });

    // Buscar instâncias conectadas
    const connectedInstances = await WhatsAppInstance.countDocuments({ 
      userId, 
      status: 'connected' 
    });

    console.log('🔍 DEBUG - Estatísticas:', {
      totalContacts,
      whatsappContacts,
      manualContacts,
      activeContacts,
      recentContacts,
      connectedInstances
    });

    res.json({
      success: true,
      participants: participantsWithGroupsAndSource,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      statistics: {
        totalContacts,
        whatsappContacts,
        manualContacts,
        activeContacts,
        recentContacts,
        connectedInstances
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar participants:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Adicione esta função no participantController.js
exports.getParticipantsByInstanceFilter = async (req, res) => {
  try {
    const userId = req.user._id;
    const { instance: sessionName } = req.query;

    console.log('🔍 DEBUG - Filtrando por instância:', sessionName);

    if (!sessionName || sessionName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nome da instância é obrigatório'
      });
    }

    // Verificar se a instância existe e pertence ao usuário
    const instance = await WhatsAppInstance.findOne({ 
      sessionName, 
      userId 
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada ou não pertence ao usuário'
      });
    }

    // Buscar grupos desta instância
    const groups = await ContactGroup.find({
      userId: userId,
      whatsappInstance: sessionName
    }).select('jid');

    const groupJids = groups.map(g => g.jid);

    // Buscar participantes que estão nesses grupos
    const participants = await Participant.find({
      user: userId,
      remoteJid: { $in: groupJids }
    })
    .sort({ pushName: 1 })
    .select('-__v')
    .limit(1000);

    console.log('🔍 DEBUG - Participants encontrados para instância:', participants.length);

    const participantsWithDetails = await Promise.all(
      participants.map(async (participant) => {
        try {
          const isManual = participant.remoteJid.includes('@manual');
          const source = isManual ? 'manual' : 'whatsapp';
          
          let groups = [];
          let groupCount = 0;
          let adminGroups = 0;
          
          if (!isManual) {
            const whatsappGroups = await ContactGroup.find({
              userId: userId,
              'contacts.whatsappId': participant.participantId,
              source: 'whatsapp',
              whatsappInstance: sessionName
            }).select('name jid groupMetadata.participants');

            groups = whatsappGroups.map(group => {
              const groupParticipant = (group.groupMetadata?.participants || []).find(
                p => p.id === participant.participantId
              );
              
              return {
                id: group._id,
                jid: group.jid,
                name: group.name,
                role: groupParticipant?.type || 'member'
              };
            });

            groupCount = groups.length;
            adminGroups = groups.filter(g => 
              g.role === 'admin' || g.role === 'superadmin'
            ).length;
          }

          return {
            id: participant._id,
            participantId: participant.participantId,
            name: participant.pushName,
            phone: participant.phoneNumber,
            whatsappId: participant.participantId,
            remoteJid: participant.remoteJid,
            lastActivity: participant.lastMessageTimestamp,
            messageCount: participant.messageCount,
            isActive: participant.isActive,
            source: source,
            isBusiness: false,
            groups: groups,
            groupCount: groupCount,
            adminGroups: adminGroups
          };
        } catch (error) {
          console.error(`❌ Erro ao processar participante ${participant.participantId}:`, error);
          
          const isManual = participant.remoteJid.includes('@manual');
          const source = isManual ? 'manual' : 'whatsapp';
          
          return {
            id: participant._id,
            participantId: participant.participantId,
            name: participant.pushName,
            phone: participant.phoneNumber,
            whatsappId: participant.participantId,
            remoteJid: participant.remoteJid,
            lastActivity: participant.lastMessageTimestamp,
            messageCount: participant.messageCount,
            isActive: participant.isActive,
            source: source,
            isBusiness: false,
            groups: [],
            groupCount: 0,
            adminGroups: 0
          };
        }
      })
    );

    res.json({
      success: true,
      participants: participantsWithDetails,
      total: participantsWithDetails.length,
      sessionName,
      statistics: {
        total: participantsWithDetails.length,
        whatsapp: participantsWithDetails.filter(p => p.source === 'whatsapp').length,
        manual: participantsWithDetails.filter(p => p.source === 'manual').length
      }
    });

  } catch (error) {
    console.error('❌ Erro ao filtrar participants por instância:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getParticipantsByInstance = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user._id;

    // Verificar se a instância pertence ao usuário
    const instance = await WhatsAppInstance.findOne({
      sessionName,
      userId
    });

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada ou não pertence ao usuário'
      });
    }

    const {
      search = '',
      sort = 'name'
    } = req.query;

    // Filtro por remoteJid relacionado à sessão (apenas WhatsApp)
    let query = {
      user: userId,
      remoteJid: { $regex: sessionName, $options: 'i' },
      remoteJid: { $not: { $regex: '@manual' } } // Excluir manuais
    };

    // Filtro de busca
    if (search) {
      query.$or = [
        { pushName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Ordenação
    let sortOptions = {};
    switch (sort) {
      case 'name':
        sortOptions.pushName = 1;
        break;
      case 'recent':
        sortOptions.lastMessageTimestamp = -1;
        break;
      case 'activity':
        sortOptions.messageCount = -1;
        break;
      default:
        sortOptions.pushName = 1;
    }

    const participants = await Participant.find(query)
      .sort(sortOptions)
      .select('-__v')
      .limit(500);

    const participantsWithGroups = await Promise.all(
      participants.map(async (participant) => {
        try {
          const groups = await ContactGroup.find({
            userId: userId,
            'contacts.whatsappId': participant.participantId,
            source: 'whatsapp'
          }).select('name jid groupMetadata.participants');

          const groupDetails = groups.map(group => {
            const groupParticipant = (group.groupMetadata?.participants || []).find(
              p => p.id === participant.participantId
            );

            return {
              id: group._id,
              jid: group.jid,
              name: group.name,
              role: groupParticipant?.type || 'member'
            };
          });

          const adminGroups = groupDetails.filter(g =>
            g.role === 'admin' || g.role === 'superadmin'
          ).length;

          return {
            id: participant._id,
            participantId: participant.participantId,
            name: participant.pushName,
            phone: participant.phoneNumber,
            whatsappId: participant.participantId,
            remoteJid: participant.remoteJid,
            lastActivity: participant.lastMessageTimestamp,
            messageCount: participant.messageCount,
            isActive: participant.isActive,
            // ✅ CORRIGIDO: Sempre whatsapp nesta rota
            source: 'whatsapp',
            isBusiness: false,
            groups: groupDetails,
            groupCount: groupDetails.length,
            adminGroups: adminGroups
          };
        } catch (error) {
          console.error(`❌ Erro ao buscar grupos para participante ${participant.participantId}:`, error);
          return {
            id: participant._id,
            participantId: participant.participantId,
            name: participant.pushName,
            phone: participant.phoneNumber,
            whatsappId: participant.participantId,
            remoteJid: participant.remoteJid,
            lastActivity: participant.lastMessageTimestamp,
            messageCount: participant.messageCount,
            isActive: participant.isActive,
            source: 'whatsapp',
            isBusiness: false,
            groups: [],
            groupCount: 0,
            adminGroups: 0
          };
        }
      })
    );

    res.json({
      success: true,
      participants: participantsWithGroups,
      total: participantsWithGroups.length,
      sessionName
    });

  } catch (error) {
    console.error('❌ Erro ao buscar participants da instância:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getParticipantStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Estatísticas gerais
    const stats = await Participant.aggregate([
      {
        $match: { user: userId }
      },
      {
        $group: {
          _id: null,
          totalContacts: { $sum: 1 },
          activeContacts: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          totalMessages: { $sum: '$messageCount' },
          recentActivity: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    '$lastMessageTimestamp',
                    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  ]
                },
                1,
                0
              ]
            }
          },
          avgMessagesPerContact: { $avg: '$messageCount' }
        }
      }
    ]);

    // ✅ NOVO: Estatísticas por tipo (manual vs whatsapp)
    const sourceStats = await Participant.aggregate([
      {
        $match: { user: userId }
      },
      {
        $addFields: {
          sourceType: {
            $cond: [
              { $regexMatch: { input: '$remoteJid', regex: '@manual' } },
              'manual',
              'whatsapp'
            ]
          }
        }
      },
      {
        $group: {
          _id: '$sourceType',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      totalContacts: 0,
      activeContacts: 0,
      totalMessages: 0,
      recentActivity: 0,
      avgMessagesPerContact: 0
    };

    // Buscar instâncias conectadas
    const connectedInstances = await WhatsAppInstance.countDocuments({
      userId,
      status: 'connected'
    });

    // Formatar estatísticas por source
    const sourceBreakdown = {
      whatsapp: { total: 0, active: 0 },
      manual: { total: 0, active: 0 }
    };

    sourceStats.forEach(stat => {
      if (stat._id === 'whatsapp') {
        sourceBreakdown.whatsapp.total = stat.count;
        sourceBreakdown.whatsapp.active = stat.active;
      } else if (stat._id === 'manual') {
        sourceBreakdown.manual.total = stat.count;
        sourceBreakdown.manual.active = stat.active;
      }
    });

    res.json({
      success: true,
      stats: {
        ...result,
        connectedInstances,
        sourceBreakdown // ✅ NOVO: Adicionar breakdown por tipo
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.createManualParticipant = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      name,
      phone,
      whatsappId,
      email,
      notes
    } = req.body;

    // Gerar participantId baseado no phone
    const participantId = whatsappId || `${phone.replace(/\D/g, '')}@s.whatsapp.net`;

    // Gerar remoteJid para contatos manuais
    const remoteJid = `manual_${Date.now()}@manual`;

    const participant = new Participant({
      participantId,
      phoneNumber: phone,
      pushName: name,
      remoteJid,
      user: userId,
      // Campos adicionais podem ser armazenados em um campo de metadados se necessário
      firstMessageTimestamp: new Date(),
      lastMessageTimestamp: new Date()
    });

    await participant.save();

    res.status(201).json({
      success: true,
      participant: {
        id: participant._id,
        participantId: participant.participantId,
        name: participant.pushName,
        phone: participant.phoneNumber,
        whatsappId: participant.participantId,
        lastActivity: participant.lastMessageTimestamp,
        messageCount: participant.messageCount,
        isActive: participant.isActive,
        source: 'manual'
      },
      message: 'Contato manual criado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao criar participant manual:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.searchParticipants = async (req, res) => {
  try {
    const userId = req.user._id;
    const { q: searchTerm } = req.query;

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({
        success: true,
        participants: []
      });
    }

    const participants = await Participant.find({
      user: userId,
      $or: [
        { pushName: { $regex: searchTerm, $options: 'i' } },
        { phoneNumber: { $regex: searchTerm, $options: 'i' } },
        { participantId: { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .sort({ lastMessageTimestamp: -1 })
      .limit(50)
      .select('pushName phoneNumber participantId remoteJid lastMessageTimestamp messageCount isActive');

    const participantsWithGroups = await Promise.all(
      participants.map(async (participant) => {
        try {
          // ✅ CORRIGIDO: Determinar source
          const isManual = participant.remoteJid.includes('@manual');
          const source = isManual ? 'manual' : 'whatsapp';

          let groups = [];
          let groupCount = 0;
          let adminGroups = 0;

          if (!isManual) {
            const whatsappGroups = await ContactGroup.find({
              userId: userId,
              'contacts.whatsappId': participant.participantId,
              source: 'whatsapp'
            }).select('name jid groupMetadata.participants');

            groups = whatsappGroups.map(group => {
              const groupParticipant = (group.groupMetadata?.participants || []).find(
                p => p.id === participant.participantId
              );

              return {
                id: group._id,
                jid: group.jid,
                name: group.name,
                role: groupParticipant?.type || 'member'
              };
            });

            groupCount = groups.length;
            adminGroups = groups.filter(g =>
              g.role === 'admin' || g.role === 'superadmin'
            ).length;
          }

          return {
            id: participant._id,
            name: participant.pushName,
            phone: participant.phoneNumber,
            whatsappId: participant.participantId,
            lastActivity: participant.lastMessageTimestamp,
            messageCount: participant.messageCount,
            isActive: participant.isActive,
            // ✅ CORRIGIDO: Usar source correto
            source: source,
            groups: groups,
            groupCount: groupCount,
            adminGroups: adminGroups
          };
        } catch (error) {
          console.error(`❌ Erro ao buscar grupos para participante ${participant.participantId}:`, error);

          const isManual = participant.remoteJid.includes('@manual');
          const source = isManual ? 'manual' : 'whatsapp';

          return {
            id: participant._id,
            name: participant.pushName,
            phone: participant.phoneNumber,
            whatsappId: participant.participantId,
            lastActivity: participant.lastMessageTimestamp,
            messageCount: participant.messageCount,
            isActive: participant.isActive,
            source: source,
            groups: [],
            groupCount: 0,
            adminGroups: 0
          };
        }
      })
    );

    res.json({
      success: true,
      participants: participantsWithGroups
    });

  } catch (error) {
    console.error('❌ Erro na busca de participants:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getParticipantGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const { participantId } = req.params;

    console.log('🔍 Buscando grupos para participante:', { userId, participantId });

    const groups = await ContactGroup.find({
      userId: userId,
      'contacts.whatsappId': participantId,
      source: 'whatsapp'
    }).select('name jid description groupMetadata participantCount isActive syncStatus contacts createdAt');

    console.log(`📊 Encontrados ${groups.length} grupos para o participante`);

    const formattedGroups = groups.map(group => {
      const participantInGroup = (group.contacts || []).find(contact =>
        contact.whatsappId === participantId
      );

      const groupParticipant = (group.groupMetadata?.participants || []).find(p =>
        p.id === participantId
      );

      return {
        id: group._id,
        jid: group.jid,
        name: group.name,
        description: group.description,
        participantCount: group.participantCount,
        role: groupParticipant?.type || 'member',
        joinedAt: participantInGroup?.lastInteraction || group.createdAt,
        isActive: group.isActive,
        syncStatus: group.syncStatus
      };
    });

    res.json({
      success: true,
      groups: formattedGroups,
      total: formattedGroups.length
    });

  } catch (error) {
    console.error('❌ Erro ao buscar grupos do participante:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.syncParticipantGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const { participantId } = req.params;

    const groups = await ContactGroup.find({
      userId: userId,
      'contacts.whatsappId': participantId,
      source: 'whatsapp'
    });

    const participant = await Participant.findOne({
      user: userId,
      participantId: participantId
    });

    if (participant) {
      participant.groups = groups.map(group => ({
        groupJid: group.jid,
        groupName: group.name,
        role: (group.groupMetadata?.participants || []).find(p => p.id === participantId)?.type || 'member',
        joinedAt: new Date(),
        isActive: group.isActive !== undefined ? group.isActive : true
      }));
      await participant.save();
    }

    res.json({
      success: true,
      message: 'Grupos sincronizados para o participante',
      groupsCount: groups.length,
      participant: participant ? { id: participant._id, groups: participant.groups } : null
    });

  } catch (error) {
    console.error('❌ Erro ao sincronizar grupos do participante:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createTestParticipants = async (req, res) => {
  try {
    const userId = req.user._id;

    const testParticipants = [
      {
        participantId: '5511999999999@s.whatsapp.net',
        phoneNumber: '5511999999999',
        pushName: 'João Silva',
        remoteJid: '5511999999999@s.whatsapp.net',
        user: userId
      },
      {
        participantId: '5511888888888@s.whatsapp.net',
        phoneNumber: '5511888888888',
        pushName: 'Maria Santos',
        remoteJid: '5511888888888@s.whatsapp.net',
        user: userId
      }
    ];

    const created = [];
    for (const participantData of testParticipants) {
      const participant = new Participant(participantData);
      await participant.save();
      created.push(participant);
    }

    res.json({
      success: true,
      message: `${created.length} participants de teste criados`,
      participants: created
    });

  } catch (error) {
    console.error('❌ Erro ao criar participants de teste:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};