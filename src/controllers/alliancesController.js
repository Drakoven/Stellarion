const db = require('../db/index')

// ================================
// CRÉER UNE ALLIANCE
// ================================
const creerAlliance = async (req, res) => {
  try {
    const { nom, tag, description } = req.body

    if (!nom || !tag) {
      return res.status(400).json({ erreur: 'Nom et tag requis' })
    }

    if (tag.length > 5) {
      return res.status(400).json({ 
        erreur: 'Le tag ne peut pas dépasser 5 caractères' 
      })
    }

    // Vérifier que le joueur n'est pas déjà dans une alliance
    const dejaMembe = await db.query(
      'SELECT id FROM membres_alliance WHERE joueur_id = $1',
      [req.joueur.id]
    )

    if (dejaMembe.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Vous êtes déjà membre d\'une alliance' 
      })
    }

    // Vérifier que le nom et tag sont disponibles
    const nomExiste = await db.query(
      'SELECT id FROM alliances WHERE nom = $1 OR tag = $2',
      [nom, tag.toUpperCase()]
    )

    if (nomExiste.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Ce nom ou tag est déjà utilisé' 
      })
    }

    // Créer l'alliance
    const alliance = await db.query(`
      INSERT INTO alliances (nom, tag, description, fondateur_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [nom, tag.toUpperCase(), description || null, req.joueur.id])

    // Ajouter le fondateur comme membre avec rang Fondateur
    await db.query(`
      INSERT INTO membres_alliance (alliance_id, joueur_id, rang)
      VALUES ($1, $2, 'Fondateur')
    `, [alliance.rows[0].id, req.joueur.id])

    res.status(201).json({
      message: `Alliance [${tag.toUpperCase()}] ${nom} créée !`,
      alliance: alliance.rows[0]
    })

  } catch (err) {
    console.error('Erreur creerAlliance:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// REJOINDRE UNE ALLIANCE
// ================================
const rejoindrAlliance = async (req, res) => {
  try {
    const { alliance_id } = req.body

    if (!alliance_id) {
      return res.status(400).json({ erreur: 'alliance_id requis' })
    }

    // Vérifier que le joueur n'est pas déjà dans une alliance
    const dejaMembe = await db.query(
      'SELECT id FROM membres_alliance WHERE joueur_id = $1',
      [req.joueur.id]
    )

    if (dejaMembe.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Vous êtes déjà membre d\'une alliance' 
      })
    }

    // Vérifier que l'alliance existe
    const alliance = await db.query(
      'SELECT * FROM alliances WHERE id = $1',
      [alliance_id]
    )

    if (alliance.rows.length === 0) {
      return res.status(404).json({ erreur: 'Alliance introuvable' })
    }

    // Ajouter le joueur comme membre
    await db.query(`
      INSERT INTO membres_alliance (alliance_id, joueur_id, rang)
      VALUES ($1, $2, 'Membre')
    `, [alliance_id, req.joueur.id])

    res.json({
      message: `Vous avez rejoint [${alliance.rows[0].tag}] ${alliance.rows[0].nom} !`,
      alliance: alliance.rows[0]
    })

  } catch (err) {
    console.error('Erreur rejoindrAlliance:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// QUITTER UNE ALLIANCE
// ================================
const quitterAlliance = async (req, res) => {
  try {
    const membre = await db.query(
      'SELECT * FROM membres_alliance WHERE joueur_id = $1',
      [req.joueur.id]
    )

    if (membre.rows.length === 0) {
      return res.status(400).json({ 
        erreur: 'Vous n\'êtes pas membre d\'une alliance' 
      })
    }

    if (membre.rows[0].rang === 'Fondateur') {
      return res.status(400).json({ 
        erreur: 'Le fondateur ne peut pas quitter l\'alliance — dissoudre l\'alliance à la place' 
      })
    }

    await db.query(
      'DELETE FROM membres_alliance WHERE joueur_id = $1',
      [req.joueur.id]
    )

    res.json({ message: 'Vous avez quitté l\'alliance' })

  } catch (err) {
    console.error('Erreur quitterAlliance:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// VOIR MON ALLIANCE
// ================================
const getMonAlliance = async (req, res) => {
  try {
    const membre = await db.query(
      'SELECT * FROM membres_alliance WHERE joueur_id = $1',
      [req.joueur.id]
    )

    if (membre.rows.length === 0) {
      return res.status(404).json({ 
        erreur: 'Vous n\'êtes pas membre d\'une alliance' 
      })
    }

    const alliance = await db.query(`
      SELECT 
        a.*,
        COUNT(ma.joueur_id) as nombre_membres
      FROM alliances a
      JOIN membres_alliance ma ON ma.alliance_id = a.id
      WHERE a.id = $1
      GROUP BY a.id
    `, [membre.rows[0].alliance_id])

    const membres = await db.query(`
      SELECT 
        j.id, j.pseudo, j.points,
        ma.rang, ma.date_adhesion
      FROM membres_alliance ma
      JOIN joueurs j ON j.id = ma.joueur_id
      WHERE ma.alliance_id = $1
      ORDER BY j.points DESC
    `, [membre.rows[0].alliance_id])

    res.json({
      alliance: alliance.rows[0],
      mon_rang: membre.rows[0].rang,
      membres: membres.rows
    })

  } catch (err) {
    console.error('Erreur getMonAlliance:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// DÉPOSER DES RESSOURCES EN BANQUE
// ================================
const deposerBanque = async (req, res) => {
  try {
    const { planete_id, ferrux, vorith, solaris } = req.body

    if (!planete_id) {
      return res.status(400).json({ erreur: 'planete_id requis' })
    }

    const total = (ferrux || 0) + (vorith || 0) + (solaris || 0)
    if (total <= 0) {
      return res.status(400).json({ 
        erreur: 'Vous devez déposer au moins une ressource' 
      })
    }

    // Vérifier que le joueur est dans une alliance
    const membre = await db.query(
      'SELECT * FROM membres_alliance WHERE joueur_id = $1',
      [req.joueur.id]
    )

    if (membre.rows.length === 0) {
      return res.status(400).json({ 
        erreur: 'Vous n\'êtes pas membre d\'une alliance' 
      })
    }

    // Vérifier que la planète appartient au joueur
    const planete = await db.query(
      'SELECT * FROM planetes WHERE id = $1 AND joueur_id = $2',
      [planete_id, req.joueur.id]
    )

    if (planete.rows.length === 0) {
      return res.status(404).json({ erreur: 'Planète introuvable' })
    }

    // Vérifier les ressources disponibles
    const ressources = planete.rows[0]
    if (
      ressources.ferrux  < (ferrux  || 0) ||
      ressources.vorith  < (vorith  || 0) ||
      ressources.solaris < (solaris || 0)
    ) {
      return res.status(400).json({ erreur: 'Ressources insuffisantes' })
    }

    // Déduire de la planète
    await db.query(`
      UPDATE planetes 
      SET ferrux  = ferrux  - $1,
          vorith  = vorith  - $2,
          solaris = solaris - $3
      WHERE id = $4
    `, [ferrux || 0, vorith || 0, solaris || 0, planete_id])

    // Ajouter à la banque de l'alliance
    await db.query(`
      UPDATE alliances 
      SET ferrux_banque  = ferrux_banque  + $1,
          vorith_banque  = vorith_banque  + $2,
          solaris_banque = solaris_banque + $3
      WHERE id = $4
    `, [ferrux || 0, vorith || 0, solaris || 0, membre.rows[0].alliance_id])

    res.json({
      message: 'Ressources déposées dans la banque de l\'alliance !',
      depot: { ferrux: ferrux || 0, vorith: vorith || 0, solaris: solaris || 0 }
    })

  } catch (err) {
    console.error('Erreur deposerBanque:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// RETIRER DES RESSOURCES DE LA BANQUE
// ================================
const retirerBanque = async (req, res) => {
  try {
    const { planete_id, ferrux, vorith, solaris } = req.body

    if (!planete_id) {
      return res.status(400).json({ erreur: 'planete_id requis' })
    }

    // Vérifier que le joueur est Officier ou Fondateur
    const membre = await db.query(
      'SELECT * FROM membres_alliance WHERE joueur_id = $1',
      [req.joueur.id]
    )

    if (membre.rows.length === 0) {
      return res.status(400).json({ 
        erreur: 'Vous n\'êtes pas membre d\'une alliance' 
      })
    }

    if (membre.rows[0].rang === 'Membre') {
      return res.status(403).json({ 
        erreur: 'Seuls les Officiers et le Fondateur peuvent retirer des ressources' 
      })
    }

    // Vérifier les ressources en banque
    const alliance = await db.query(
      'SELECT * FROM alliances WHERE id = $1',
      [membre.rows[0].alliance_id]
    )

    const banque = alliance.rows[0]
    if (
      banque.ferrux_banque  < (ferrux  || 0) ||
      banque.vorith_banque  < (vorith  || 0) ||
      banque.solaris_banque < (solaris || 0)
    ) {
      return res.status(400).json({ 
        erreur: 'Ressources insuffisantes en banque' 
      })
    }

    // Vérifier que la planète appartient au joueur
    const planete = await db.query(
      'SELECT id FROM planetes WHERE id = $1 AND joueur_id = $2',
      [planete_id, req.joueur.id]
    )

    if (planete.rows.length === 0) {
      return res.status(404).json({ erreur: 'Planète introuvable' })
    }

    // Déduire de la banque
    await db.query(`
      UPDATE alliances 
      SET ferrux_banque  = ferrux_banque  - $1,
          vorith_banque  = vorith_banque  - $2,
          solaris_banque = solaris_banque - $3
      WHERE id = $4
    `, [ferrux || 0, vorith || 0, solaris || 0, membre.rows[0].alliance_id])

    // Ajouter à la planète
    await db.query(`
      UPDATE planetes 
      SET ferrux  = ferrux  + $1,
          vorith  = vorith  + $2,
          solaris = solaris + $3
      WHERE id = $4
    `, [ferrux || 0, vorith || 0, solaris || 0, planete_id])

    res.json({
      message: 'Ressources retirées de la banque !',
      retrait: { ferrux: ferrux || 0, vorith: vorith || 0, solaris: solaris || 0 }
    })

  } catch (err) {
    console.error('Erreur retirerBanque:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// VOIR TOUTES LES ALLIANCES
// ================================
const getAllAlliances = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        a.id, a.nom, a.tag, a.description,
        a.date_creation,
        COUNT(ma.joueur_id) as nombre_membres,
        SUM(j.points) as points_total
      FROM alliances a
      JOIN membres_alliance ma ON ma.alliance_id = a.id
      JOIN joueurs j ON j.id = ma.joueur_id
      GROUP BY a.id
      ORDER BY points_total DESC
    `)

    res.json({ alliances: result.rows })

  } catch (err) {
    console.error('Erreur getAllAlliances:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = {
  creerAlliance,
  rejoindrAlliance,
  quitterAlliance,
  getMonAlliance,
  deposerBanque,
  retirerBanque,
  getAllAlliances
}