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
    { id: "d1", rp_name: "Takeda Harunobu", age: 34, metier: "Samouraï", skin_pseudo: "Dinnerbone",
      clan: { name: "Clan Takeda" }, status: "valide",
      background: "Fils aîné d'une lignée de guerriers, Harunobu a juré de rendre au clan Takeda sa gloire passée.\n\nOn dit qu'il ne dégaine jamais sans raison — et qu'il n'a jamais rengainé sans avoir gagné." },
    { id: "d2", rp_name: "Oyuki", age: 26, metier: "Herboriste", skin_pseudo: "jeb_",
      clan: null, status: "valide",
      background: "Recueillie enfant par un moine des montagnes, Oyuki connaît chaque plante des vallées. Les villageois murmurent qu'elle parle aux esprits — elle laisse dire." },
    { id: "d3", rp_name: "Jirō le Borgne", age: 41, metier: "Forgeron", skin_pseudo: "Notch",
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

// Tickets de l'utilisateur dont le DERNIER message vient du staff
// (= une réponse t'attend). Proxy simple, sans table de lecture.
async function unreadStaffReplies(uid) {
  try {
    const { data: ts } = await sb.from("tickets")
      .select("id").eq("user_id", uid).neq("status", "resolu");
    if (!ts || !ts.length) return 0;
    const ids = ts.map((t) => t.id);
    const { data: ms } = await sb.from("ticket_messages")
      .select("ticket_id, created_at, author:profiles(role)")
      .in("ticket_id", ids)
      .order("created_at", { ascending: false })
      .limit(120);
    const seen = new Set();
    let n = 0;
    for (const m of ms || []) {
      if (seen.has(m.ticket_id)) continue;
      seen.add(m.ticket_id);
      if (["moderateur", "admin", "fondateur"].includes(m.author?.role)) n++;
    }
    return n;
  } catch (e) { return 0; }
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

  // nav : "Espace joueur" ⇄ "Nous rejoindre" selon la session,
  // + lien Staff et cloche de notifications
  const cta = document.getElementById("nav-cta");
  const navLinks = document.querySelector(".nav-links");
  if (cta && !DEMO_MODE) {
    const session = await getSession();
    if (session) {
      cta.textContent = "Espace joueur"; cta.href = "espace.html";
      const me = await getProfile();

      if (isStaff(me) && navLinks && !document.getElementById("nav-staff")) {
        const a = document.createElement("a");
        a.id = "nav-staff"; a.href = "admin.html"; a.textContent = "Staff";
        navLinks.insertBefore(a, cta);
        if ((location.pathname.split("/").pop() || "") === "admin.html") a.classList.add("active");
      }

      if (navLinks && !document.querySelector(".bell")) {
        const bell = document.createElement("a");
        bell.className = "bell"; bell.href = "espace.html";
        bell.title = "Réponses du staff sur tes tickets";
        bell.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>' +
          '<span class="bell-n" hidden></span>';
        navLinks.insertBefore(bell, cta);
        unreadStaffReplies(session.user.id).then((n) => {
          if (n > 0) {
            const b = bell.querySelector(".bell-n");
            b.textContent = "+" + n;
            b.hidden = false;
          }
        });
      }
    }
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
