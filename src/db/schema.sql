 -- ================================
-- STELLARION -- SCHEMA BASE DE DONNÉES
-- ================================

CREATE TABLE joueurs (
  id SERIAL PRIMARY KEY,
  pseudo VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  points INTEGER DEFAULT 0,
  points_militaire INTEGER DEFAULT 0,
  points_recherche INTEGER DEFAULT 0,
  points_economique INTEGER DEFAULT 0,
  combats_gagnes INTEGER DEFAULT 0,
  combats_perdus INTEGER DEFAULT 0,
  mode_vacances BOOLEAN DEFAULT FALSE,
  nouveau_joueur BOOLEAN DEFAULT TRUE,
  date_inscription TIMESTAMP DEFAULT NOW(),
  derniere_connexion TIMESTAMP DEFAULT NOW()
);

CREATE TABLE planetes (
  id SERIAL PRIMARY KEY,
  joueur_id INTEGER REFERENCES joueurs(id),
  nom VARCHAR(100) NOT NULL,
  galaxie INTEGER DEFAULT 1,
  systeme INTEGER NOT NULL,
  position INTEGER NOT NULL,
  cases_totales INTEGER NOT NULL,
  cases_utilisees INTEGER DEFAULT 0,
  bonus_naturel VARCHAR(50) DEFAULT NULL,
  bonus_valeur INTEGER DEFAULT 0,
  ferrux INTEGER DEFAULT 500,
  vorith INTEGER DEFAULT 500,
  solaris INTEGER DEFAULT 100,
  est_principale BOOLEAN DEFAULT FALSE,
  date_colonisation TIMESTAMP DEFAULT NOW()
);

CREATE TABLE batiments (
  id SERIAL PRIMARY KEY,
  planete_id INTEGER REFERENCES planetes(id),
  mine_ferrux INTEGER DEFAULT 0,
  mine_vorith INTEGER DEFAULT 0,
  mine_solaris INTEGER DEFAULT 0,
  centrale_energetique INTEGER DEFAULT 0,
  satellite_solaire INTEGER DEFAULT 0,
  bunker_ferrux INTEGER DEFAULT 0,
  bunker_vorith INTEGER DEFAULT 0,
  bunker_solaris INTEGER DEFAULT 0,
  depot_missiles INTEGER DEFAULT 0,
  academie INTEGER DEFAULT 0,
  convertisseur INTEGER DEFAULT 0,
  centre_alliance INTEGER DEFAULT 0,
  usine_droide INTEGER DEFAULT 0,
  usine_androide INTEGER DEFAULT 0,
  chantier_spatial INTEGER DEFAULT 0,
  labo_recherche INTEGER DEFAULT 0
);

CREATE TABLE recherches (
  id SERIAL PRIMARY KEY,
  joueur_id INTEGER REFERENCES joueurs(id),
  informatique INTEGER DEFAULT 0,
  energie INTEGER DEFAULT 0,
  propulsion INTEGER DEFAULT 0,
  armement INTEGER DEFAULT 0,
  boucliers INTEGER DEFAULT 0,
  espionnage INTEGER DEFAULT 0,
  extraction_miniere INTEGER DEFAULT 0,
  colonisation INTEGER DEFAULT 0,
  hyperespace INTEGER DEFAULT 0,
  laser INTEGER DEFAULT 0
);

CREATE TABLE flottes (
  id SERIAL PRIMARY KEY,
  planete_id INTEGER REFERENCES planetes(id),
  chasseur_leger INTEGER DEFAULT 0,
  chasseur_lourd INTEGER DEFAULT 0,
  croiseur INTEGER DEFAULT 0,
  cuirasse INTEGER DEFAULT 0,
  destructeur INTEGER DEFAULT 0,
  bombardier INTEGER DEFAULT 0,
  sonde_espionnage INTEGER DEFAULT 0,
  transporteur_leger INTEGER DEFAULT 0,
  transporteur_lourd INTEGER DEFAULT 0,
  vaisseau_extracteur INTEGER DEFAULT 0,
  vaisseau_colonisateur INTEGER DEFAULT 0,
  titan INTEGER DEFAULT 0
);

CREATE TABLE mouvements_flottes (
  id SERIAL PRIMARY KEY,
  joueur_id INTEGER REFERENCES joueurs(id),
  planete_depart_id INTEGER REFERENCES planetes(id),
  planete_arrivee_id INTEGER REFERENCES planetes(id),
  mission VARCHAR(50) NOT NULL,
  chasseur_leger INTEGER DEFAULT 0,
  chasseur_lourd INTEGER DEFAULT 0,
  croiseur INTEGER DEFAULT 0,
  cuirasse INTEGER DEFAULT 0,
  destructeur INTEGER DEFAULT 0,
  bombardier INTEGER DEFAULT 0,
  sonde_espionnage INTEGER DEFAULT 0,
  transporteur_leger INTEGER DEFAULT 0,
  transporteur_lourd INTEGER DEFAULT 0,
  vaisseau_extracteur INTEGER DEFAULT 0,
  vaisseau_colonisateur INTEGER DEFAULT 0,
  titan INTEGER DEFAULT 0,
  ferrux_transporte INTEGER DEFAULT 0,
  vorith_transporte INTEGER DEFAULT 0,
  solaris_transporte INTEGER DEFAULT 0,
  heure_depart TIMESTAMP DEFAULT NOW(),
  heure_arrivee TIMESTAMP NOT NULL,
  retour BOOLEAN DEFAULT FALSE
);

CREATE TABLE defenses (
  id SERIAL PRIMARY KEY,
  planete_id INTEGER REFERENCES planetes(id),
  lanceur_missiles INTEGER DEFAULT 0,
  artillerie_laser_legere INTEGER DEFAULT 0,
  artillerie_laser_lourde INTEGER DEFAULT 0,
  canon_ions INTEGER DEFAULT 0,
  canon_gauss INTEGER DEFAULT 0,
  tourelle_plasma INTEGER DEFAULT 0,
  bouclier_planetaire INTEGER DEFAULT 0,
  missile_interception INTEGER DEFAULT 0,
  missile_interplanetaire INTEGER DEFAULT 0
);

CREATE TABLE alliances (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) UNIQUE NOT NULL,
  tag VARCHAR(5) UNIQUE NOT NULL,
  description TEXT DEFAULT NULL,
  fondateur_id INTEGER REFERENCES joueurs(id),
  ferrux_banque INTEGER DEFAULT 0,
  vorith_banque INTEGER DEFAULT 0,
  solaris_banque INTEGER DEFAULT 0,
  date_creation TIMESTAMP DEFAULT NOW()
);

CREATE TABLE membres_alliance (
  id SERIAL PRIMARY KEY,
  alliance_id INTEGER REFERENCES alliances(id),
  joueur_id INTEGER REFERENCES joueurs(id),
  rang VARCHAR(50) DEFAULT 'Membre',
  date_adhesion TIMESTAMP DEFAULT NOW()
);

CREATE TABLE rapports (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  joueur_id INTEGER REFERENCES joueurs(id),
  joueur_cible_id INTEGER REFERENCES joueurs(id),
  planete_id INTEGER REFERENCES planetes(id),
  contenu TEXT NOT NULL,
  ferrux_pille INTEGER DEFAULT 0,
  vorith_pille INTEGER DEFAULT 0,
  solaris_pille INTEGER DEFAULT 0,
  lu BOOLEAN DEFAULT FALSE,
  date_rapport TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  expediteur_id INTEGER REFERENCES joueurs(id),
  destinataire_id INTEGER REFERENCES joueurs(id),
  sujet VARCHAR(200) NOT NULL,
  contenu TEXT NOT NULL,
  lu BOOLEAN DEFAULT FALSE,
  date_envoi TIMESTAMP DEFAULT NOW()
);

CREATE TABLE files_construction (
  id SERIAL PRIMARY KEY,
  planete_id INTEGER REFERENCES planetes(id),
  joueur_id INTEGER REFERENCES joueurs(id),
  type VARCHAR(50) NOT NULL,
  element VARCHAR(100) NOT NULL,
  niveau_actuel INTEGER DEFAULT 0,
  niveau_cible INTEGER DEFAULT 1,
  ferrux_cout INTEGER DEFAULT 0,
  vorith_cout INTEGER DEFAULT 0,
  solaris_cout INTEGER DEFAULT 0,
  heure_debut TIMESTAMP DEFAULT NOW(),
  heure_fin TIMESTAMP NOT NULL
);