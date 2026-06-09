const db = require('../db/index')

// ================================
// VITESSES DES VAISSEAUX
// ================================
const vitessesVaisseaux = {
  chasseur_leger:       12500,
  chasseur_lourd:       10000,
  croiseur:             15000,
  cuirasse:             10000,
  destructeur:          5000,
  bombardier:           4000,
  sonde_espionnage:     100000000,
  transporteur_leger:   7500,
  transporteur_lourd:   5000,
  vaisseau_extracteur:  6000,
  vaisseau_colonisateur:2500,
  titan:                1000
}

// ================================
// CALCUL DU TEMPS DE TRAJET
// ================================
const calculerTempsTrajet = (
  systemeDepart, positionDepart,
  systemeArrivee, positionArrivee,
  vaisseaux, niveauPropulsion
) => {
  // Distance entre les deux planètes
  const distanceSysteme = Math.abs(systemeArrivee - systemeDepart) * 1000
  const distancePosition = Math.abs(positionArrivee - positionDepart) * 100
  const distance = Math.max(distanceSysteme + distancePosition, 100)

  // Vitesse du vaisseau le plus lent de la flotte
  let vitesseMin = Infinity
  for (const [vaisseau, quantite] of Object.entries(vaisseaux)) {
    if (quantite > 0 && vitessesVaisseaux[vaisseau]) {
      vitesseMin = Math.min(vitesseMin, vitessesVaisseaux[vaisseau])
    }
  }

  if (vitesseMin === Infinity) return null

  // La propulsion augmente la vitesse de 10% par niveau
  const bonusPropulsion = 1 + (niveauPropulsion * 0.1)
  const vitesseFinale = vitesseMin * bonusPropulsion

  // Temps en secondes
  const temps = Math.floor(distance / vitesseFinale * 3600)
  return Math.max(temps, 10)
}

// ================================
// ENVOYER UNE FLOTTE
// ================================
const envoyerFlotte = async (req, res) => {
  try {
    const {
      planete_depart_id,
      planete_arrivee_id,
      mission,
      vaisseaux,
      ferrux_transporte,
      vorith_transporte,
      solaris_transporte
    } = req.body

    // Validations de base
    if (!planete_depart_id || !planete_arrivee_id || !mission || !vaisseaux) {
      return res.status(400).json({ 
        erreur: 'Champs manquants' 
      })
    }

    const missionsValides = [
      'ATTAQUE', 'TRANSPORT', 'STATIONNER', 
      'ESPIONNAGE', 'EXTRACTION', 'COLONISATION'
    ]
    if (!missionsValides.includes(mission)) {
      return res.status(400).json({ erreur: 'Mission invalide' })
    }

    // Vérifier que la planète de départ appartient au joueur
    const planeteDepart = await db.query(
      'SELECT * FROM planetes WHERE id = $1 AND joueur_id = $2',
      [planete_depart_id, req.joueur.id]
    )

    if (planeteDepart.rows.length === 0) {
      return res.status(404).json({ 
        erreur: 'Planète de départ introuvable' 
      })
    }

    // Vérifier que la planète d'arrivée existe
    const planeteArrivee = await db.query(
      'SELECT * FROM planetes WHERE id = $1',
      [planete_arrivee_id]
    )

    if (planeteArrivee.rows.length === 0) {
      return res.status(404).json({ 
        erreur: 'Planète d\'arrivée introuvable' 
      })
    }

    // Vérifier que le joueur a assez de vaisseaux
    const flotteActuelle = await db.query(
      'SELECT * FROM flottes WHERE planete_id = $1',
      [planete_depart_id]
    )

    const flotte = flotteActuelle.rows[0]
    let totalVaisseaux = 0

    for (const [vaisseau, quantite] of Object.entries(vaisseaux)) {
      if (quantite > 0) {
        if (flotte[vaisseau] < quantite) {
          return res.status(400).json({ 
            erreur: `Pas assez de ${vaisseau} disponibles`,
            disponible: flotte[vaisseau],
            demande: quantite
          })
        }
        totalVaisseaux += quantite
      }
    }

    if (totalVaisseaux === 0) {
      return res.status(400).json({ 
        erreur: 'Vous devez envoyer au moins un vaisseau' 
      })
    }

    // Vérifier la capacité de cargo pour le transport
    const ressourcesTransportees = (ferrux_transporte || 0) + 
                                   (vorith_transporte || 0) + 
                                   (solaris_transporte || 0)

    if (ressourcesTransportees > 0) {
      const capaciteCargo = 
        (vaisseaux.transporteur_leger || 0) * 5000 +
        (vaisseaux.transporteur_lourd || 0) * 25000 +
        (vaisseaux.vaisseau_extracteur || 0) * 20000

      if (ressourcesTransportees > capaciteCargo) {
        return res.status(400).json({ 
          erreur: 'Capacité de cargo insuffisante',
          capacite: capaciteCargo,
          charge: ressourcesTransportees
        })
      }

      // Vérifier que le joueur a les ressources
      const ressources = planeteDepart.rows[0]
      if (
        ressources.ferrux  < (ferrux_transporte  || 0) ||
        ressources.vorith  < (vorith_transporte  || 0) ||
        ressources.solaris < (solaris_transporte || 0)
      ) {
        return res.status(400).json({ 
          erreur: 'Ressources insuffisantes pour le transport' 
        })
      }
    }

    // Récupérer le niveau de propulsion du joueur
    const recherches = await db.query(
      'SELECT propulsion FROM recherches WHERE joueur_id = $1',
      [req.joueur.id]
    )
    const niveauPropulsion = recherches.rows[0].propulsion

    // Calculer le temps de trajet
    const depart = planeteDepart.rows[0]
    const arrivee = planeteArrivee.rows[0]

    const tempsTrajet = calculerTempsTrajet(
      depart.systeme, depart.position,
      arrivee.systeme, arrivee.position,
      vaisseaux, niveauPropulsion
    )

    if (!tempsTrajet) {
      return res.status(400).json({ erreur: 'Flotte invalide' })
    }

    const heureArrivee = new Date(Date.now() + tempsTrajet * 1000)

    // Déduire les vaisseaux de la planète de départ
    const updates = Object.entries(vaisseaux)
      .filter(([_, q]) => q > 0)
      .map(([vaisseau, quantite]) => 
        db.query(
          `UPDATE flottes SET ${vaisseau} = ${vaisseau} - $1 
           WHERE planete_id = $2`,
          [quantite, planete_depart_id]
        )
      )
    await Promise.all(updates)

    // Déduire les ressources transportées
    if (ressourcesTransportees > 0) {
      await db.query(`
        UPDATE planetes 
        SET ferrux  = ferrux  - $1,
            vorith  = vorith  - $2,
            solaris = solaris - $3
        WHERE id = $4
      `, [
        ferrux_transporte  || 0,
        vorith_transporte  || 0,
        solaris_transporte || 0,
        planete_depart_id
      ])
    }

    // Créer le mouvement de flotte
    await db.query(`
      INSERT INTO mouvements_flottes (
        joueur_id, planete_depart_id, planete_arrivee_id,
        mission,
        chasseur_leger, chasseur_lourd, croiseur, cuirasse,
        destructeur, bombardier, sonde_espionnage,
        transporteur_leger, transporteur_lourd,
        vaisseau_extracteur, vaisseau_colonisateur, titan,
        ferrux_transporte, vorith_transporte, solaris_transporte,
        heure_arrivee
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20
      )
    `, [
      req.joueur.id, planete_depart_id, planete_arrivee_id,
      mission,
      vaisseaux.chasseur_leger        || 0,
      vaisseaux.chasseur_lourd        || 0,
      vaisseaux.croiseur              || 0,
      vaisseaux.cuirasse              || 0,
      vaisseaux.destructeur           || 0,
      vaisseaux.bombardier            || 0,
      vaisseaux.sonde_espionnage      || 0,
      vaisseaux.transporteur_leger    || 0,
      vaisseaux.transporteur_lourd    || 0,
      vaisseaux.vaisseau_extracteur   || 0,
      vaisseaux.vaisseau_colonisateur || 0,
      vaisseaux.titan                 || 0,
      ferrux_transporte  || 0,
      vorith_transporte  || 0,
      solaris_transporte || 0,
      heureArrivee
    ])

    res.json({
      message: `Flotte envoyée en mission ${mission} !`,
      temps_trajet_secondes: tempsTrajet,
      heure_arrivee: heureArrivee,
      vaisseaux_envoyes: vaisseaux
    })

  } catch (err) {
    console.error('Erreur envoyerFlotte:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// VOIR SES FLOTTES EN MOUVEMENT
// ================================
const getMesFlottes = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        mf.*,
        pd.nom as planete_depart_nom,
        pd.systeme as systeme_depart,
        pd.position as position_depart,
        pa.nom as planete_arrivee_nom,
        pa.systeme as systeme_arrivee,
        pa.position as position_arrivee,
        pj.pseudo as proprietaire_arrivee
      FROM mouvements_flottes mf
      JOIN planetes pd ON pd.id = mf.planete_depart_id
      JOIN planetes pa ON pa.id = mf.planete_arrivee_id
      JOIN joueurs pj ON pj.id = pa.joueur_id
      WHERE mf.joueur_id = $1
      ORDER BY mf.heure_arrivee ASC
    `, [req.joueur.id])

    res.json({ flottes: result.rows })

  } catch (err) {
    console.error('Erreur getMesFlottes:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// RAPPELER UNE FLOTTE
// ================================
const rappelerFlotte = async (req, res) => {
  try {
    const { mouvement_id } = req.params

    const mouvement = await db.query(
      'SELECT * FROM mouvements_flottes WHERE id = $1 AND joueur_id = $2',
      [mouvement_id, req.joueur.id]
    )

    if (mouvement.rows.length === 0) {
      return res.status(404).json({ 
        erreur: 'Mouvement introuvable' 
      })
    }

    if (mouvement.rows[0].retour) {
      return res.status(400).json({ 
        erreur: 'La flotte est déjà en route retour' 
      })
    }

    // Calculer le nouveau temps de retour
    // (temps écoulé depuis le départ)
    const tempsEcoule = Date.now() - new Date(mouvement.rows[0].heure_depart).getTime()
    const heureRetour = new Date(Date.now() + tempsEcoule)

    // Mettre à jour le mouvement en retour
    await db.query(`
      UPDATE mouvements_flottes 
      SET retour = true,
          heure_arrivee = $1,
          planete_arrivee_id = planete_depart_id,
          mission = 'RETOUR'
      WHERE id = $2
    `, [heureRetour, mouvement_id])

    res.json({
      message: 'Flotte rappelée !',
      heure_retour: heureRetour
    })

  } catch (err) {
    console.error('Erreur rappelerFlotte:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = { envoyerFlotte, getMesFlottes, rappelerFlotte }