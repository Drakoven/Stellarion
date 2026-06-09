const express = require('express')
const router = express.Router()
const { 
  lancerRecherche,
  getMesRecherches
} = require('../controllers/rechercheController')
const verifierToken = require('../middleware/auth')

// GET /api/recherches - voir ses recherches
router.get('/', verifierToken, getMesRecherches)

// POST /api/recherches/lancer - lancer une recherche
router.post('/lancer', verifierToken, lancerRecherche)

module.exports = router