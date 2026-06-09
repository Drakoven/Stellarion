const express = require('express')
const router = express.Router()
const {
  getClassementGeneral,
  getClassementMilitaire,
  getClassementRecherche,
  getClassementEconomique,
  getClassementAlliances,
  getMonRang
} = require('../controllers/classementController')
const verifierToken = require('../middleware/auth')

// Routes publiques — le classement est visible par tous
router.get('/general', getClassementGeneral)
router.get('/militaire', getClassementMilitaire)
router.get('/recherche', getClassementRecherche)
router.get('/economique', getClassementEconomique)
router.get('/alliances', getClassementAlliances)

// Route protégée — mon rang personnel
router.get('/mon-rang', verifierToken, getMonRang)

module.exports = router