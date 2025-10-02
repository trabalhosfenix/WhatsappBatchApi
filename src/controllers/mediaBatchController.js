const MediaBatch = require('../models/MediaBatch');
const mediaService = require('../services/mediaService');

exports.createMediaBatch = async (req, res) => {
  try {
    const { name, mediaItems, contactGroupIds, whatsappInstanceId, options } = req.body;

    if (!name || !mediaItems || !contactGroupIds || !whatsappInstanceId) {
      return res.status(400).json({
        success: false,
        error: 'Nome, mídias, grupos de contatos e instância WhatsApp são obrigatórios'
      });
    }

    const batch = await mediaService.createMediaBatch({
      userId: req.user._id,
      whatsappInstanceId,
      name,
      mediaItems,
      contactGroupIds,
      options
    });

    res.status(201).json({
      success: true,
      message: 'Lote de mídia criado e processamento iniciado',
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        mediaCount: batch.mediaItems.length,
        createdAt: batch.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar lote de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.uploadMedia = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const mediaItems = [];

    for (const file of req.files) {
      const mediaItem = await mediaService.saveMediaFile(file, req.user._id);
      mediaItems.push(mediaItem);
    }

    res.json({
      success: true,
      message: `${mediaItems.length} arquivos de mídia salvos com sucesso`,
      mediaItems
    });

  } catch (error) {
    console.error('❌ Erro ao fazer upload de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getMediaBatches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const batches = await MediaBatch.find({ userId: req.user._id })
      .populate('whatsappInstanceId', 'sessionName phoneNumber')
      .populate('contactGroupIds', 'name contactCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MediaBatch.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      batches: batches.map(batch => ({
        _id: batch._id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        mediaCount: batch.mediaItems.length,
        whatsappInstance: batch.whatsappInstanceId,
        contactGroups: batch.contactGroupIds,
        totalSends: batch.progress.total,
        sent: batch.progress.sent,
        failed: batch.progress.failed,
        createdAt: batch.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lotes de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getMediaBatch = async (req, res) => {
  try {
    const batch = await MediaBatch.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate('whatsappInstanceId', 'sessionName phoneNumber')
      .populate('contactGroupIds', 'name contactCount');

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote de mídia não encontrado'
      });
    }

    res.json({
      success: true,
      batch: {
        _id: batch._id,
        name: batch.name,
        mediaItems: batch.mediaItems,
        status: batch.status,
        progress: batch.progress,
        whatsappInstance: batch.whatsappInstanceId,
        contactGroups: batch.contactGroupIds,
        results: batch.results,
        options: batch.options,
        createdAt: batch.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lote de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.cancelMediaBatch = async (req, res) => {
  try {
    const batch = await MediaBatch.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        status: { $in: ['pending', 'processing'] }
      },
      {
        status: 'cancelled',
        $push: {
          results: {
            contact: 'Sistema',
            phone: 'N/A',
            mediaItem: 'Sistema',
            status: 'cancelled',
            error: 'Lote cancelado pelo usuário',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado ou não pode ser cancelado'
      });
    }

    res.json({
      success: true,
      message: 'Lote de mídia cancelado com sucesso',
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status
      }
    });
  } catch (error) {
    console.error('❌ Erro ao cancelar lote de mídia:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};