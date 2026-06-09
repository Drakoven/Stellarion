const express = require('express')
const router = express.Router()
const { 
  getMesPlanetes, 
  getPlanete, 
  getFileConstruction,
  renommerPlanete
} = require('../controllers/planetesController')
const verifierToken = require('../middleware/auth')

// Toutes les routes planètes sont protégées
// le joueur doit être connecté

// GET /api/planetes - toutes mes planètes
router.get('/', verifierToken, getMesPlanetes)

// GET /api/planetes/:id - une planète spécifique
router.get('/:id', verifierToken, getPlanete)

// GET /api/planetes/:id/construction - file de construction
router.get('/:id/construction', verifierToken, getFileConstruction)

// PUT /api/planetes/:id/renommer - renommer une planète
router.put('/:id/renommer', verifierToken, renommerPlanete)

module.exports = router