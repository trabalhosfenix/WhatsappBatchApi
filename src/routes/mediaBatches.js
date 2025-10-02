const express = require('express');
const multer = require('multer');
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
    // Permitir apenas tipos de mídia comuns
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

router.use(auth);

// Upload de mídias
router.post('/upload', upload.array('mediaFiles', 10), mediaBatchController.uploadMedia);

// Lotes de mídia
router.post('/batches', mediaBatchController.createMediaBatch);
router.get('/batches', mediaBatchController.getMediaBatches);
router.get('/batches/:id', mediaBatchController.getMediaBatch);
router.put('/batches/:id/cancel', mediaBatchController.cancelMediaBatch);

module.exports = router;