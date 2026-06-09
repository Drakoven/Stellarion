const express = require('express')
const router = express.Router()
const { 
  envoyerFlotte,
  getMesFlottes,
  rappelerFlotte
} = require('../controllers/flottesController')
const verifierToken = require('../middleware/auth')

// GET /api/flottes - voir ses flottes en mouvement
router.get('/', verifierToken, getMesFlottes)

// POST /api/flottes/envoyer - envoyer une flotte
router.post('/envoyer', verifierToken, envoyerFlotte)

// PUT /api/flottes/:mouvement_id/rappeler - rappeler une flotte
router.put('/:mouvement_id/rappeler', verifierToken, rappelerFlotte)

module.exports = router