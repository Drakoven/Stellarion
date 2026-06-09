const db = require('../db/index')

// ================================
// COÛTS ET TEMPS DES RECHERCHES
// ================================

const coutRecherche = (element, niveauActuel) => {
  const couts = {
    informatique:      { ferrux: 0,     vorith: 400,  solaris: 600  },
    energie:           { ferrux: 0,     vorith: 800,  solaris: 400  },
    propulsion:        { ferrux: 400,   vorith: 0,    solaris: 600  },
    armement:          { ferrux: 800,   vorith: 200,  solaris: 0    },
    boucliers:         { ferrux: 200,   vorith: 600,  solaris: 0    },
    espionnage:        { ferrux: 200,   vorith: 1000, solaris: 200  },
    extraction_miniere:{ ferrux: 400,   vorith: 400,  solaris: 0    },
    colonisation:      { ferrux: 20000, vorith: 40000,solaris: 20000},
    hyperespace:       { ferrux: 10000, vorith: 20000,solaris: 6000 },
    laser:             { ferrux: 200,   vorith: 100,  solaris: 0    },
  }

  const base = couts[element]
  if (!base) return null

  return {
    ferrux:  Math.floor(base.ferrux  * Math.pow(2, niveauActuel)),
    vorith:  Math.floor(base.vorith  * Math.pow(2, niveauActuel)),
    solaris: Math.floor(base.solaris * Math.pow(2, niveauActuel)),
  }
}

const tempsRecherche = (element, niveauActuel, niveauLabo) => {
  const tempsBase = {
    informatique:       1800,
    energie:            1600,
    propulsion:         2000,
    armement:           2400,
    boucliers:          2000,
    espionnage:         2400,
    extraction_miniere: 1600,
    colonisation:       86400,
    hyperespace:        14400,
    laser:              1200,
  }

  const base = tempsBase[element]
  if (!base) return null

  // Plus le niveau est haut plus c'est long
  let temps = Math.floor(base * Math.pow(1.75, niveauActuel))

  // Le labo réduit le temps
  const diviseur = 1 + niveauLabo
  temps = Math.floor(temps / diviseur)

  return Math.max(temps, 10)
}

// ================================
// LANCER UNE RECHERCHE
// ================================
const lancerRecherche = async (req, res) => {
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

    // Vérifier que le labo existe sur cette planète
    const batiments = await db.query(
      'SELECT labo_recherche FROM batiments WHERE planete_id = $1',
      [planete_id]
    )

    if (batiments.rows[0].labo_recherche === 0) {
      return res.status(400).json({ 
        erreur: 'Vous devez construire un Laboratoire de Recherche d\'abord' 
      })
    }

    const niveauLabo = batiments.rows[0].labo_recherche

    // Vérifier qu'aucune recherche n'est en cours pour ce joueur
    const rechercheEnCours = await db.query(
      `SELECT id FROM files_construction 
       WHERE joueur_id = $1 AND type = 'RECHERCHE'`,
      [req.joueur.id]
    )

    if (rechercheEnCours.rows.length > 0) {
      return res.status(400).json({ 
        erreur: 'Une recherche est déjà en cours' 
      })
    }

    // Récupérer le niveau actuel de la recherche
    const recherches = await db.query(
      'SELECT * FROM recherches WHERE joueur_id = $1',
      [req.joueur.id]
    )

    const niveauActuel = recherches.rows[0][element]
    if (niveauActuel === undefined) {
      return res.status(400).json({ erreur: 'Recherche invalide' })
    }

    // Calculer le coût
    const cout = coutRecherche(element, niveauActuel)
    if (!cout) {
      return res.status(400).json({ erreur: 'Recherche invalide' })
    }

    // Vérifier les ressources
    const ressources = planete.rows[0]
    if (
      ressources.ferrux  < cout.ferrux  ||
      ressources.vorith  < cout.vorith  ||
      ressources.solaris < cout.solaris
    ) {
      return res.status(400).json({ 
        erreur: 'Ressources insuffisantes',
        cout,
        disponible: {
          ferrux:  ressources.ferrux,
          vorith:  ressources.vorith,
          solaris: ressources.solaris
        }
      })
    }

    // Calculer le temps
    const duree = tempsRecherche(element, niveauActuel, niveauLabo)
    const heureFin = new Date(Date.now() + duree * 1000)

    // Déduire les ressources
    await db.query(`
      UPDATE planetes 
      SET ferrux  = ferrux  - $1,
          vorith  = vorith  - $2,
          solaris = solaris - $3
      WHERE id = $4
    `, [cout.ferrux, cout.vorith, cout.solaris, planete_id])

    // Ajouter à la file de construction
    await db.query(`
      INSERT INTO files_construction 
      (planete_id, joueur_id, type, element, niveau_actuel,
       niveau_cible, ferrux_cout, vorith_cout, solaris_cout, heure_fin)
      VALUES ($1, $2, 'RECHERCHE', $3, $4, $5, $6, $7, $8, $9)
    `, [
      planete_id, req.joueur.id, element,
      niveauActuel, niveauActuel + 1,
      cout.ferrux, cout.vorith, cout.solaris,
      heureFin
    ])

    res.json({
      message: `Recherche ${element} niveau ${niveauActuel + 1} lancée !`,
      cout,
      duree_secondes: duree,
      heure_fin: heureFin
    })

  } catch (err) {
    console.error('Erreur lancerRecherche:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// VOIR SES RECHERCHES
// ================================
const getMesRecherches = async (req, res) => {
  try {
    const recherches = await db.query(
      'SELECT * FROM recherches WHERE joueur_id = $1',
      [req.joueur.id]
    )

    if (recherches.rows.length === 0) {
      return res.status(404).json({ erreur: 'Recherches introuvables' })
    }

    // Recherche en cours
    const enCours = await db.query(
      `SELECT * FROM files_construction 
       WHERE joueur_id = $1 AND type = 'RECHERCHE'`,
      [req.joueur.id]
    )

    res.json({ 
      recherches: recherches.rows[0],
      en_cours: enCours.rows[0] || null
    })

  } catch (err) {
    console.error('Erreur getMesRecherches:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = { lancerRecherche, getMesRecherches }