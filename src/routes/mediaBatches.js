const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { auth } = require('../middleware/auth');
const mediaBatchController = require('../controllers/mediaBatchController');

const router = express.Router();

// ✅ CONFIGURAÇÃO MULTER (MANTIDA)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mkv', 'video/quicktime',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'), false);
    }
  }
});

// ✅ ENDPOINT PÚBLICO PARA MÍDIAS (MANTIDO)
router.get('/public-media/:userId/:filename', async (req, res) => {
  try {
    const { userId, filename } = req.params;
    
    console.log('📁 Servindo arquivo público:', { userId, filename });

    const projectRoot = path.join(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'src', 'uploads', 'media', userId, filename);
    
    console.log('🔍 Verificando arquivo em:', filePath);

    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado:', filePath);
      return res.status(404).json({
        success: false,
        error: 'Arquivo de mídia não encontrado'
      });
    }

    const mimeType = getMimeTypeFromFilename(filename);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    console.log('✅ Arquivo público servido:', filename);

  } catch (error) {
    console.error('❌ Erro ao servir arquivo público:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar mídia'
    });
  }
});

// ✅ APLICAR AUTENTICAÇÃO
router.use(auth);

// ✅ ENDPOINT AUTENTICADO PARA BASE64 (OPCIONAL)
router.get('/media-file/:userId/:filename', async (req, res) => {
  try {
    const { userId, filename } = req.params;
    
    console.log('📁 Buscando arquivo:', { userId, filename });

    if (req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a esta mídia'
      });
    }

    const projectRoot = path.join(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'src', 'uploads', 'media', userId, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo de mídia não encontrado'
      });
    }

    return serveFile(filePath, filename, res);

  } catch (error) {
    console.error('❌ Erro ao obter mídia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ FUNÇÃO AUXILIAR PARA SERVIR ARQUIVO (MANTIDA)
function serveFile(filePath, filename, res) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64String = fileBuffer.toString('base64');
    const mimeType = getMimeTypeFromFilename(filename);
    
    console.log('✅ Arquivo carregado com sucesso:', {
      filename,
      mimeType,
      size: fileBuffer.length
    });

    res.json({
      success: true,
      data: `data:${mimeType};base64,${base64String}`,
      mimeType: mimeType,
      filename: filename
    });
  } catch (error) {
    console.error('❌ Erro ao servir arquivo:', error);
    throw error;
  }
}

// ✅ FUNÇÃO AUXILIAR MIME TYPE (MANTIDA)
function getMimeTypeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// ✅ ROTAS PRINCIPAIS DE MEDIA BATCH
router.post('/upload', upload.array('mediaFiles', 10), mediaBatchController.uploadMedia);
router.post('/batches', mediaBatchController.createMediaBatch);
router.get('/batches', mediaBatchController.getMediaBatches);
router.get('/batches/:id', mediaBatchController.getMediaBatch);
router.put('/batches/:id/cancel', mediaBatchController.cancelMediaBatch);
router.delete('/batches/:id', mediaBatchController.deleteMediaBatch);

// ✅ NOVA ROTA: STATUS DOS LIMITES
router.get('/rate-limit/:instanceId', mediaBatchController.getRateLimitStatus);

module.exports = router;