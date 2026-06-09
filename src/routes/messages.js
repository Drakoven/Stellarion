const express = require('express')
const router = express.Router()
const {
  envoyerMessage,
  getMessagesRecus,
  getMessagesEnvoyes,
  lireMessage,
  supprimerMessage,
  getRapports
} = require('../controllers/messagesController')
const verifierToken = require('../middleware/auth')

// Toutes les routes messages sont protégées

// GET /api/messages/recus - boîte de réception
router.get('/recus', verifierToken, getMessagesRecus)

// GET /api/messages/envoyes - messages envoyés
router.get('/envoyes', verifierToken, getMessagesEnvoyes)

// GET /api/messages/rapports - rapports de combat
router.get('/rapports', verifierToken, getRapports)

// GET /api/messages/:id - lire un message
router.get('/:id', verifierToken, lireMessage)

// POST /api/messages/envoyer - envoyer un message
router.post('/envoyer', verifierToken, envoyerMessage)

// DELETE /api/messages/:id - supprimer un message
router.delete('/:id', verifierToken, supprimerMessage)

module.exports = router