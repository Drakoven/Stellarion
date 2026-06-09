// On importe les outils dont on a besoin
const express = require('express')
const cors = require('cors')
require('dotenv').config()

// On importe la connexion à la base de données
// dès le démarrage du serveur, la connexion est établie
const db = require('./db/index')

// On crée l'application Express
const app = express()

// CORS permet au frontend React (sur Netlify)
// de parler à ce backend sans être bloqué
app.use(cors())

// Permet au serveur de lire le JSON
// envoyé par le frontend
app.use(express.json())

// Route de test — pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
  res.json({ message: 'Stellarion API en ligne 🚀' })
})

// Route de test BDD — vérifie que PostgreSQL répond
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

// On démarre le serveur sur le port défini dans .env
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Serveur Stellarion démarré sur le port ${PORT}`)
})