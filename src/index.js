const express = require('express')
const cors = require('cors')
require('dotenv').config()

const db = require('./db/index')
const authRoutes = require('./routes/auth')
const { executerTick } = require('./game/tick')

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'Stellarion API en ligne 🚀' })
})

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

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Serveur Stellarion démarré sur le port ${PORT}`)
  executerTick()
  setInterval(executerTick, 3600000)
  console.log('⚙️ Moteur de jeu démarré - tick toutes les heures')
})