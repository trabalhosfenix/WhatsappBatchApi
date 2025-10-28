const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { auth } = require('../middleware/auth');
const mediaBatchController = require('../controllers/mediaBatchController');

const router = express.Router();

// Configurar multer para upload de arquivos
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 10 // Máximo 10 arquivos por upload
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

// ✅ CORREÇÃO: ENDPOINT PÚBLICO DEVE VIR ANTES DO MIDDLEWARE AUTH
// ✅ ENDPOINT PÚBLICO PARA MÍDIAS (SEM AUTH)
router.get('/public-media/:userId/:filename', async (req, res) => {
  try {
    const { userId, filename } = req.params;
    
    console.log('📁 Servindo arquivo público:', { userId, filename });

    // Construir caminho correto
    const projectRoot = path.join(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'src', 'uploads', 'media', userId, filename);
    
    console.log('🔍 Verificando arquivo em:', filePath);

    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado:', filePath);
      return res.status(404).json({
        success: false,
        error: 'Arquivo de mídia não encontrado'
      });
    }

    // Determinar o MIME type
    const mimeType = getMimeTypeFromFilename(filename);
    
    // Servir o arquivo diretamente
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 1 dia
    
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

// ✅ APÓS OS ENDPOINTS PÚBLICOS, APLICAR AUTH PARA OS DEMAIS
router.use(auth);

// ✅ ENDPOINT AUTENTICADO PARA BASE64 (SE NECESSÁRIO)
router.get('/media-file/:userId/:filename', async (req, res) => {
  try {
    const { userId, filename } = req.params;
    
    console.log('📁 Buscando arquivo:', { userId, filename });

    // Verificar se o usuário tem acesso a esta mídia
    if (req.user._id.toString() !== userId) {
      console.log('❌ Acesso negado:', { 
        userToken: req.user._id.toString(), 
        userFile: userId 
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a esta mídia'
      });
    }

    // Construir caminho correto
    const projectRoot = path.join(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'src', 'uploads', 'media', userId, filename);
    
    console.log('🔍 Verificando arquivo em:', filePath);

    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado:', filePath);
      
      // TENTAR CAMINHO ALTERNATIVO (caso esteja em outro local)
      const alternativePath = path.join(__dirname, '..', 'uploads', 'media', userId, filename);
      console.log('🔍 Tentando caminho alternativo:', alternativePath);
      
      if (fs.existsSync(alternativePath)) {
        console.log('✅ Arquivo encontrado no caminho alternativo');
        return serveFile(alternativePath, filename, res);
      }
      
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

// ✅ FUNÇÃO AUXILIAR PARA SERVIR O ARQUIVO
function serveFile(filePath, filename, res) {
  try {
    // Ler o arquivo e converter para base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64String = fileBuffer.toString('base64');
    
    // Determinar o MIME type
    const mimeType = getMimeTypeFromFilename(filename);
    
    console.log('✅ Arquivo carregado com sucesso:', {
      filename,
      mimeType,
      size: fileBuffer.length,
      path: filePath
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

// Função auxiliar para determinar MIME type
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

// Upload de mídias
router.post('/upload', upload.array('mediaFiles', 10), mediaBatchController.uploadMedia);

// Lotes de mídia
router.post('/batches', mediaBatchController.createMediaBatch);
router.get('/batches', mediaBatchController.getMediaBatches);
router.get('/batches/:id', mediaBatchController.getMediaBatch);
router.put('/batches/:id/cancel', mediaBatchController.cancelMediaBatch);

router.delete('/batches/:id', mediaBatchController.deleteMediaBatch);

module.exports = router;