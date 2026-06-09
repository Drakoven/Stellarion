const db = require('../db/index')

// ================================
// COÛTS ET TEMPS DE CONSTRUCTION
// ================================

// Coût d'un bâtiment selon son niveau actuel
const coutBatiment = (element, niveauActuel) => {
  const niveauCible = niveauActuel + 1
  
  const couts = {
    mine_ferrux:          { ferrux: 60,  vorith: 15,  solaris: 0  },
    mine_vorith:          { ferrux: 48,  vorith: 24,  solaris: 0  },
    mine_solaris:         { ferrux: 0,   vorith: 50,  solaris: 100},
    centrale_energetique: { ferrux: 75,  vorith: 30,  solaris: 0  },
    satellite_solaire:    { ferrux: 0,   vorith: 20,  solaris: 0  },
    bunker_ferrux:        { ferrux: 500, vorith: 200, solaris: 0  },
    bunker_vorith:        { ferrux: 500, vorith: 200, solaris: 0  },
    bunker_solaris:       { ferrux: 500, vorith: 200, solaris: 0  },
    depot_missiles:       { ferrux: 200, vorith: 100, solaris: 0  },
    academie:             { ferrux: 400, vorith: 200, solaris: 100},
    convertisseur:        { ferrux: 300, vorith: 200, solaris: 50 },
    centre_alliance:      { ferrux: 200, vorith: 100, solaris: 0  },
    usine_droide:         { ferrux: 400, vorith: 120, solaris: 200},
    usine_androide:       { ferrux: 1000,vorith: 500, solaris: 200},
    chantier_spatial:     { ferrux: 400, vorith: 200, solaris: 100},
    labo_recherche:       { ferrux: 200, vorith: 400, solaris: 200},
  }

  const base = couts[element]
  if (!base) return null

  // Progression exponentielle — plus le niveau est haut
  // plus ça coûte cher
  return {
    ferrux:  Math.floor(base.ferrux  * Math.pow(1.5, niveauActuel)),
    vorith:  Math.floor(base.vorith  * Math.pow(1.5, niveauActuel)),
    solaris: Math.floor(base.solaris * Math.pow(1.5, niveauActuel)),
  }
}

// Temps de construction en secondes selon le niveau
const tempsBatiment = (element, niveauActuel, niveauDroide, niveauAndroide) => {
  const niveauCible = niveauActuel + 1
  
  // Temps de base en secondes
  const tempsBase = {
    mine_ferrux:          60,
    mine_vorith:          90,
    mine_solaris:         180,
    centrale_energetique: 120,
    satellite_solaire:    60,
    bunker_ferrux:        300,
    bunker_vorith:        300,
    bunker_solaris:       300,
    depot_missiles:       240,
    academie:             600,
    convertisseur:        480,
    centre_alliance:      300,
    usine_droide:         900,
    usine_androide:       3600,
    chantier_spatial:     1200,
    labo_recherche:       900,
  }

  const base = tempsBase[element]
  if (!base) return null

  // Plus le niveau est haut, plus c'est long
  let temps = Math.floor(base * Math.pow(1.6, niveauActuel))

  // Réduction par les usines
  // Usine de Droïde et Androïde réduisent le temps
  const diviseur = 1 + niveauDroide + (2 * niveauAndroide)
  temps = Math.floor(temps / diviseur)

  // Minimum 5 secondes
  return Math.max(temps, 5)
}

// ================================
// LANCER UNE CONSTRUCTION
// ================================
const lancerConstruction = async (req, res) => {
  try {
    const { planete_id, element } = req.body

    if (!planete_id || !element) {
      return res.status(400).json({ 
        erreur: 'planete_id et element requis' 
      })
    }

    // Vérifier que la planète appartient au joueur
    const planete = await db.query(
      'SELECT * FROM planetes WHERE id = $1 AND joueur_id = $2',
      [planete_id, req.joueur.id]
    )

    if (planete.rows.length === 0) {
      return res.status(404).json({ 
        erreur: 'Planète introuvable ou non autorisé' 
      })
    }

    // Vérifier qu'il n'y a pas déjà une construction en cours
    const fileEnCours = await db.query(
      `SELECT id FROM files_construction 
       WHERE planete_id = $1 AND type = 'BATIMENT'`,
      [planete_id]
    )

    if (fileEnCours.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Une construction est déjà en cours sur cette planète' 
      })
    }

    // Récupérer le niveau actuel du bâtiment
    const batiments = await db.query(
      'SELECT * FROM batiments WHERE planete_id = $1',
      [planete_id]
    )

    const niveauActuel = batiments.rows[0][element]
    if (niveauActuel === undefined) {
      return res.status(400).json({ erreur: 'Bâtiment invalide' })
    }

    // Récupérer les niveaux des usines pour réduire le temps
    const niveauDroide = batiments.rows[0].usine_droide
    const niveauAndroide = batiments.rows[0].usine_androide

    // Calculer le coût
    const cout = coutBatiment(element, niveauActuel)
    if (!cout) {
      return res.status(400).json({ erreur: 'Bâtiment invalide' })
    }

    // Vérifier que le joueur a assez de ressources
    const ressources = planete.rows[0]
    if (
      ressources.ferrux < cout.ferrux ||
      ressources.vorith < cout.vorith ||
      ressources.solaris < cout.solaris
    ) {
      return res.status(400).json({ 
        erreur: 'Ressources insuffisantes',
        cout,
        disponible: {
          ferrux: ressources.ferrux,
          vorith: ressources.vorith,
          solaris: ressources.solaris
        }
      })
    }

    // Calculer le temps de construction
    const duree = tempsBatiment(
      element, niveauActuel, niveauDroide, niveauAndroide
    )

    const heureFin = new Date(Date.now() + duree * 1000)

    // Déduire les ressources
    await db.query(`
      UPDATE planetes 
      SET ferrux = ferrux - $1,
          vorith = vorith - $2,
          solaris = solaris - $3
      WHERE id = $4
    `, [cout.ferrux, cout.vorith, cout.solaris, planete_id])

    // Ajouter à la file de construction
    await db.query(`
      INSERT INTO files_construction 
      (planete_id, joueur_id, type, element, niveau_actuel, 
       niveau_cible, ferrux_cout, vorith_cout, solaris_cout, heure_fin)
      VALUES ($1, $2, 'BATIMENT', $3, $4, $5, $6, $7, $8, $9)
    `, [
      planete_id, req.joueur.id, element,
      niveauActuel, niveauActuel + 1,
      cout.ferrux, cout.vorith, cout.solaris,
      heureFin
    ])

    res.json({
      message: `Construction de ${element} niveau ${niveauActuel + 1} lancée !`,
      cout,
      duree_secondes: duree,
      heure_fin: heureFin
    })

  } catch (err) {
    console.error('Erreur lancerConstruction:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = { lancerConstruction }