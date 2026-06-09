// On importe pg - l'outil qui permet à Node.js
// de parler à PostgreSQL
const { Pool } = require('pg')

// On charge les variables du fichier .env
require('dotenv').config()

// Pool = un groupe de connexions à la BDD
// plutôt qu'ouvrir/fermer une connexion à chaque requête
// le Pool garde des connexions ouvertes en permanence
// c'est beaucoup plus rapide
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

// On teste la connexion au démarrage
pool.connect((err) => {
  if (err) {
    console.error('Erreur connexion PostgreSQL:', err)
  } else {
    console.log('Connecté à PostgreSQL ✅')
  }
})

// On exporte le pool pour l'utiliser partout
// dans le projet
module.exports = pool