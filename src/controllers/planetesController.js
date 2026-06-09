const db = require('../db/index')

// ================================
// RÉCUPÉRER SES PLANÈTES
// ================================
const getMesPlanetes = async (req, res) => {
  try {
    const planetes = await db.query(`
      SELECT 
        p.id, p.nom, p.galaxie, p.systeme, p.position,
        p.cases_totales, p.cases_utilisees,
        p.bonus_naturel, p.bonus_valeur,
        p.ferrux, p.vorith, p.solaris,
        p.est_principale, p.date_colonisation,
        b.mine_ferrux, b.mine_vorith, b.mine_solaris,
        b.centrale_energetique, b.satellite_solaire,
        b.bunker_ferrux, b.bunker_vorith, b.bunker_solaris,
        b.depot_missiles, b.academie, b.convertisseur,
        b.centre_alliance, b.usine_droide, b.usine_androide,
        b.chantier_spatial, b.labo_recherche,
        f.chasseur_leger, f.chasseur_lourd, f.croiseur,
        f.cuirasse, f.destructeur, f.bombardier,
        f.sonde_espionnage, f.transporteur_leger,
        f.transporteur_lourd, f.vaisseau_extracteur,
        f.vaisseau_colonisateur, f.titan,
        d.lanceur_missiles, d.artillerie_laser_legere,
        d.artillerie_laser_lourde, d.canon_ions,
        d.canon_gauss, d.tourelle_plasma,
        d.bouclier_planetaire, d.missile_interception,
        d.missile_interplanetaire
      FROM planetes p
      JOIN batiments b ON b.planete_id = p.id
      JOIN flottes f ON f.planete_id = p.id
      JOIN defenses d ON d.planete_id = p.id
      WHERE p.joueur_id = $1
      ORDER BY p.est_principale DESC, p.date_colonisation ASC
    `, [req.joueur.id])

    res.json({ planetes: planetes.rows })

  } catch (err) {
    console.error('Erreur getMesPlanetes:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// RÉCUPÉRER UNE PLANÈTE SPÉCIFIQUE
// ================================
const getPlanete = async (req, res) => {
  try {
    const { id } = req.params

    const planete = await db.query(`
      SELECT 
        p.id, p.nom, p.galaxie, p.systeme, p.position,
        p.cases_totales, p.cases_utilisees,
        p.bonus_naturel, p.bonus_valeur,
        p.ferrux, p.vorith, p.solaris,
        p.est_principale, p.date_colonisation,
        b.mine_ferrux, b.mine_vorith, b.mine_solaris,
        b.centrale_energetique, b.satellite_solaire,
        b.bunker_ferrux, b.bunker_vorith, b.bunker_solaris,
        b.depot_missiles, b.academie, b.convertisseur,
        b.centre_alliance, b.usine_droide, b.usine_androide,
        b.chantier_spatial, b.labo_recherche,
        f.chasseur_leger, f.chasseur_lourd, f.croiseur,
        f.cuirasse, f.destructeur, f.bombardier,
        f.sonde_espionnage, f.transporteur_leger,
        f.transporteur_lourd, f.vaisseau_extracteur,
        f.vaisseau_colonisateur, f.titan,
        d.lanceur_missiles, d.artillerie_laser_legere,
        d.artillerie_laser_lourde, d.canon_ions,
        d.canon_gauss, d.tourelle_plasma,
        d.bouclier_planetaire, d.missile_interception,
        d.missile_interplanetaire
      FROM planetes p
      JOIN batiments b ON b.planete_id = p.id
      JOIN flottes f ON f.planete_id = p.id
      JOIN defenses d ON d.planete_id = p.id
      WHERE p.id = $1 AND p.joueur_id = $2
    `, [id, req.joueur.id])

    if (planete.rows.length === 0) {
      return res.status(404).json({ 
        erreur: 'Planète introuvable ou non autorisé' 
      })
    }

    res.json({ planete: planete.rows[0] })

  } catch (err) {
    console.error('Erreur getPlanete:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// FILE DE CONSTRUCTION
// ================================
const getFileConstruction = async (req, res) => {
  try {
    const { id } = req.params

    const file = await db.query(`
      SELECT * FROM files_construction
      WHERE planete_id = $1 AND joueur_id = $2
      ORDER BY heure_debut ASC
    `, [id, req.joueur.id])

    res.json({ file: file.rows })

  } catch (err) {
    console.error('Erreur getFileConstruction:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// RENOMMER UNE PLANÈTE
// ================================
const renommerPlanete = async (req, res) => {
  try {
    const { id } = req.params
    const { nom } = req.body

    if (!nom || nom.trim().length === 0) {
      return res.status(400).json({ erreur: 'Nom invalide' })
    }

    if (nom.length > 100) {
      return res.status(400).json({ 
        erreur: 'Nom trop long (100 caractères max)' 
      })
    }

    const result = await db.query(`
      UPDATE planetes SET nom = $1
      WHERE id = $2 AND joueur_id = $3
      RETURNING id, nom
    `, [nom.trim(), id, req.joueur.id])

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        erreur: 'Planète introuvable ou non autorisé' 
      })
    }

    res.json({ 
      message: 'Planète renommée avec succès',
      planete: result.rows[0]
    })

  } catch (err) {
    console.error('Erreur renommerPlanete:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = { 
  getMesPlanetes, 
  getPlanete, 
  getFileConstruction,
  renommerPlanete
}