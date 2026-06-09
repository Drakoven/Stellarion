const express = require('express')
const cors = require('cors')
require('dotenv').config()

// Connexion à la base de données
const db = require('./db/index')

// Import des routes
const authRoutes = require('./routes/auth')

// Création de l'application Express
const app = express()

// Middlewares globaux
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)

// Route de test serveur
app.get('/', (req, res) => {
  res.json({ message: 'Stellarion API en ligne 🚀' })
})

// Route de test BDD
app.get('/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as heure')
    res.json({ 
      message: 'Base de données connectée ✅',
      heure: result.rows[0].heure
    })
  } catch (err) {
    res.status(500).json({ erreur: err.message })
  }
})

// Démarrage du serveur
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Serveur Stellarion démarré sur le port ${PORT}`)
})