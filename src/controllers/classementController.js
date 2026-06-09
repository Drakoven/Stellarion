const db = require('../db/index')

// ================================
// CLASSEMENT GÉNÉRAL
// ================================
const getClassementGeneral = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        j.id, j.pseudo, j.points,
        j.points_militaire, j.points_recherche,
        j.points_economique, j.combats_gagnes,
        j.combats_perdus,
        a.nom as alliance_nom, a.tag as alliance_tag,
        COUNT(p.id) as nombre_planetes
      FROM joueurs j
      LEFT JOIN membres_alliance ma ON ma.joueur_id = j.id
      LEFT JOIN alliances a ON a.id = ma.alliance_id
      LEFT JOIN planetes p ON p.joueur_id = j.id
      WHERE j.mode_vacances = false
      GROUP BY j.id, a.nom, a.tag
      ORDER BY j.points DESC
      LIMIT 100
    `)

    const classement = result.rows.map((joueur, index) => ({
      rang: index + 1,
      ...joueur
    }))

    res.json({ classement })

  } catch (err) {
    console.error('Erreur classement général:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// CLASSEMENT MILITAIRE
// ================================
const getClassementMilitaire = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        j.id, j.pseudo, j.points_militaire,
        j.combats_gagnes, j.combats_perdus,
        a.nom as alliance_nom, a.tag as alliance_tag
      FROM joueurs j
      LEFT JOIN membres_alliance ma ON ma.joueur_id = j.id
      LEFT JOIN alliances a ON a.id = ma.alliance_id
      WHERE j.mode_vacances = false
      ORDER BY j.points_militaire DESC
      LIMIT 100
    `)

    const classement = result.rows.map((joueur, index) => ({
      rang: index + 1,
      ...joueur
    }))

    res.json({ classement })

  } catch (err) {
    console.error('Erreur classement militaire:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// CLASSEMENT RECHERCHE
// ================================
const getClassementRecherche = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        j.id, j.pseudo, j.points_recherche,
        a.nom as alliance_nom, a.tag as alliance_tag
      FROM joueurs j
      LEFT JOIN membres_alliance ma ON ma.joueur_id = j.id
      LEFT JOIN alliances a ON a.id = ma.alliance_id
      WHERE j.mode_vacances = false
      ORDER BY j.points_recherche DESC
      LIMIT 100
    `)

    const classement = result.rows.map((joueur, index) => ({
      rang: index + 1,
      ...joueur
    }))

    res.json({ classement })

  } catch (err) {
    console.error('Erreur classement recherche:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// CLASSEMENT ÉCONOMIQUE
// ================================
const getClassementEconomique = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        j.id, j.pseudo, j.points_economique,
        a.nom as alliance_nom, a.tag as alliance_tag,
        COUNT(p.id) as nombre_planetes
      FROM joueurs j
      LEFT JOIN membres_alliance ma ON ma.joueur_id = j.id
      LEFT JOIN alliances a ON a.id = ma.alliance_id
      LEFT JOIN planetes p ON p.joueur_id = j.id
      WHERE j.mode_vacances = false
      GROUP BY j.id, a.nom, a.tag
      ORDER BY j.points_economique DESC
      LIMIT 100
    `)

    const classement = result.rows.map((joueur, index) => ({
      rang: index + 1,
      ...joueur
    }))

    res.json({ classement })

  } catch (err) {
    console.error('Erreur classement économique:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// CLASSEMENT ALLIANCES
// ================================
const getClassementAlliances = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        a.id, a.nom, a.tag,
        SUM(j.points) as points_total,
        COUNT(ma.joueur_id) as nombre_membres
      FROM alliances a
      JOIN membres_alliance ma ON ma.alliance_id = a.id
      JOIN joueurs j ON j.id = ma.joueur_id
      GROUP BY a.id
      ORDER BY points_total DESC
      LIMIT 100
    `)

    const classement = result.rows.map((alliance, index) => ({
      rang: index + 1,
      ...alliance
    }))

    res.json({ classement })

  } catch (err) {
    console.error('Erreur classement alliances:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// MON RANG
// ================================
const getMonRang = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT COUNT(*) + 1 as rang
      FROM joueurs
      WHERE points > (
        SELECT points FROM joueurs WHERE id = $1
      )
      AND mode_vacances = false
    `, [req.joueur.id])

    const joueur = await db.query(`
      SELECT id, pseudo, points, points_militaire,
             points_recherche, points_economique
      FROM joueurs WHERE id = $1
    `, [req.joueur.id])

    res.json({
      rang: parseInt(result.rows[0].rang),
      joueur: joueur.rows[0]
    })

  } catch (err) {
    console.error('Erreur mon rang:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = {
  getClassementGeneral,
  getClassementMilitaire,
  getClassementRecherche,
  getClassementEconomique,
  getClassementAlliances,
  getMonRang
}