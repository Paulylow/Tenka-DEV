/* ================================================================
   TENKA — app.js
   Client Supabase, auth Discord, helpers, données démo, UI commune.
   Charger APRÈS config.js et après le CDN supabase-js v2.
   ================================================================ */

// ---------- Client ----------
const sb = DEMO_MODE ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Données démo (visibles tant que Supabase n'est pas branché) ----------
const DEMO = {
  clans: [
    { id: 1, name: "Clan Takeda" },
    { id: 2, name: "Clan Mori" },
    { id: 3, name: "Clan Uesugi" },
  ],
  characters: [
    { id: "d1", rp_name: "Takeda Harunobu", age: 34, metier: "Samouraï",
      clan: { name: "Clan Takeda" }, status: "valide",
      background: "Fils aîné d'une lignée de guerriers, Harunobu a juré de rendre au clan Takeda sa gloire passée.\n\nOn dit qu'il ne dégaine jamais sans raison — et qu'il n'a jamais rengainé sans avoir gagné." },
    { id: "d2", rp_name: "Oyuki", age: 26, metier: "Herboriste",
      clan: null, status: "valide",
      background: "Recueillie enfant par un moine des montagnes, Oyuki connaît chaque plante des vallées. Les villageois murmurent qu'elle parle aux esprits — elle laisse dire." },
    { id: "d3", rp_name: "Jirō le Borgne", age: 41, metier: "Forgeron",
      clan: { name: "Clan Mori" }, status: "valide",
      background: "Son œil, il l'a laissé à Nagashino. Sa rancune, il la martèle chaque jour dans l'acier qu'il forge pour les Mori." },
  ],
  news: [
    { id: 1, category: "evenement", title: "La nuit des lanternes — Obon approche",
      body: "Les esprits des ancêtres reviennent. Trois soirs d'événement RP orchestré par le staff. Préparez vos offrandes.",
      published_at: "2026-07-18" },
    { id: 2, category: "changelog", title: "Saisons dynamiques — l'été s'installe",
      body: "Récoltes, météo et températures évoluent désormais au fil de l'année sur tout l'archipel.",
      published_at: "2026-07-10" },
    { id: 3, category: "annonce", title: "Ouverture du recensement des clans",
      body: "Les demandes de création de clan sont ouvertes depuis votre espace joueur.",
      published_at: "2026-07-02" },
  ],
  tickets: [
    { id: "t1", type: "validation_background", subject: "Validation — Oyuki", status: "resolu", created_at: "2026-07-05" },
    { id: "t2", type: "question_hrp", subject: "Souci de resource pack", status: "en_traitement", created_at: "2026-07-19" },
  ],
};

// ---------- Auth ----------
async function getSession() {
  if (DEMO_MODE) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

async function getProfile() {
  if (DEMO_MODE) return null;
  const session = await getSession();
  if (!session) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  return data;
}

function isStaff(profile) {
  return profile && ["moderateur", "admin", "fondateur"].includes(profile.role);
}

async function loginDiscord(redirectPage = "espace.html") {
  if (DEMO_MODE) {
    alert("Mode démo : branche Supabase dans assets/config.js pour activer la connexion Discord.");
    return;
  }
  await sb.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: new URL(redirectPage, location.href).href },
  });
}

async function logout() {
  if (!DEMO_MODE) await sb.auth.signOut();
  location.href = "index.html";
}

// ---------- Statut serveur Minecraft ----------
async function fetchMcStatus() {
  if (DEMO_MODE) return { online: true, players: { online: 47, max: 100 } };
  try {
    const r = await fetch("https://api.mcsrvstat.us/3/" + MC_HOST);
    return await r.json();
  } catch (e) {
    return { online: false };
  }
}

async function renderMcStatus(boxId = "server-status", txtId = "status-text") {
  const box = document.getElementById(boxId);
  const txt = document.getElementById(txtId);
  if (!box || !txt) return;
  const s = await fetchMcStatus();
  if (s.online) {
    txt.innerHTML = "En ligne — <strong>" + (s.players?.online ?? "?") + "</strong> / " + (s.players?.max ?? "?") + " joueurs";
  } else {
    box.classList.add("offline");
    txt.textContent = "Hors ligne";
  }
}

// ---------- Petits helpers ----------
const CAT_LABEL = { annonce: "Annonce", changelog: "Changelog", evenement: "Événement" };
const STATUS_LABEL = {
  brouillon: "Brouillon", en_attente: "En attente", en_traitement: "En traitement",
  valide: "Validé", resolu: "Résolu", rejete: "Rejeté",
};
const TICKET_LABEL = {
  validation_background: "Validation de background",
  creation_clan: "Création de clan",
  question_hrp: "Question HRP",
  item_custom: "Demande d'item custom",
  autre: "Autre",
};

function badge(status) {
  return '<span class="badge ' + status + '">' + (STATUS_LABEL[status] || status) + "</span>";
}

function fdate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

// ---------- UI commune ----------
document.addEventListener("DOMContentLoaded", async () => {
  // trait de pinceau sous la nav au scroll
  const nav = document.querySelector("nav.site");
  if (nav) {
    addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 10), { passive: true });
  }

  // lien actif
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    if (a.getAttribute("href") === here) a.classList.add("active");
  });

  // révélations au scroll
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".rv:not(.in)").forEach((el) => io.observe(el));

  // marquee : duplication pour boucle parfaite
  const track = document.getElementById("marquee-track");
  if (track) track.innerHTML += track.innerHTML;

  // nav : "Espace joueur" ⇄ "Nous rejoindre" selon la session
  const cta = document.getElementById("nav-cta");
  if (cta && !DEMO_MODE) {
    const session = await getSession();
    if (session) { cta.textContent = "Espace joueur"; cta.href = "espace.html"; }
  }

  // bandeau démo
  if (DEMO_MODE && document.body.dataset.demoNotice === "on") {
    const n = document.createElement("div");
    n.className = "notice demo";
    n.style.cssText = "max-width:1144px;margin:24px auto 0";
    n.innerHTML = '<span class="k">試</span><span><strong>Mode démo</strong> — données factices. Renseigne ton projet dans <code>assets/config.js</code> pour brancher Supabase.</span>';
    const head = document.querySelector(".page-head");
    if (head) head.appendChild(n);
  }
});
