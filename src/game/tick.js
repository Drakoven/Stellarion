const db = require('../db/index')

// ================================
// FORMULES DE PRODUCTION
// ================================

// Production horaire d'une mine selon son niveau
const calculerProduction = (niveau, typeRessource) => {
  if (niveau === 0) return 0
  
  // Formule de base : production augmente exponentiellement
  let productionBase = 30 * niveau * Math.pow(1.1, niveau)
  
  // Le Solaris est plus rare donc produit moins
  if (typeRessource === 'solaris') {
    productionBase = productionBase * 0.4
  }
  
  return Math.floor(productionBase)
}

// Capacité maximale d'un bunker selon son niveau
const calculerCapaciteBunker = (niveau) => {
  if (niveau === 0) return 10000 // capacité de base sans bunker
  return Math.floor(10000 * Math.pow(2, niveau))
}

// ================================
// TICK PRINCIPAL
// ================================
const executerTick = async () => {
  console.log(`[TICK] Démarrage - ${new Date().toISOString()}`)
  
  try {
    // On récupère toutes les planètes avec leurs bâtiments
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

    // Pour chaque planète on calcule la production
    for (const planete of planetes.rows) {

      // Calcul de la production de base
      let productionFerrux = calculerProduction(planete.mine_ferrux, 'ferrux')
      let productionVorith = calculerProduction(planete.mine_vorith, 'vorith')
      let productionSolaris = calculerProduction(planete.mine_solaris, 'solaris')

      // Application du bonus naturel de la planète
      if (planete.bonus_naturel) {
        if (planete.bonus_naturel === 'Croûte Ferreuse') {
          productionFerrux = Math.floor(
            productionFerrux * (1 + planete.bonus_valeur / 100)
          )
        }
        if (planete.bonus_naturel === 'Gisements de Vorith') {
          productionVorith = Math.floor(
            productionVorith * (1 + planete.bonus_valeur / 100)
          )
        }
        if (planete.bonus_naturel === 'Riche en Solaris') {
          productionSolaris = Math.floor(
            productionSolaris * (1 + planete.bonus_valeur / 100)
          )
        }
        if (planete.bonus_naturel === 'Monde Ancien') {
          productionFerrux = Math.floor(
            productionFerrux * (1 + planete.bonus_valeur / 100)
          )
          productionVorith = Math.floor(
            productionVorith * (1 + planete.bonus_valeur / 100)
          )
          productionSolaris = Math.floor(
            productionSolaris * (1 + planete.bonus_valeur / 100)
          )
        }
      }

      // Calcul des capacités maximales des bunkers
      const maxFerrux = calculerCapaciteBunker(planete.bunker_ferrux)
      const maxVorith = calculerCapaciteBunker(planete.bunker_vorith)
      const maxSolaris = calculerCapaciteBunker(planete.bunker_solaris)

      // Calcul des nouveaux stocks
      // Math.min = on ne dépasse pas la capacité du bunker
      const nouveauFerrux = Math.min(
        planete.ferrux + productionFerrux, maxFerrux
      )
      const nouveauVorith = Math.min(
        planete.vorith + productionVorith, maxVorith
      )
      const nouveauSolaris = Math.min(
        planete.solaris + productionSolaris, maxSolaris
      )

      // On met à jour les ressources en BDD
      await db.query(`
        UPDATE planetes 
        SET ferrux = $1, vorith = $2, solaris = $3
        WHERE id = $4
      `, [nouveauFerrux, nouveauVorith, nouveauSolaris, planete.id])
    }

    console.log(
      `[TICK] Production calculée pour ${planetes.rows.length} planètes`
    )

    // Vérification des constructions terminées
    await verifierConstructions()

  } catch (err) {
    console.error('[TICK] Erreur:', err)
  }
}

// ================================
// VÉRIFICATION DES CONSTRUCTIONS
// ================================
const verifierConstructions = async () => {
  try {
    // On récupère toutes les constructions terminées
    const constructions = await db.query(`
      SELECT * FROM files_construction
      WHERE heure_fin <= NOW()
    `)

    for (const construction of constructions.rows) {

      // BÂTIMENT terminé
      if (construction.type === 'BATIMENT') {
        await db.query(`
          UPDATE batiments 
          SET ${construction.element} = $1
          WHERE planete_id = $2
        `, [construction.niveau_cible, construction.planete_id])

        // Mise à jour des points économiques du joueur
        const cout = construction.ferrux_cout + 
                     construction.vorith_cout + 
                     construction.solaris_cout
        await db.query(`
          UPDATE joueurs 
          SET points_economique = points_economique + $1,
              points = points + $1
          WHERE id = $2
        `, [Math.floor(cout / 100), construction.joueur_id])
      }

      // RECHERCHE terminée
      if (construction.type === 'RECHERCHE') {
        await db.query(`
          UPDATE recherches 
          SET ${construction.element} = $1
          WHERE joueur_id = $2
        `, [construction.niveau_cible, construction.joueur_id])

        const cout = construction.ferrux_cout + 
                     construction.vorith_cout + 
                     construction.solaris_cout
        await db.query(`
          UPDATE joueurs 
          SET points_recherche = points_recherche + $1,
              points = points + $1
          WHERE id = $2
        `, [Math.floor(cout / 100), construction.joueur_id])
      }

      // VAISSEAU terminé
      if (construction.type === 'VAISSEAU') {
        await db.query(`
          UPDATE flottes 
          SET ${construction.element} = ${construction.element} + $1
          WHERE planete_id = $2
        `, [construction.niveau_cible, construction.planete_id])

        const cout = construction.ferrux_cout + 
                     construction.vorith_cout + 
                     construction.solaris_cout
        await db.query(`
          UPDATE joueurs 
          SET points_militaire = points_militaire + $1,
              points = points + $1
          WHERE id = $2
        `, [Math.floor(cout / 100), construction.joueur_id])
      }

      // DÉFENSE terminée
      if (construction.type === 'DEFENSE') {
        await db.query(`
          UPDATE defenses 
          SET ${construction.element} = ${construction.element} + $1
          WHERE planete_id = $2
        `, [construction.niveau_cible, construction.planete_id])

        const cout = construction.ferrux_cout + 
                     construction.vorith_cout + 
                     construction.solaris_cout
        await db.query(`
          UPDATE joueurs 
          SET points_militaire = points_militaire + $1,
              points = points + $1
          WHERE id = $2
        `, [Math.floor(cout / 100), construction.joueur_id])
      }

      // On supprime la construction de la file
      await db.query(
        'DELETE FROM files_construction WHERE id = $1',
        [construction.id]
      )

      console.log(
        `[TICK] Construction terminée: ${construction.element} 
         pour joueur ${construction.joueur_id}`
      )
    }

  } catch (err) {
    console.error('[TICK] Erreur constructions:', err)
  }
}

module.exports = { executerTick }