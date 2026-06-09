const db = require('../db/index')
const { executerCombat } = require('./combat')

// ================================
// FORMULES DE PRODUCTION
// ================================
const calculerProduction = (niveau, typeRessource) => {
  if (niveau === 0) return 0
  let productionBase = 30 * niveau * Math.pow(1.1, niveau)
  if (typeRessource === 'solaris') {
    productionBase = productionBase * 0.4
  }
  return Math.floor(productionBase)
}

const calculerCapaciteBunker = (niveau) => {
  if (niveau === 0) return 10000
  return Math.floor(10000 * Math.pow(2, niveau))
}

// ================================
// TICK PRINCIPAL
// ================================
const executerTick = async () => {
  console.log(`[TICK] Démarrage - ${new Date().toISOString()}`)
  
  try {
    const planetes = await db.query(`
      SELECT 
        p.id, p.joueur_id,
        p.ferrux, p.vorith, p.solaris,
        p.bonus_naturel, p.bonus_valeur,
        b.mine_ferrux, b.mine_vorith, b.mine_solaris,
        b.bunker_ferrux, b.bunker_vorith, b.bunker_solaris,
        b.centrale_energetique
      FROM planetes p
      JOIN batiments b ON b.planete_id = p.id
    `)

    for (const planete of planetes.rows) {
      let productionFerrux  = calculerProduction(planete.mine_ferrux,  'ferrux')
      let productionVorith  = calculerProduction(planete.mine_vorith,  'vorith')
      let productionSolaris = calculerProduction(planete.mine_solaris, 'solaris')

      if (planete.bonus_naturel) {
        if (planete.bonus_naturel === 'Croûte Ferreuse') {
          productionFerrux = Math.floor(productionFerrux * (1 + planete.bonus_valeur / 100))
        }
        if (planete.bonus_naturel === 'Gisements de Vorith') {
          productionVorith = Math.floor(productionVorith * (1 + planete.bonus_valeur / 100))
        }
        if (planete.bonus_naturel === 'Riche en Solaris') {
          productionSolaris = Math.floor(productionSolaris * (1 + planete.bonus_valeur / 100))
        }
        if (planete.bonus_naturel === 'Monde Ancien') {
          productionFerrux  = Math.floor(productionFerrux  * (1 + planete.bonus_valeur / 100))
          productionVorith  = Math.floor(productionVorith  * (1 + planete.bonus_valeur / 100))
          productionSolaris = Math.floor(productionSolaris * (1 + planete.bonus_valeur / 100))
        }
      }

      const maxFerrux  = calculerCapaciteBunker(planete.bunker_ferrux)
      const maxVorith  = calculerCapaciteBunker(planete.bunker_vorith)
      const maxSolaris = calculerCapaciteBunker(planete.bunker_solaris)

      const nouveauFerrux  = Math.min(planete.ferrux  + productionFerrux,  maxFerrux)
      const nouveauVorith  = Math.min(planete.vorith  + productionVorith,  maxVorith)
      const nouveauSolaris = Math.min(planete.solaris + productionSolaris, maxSolaris)

      await db.query(`
        UPDATE planetes 
        SET ferrux = $1, vorith = $2, solaris = $3
        WHERE id = $4
      `, [nouveauFerrux, nouveauVorith, nouveauSolaris, planete.id])
    }

    console.log(`[TICK] Production calculée pour ${planetes.rows.length} planètes`)

    await verifierConstructions()
    await verifierMouvements()

  } catch (err) {
    console.error('[TICK] Erreur:', err)
  }
}

// ================================
// VÉRIFICATION DES CONSTRUCTIONS
// ================================
const verifierConstructions = async () => {
  try {
    const constructions = await db.query(`
      SELECT * FROM files_construction
      WHERE heure_fin <= NOW()
    `)

    for (const construction of constructions.rows) {
      if (construction.type === 'BATIMENT') {
        await db.query(`
          UPDATE batiments 
          SET ${construction.element} = $1
          WHERE planete_id = $2
        `, [construction.niveau_cible, construction.planete_id])

        const cout = construction.ferrux_cout + construction.vorith_cout + construction.solaris_cout
        await db.query(`
          UPDATE joueurs 
          SET points_economique = points_economique + $1,
              points = points + $1
          WHERE id = $2
        `, [Math.floor(cout / 100), construction.joueur_id])
      }

      if (construction.type === 'RECHERCHE') {
        await db.query(`
          UPDATE recherches 
          SET ${construction.element} = $1
          WHERE joueur_id = $2
        `, [construction.niveau_cible, construction.joueur_id])

        const cout = construction.ferrux_cout + construction.vorith_cout + construction.solaris_cout
        await db.query(`
          UPDATE joueurs 
          SET points_recherche = points_recherche + $1,
              points = points + $1
          WHERE id = $2
        `, [Math.floor(cout / 100), construction.joueur_id])
      }

      if (construction.type === 'VAISSEAU') {
        await db.query(`
          UPDATE flottes 
          SET ${construction.element} = ${construction.element} + $1
          WHERE planete_id = $2
        `, [construction.niveau_cible, construction.planete_id])

        const cout = construction.ferrux_cout + construction.vorith_cout + construction.solaris_cout
        await db.query(`
          UPDATE joueurs 
          SET points_militaire = points_militaire + $1,
              points = points + $1
          WHERE id = $2
        `, [Math.floor(cout / 100), construction.joueur_id])
      }

      if (construction.type === 'DEFENSE') {
        await db.query(`
          UPDATE defenses 
          SET ${construction.element} = ${construction.element} + $1
          WHERE planete_id = $2
        `, [construction.niveau_cible, construction.planete_id])

        const cout = construction.ferrux_cout + construction.vorith_cout + construction.solaris_cout
        await db.query(`
          UPDATE joueurs 
          SET points_militaire = points_militaire + $1,
              points = points + $1
          WHERE id = $2
        `, [Math.floor(cout / 100), construction.joueur_id])
      }

      await db.query(
        'DELETE FROM files_construction WHERE id = $1',
        [construction.id]
      )

      console.log(`[TICK] Construction terminée: ${construction.element} pour joueur ${construction.joueur_id}`)
    }

  } catch (err) {
    console.error('[TICK] Erreur constructions:', err)
  }
}

// ================================
// VÉRIFICATION DES MOUVEMENTS
// ================================
const verifierMouvements = async () => {
  try {
    const mouvements = await db.query(`
      SELECT * FROM mouvements_flottes
      WHERE heure_arrivee <= NOW()
    `)

    for (const mouvement of mouvements.rows) {

      // RETOUR — vaisseaux et ressources rentrent à la base
      if (mouvement.retour) {
        const vaisseaux = {
          chasseur_leger:        mouvement.chasseur_leger,
          chasseur_lourd:        mouvement.chasseur_lourd,
          croiseur:              mouvement.croiseur,
          cuirasse:              mouvement.cuirasse,
          destructeur:           mouvement.destructeur,
          bombardier:            mouvement.bombardier,
          sonde_espionnage:      mouvement.sonde_espionnage,
          transporteur_leger:    mouvement.transporteur_leger,
          transporteur_lourd:    mouvement.transporteur_lourd,
          vaisseau_extracteur:   mouvement.vaisseau_extracteur,
          vaisseau_colonisateur: mouvement.vaisseau_colonisateur,
          titan:                 mouvement.titan
        }

        // Remettre les vaisseaux sur la planète
        for (const [type, quantite] of Object.entries(vaisseaux)) {
          if (quantite > 0) {
            await db.query(
              `UPDATE flottes SET ${type} = ${type} + $1 WHERE planete_id = $2`,
              [quantite, mouvement.planete_arrivee_id]
            )
          }
        }

        // Remettre les ressources transportées
        if (
          mouvement.ferrux_transporte  > 0 ||
          mouvement.vorith_transporte  > 0 ||
          mouvement.solaris_transporte > 0
        ) {
          await db.query(`
            UPDATE planetes 
            SET ferrux  = ferrux  + $1,
                vorith  = vorith  + $2,
                solaris = solaris + $3
            WHERE id = $4
          `, [
            mouvement.ferrux_transporte,
            mouvement.vorith_transporte,
            mouvement.solaris_transporte,
            mouvement.planete_arrivee_id
          ])
        }

        console.log(`[TICK] Retour flotte joueur ${mouvement.joueur_id}`)

      // ATTAQUE
      } else if (mouvement.mission === 'ATTAQUE') {
        await executerCombat(mouvement)

      // TRANSPORT
      } else if (mouvement.mission === 'TRANSPORT') {
        await db.query(`
          UPDATE planetes 
          SET ferrux  = ferrux  + $1,
              vorith  = vorith  + $2,
              solaris = solaris + $3
          WHERE id = $4
        `, [
          mouvement.ferrux_transporte,
          mouvement.vorith_transporte,
          mouvement.solaris_transporte,
          mouvement.planete_arrivee_id
        ])

        // La flotte repart immédiatement
        const tempsRetour = 
          (new Date(mouvement.heure_arrivee) - new Date(mouvement.heure_depart))
        await db.query(`
          UPDATE mouvements_flottes SET
            retour = true,
            heure_arrivee = NOW() + $1 * INTERVAL '1 millisecond',
            planete_arrivee_id = planete_depart_id,
            ferrux_transporte = 0,
            vorith_transporte = 0,
            solaris_transporte = 0
          WHERE id = $2
        `, [tempsRetour, mouvement.id])
        continue

      // STATIONNER
      } else if (mouvement.mission === 'STATIONNER') {
        const vaisseaux = {
          chasseur_leger:        mouvement.chasseur_leger,
          chasseur_lourd:        mouvement.chasseur_lourd,
          croiseur:              mouvement.croiseur,
          cuirasse:              mouvement.cuirasse,
          destructeur:           mouvement.destructeur,
          bombardier:            mouvement.bombardier,
          transporteur_leger:    mouvement.transporteur_leger,
          transporteur_lourd:    mouvement.transporteur_lourd,
          vaisseau_extracteur:   mouvement.vaisseau_extracteur,
          titan:                 mouvement.titan
        }

        for (const [type, quantite] of Object.entries(vaisseaux)) {
          if (quantite > 0) {
            await db.query(
              `UPDATE flottes SET ${type} = ${type} + $1 WHERE planete_id = $2`,
              [quantite, mouvement.planete_arrivee_id]
            )
          }
        }
        console.log(`[TICK] Flotte stationnée joueur ${mouvement.joueur_id}`)
      }

      // Supprimer le mouvement traité
      // (sauf TRANSPORT qui continue en retour)
      await db.query(
        'DELETE FROM mouvements_flottes WHERE id = $1',
        [mouvement.id]
      )
    }

  } catch (err) {
    console.error('[TICK] Erreur mouvements:', err)
  }
}

module.exports = { executerTick }