const db = require('../db/index')

// ================================
// ENVOYER UN MESSAGE
// ================================
const envoyerMessage = async (req, res) => {
  try {
    const { destinataire_pseudo, sujet, contenu } = req.body

    if (!destinataire_pseudo || !sujet || !contenu) {
      return res.status(400).json({ 
        erreur: 'Destinataire, sujet et contenu requis' 
      })
    }

    // Trouver le destinataire par pseudo
    const destinataire = await db.query(
      'SELECT id, pseudo FROM joueurs WHERE pseudo = $1',
      [destinataire_pseudo]
    )

    if (destinataire.rows.length === 0) {
      return res.status(404).json({ 
        erreur: 'Joueur introuvable' 
      })
    }

    if (destinataire.rows[0].id === req.joueur.id) {
      return res.status(400).json({ 
        erreur: 'Vous ne pouvez pas vous envoyer un message' 
      })
    }

    // Créer le message
    await db.query(`
      INSERT INTO messages 
      (expediteur_id, destinataire_id, sujet, contenu)
      VALUES ($1, $2, $3, $4)
    `, [
      req.joueur.id,
      destinataire.rows[0].id,
      sujet,
      contenu
    ])

    res.json({
      message: `Message envoyé à ${destinataire.rows[0].pseudo} !`
    })

  } catch (err) {
    console.error('Erreur envoyerMessage:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// VOIR SA BOÎTE DE RÉCEPTION
// ================================
const getMessagesRecus = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        m.id, m.sujet, m.contenu, m.lu,
        m.date_envoi,
        j.pseudo as expediteur_pseudo
      FROM messages m
      JOIN joueurs j ON j.id = m.expediteur_id
      WHERE m.destinataire_id = $1
      ORDER BY m.date_envoi DESC
    `, [req.joueur.id])

    // Compter les messages non lus
    const nonLus = result.rows.filter(m => !m.lu).length

    res.json({ 
      messages: result.rows,
      non_lus: nonLus
    })

  } catch (err) {
    console.error('Erreur getMessagesRecus:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// VOIR SES MESSAGES ENVOYÉS
// ================================
const getMessagesEnvoyes = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        m.id, m.sujet, m.contenu, m.lu,
        m.date_envoi,
        j.pseudo as destinataire_pseudo
      FROM messages m
      JOIN joueurs j ON j.id = m.destinataire_id
      WHERE m.expediteur_id = $1
      ORDER BY m.date_envoi DESC
    `, [req.joueur.id])

    res.json({ messages: result.rows })

  } catch (err) {
    console.error('Erreur getMessagesEnvoyes:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// LIRE UN MESSAGE
// ================================
const lireMessage = async (req, res) => {
  try {
    const { id } = req.params

    const message = await db.query(`
      SELECT 
        m.*,
        je.pseudo as expediteur_pseudo,
        jd.pseudo as destinataire_pseudo
      FROM messages m
      JOIN joueurs je ON je.id = m.expediteur_id
      JOIN joueurs jd ON jd.id = m.destinataire_id
      WHERE m.id = $1 
      AND (m.destinataire_id = $2 OR m.expediteur_id = $2)
    `, [id, req.joueur.id])

    if (message.rows.length === 0) {
      return res.status(404).json({ erreur: 'Message introuvable' })
    }

    // Marquer comme lu si destinataire
    if (message.rows[0].destinataire_id === req.joueur.id) {
      await db.query(
        'UPDATE messages SET lu = true WHERE id = $1',
        [id]
      )
    }

    res.json({ message: message.rows[0] })

  } catch (err) {
    console.error('Erreur lireMessage:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// SUPPRIMER UN MESSAGE
// ================================
const supprimerMessage = async (req, res) => {
  try {
    const { id } = req.params

    const result = await db.query(`
      DELETE FROM messages 
      WHERE id = $1 
      AND (destinataire_id = $2 OR expediteur_id = $2)
      RETURNING id
    `, [id, req.joueur.id])

    if (result.rows.length === 0) {
      return res.status(404).json({ erreur: 'Message introuvable' })
    }

    res.json({ message: 'Message supprimé' })

  } catch (err) {
    console.error('Erreur supprimerMessage:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

// ================================
// VOIR SES RAPPORTS DE COMBAT
// ================================
const getRapports = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.*,
        j.pseudo as joueur_cible_pseudo
      FROM rapports r
      LEFT JOIN joueurs j ON j.id = r.joueur_cible_id
      WHERE r.joueur_id = $1
      ORDER BY r.date_rapport DESC
      LIMIT 50
    `, [req.joueur.id])

    // Marquer tous comme lus
    await db.query(
      'UPDATE rapports SET lu = true WHERE joueur_id = $1',
      [req.joueur.id]
    )

    res.json({ rapports: result.rows })

  } catch (err) {
    console.error('Erreur getRapports:', err)
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
}

module.exports = {
  envoyerMessage,
  getMessagesRecus,
  getMessagesEnvoyes,
  lireMessage,
  supprimerMessage,
  getRapports
}