const db = require('../db/index')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

// ================================
// INSCRIPTION
// ================================
const inscription = async (req, res) => {
  try {
    const { pseudo, email, mot_de_passe } = req.body

    // Vérification que tous les champs sont remplis
    if (!pseudo || !email || !mot_de_passe) {
      return res.status(400).json({ 
        erreur: 'Pseudo, email et mot de passe requis' 
      })
    }

    // Vérification que le pseudo n'est pas déjà pris
    const pseudoExiste = await db.query(
      'SELECT id FROM joueurs WHERE pseudo = $1', 
      [pseudo]
    )
    if (pseudoExiste.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Ce pseudo est déjà utilisé' 
      })
    }

    // Vérification que l'email n'est pas déjà utilisé
    const emailExiste = await db.query(
      'SELECT id FROM joueurs WHERE email = $1', 
      [email]
    )
    if (emailExiste.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Cet email est déjà utilisé' 
      })
    }

    // On chiffre le mot de passe avant de le stocker
    // jamais stocker un mot de passe en clair !
    const salt = await bcrypt.genSalt(10)
    const motDePasseChiffre = await bcrypt.hash(mot_de_passe, salt)

    // On crée le joueur dans la BDD
    const nouveauJoueur = await db.query(
      `INSERT INTO joueurs (pseudo, email, mot_de_passe) 
       VALUES ($1, $2, $3) 
       RETURNING id, pseudo, email`,
      [pseudo, email, motDePasseChiffre]
    )

    const joueur = nouveauJoueur.rows[0]

    // On crée automatiquement sa planète de départ
    await creerPlaneteDepart(joueur.id)

    // On génère un token JWT pour connecter le joueur
    // directement après l'inscription
    const token = jwt.sign(
      { id: joueur.id, pseudo: joueur.pseudo },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      message: `Bienvenue dans Stellarion, ${joueur.pseudo} !`,
      token,
      joueur: {
        id: joueur.id,
        pseudo: joueur.pseudo,
        email: joueur.email
      }
    })

  } catch (err) {
    console.error('Erreur inscription:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// CRÉATION PLANÈTE DE DÉPART
// ================================
const creerPlaneteDepart = async (joueurId) => {

  // Position aléatoire dans la galaxie
  const systeme = Math.floor(Math.random() * 250) + 1
  const position = Math.floor(Math.random() * 10) + 1

  // Taille aléatoire selon la position (slot 5-6 = plus grande)
  let casesMin, casesMax
  if (position >= 5 && position <= 6) {
    casesMin = 160; casesMax = 220
  } else if (position >= 3 && position <= 8) {
    casesMin = 130; casesMax = 180
  } else {
    casesMin = 80; casesMax = 130
  }
  const casesTotales = Math.floor(
    Math.random() * (casesMax - casesMin + 1)
  ) + casesMin

  // Bonus naturel aléatoire
  const bonusNaturel = genererBonusNaturel()

  // Création de la planète
  const planete = await db.query(
    `INSERT INTO planetes 
     (joueur_id, nom, systeme, position, cases_totales, 
      bonus_naturel, bonus_valeur, est_principale)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING id`,
    [
      joueurId,
      'Planète Mère',
      systeme,
      position,
      casesTotales,
      bonusNaturel.nom,
      bonusNaturel.valeur
    ]
  )

  const planeteId = planete.rows[0].id

  // Création des bâtiments (tous à niveau 0)
  await db.query(
    'INSERT INTO batiments (planete_id) VALUES ($1)',
    [planeteId]
  )

  // Création des défenses (toutes à 0)
  await db.query(
    'INSERT INTO defenses (planete_id) VALUES ($1)',
    [planeteId]
  )

  // Création de la flotte (vide)
  await db.query(
    'INSERT INTO flottes (planete_id) VALUES ($1)',
    [planeteId]
  )

  // Création des recherches (toutes à niveau 0)
  await db.query(
    'INSERT INTO recherches (joueur_id) VALUES ($1)',
    [joueurId]
  )
}

// ================================
// GÉNÉRATEUR DE BONUS NATUREL
// ================================
const genererBonusNaturel = () => {
  const chance = Math.random() * 100

  // Légendaire 1%
  if (chance <= 1) {
    return { nom: 'Monde Ancien', valeur: 15 }
  }
  // Très rare 5%
  else if (chance <= 6) {
    const options = [
      { nom: 'Planète Cristalline', valeur: 20 },
      { nom: 'Coeur de Plasma', valeur: 20 },
      { nom: 'Position Stratégique', valeur: 15 }
    ]
    return options[Math.floor(Math.random() * options.length)]
  }
  // Rare 15%
  else if (chance <= 21) {
    const options = [
      { nom: 'Champ Magnétique', valeur: 15 },
      { nom: 'Terrain Fortifié', valeur: 15 },
      { nom: 'Orbite Stable', valeur: 10 }
    ]
    return options[Math.floor(Math.random() * options.length)]
  }
  // Commun 40%
  else if (chance <= 61) {
    const options = [
      { nom: 'Croûte Ferreuse', valeur: 10 },
      { nom: 'Gisements de Vorith', valeur: 10 },
      { nom: 'Riche en Solaris', valeur: 10 }
    ]
    return options[Math.floor(Math.random() * options.length)]
  }
  // Pas de bonus 39%
  else {
    return { nom: null, valeur: 0 }
  }
}

// ================================
// CONNEXION
// ================================
const connexion = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body

    // Vérification des champs
    if (!email || !mot_de_passe) {
      return res.status(400).json({ 
        erreur: 'Email et mot de passe requis' 
      })
    }

    // On cherche le joueur par email
    const result = await db.query(
      'SELECT * FROM joueurs WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ 
        erreur: 'Email ou mot de passe incorrect' 
      })
    }

    const joueur = result.rows[0]

    // On compare le mot de passe avec le hash stocké
    const motDePasseValide = await bcrypt.compare(
      mot_de_passe, 
      joueur.mot_de_passe
    )

    if (!motDePasseValide) {
      return res.status(400).json({ 
        erreur: 'Email ou mot de passe incorrect' 
      })
    }

    // Mise à jour de la dernière connexion
    await db.query(
      'UPDATE joueurs SET derniere_connexion = NOW() WHERE id = $1',
      [joueur.id]
    )

    // Génération du token JWT
    const token = jwt.sign(
      { id: joueur.id, pseudo: joueur.pseudo },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: `Bon retour parmi les étoiles, ${joueur.pseudo} !`,
      token,
      joueur: {
        id: joueur.id,
        pseudo: joueur.pseudo,
        email: joueur.email,
        points: joueur.points
      }
    })

  } catch (err) {
    console.error('Erreur connexion:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// PROFIL (route protégée)
// ================================
const profil = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, pseudo, email, points, points_militaire,
              points_recherche, points_economique,
              combats_gagnes, combats_perdus,
              mode_vacances, nouveau_joueur,
              date_inscription, derniere_connexion
       FROM joueurs WHERE id = $1`,
      [req.joueur.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ erreur: 'Joueur introuvable' })
    }

    res.json({ joueur: result.rows[0] })

  } catch (err) {
    console.error('Erreur profil:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = { inscription, connexion, profil }