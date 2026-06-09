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

// ================================
// STATS DES VAISSEAUX
// ================================

const statsVaisseaux = {
  chasseur_leger: {
    ferrux: 3000, vorith: 1000, solaris: 0,
    temps: 120,
    puissance: 50, blindage: 400, bouclier: 10
  },
  chasseur_lourd: {
    ferrux: 6000, vorith: 4000, solaris: 0,
    temps: 300,
    puissance: 150, blindage: 1000, bouclier: 25
  },
  croiseur: {
    ferrux: 20000, vorith: 7000, solaris: 2000,
    temps: 900,
    puissance: 400, blindage: 2700, bouclier: 50
  },
  cuirasse: {
    ferrux: 45000, vorith: 15000, solaris: 0,
    temps: 2400,
    puissance: 1000, blindage: 6000, bouclier: 200
  },
  destructeur: {
    ferrux: 60000, vorith: 15000, solaris: 0,
    temps: 3600,
    puissance: 2000, blindage: 11000, bouclier: 500
  },
  bombardier: {
    ferrux: 50000, vorith: 25000, solaris: 15000,
    temps: 4800,
    puissance: 1000, blindage: 7500, bouclier: 250
  },
  sonde_espionnage: {
    ferrux: 0, vorith: 1000, solaris: 0,
    temps: 60,
    puissance: 0, blindage: 100, bouclier: 0
  },
  transporteur_leger: {
    ferrux: 2000, vorith: 2000, solaris: 0,
    temps: 180,
    puissance: 5, blindage: 400, bouclier: 10,
    cargo: 5000
  },
  transporteur_lourd: {
    ferrux: 6000, vorith: 6000, solaris: 0,
    temps: 600,
    puissance: 5, blindage: 1200, bouclier: 25,
    cargo: 25000
  },
  vaisseau_extracteur: {
    ferrux: 10000, vorith: 6000, solaris: 2000,
    temps: 900,
    puissance: 5, blindage: 1000, bouclier: 10,
    cargo: 20000
  },
  vaisseau_colonisateur: {
    ferrux: 10000, vorith: 20000, solaris: 10000,
    temps: 7200,
    puissance: 50, blindage: 3000, bouclier: 100
  },
  titan: {
    ferrux: 5000000, vorith: 4000000, solaris: 1000000,
    temps: 604800,
    puissance: 8000, blindage: 120000, bouclier: 5000
  }
}

// ================================
// CONSTRUCTION DE VAISSEAUX
// ================================
const construireVaisseau = async (req, res) => {
  try {
    const { planete_id, vaisseau, quantite } = req.body

    if (!planete_id || !vaisseau || !quantite) {
      return res.status(400).json({ 
        erreur: 'planete_id, vaisseau et quantite requis' 
      })
    }

    if (quantite <= 0 || quantite > 10000) {
      return res.status(400).json({ 
        erreur: 'Quantité invalide (1 à 10000)' 
      })
    }

    // Vérifier que le vaisseau existe
    const stats = statsVaisseaux[vaisseau]
    if (!stats) {
      return res.status(400).json({ erreur: 'Vaisseau invalide' })
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

    // Vérifier que le chantier spatial existe (niveau > 0)
    const batiments = await db.query(
      'SELECT * FROM batiments WHERE planete_id = $1',
      [planete_id]
    )

    if (batiments.rows[0].chantier_spatial === 0) {
      return res.status(400).json({ 
        erreur: 'Vous devez construire un Chantier Spatial d\'abord' 
      })
    }

    // Vérifier qu'il n'y a pas déjà une construction de vaisseaux en cours
    const fileEnCours = await db.query(
      `SELECT id FROM files_construction 
       WHERE planete_id = $1 AND type = 'VAISSEAU'`,
      [planete_id]
    )

    if (fileEnCours.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Une construction de vaisseau est déjà en cours' 
      })
    }

    // Calculer le coût total
    const coutTotal = {
      ferrux:  stats.ferrux  * quantite,
      vorith:  stats.vorith  * quantite,
      solaris: stats.solaris * quantite
    }

    // Vérifier les ressources
    const ressources = planete.rows[0]
    if (
      ressources.ferrux  < coutTotal.ferrux  ||
      ressources.vorith  < coutTotal.vorith  ||
      ressources.solaris < coutTotal.solaris
    ) {
      return res.status(400).json({ 
        erreur: 'Ressources insuffisantes',
        cout_total: coutTotal,
        disponible: {
          ferrux:  ressources.ferrux,
          vorith:  ressources.vorith,
          solaris: ressources.solaris
        }
      })
    }

    // Calculer le temps total
    // Chantier spatial réduit le temps
    const niveauChantier = batiments.rows[0].chantier_spatial
    const niveauDroide   = batiments.rows[0].usine_droide
    const niveauAndroide = batiments.rows[0].usine_androide

    const diviseur = 1 + niveauChantier + niveauDroide + (2 * niveauAndroide)
    const tempsUnitaire = Math.max(
      Math.floor(stats.temps / diviseur), 5
    )
    const tempsTotal = tempsUnitaire * quantite
    const heureFin = new Date(Date.now() + tempsTotal * 1000)

    // Déduire les ressources
    await db.query(`
      UPDATE planetes 
      SET ferrux  = ferrux  - $1,
          vorith  = vorith  - $2,
          solaris = solaris - $3
      WHERE id = $4
    `, [coutTotal.ferrux, coutTotal.vorith, coutTotal.solaris, planete_id])

    // Ajouter à la file de construction
    // niveau_cible = quantité commandée
    await db.query(`
      INSERT INTO files_construction 
      (planete_id, joueur_id, type, element, niveau_actuel,
       niveau_cible, ferrux_cout, vorith_cout, solaris_cout, heure_fin)
      VALUES ($1, $2, 'VAISSEAU', $3, 0, $4, $5, $6, $7, $8)
    `, [
      planete_id, req.joueur.id, vaisseau,
      quantite,
      coutTotal.ferrux, coutTotal.vorith, coutTotal.solaris,
      heureFin
    ])

    res.json({
      message: `Construction de ${quantite} ${vaisseau} lancée !`,
      cout_total: coutTotal,
      temps_unitaire_secondes: tempsUnitaire,
      temps_total_secondes: tempsTotal,
      heure_fin: heureFin
    })

  } catch (err) {
    console.error('Erreur construireVaisseau:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// STATS DES DÉFENSES
// ================================

const statsDefenses = {
  lanceur_missiles: {
    ferrux: 2000, vorith: 0, solaris: 0,
    temps: 30,
    puissance: 80, blindage: 200, bouclier: 20
  },
  artillerie_laser_legere: {
    ferrux: 1500, vorith: 500, solaris: 0,
    temps: 25,
    puissance: 100, blindage: 200, bouclier: 25
  },
  artillerie_laser_lourde: {
    ferrux: 6000, vorith: 2000, solaris: 0,
    temps: 120,
    puissance: 250, blindage: 800, bouclier: 100
  },
  canon_ions: {
    ferrux: 5000, vorith: 3000, solaris: 0,
    temps: 240,
    puissance: 150, blindage: 800, bouclier: 500
  },
  canon_gauss: {
    ferrux: 20000, vorith: 15000, solaris: 2000,
    temps: 600,
    puissance: 1100, blindage: 3500, bouclier: 200
  },
  tourelle_plasma: {
    ferrux: 50000, vorith: 50000, solaris: 30000,
    temps: 1800,
    puissance: 3000, blindage: 10000, bouclier: 300
  },
  bouclier_planetaire: {
    ferrux: 10000, vorith: 10000, solaris: 0,
    temps: 300,
    puissance: 0, blindage: 20000, bouclier: 0
  },
  missile_interception: {
    ferrux: 8000, vorith: 2000, solaris: 0,
    temps: 60,
    puissance: 800, blindage: 1, bouclier: 1
  },
  missile_interplanetaire: {
    ferrux: 12500, vorith: 2500, solaris: 5000,
    temps: 120,
    puissance: 12000, blindage: 1, bouclier: 1
  }
}

// ================================
// CONSTRUCTION DE DÉFENSES
// ================================
const construireDefense = async (req, res) => {
  try {
    const { planete_id, defense, quantite } = req.body

    if (!planete_id || !defense || !quantite) {
      return res.status(400).json({ 
        erreur: 'planete_id, defense et quantite requis' 
      })
    }

    if (quantite <= 0 || quantite > 10000) {
      return res.status(400).json({ 
        erreur: 'Quantité invalide (1 à 10000)' 
      })
    }

    // Vérifier que la défense existe
    const stats = statsDefenses[defense]
    if (!stats) {
      return res.status(400).json({ erreur: 'Défense invalide' })
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

    // Vérifier qu'il n'y a pas déjà une construction de défense en cours
    const fileEnCours = await db.query(
      `SELECT id FROM files_construction 
       WHERE planete_id = $1 AND type = 'DEFENSE'`,
      [planete_id]
    )

    if (fileEnCours.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Une construction de défense est déjà en cours' 
      })
    }

    // Vérifier le dépôt de missiles pour les missiles
    if (
      defense === 'missile_interception' || 
      defense === 'missile_interplanetaire'
    ) {
      const batiments = await db.query(
        'SELECT depot_missiles FROM batiments WHERE planete_id = $1',
        [planete_id]
      )
      if (batiments.rows[0].depot_missiles === 0) {
        return res.status(400).json({ 
          erreur: 'Vous devez construire un Dépôt de Missiles d\'abord' 
        })
      }
    }

    // Calculer le coût total
    const coutTotal = {
      ferrux:  stats.ferrux  * quantite,
      vorith:  stats.vorith  * quantite,
      solaris: stats.solaris * quantite
    }

    // Vérifier les ressources
    const ressources = planete.rows[0]
    if (
      ressources.ferrux  < coutTotal.ferrux  ||
      ressources.vorith  < coutTotal.vorith  ||
      ressources.solaris < coutTotal.solaris
    ) {
      return res.status(400).json({ 
        erreur: 'Ressources insuffisantes',
        cout_total: coutTotal,
        disponible: {
          ferrux:  ressources.ferrux,
          vorith:  ressources.vorith,
          solaris: ressources.solaris
        }
      })
    }

    // Calculer le temps total
    const batiments = await db.query(
      'SELECT usine_droide, usine_androide FROM batiments WHERE planete_id = $1',
      [planete_id]
    )
    const niveauDroide   = batiments.rows[0].usine_droide
    const niveauAndroide = batiments.rows[0].usine_androide

    const diviseur = 1 + niveauDroide + (2 * niveauAndroide)
    const tempsUnitaire = Math.max(
      Math.floor(stats.temps / diviseur), 5
    )
    const tempsTotal = tempsUnitaire * quantite
    const heureFin = new Date(Date.now() + tempsTotal * 1000)

    // Déduire les ressources
    await db.query(`
      UPDATE planetes 
      SET ferrux  = ferrux  - $1,
          vorith  = vorith  - $2,
          solaris = solaris - $3
      WHERE id = $4
    `, [coutTotal.ferrux, coutTotal.vorith, coutTotal.solaris, planete_id])

    // Ajouter à la file de construction
    await db.query(`
      INSERT INTO files_construction 
      (planete_id, joueur_id, type, element, niveau_actuel,
       niveau_cible, ferrux_cout, vorith_cout, solaris_cout, heure_fin)
      VALUES ($1, $2, 'DEFENSE', $3, 0, $4, $5, $6, $7, $8)
    `, [
      planete_id, req.joueur.id, defense,
      quantite,
      coutTotal.ferrux, coutTotal.vorith, coutTotal.solaris,
      heureFin
    ])

    res.json({
      message: `Construction de ${quantite} ${defense} lancée !`,
      cout_total: coutTotal,
      temps_unitaire_secondes: tempsUnitaire,
      temps_total_secondes: tempsTotal,
      heure_fin: heureFin
    })

  } catch (err) {
    console.error('Erreur construireDefense:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = { lancerConstruction, construireVaisseau, construireDefense }