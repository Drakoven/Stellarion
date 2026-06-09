const express = require('express')
const router = express.Router()
const {
  creerAlliance,
  rejoindrAlliance,
  quitterAlliance,
  getMonAlliance,
  deposerBanque,
  retirerBanque,
  getAllAlliances
} = require('../controllers/alliancesController')
const verifierToken = require('../middleware/auth')

// GET /api/alliances - voir toutes les alliances
router.get('/', getAllAlliances)

// GET /api/alliances/moi - voir mon alliance
router.get('/moi', verifierToken, getMonAlliance)

// POST /api/alliances/creer - créer une alliance
router.post('/creer', verifierToken, creerAlliance)

// POST /api/alliances/rejoindre - rejoindre une alliance
router.post('/rejoindre', verifierToken, rejoindrAlliance)

// POST /api/alliances/quitter - quitter une alliance
router.post('/quitter', verifierToken, quitterAlliance)

// POST /api/alliances/banque/deposer - déposer en banque
router.post('/banque/deposer', verifierToken, deposerBanque)

// POST /api/alliances/banque/retirer - retirer de la banque
router.post('/banque/retirer', verifierToken, retirerBanque)

module.exports = router