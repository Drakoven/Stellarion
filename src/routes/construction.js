const express = require('express')
const router = express.Router()
const { lancerConstruction } = require('../controllers/constructionController')
const verifierToken = require('../middleware/auth')

// POST /api/construction/batiment - lancer une construction
router.post('/batiment', verifierToken, lancerConstruction)

module.exports = router