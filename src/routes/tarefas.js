// routes/tarefas.js
const express = require('express');
const { auth } = require('../middleware/auth');
const tarefaController = require('../controllers/tarefaController');

const router = express.Router();

router.use(auth);

// CRUD Tarefas
router.post('/', tarefaController.criarTarefa);
router.get('/', tarefaController.listarTarefas);
router.get('/:id', tarefaController.obterTarefa);
router.put('/:id', tarefaController.atualizarTarefa);
router.delete('/:id', tarefaController.excluirTarefa);

// Operações específicas
router.get('/status/pendentes', tarefaController.tarefasPendentes);
router.put('/:id/status', tarefaController.atualizarStatus);
router.get('/proximas', tarefaController.proximasTarefas);
router.get('/hoje', tarefaController.tarefasHoje);

// Lembretes e popups
router.get('/lembretes/pendentes', tarefaController.lembretesPendentes);
router.post('/:id/marcar-popup', tarefaController.marcarPopupMostrado);

module.exports = router;