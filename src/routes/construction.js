const express = require('express')
const router = express.Router()
const { 
  lancerConstruction,
  construireVaisseau,
  construireDefense
} = require('../controllers/constructionController')
const verifierToken = require('../middleware/auth')

// POST /api/construction/batiment
router.post('/batiment', verifierToken, lancerConstruction)

// POST /api/construction/vaisseau
router.post('/vaisseau', verifierToken, construireVaisseau)

// POST /api/construction/defense
router.post('/defense', verifierToken, construireDefense)

module.exports = router