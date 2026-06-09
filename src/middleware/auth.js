const jwt = require('jsonwebtoken')
require('dotenv').config()

// Ce middleware vérifie que le joueur est bien connecté
// Il sera utilisé sur toutes les routes protégées
const verifierToken = (req, res, next) => {

  // On récupère le token dans le header de la requête
  // Le frontend l'enverra comme ça :
  // Authorization: Bearer eyJhbGc...
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  // Pas de token = pas connecté
  if (!token) {
    return res.status(401).json({ 
      erreur: 'Accès refusé - Vous devez être connecté' 
    })
  }

  // On vérifie que le token est valide et non expiré
  jwt.verify(token, process.env.JWT_SECRET, (err, joueur) => {
    if (err) {
      return res.status(403).json({ 
        erreur: 'Token invalide ou expiré' 
      })
    }

    // Token valide → on ajoute les infos du joueur
    // à la requête pour les utiliser dans la route
    req.joueur = joueur
    next()
  })
}

module.exports = verifierToken