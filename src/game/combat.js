const db = require('../db/index')

// ================================
// STATS DES VAISSEAUX
// ================================
const statsVaisseaux = {
  chasseur_leger:       { puissance: 50,   blindage: 400,   bouclier: 10  },
  chasseur_lourd:       { puissance: 150,  blindage: 1000,  bouclier: 25  },
  croiseur:             { puissance: 400,  blindage: 2700,  bouclier: 50  },
  cuirasse:             { puissance: 1000, blindage: 6000,  bouclier: 200 },
  destructeur:          { puissance: 2000, blindage: 11000, bouclier: 500 },
  bombardier:           { puissance: 1000, blindage: 7500,  bouclier: 250 },
  sonde_espionnage:     { puissance: 0,    blindage: 100,   bouclier: 0   },
  transporteur_leger:   { puissance: 5,    blindage: 400,   bouclier: 10  },
  transporteur_lourd:   { puissance: 5,    blindage: 1200,  bouclier: 25  },
  vaisseau_extracteur:  { puissance: 5,    blindage: 1000,  bouclier: 10  },
  vaisseau_colonisateur:{ puissance: 50,   blindage: 3000,  bouclier: 100 },
  titan:                { puissance: 8000, blindage: 120000,bouclier: 5000}
}

const statsDefenses = {
  lanceur_missiles:         { puissance: 80,   blindage: 200,   bouclier: 20  },
  artillerie_laser_legere:  { puissance: 100,  blindage: 200,   bouclier: 25  },
  artillerie_laser_lourde:  { puissance: 250,  blindage: 800,   bouclier: 100 },
  canon_ions:               { puissance: 150,  blindage: 800,   bouclier: 500 },
  canon_gauss:              { puissance: 1100, blindage: 3500,  bouclier: 200 },
  tourelle_plasma:          { puissance: 3000, blindage: 10000, bouclier: 300 },
  bouclier_planetaire:      { puissance: 0,    blindage: 20000, bouclier: 0   },
  missile_interception:     { puissance: 800,  blindage: 1,     bouclier: 1   },
  missile_interplanetaire:  { puissance: 12000,blindage: 1,     bouclier: 1   }
}

// Tirs de précision (multiplicateur de tirs)
const tirsRapides = {
  chasseur_lourd:  { chasseur_leger: 2 },
  croiseur:        { chasseur_leger: 6 },
  destructeur:     { chasseur_lourd: 2 },
  bombardier:      { 
    lanceur_missiles: 5, artillerie_laser_legere: 5,
    artillerie_laser_lourde: 5, canon_ions: 5,
    canon_gauss: 5, tourelle_plasma: 5
  },
  titan:           { cuirasse: 2 }
}

// ================================
// CALCULER LA PUISSANCE TOTALE
// ================================
const calculerPuissance = (unites, stats, niveauArmement, niveauBoucliers) => {
  let puissanceTotale = 0
  let blindageTotale = 0
  let bouclierTotal = 0

  for (const [type, quantite] of Object.entries(unites)) {
    if (quantite > 0 && stats[type]) {
      const s = stats[type]
      // Armement augmente la puissance de 10% par niveau
      const bonusArmement = 1 + (niveauArmement * 0.1)
      // Boucliers augmente le bouclier de 10% par niveau
      const bonusBoucliers = 1 + (niveauBoucliers * 0.1)

      puissanceTotale += s.puissance * quantite * bonusArmement
      blindageTotale  += s.blindage  * quantite
      bouclierTotal   += s.bouclier  * quantite * bonusBoucliers
    }
  }

  return { puissanceTotale, blindageTotale, bouclierTotal }
}

// ================================
// UN ROUND DE COMBAT
// ================================
const executerRound = (attaquants, defenseurs, statsAtt, statsDef) => {
  // Attaquants tirent sur défenseurs
  let degatsAttaquants = 0
  for (const [type, quantite] of Object.entries(attaquants.unites)) {
    if (quantite > 0 && statsAtt[type]) {
      const puissance = statsAtt[type].puissance * quantite
      // Tirs rapides
      const multiplicateur = tirsRapides[type] ? 
        Object.values(tirsRapides[type])[0] : 1
      degatsAttaquants += puissance * multiplicateur
    }
  }

  // Défenseurs tirent sur attaquants
  let degatsDefenseurs = 0
  for (const [type, quantite] of Object.entries(defenseurs.unites)) {
    if (quantite > 0 && statsDef[type]) {
      const puissance = statsDef[type].puissance * quantite
      degatsDefenseurs += puissance
    }
  }

  // Application des dégâts
  // Les boucliers absorbent en premier
  const degatsReelsAttaquants = Math.max(
    degatsAttaquants - defenseurs.bouclierTotal, 
    degatsAttaquants * 0.01
  )
  const degatsReelsDefenseurs = Math.max(
    degatsDefenseurs - attaquants.bouclierTotal,
    degatsDefenseurs * 0.01
  )

  // Réduction du blindage
  attaquants.blindageTotale  -= degatsReelsDefenseurs
  defenseurs.blindageTotale  -= degatsReelsAttaquants

  return {
    degatsAttaquants: Math.floor(degatsReelsAttaquants),
    degatsDefenseurs: Math.floor(degatsReelsDefenseurs)
  }
}

// ================================
// COMBAT PRINCIPAL
// ================================
const executerCombat = async (mouvement) => {
  try {
    const planeteArrivee = await db.query(
      'SELECT * FROM planetes WHERE id = $1',
      [mouvement.planete_arrivee_id]
    )
    const planete = planeteArrivee.rows[0]
    const joueurDefenseur = planete.joueur_id

    // Récupérer les recherches des deux joueurs
    const rechercheAttaquant = await db.query(
      'SELECT * FROM recherches WHERE joueur_id = $1',
      [mouvement.joueur_id]
    )
    const rechercheDefenseur = await db.query(
      'SELECT * FROM recherches WHERE joueur_id = $1',
      [joueurDefenseur]
    )

    const rA = rechercheAttaquant.rows[0]
    const rD = rechercheDefenseur.rows[0]

    // Préparer les unités attaquantes
    const unitesAttaquantes = {
      chasseur_leger:        mouvement.chasseur_leger,
      chasseur_lourd:        mouvement.chasseur_lourd,
      croiseur:              mouvement.croiseur,
      cuirasse:              mouvement.cuirasse,
      destructeur:           mouvement.destructeur,
      bombardier:            mouvement.bombardier,
      transporteur_leger:    mouvement.transporteur_leger,
      transporteur_lourd:    mouvement.transporteur_lourd,
      vaisseau_extracteur:   mouvement.vaisseau_extracteur,
      vaisseau_colonisateur: mouvement.vaisseau_colonisateur,
      titan:                 mouvement.titan
    }

    // Récupérer les défenses de la planète cible
    const defensesDB = await db.query(
      'SELECT * FROM defenses WHERE planete_id = $1',
      [mouvement.planete_arrivee_id]
    )
    const flotteDefenseur = await db.query(
      'SELECT * FROM flottes WHERE planete_id = $1',
      [mouvement.planete_arrivee_id]
    )

    const d = defensesDB.rows[0]
    const f = flotteDefenseur.rows[0]

    const unitesDefenseuses = {
      // Défenses fixes
      lanceur_missiles:        d.lanceur_missiles,
      artillerie_laser_legere: d.artillerie_laser_legere,
      artillerie_laser_lourde: d.artillerie_laser_lourde,
      canon_ions:              d.canon_ions,
      canon_gauss:             d.canon_gauss,
      tourelle_plasma:         d.tourelle_plasma,
      bouclier_planetaire:     d.bouclier_planetaire,
      missile_interception:    d.missile_interception,
      // Flotte stationnée
      chasseur_leger:          f.chasseur_leger,
      chasseur_lourd:          f.chasseur_lourd,
      croiseur:                f.croiseur,
      cuirasse:                f.cuirasse,
      destructeur:             f.destructeur,
      bombardier:              f.bombardier,
      titan:                   f.titan
    }

    // Calculer les stats initiales
    const attaquants = calculerPuissance(
      unitesAttaquantes, statsVaisseaux, 
      rA.armement, rA.boucliers
    )
    attaquants.unites = unitesAttaquantes

    const statsDefCombinees = { ...statsVaisseaux, ...statsDefenses }
    const defenseurs = calculerPuissance(
      unitesDefenseuses, statsDefCombinees,
      rD.armement, rD.boucliers
    )
    defenseurs.unites = unitesDefenseuses

    // ================================
    // 6 ROUNDS DE COMBAT
    // ================================
    const rounds = []
    for (let i = 0; i < 6; i++) {
      if (
        attaquants.blindageTotale <= 0 || 
        defenseurs.blindageTotale <= 0
      ) break

      const round = executerRound(
        attaquants, defenseurs, 
        statsVaisseaux, statsDefCombinees
      )
      rounds.push({ round: i + 1, ...round })
    }

    // ================================
    // RÉSULTAT DU COMBAT
    // ================================
    const attaquantsGagnent = attaquants.blindageTotale > 0 && 
                              defenseurs.blindageTotale <= 0

    const resultat = attaquantsGagnent ? 'VICTOIRE' : 
                     attaquants.blindageTotale <= 0 ? 'DEFAITE' : 'NUL'

    // Calcul des pertes (simplifié)
    const tauxPertesAttaquants = Math.max(0, Math.min(1,
      1 - (attaquants.blindageTotale / 
           (calculerPuissance(unitesAttaquantes, statsVaisseaux, rA.armement, rA.boucliers).blindageTotale || 1))
    ))
    const tauxPertesDefenseurs = Math.max(0, Math.min(1,
      1 - (defenseurs.blindageTotale / 
           (calculerPuissance(unitesDefenseuses, statsDefCombinees, rD.armement, rD.boucliers).blindageTotale || 1))
    ))

    // Appliquer les pertes aux vaisseaux attaquants
    for (const [type, quantite] of Object.entries(unitesAttaquantes)) {
      if (quantite > 0) {
        const pertes = Math.floor(quantite * tauxPertesAttaquants)
        unitesAttaquantes[type] = quantite - pertes
      }
    }

    // Pillage si victoire
    let ferruxPille = 0, vorithPille = 0, solarisPille = 0

    if (attaquantsGagnent) {
      const ressourcesCible = planeteArrivee.rows[0]
      
      // Capacité cargo de la flotte attaquante
      const cargo = 
        (unitesAttaquantes.transporteur_leger  || 0) * 5000  +
        (unitesAttaquantes.transporteur_lourd  || 0) * 25000 +
        (unitesAttaquantes.vaisseau_extracteur || 0) * 20000

      ferruxPille  = Math.min(
        Math.floor(ressourcesCible.ferrux  * 0.5), 
        Math.floor(cargo / 3)
      )
      vorithPille  = Math.min(
        Math.floor(ressourcesCible.vorith  * 0.5), 
        Math.floor(cargo / 3)
      )
      solarisPille = Math.min(
        Math.floor(ressourcesCible.solaris * 0.5), 
        Math.floor(cargo / 3)
      )

      // Déduire les ressources pillées de la cible
      await db.query(`
        UPDATE planetes 
        SET ferrux  = ferrux  - $1,
            vorith  = vorith  - $2,
            solaris = solaris - $3
        WHERE id = $4
      `, [ferruxPille, vorithPille, solarisPille, mouvement.planete_arrivee_id])

      // Mettre à jour les stats du joueur attaquant
      await db.query(`
        UPDATE joueurs SET combats_gagnes = combats_gagnes + 1
        WHERE id = $1
      `, [mouvement.joueur_id])

      await db.query(`
        UPDATE joueurs SET combats_perdus = combats_perdus + 1
        WHERE id = $1
      `, [joueurDefenseur])

    } else if (resultat === 'DEFAITE') {
      await db.query(`
        UPDATE joueurs SET combats_perdus = combats_perdus + 1
        WHERE id = $1
      `, [mouvement.joueur_id])

      await db.query(`
        UPDATE joueurs SET combats_gagnes = combats_gagnes + 1
        WHERE id = $1
      `, [joueurDefenseur])
    }

    // Retourner les vaisseaux survivants à la planète de départ
    // avec les ressources pillées
    await db.query(`
      UPDATE mouvements_flottes SET
        retour = true,
        heure_arrivee = NOW() + INTERVAL '1 second' * $1,
        planete_arrivee_id = planete_depart_id,
        chasseur_leger        = $2,
        chasseur_lourd        = $3,
        croiseur              = $4,
        cuirasse              = $5,
        destructeur           = $6,
        bombardier            = $7,
        transporteur_leger    = $8,
        transporteur_lourd    = $9,
        vaisseau_extracteur   = $10,
        vaisseau_colonisateur = $11,
        titan                 = $12,
        ferrux_transporte     = $13,
        vorith_transporte     = $14,
        solaris_transporte    = $15
      WHERE id = $16
    `, [
      61920, // même temps de retour
      unitesAttaquantes.chasseur_leger        || 0,
      unitesAttaquantes.chasseur_lourd        || 0,
      unitesAttaquantes.croiseur              || 0,
      unitesAttaquantes.cuirasse              || 0,
      unitesAttaquantes.destructeur           || 0,
      unitesAttaquantes.bombardier            || 0,
      unitesAttaquantes.transporteur_leger    || 0,
      unitesAttaquantes.transporteur_lourd    || 0,
      unitesAttaquantes.vaisseau_extracteur   || 0,
      unitesAttaquantes.vaisseau_colonisateur || 0,
      unitesAttaquantes.titan                 || 0,
      mouvement.ferrux_transporte  + ferruxPille,
      mouvement.vorith_transporte  + vorithPille,
      mouvement.solaris_transporte + solarisPille,
      mouvement.id
    ])

    // Créer le rapport de combat
    const contenu = JSON.stringify({
      resultat,
      rounds,
      pertes_attaquant: Math.floor(tauxPertesAttaquants * 100),
      pertes_defenseur: Math.floor(tauxPertesDefenseurs * 100),
      pillage: { ferrux: ferruxPille, vorith: vorithPille, solaris: solarisPille }
    })

    // Rapport pour l'attaquant
    await db.query(`
      INSERT INTO rapports 
      (type, joueur_id, joueur_cible_id, planete_id, contenu,
       ferrux_pille, vorith_pille, solaris_pille)
      VALUES ('COMBAT', $1, $2, $3, $4, $5, $6, $7)
    `, [
      mouvement.joueur_id, joueurDefenseur,
      mouvement.planete_arrivee_id, contenu,
      ferruxPille, vorithPille, solarisPille
    ])

    // Rapport pour le défenseur
    await db.query(`
      INSERT INTO rapports 
      (type, joueur_id, joueur_cible_id, planete_id, contenu,
       ferrux_pille, vorith_pille, solaris_pille)
      VALUES ('COMBAT', $1, $2, $3, $4, $5, $6, $7)
    `, [
      joueurDefenseur, mouvement.joueur_id,
      mouvement.planete_arrivee_id, contenu,
      ferruxPille, vorithPille, solarisPille
    ])

    console.log(
      `[COMBAT] ${resultat} — Attaquant: joueur ${mouvement.joueur_id} ` +
      `vs Défenseur: joueur ${joueurDefenseur} — ` +
      `Pillage: ${ferruxPille}F ${vorithPille}V ${solarisPille}S`
    )

  } catch (err) {
    console.error('[COMBAT] Erreur:', err)
  }
}

module.exports = { executerCombat }