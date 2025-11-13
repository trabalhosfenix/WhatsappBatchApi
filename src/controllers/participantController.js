// 📁 controllers/participantController.js
const Participant = require('../models/Participants.js');
const WhatsAppInstance = require('../models/WhatsAppInstance.js');

exports.getParticipants = async (req, res) => {
  try {
    const userId = req.user._id;

    const { 
      search = '',
      platform = '',
      group = '',
      sort = 'name',
      sessionName = ''
    } = req.query;

    // Construir query base
    let query = { user: userId };

    // Filtro por sessão específica
    if (sessionName) {
      // Aqui você precisaria relacionar sessionName com remoteJid ou criar um campo sessionName no Participant
      // Por enquanto, vou filtrar por remoteJid contendo a sessionName
      query.remoteJid = { $regex: sessionName, $options: 'i' };
    }

    // Filtro de busca
    if (search) {
      query.$or = [
        { pushName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { participantId: { $regex: search, $options: 'i' } }
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
      .limit(1000); // Limite para performance

    // Formatar dados para o frontend
    const formattedParticipants = participants.map(participant => ({
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
      // Campos para compatibilidade com o frontend
      isBusiness: false, // Você pode adicionar lógica para detectar business
      photo: null // Pode ser implementado depois
    }));

    // Estatísticas
    const totalContacts = participants.length;
    const activeContacts = participants.filter(p => p.isActive).length;
    const recentContacts = participants.filter(p => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return p.lastMessageTimestamp > oneWeekAgo;
    }).length;

    // Buscar instâncias conectadas
    const connectedInstances = await WhatsAppInstance.countDocuments({ 
      userId, 
      status: 'connected' 
    });

    res.json({
      success: true,
      participants: formattedParticipants,
      statistics: {
        totalContacts,
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

    // Filtro por remoteJid relacionado à sessão
    let query = { 
      user: userId,
      remoteJid: { $regex: sessionName, $options: 'i' }
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

    const formattedParticipants = participants.map(participant => ({
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
      isBusiness: false
    }));

    res.json({
      success: true,
      participants: formattedParticipants,
      total: participants.length,
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

    res.json({
      success: true,
      stats: {
        ...result,
        connectedInstances
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
    .select('pushName phoneNumber participantId lastMessageTimestamp messageCount');

    const formattedParticipants = participants.map(participant => ({
      id: participant._id,
      name: participant.pushName,
      phone: participant.phoneNumber,
      whatsappId: participant.participantId,
      lastActivity: participant.lastMessageTimestamp,
      messageCount: participant.messageCount,
      isActive: participant.isActive
    }));

    res.json({
      success: true,
      participants: formattedParticipants
    });

  } catch (error) {
    console.error('❌ Erro na busca de participants:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};