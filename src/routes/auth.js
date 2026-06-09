const express = require('express')
const router = express.Router()
const { inscription, connexion, profil } = require('../controllers/authController')
const verifierToken = require('../middleware/auth')

// Route publique - inscription
// POST /api/auth/inscription
router.post('/inscription', inscription)

// Route publique - connexion
// POST /api/auth/connexion
router.post('/connexion', connexion)

// Route protégée - profil
// GET /api/auth/profil
// nécessite un token JWT valide
router.get('/profil', verifierToken, profil)

module.exports = router