/* ================================================================
   HYŌRI — app.js
   Client Supabase, auth Discord, helpers, données démo, UI commune.
   ================================================================ */

const sb = DEMO_MODE ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Gestion du Thème (Clair/Sombre) ----------
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ---------- Données démo ----------
const DEMO = {
  clans: [{ id: 1, name: "Clan Takeda" }, { id: 2, name: "Clan Mori" }, { id: 3, name: "Clan Uesugi" }],
  characters: [{ id: "d1", rp_name: "Takeda Harunobu", age: 34, metier: "Samouraï", skin_pseudo: "Dinnerbone", clan: { name: "Clan Takeda" }, status: "valide", background: "Exemple de background." }],
  news: [{ id: 1, category: "evenement", title: "O-Bon approche", body: "Préparez vos offrandes.", published_at: "2026-07-18" }],
  tickets: [{ id: "t1", type: "validation_background", subject: "Validation — Oyuki", status: "resolu", created_at: "2026-07-05" }],
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
  if (DEMO_MODE) return alert("Mode démo : branche Supabase.");
  await sb.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: new URL(redirectPage, location.href).href } });
}

async function logout() {
  if (!DEMO_MODE) await sb.auth.signOut();
  location.href = "index.html";
}

// ---------- Notifications Intelligentes ----------
async function getUnreadNotifications(uid) {
  if (DEMO_MODE) return [];
  try {
    const { data: ts } = await sb.from("tickets").select("id, subject, type").eq("user_id", uid).neq("status", "resolu");
    if (!ts || !ts.length) return [];
    
    const ids = ts.map(t => t.id);
    const { data: ms } = await sb.from("ticket_messages")
      .select("id, ticket_id, created_at, author:profiles(role)")
      .in("ticket_id", ids).order("created_at", { ascending: false });

    // On garde uniquement le tout dernier message de chaque ticket
    const latestMsgs = {};
    for (const m of ms || []) if (!latestMsgs[m.ticket_id]) latestMsgs[m.ticket_id] = m;

    const readMsgs = JSON.parse(localStorage.getItem('read_msgs') || '[]');
    const unread = [];

    for (const t of ts) {
      const lm = latestMsgs[t.id];
      // Si le dernier message vient du staff et n'a pas été lu
      if (lm && ["moderateur", "admin", "fondateur"].includes(lm.author?.role)) {
        if (!readMsgs.includes(lm.id)) unread.push({ ticket: t, message: lm });
      }
    }
    return unread;
  } catch (e) { return []; }
}

// ---------- Statut serveur Minecraft ----------
async function fetchMcStatus() {
  if (DEMO_MODE) return { online: true, players: { online: 47, max: 100 } };
  try { const r = await fetch("https://api.mcsrvstat.us/3/" + MC_HOST); return await r.json(); } 
  catch (e) { return { online: false }; }
}

async function renderMcStatus(boxId = "server-status", txtId = "status-text") {
  const box = document.getElementById(boxId); const txt = document.getElementById(txtId);
  if (!box || !txt) return;
  const s = await fetchMcStatus();
  if (s.online) txt.innerHTML = "En ligne — <strong>" + (s.players?.online ?? "?") + "</strong> / " + (s.players?.max ?? "?") + " joueurs";
  else { box.classList.add("offline"); txt.textContent = "Hors ligne"; }
}

// ---------- Helpers ----------
const CAT_LABEL = { annonce: "Annonce", changelog: "Changelog", evenement: "Événement" };
const STATUS_LABEL = { brouillon: "Brouillon", en_attente: "En attente", en_traitement: "En traitement", valide: "Validé", resolu: "Résolu", rejete: "Rejeté" };
const TICKET_LABEL = { validation_background: "Validation RP", creation_clan: "Création de clan", question_hrp: "Question HRP", item_custom: "Item custom", autre: "Autre" };

function badge(status) { return '<span class="badge ' + status + '">' + (STATUS_LABEL[status] || status) + "</span>"; }
function fdate(iso) { return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : ""; }
function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }

// ---------- UI commune ----------
document.addEventListener("DOMContentLoaded", async () => {
  const nav = document.querySelector("nav.site");
  if (nav) addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 10), { passive: true });

  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach(a => { if (a.getAttribute("href") === here) a.classList.add("active"); });

  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll(".rv:not(.in)").forEach(el => io.observe(el));

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
        if (here === "admin.html") a.classList.add("active");
      }

      // Injection du menu de Notification
      if (navLinks && !document.querySelector(".bell-wrap")) {
        const bellWrap = document.createElement("div");
        bellWrap.className = "bell-wrap";
        bellWrap.innerHTML = `
          <button class="bell" title="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
            <span class="bell-n" hidden></span>
          </button>
          <div class="bell-drop"></div>
        `;
        navLinks.insertBefore(bellWrap, cta);

        const bellBtn = bellWrap.querySelector('.bell');
        const drop = bellWrap.querySelector('.bell-drop');

        getUnreadNotifications(session.user.id).then((notifs) => {
          if (notifs.length > 0) {
            const b = bellWrap.querySelector(".bell-n");
            b.textContent = notifs.length;
            b.hidden = false;

            drop.innerHTML = notifs.map(n => {
              let text = "Le staff t'a répondu.";
              if (n.ticket.type === "validation_background") text = "Ta fiche RP requiert ton attention.";
              return `<a href="espace.html?ticket=${n.ticket.id}#mes-tickets" class="notif-item">
                <strong>${esc(n.ticket.subject)}</strong>
                <span>${text}</span>
              </a>`;
            }).join('');
          } else {
             drop.innerHTML = '<div style="padding:16px 20px;font-size:13.5px;color:var(--ink-45);">Aucune nouvelle notification</div>';
          }
        });

        bellBtn.addEventListener('click', (e) => { e.stopPropagation(); drop.classList.toggle('show'); });
        document.addEventListener('click', (e) => { if(!bellWrap.contains(e.target)) drop.classList.remove('show'); });
      }
    }
  }
});
