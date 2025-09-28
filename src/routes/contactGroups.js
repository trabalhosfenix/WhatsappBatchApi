const express = require('express');
const {
  createContactGroup,
  getContactGroups,
  getContactGroup,
  updateContactGroup,
  deleteContactGroup,
  addContactsToGroup
} = require('../controllers/contactGroupController');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.post('/', createContactGroup);
router.get('/', getContactGroups);
router.get('/:id', getContactGroup);
router.put('/:id', updateContactGroup);
router.delete('/:id', deleteContactGroup);
router.post('/:id/contacts', addContactsToGroup);

module.exports = router;