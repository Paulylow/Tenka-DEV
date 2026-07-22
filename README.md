# Tenka — Site du serveur (Serious RP · Japon féodal)

Site statique multi-pages (HTML/CSS/JS vanilla) branché sur **Supabase**
(Postgres + auth Discord + Row Level Security). Aucun backend à héberger.

## Structure

```
tenka/
├── index.html          Accueil : statut serveur, actus, galerie, aperçu recensement
├── regles.html         Règles (éditorial + sommaire sticky)
├── lore.html           Lore & histoire (clans, esprits, guide de background)
├── recensement.html    Annuaire public des personnages (recherche + filtres)
├── personnage.html     Fiche publique d'un personnage (?id=…)
├── espace.html         Espace joueur : login Discord, fiche, tickets
├── admin.html          Panel staff : modération, tickets, news
├── assets/
│   ├── ink.css         Charte graphique « encrage » partagée
│   ├── config.js       ← SEUL FICHIER À ÉDITER
│   └── app.js          Client Supabase, auth, helpers, mode démo
└── supabase/
    └── schema.sql      Schéma complet : tables, triggers, RLS
```

**Mode démo** : tant que `assets/config.js` contient l'URL placeholder,
le site tourne avec des données factices. Tu peux ouvrir les pages en
local et tout voir fonctionner sans rien configurer.

## Mise en route (≈ 20 min)

### 1. Créer le projet Supabase
1. https://supabase.com → New project (gratuit)
2. **SQL Editor → New query** : colle tout `supabase/schema.sql` → **Run**

### 2. Activer la connexion Discord
1. https://discord.com/developers/applications → New Application
2. **OAuth2** : copie le *Client ID* et le *Client Secret*
3. Dans **OAuth2 → Redirects**, ajoute :
   `https://TON-PROJET.supabase.co/auth/v1/callback`
   (remplace par l'URL réelle de ton projet, visible dans Settings → API)
4. Supabase → **Authentication → Sign In / Up → Discord** : active,
   colle Client ID + Secret
5. Supabase → **Authentication → URL Configuration** :
   - *Site URL* : l'URL où le site sera hébergé
   - *Redirect URLs* : ajoute aussi `http://localhost:*` si tu testes en local

### 3. Brancher le site
Édite `assets/config.js` :
```js
const SUPABASE_URL = "https://xxxx.supabase.co";   // Settings → API
const SUPABASE_ANON_KEY = "eyJ...";                // clé "anon public"
const MC_HOST = "ip.de.ton.serveur";
```
La clé *anon* est faite pour être publique — la sécurité est assurée
par les policies RLS du schéma.

### 4. Te donner le rôle fondateur
1. Connecte-toi une fois sur le site avec Discord (ton profil est créé automatiquement)
2. Supabase → SQL Editor :
```sql
update public.profiles set role = 'fondateur' where discord_username = 'TonPseudoDiscord';
```
Le lien « Panel staff » apparaît alors dans ton espace joueur.

### 5. Héberger
Le site est 100 % statique : n'importe quel hébergement fait l'affaire.
- **Ton serveur dédié** : copie le dossier dans le vhost nginx/apache
- **GitHub Pages** : push le dossier, Settings → Pages (comme Le Karmine Déchaîné)
- Netlify / Vercel / Cloudflare Pages : drag & drop

Pense à reporter l'URL finale dans *Authentication → URL Configuration*.

## Fonctionnement

- **Rôles** : `joueur` (défaut) → `moderateur` / `admin` / `fondateur` (staff).
  Seul le staff modère, gère les news et voit tous les tickets — imposé par
  les policies RLS côté base, pas seulement par l'interface.
- **Fiches** : brouillon → soumission (`en_attente` + ticket automatique de
  validation) → sceau du staff (`valide`, publique au Recensement) ou `rejete`.
  Toute modification par le joueur repasse automatiquement `en_attente`
  (trigger `reset_status_on_edit`).
- **Statut serveur** : via l'API publique `api.mcsrvstat.us` (aucune conf,
  fonctionne dès que `MC_HOST` pointe sur ton serveur).
- **Tickets** : 5 types (validation background, création de clan, question
  HRP, item custom, autre), fil de discussion joueur ⇄ staff.

## Personnalisation

- **Nom / IP** : « Tenka » est un placeholder — cherche/remplace `TENKA`,
  `Tenka` et `天下` dans les pages, et `MC_HOST` dans config.js.
- **Galerie** : remplace les `<svg>` des `.kake .paper` dans `index.html`
  par des `<img src="…">` de tes screenshots sous shaders (350 px de haut).
- **Lien Discord** : les `<a href="#">Discord</a>` du footer et
  `#discord-link` attendent ton invitation.
- **Charte** : toutes les couleurs/typos sont des variables CSS en tête
  de `assets/ink.css` (`--washi`, `--sumi`, `--shu`…).
