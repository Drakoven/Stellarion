const express = require('express')
const router = express.Router()
const { 
  lancerConstruction,
  construireVaisseau
} = require('../controllers/constructionController')
const verifierToken = require('../middleware/auth')

// POST /api/construction/batiment - lancer une construction
router.post('/batiment', verifierToken, lancerConstruction)

// POST /api/construction/vaisseau - construire des vaisseaux
router.post('/vaisseau', verifierToken, construireVaisseau)

module.exports = router