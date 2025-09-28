const express = require('express');
const { 
  createBatch, 
  getBatches, 
  getBatch, 
  cancelBatch 
} = require('../controllers/batchController');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.post('/', createBatch);
router.get('/', getBatches);
router.get('/:id', getBatch);
router.put('/:id/cancel', cancelBatch);

module.exports = router;