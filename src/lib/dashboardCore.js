// Logique du dashboard partagé entre /admin et /superadmin — markup dans
// src/components/admin/DashboardCore.astro. Même principe que
// lib/adminContent.js pour les vues de contenu.
//
// Usage :
//   const dashboard = createDashboardCore({ goPage, getBadgeHtml, role });
//   await dashboard.load();   // à chaque affichage de la vue dashboard

import { eventBucket } from './adminContent.js';

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// "YYYY-MM-DD HH:MM:SS" (UTC, tel que stocké par D1) -> "12 juillet 2026, 14:32"
function formatJournalDate(sqlDate) {
  if (!sqlDate) return '—';
  const [datePart, timePart] = sqlDate.split(' ');
  const [y, m, d] = (datePart || '').split('-').map(Number);
  const [h, min] = (timePart || '').split(':');
  if (!y || !m || !d) return sqlDate;
  return `${d} ${MONTHS_FR[m - 1]} ${y}, ${h}:${min}`;
}

/**
 * @param {object} deps
 * @param {(pageKey: string) => void} deps.goPage
 * @param {(label: string, tone: string) => string} deps.getBadgeHtml
 * @param {'admin' | 'super_admin'} deps.role  Détermine si la section
 *   Gouvernance est chargée et affichée.
 */
export function createDashboardCore({ goPage, getBadgeHtml, role }) {
  // Les 4 KPI communs viennent uniquement de /api/admin/kpis (lib/stats.js
  // côté serveur) — jamais recalculés ici par .filter()/.length.
  async function load() {
    const [kpisRes, dataRes] = await Promise.all([
      fetch('/api/admin/kpis'),
      fetch('/api/admin/data'),
    ]);
    if (!kpisRes.ok) throw new Error('Erreur de récupération des statistiques.');
    if (!dataRes.ok) throw new Error('Erreur de récupération des données.');

    const kpis = await kpisRes.json();
    const data = await dataRes.json();

    renderKpis(kpis);
    renderPriorityItems(data.messages || []);
    renderCalendar(data.evenements || []);
    renderNextEvent(data.evenements || []);

    if (role === 'super_admin') {
      wireSubnav();
      await loadGovernance();
    }
  }

  // Segmented control « Opérations | Gouvernance » — Super Admin uniquement.
  // Bascule .hidden entre les deux panneaux déjà présents dans le markup
  // (DashboardCore.astro), retient le dernier onglet consulté en
  // sessionStorage (même pattern que superadmin-current-page), et gère les
  // flèches gauche/droite pour l'accessibilité clavier (rôle tablist).
  // idempotent : load() peut être rappelé à chaque retour sur la vue.
  let subnavWired = false;
  function wireSubnav() {
    const tabs = [...document.querySelectorAll('.dashcore-subnav-tab')];
    const opsPanel = document.getElementById('dashcore-ops-panel');
    const govPanel = document.getElementById('dashcore-gov-panel');
    if (!tabs.length || !opsPanel || !govPanel) return;

    function activate(target, { focus = false } = {}) {
      tabs.forEach((tab) => {
        const isActive = tab.dataset.target === target;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
        if (isActive && focus) tab.focus();
      });
      opsPanel.classList.toggle('hidden', target !== 'ops');
      govPanel.classList.toggle('hidden', target !== 'gov');
      try { sessionStorage.setItem('dashcore-subview', target); } catch {}
    }

    if (!subnavWired) {
      subnavWired = true;
      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => activate(tab.dataset.target));
        tab.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          activate(next.dataset.target, { focus: true });
        });
      });
    }

    let initial = 'ops';
    try {
      const saved = sessionStorage.getItem('dashcore-subview');
      if (saved === 'gov' || saved === 'ops') initial = saved;
    } catch {}
    activate(initial);
  }

  function renderKpis(kpis) {
    document.getElementById('stat-events-count').textContent = kpis.evenements_a_venir;
    document.getElementById('stat-members-count').textContent = kpis.inscriptions_evenements;
    document.getElementById('stat-news-count').textContent = kpis.actualites_publiees;
    document.getElementById('stat-census-count').textContent = kpis.personnes_recensees;
  }

  // « À traiter en priorité » : messages non lus/à traiter, présentés comme
  // des actions concrètes (lien direct vers la vue Messages).
  function renderPriorityItems(messages) {
    const container = document.getElementById('dashcore-priority-items');
    if (!container) return;
    container.innerHTML = '';

    const items = messages
      .filter((m) => m.status === 'Non lu' || m.status === 'À traiter')
      .map((m) => ({
        name: m.from_name, type: m.subject, status: m.status,
        tone: 'o', avatarBg: 'linear-gradient(150deg,#E97824,#1F2925)', action: 'messages',
      }));

    if (items.length === 0) {
      container.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--color-muted-text); font-size: 13.5px;">✓ Parfait ! Aucun message en attente.</div>';
      return;
    }

    items.forEach((it) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:14px; padding:14px 6px; border-bottom:1px solid rgba(31,41,37,0.06); flex-wrap:wrap;';
      row.innerHTML = `
        <div style="width:36px; height:36px; border-radius:50%; background:${it.avatarBg}; flex-shrink:0;"></div>
        <div style="flex:1; min-width:180px;">
          <div style="font-size:14px; font-weight:700; color:#1F2925;">${it.name} — ${it.type}</div>
        </div>
        ${getBadgeHtml(it.status, it.tone)}
        <a class="priority-item-action" style="font-size:13.5px; font-weight:700; color:#176B4D; cursor:pointer; text-decoration: underline;">Traiter →</a>
      `;
      row.querySelector('.priority-item-action').addEventListener('click', () => goPage(it.action));
      container.appendChild(row);
    });
  }

  // Mini-calendrier du mois courant, avec un repère sur les jours qui ont un
  // événement Ouvert. Utilise `event_date` (ISO AAAA-MM-JJ, la source de
  // vérité pour les dates depuis le tri chronologique des événements) —
  // plus de parsing du texte libre `date` affiché.
  function renderCalendar(events) {
    const calendarWrapper = document.getElementById('dashcore-calendar');
    if (!calendarWrapper) return;
    const dayHeaders = Array.from(calendarWrapper.querySelectorAll('div[style*="font-size:11px"]'));
    calendarWrapper.innerHTML = '';
    dayHeaders.forEach((dh) => calendarWrapper.appendChild(dh));

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const todayDate = today.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = lundi

    const monthLabel = document.getElementById('dashcore-calendar-month-label');
    if (monthLabel) monthLabel.textContent = `Calendrier — ${MONTHS_FR[month]} ${year}`;

    const eventDays = new Set();
    events.forEach((e) => {
      if (!e.event_date) return;
      const [y, m, d] = e.event_date.split('-').map(Number);
      if (y === year && m - 1 === month) eventDays.add(d);
    });

    for (let i = 0; i < firstWeekday; i++) {
      calendarWrapper.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === todayDate;
      const hasEvent = eventDays.has(d);
      const cell = document.createElement('div');
      cell.style.cssText = `aspect-ratio:1; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:12px; font-weight:600; background:${isToday ? '#E97824' : (hasEvent ? 'rgba(23,107,77,0.12)' : 'transparent')}; color:${isToday ? '#FFFFFF' : (hasEvent ? '#176B4D' : '#1F2925')};`;
      cell.textContent = d;
      calendarWrapper.appendChild(cell);
    }
  }

  function renderNextEvent(events) {
    const next = events.find((e) => eventBucket(e) === 'Ouvert');
    const titleEl = document.getElementById('dashcore-next-event-title');
    const dateEl = document.getElementById('dashcore-next-event-date');
    const placeEl = document.getElementById('dashcore-next-event-place');
    if (!titleEl) return;
    if (!next) {
      titleEl.textContent = 'Aucun événement ouvert';
      dateEl.textContent = '';
      placeEl.textContent = '';
      return;
    }
    titleEl.textContent = next.title;
    dateEl.textContent = next.date;
    placeEl.textContent = next.place;
  }

  // ---------------------------------------------------------- Gouvernance
  // Super Admin uniquement. Réutilise la route existante
  // (api/superadmin/stats.js) — aucune nouvelle route, aucun calcul dupliqué.
  //
  // Les 4 lignes "Attention requise" reprennent la maquette d'origine à
  // l'identique dans leur position, mais pas toutes ne sont des alertes
  // dynamiques : 2 sont réelles et conditionnelles (messages non traités
  // depuis 7 jours, événement sans image), 2 sont des informations fixes
  // ("Bientôt disponible" pour le suivi d'inactivité admin — aucune colonne
  // de dernière connexion n'existe encore ; rappel Cloudflare pour les
  // sauvegardes — jamais présenté comme une alerte, rien à vérifier
  // manuellement côté admin).
  async function loadGovernance() {
    const statsRes = await fetch('/api/superadmin/stats');
    const stats = statsRes.ok ? await statsRes.json() : null;
    if (!stats) return;

    document.getElementById('dashcore-gov-membres').textContent = stats.overview.membres;
    document.getElementById('dashcore-gov-adhesions-mois').textContent = stats.overview.adhesions_ce_mois;
    document.getElementById('dashcore-gov-evenements').textContent = stats.overview.evenements_a_venir;
    document.getElementById('dashcore-gov-demandes').textContent = stats.overview.demandes_a_traiter;
    document.getElementById('dashcore-gov-admins').textContent = stats.overview.admins_actifs;

    const attentionItems = [];
    if (stats.overview.messages_non_traites_7j > 0) {
      attentionItems.push({ text: `${stats.overview.messages_non_traites_7j} message(s) non traité(s) depuis plus de 7 jours.`, tone: 'alert' });
    }
    if (stats.overview.evenements_sans_image > 0) {
      attentionItems.push({ text: `${stats.overview.evenements_sans_image} événement(s) à venir sans image de couverture.`, tone: 'alert' });
    }
    attentionItems.push({ text: 'Suivi des comptes administrateurs inactifs', badge: 'Bientôt disponible', tone: 'info' });
    attentionItems.push({
      text: 'Sauvegardes gérées automatiquement par Cloudflare (D1 Time Travel).',
      tone: 'info',
      link: { href: 'https://developers.cloudflare.com/d1/reference/time-travel/', label: 'Voir la procédure ↗' },
    });

    const attWrapper = document.getElementById('dashcore-gov-attention-list');
    attWrapper.innerHTML = '';
    attentionItems.forEach((it) => {
      const isAlert = it.tone === 'alert';
      const item = document.createElement('div');
      item.style.cssText = `display:flex; align-items:center; gap:12px; padding:12px 14px; background:${isAlert ? 'rgba(233,120,36,0.08)' : 'rgba(31,41,37,0.03)'}; border-radius:12px; flex-wrap:wrap;`;
      item.innerHTML = `
        <span style="width:8px; height:8px; border-radius:50%; background:${isAlert ? '#E97824' : '#9aa39c'}; flex-shrink:0;"></span>
        <span style="font-size:13.5px; color:${isAlert ? '#1F2925' : '#5a655f'}; flex:1; min-width:200px;">${it.text}</span>
        ${it.badge ? `<span style="background:rgba(31,41,37,0.08); color:#5a655f; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700;">${it.badge}</span>` : ''}
        ${it.link ? `<a href="${it.link.href}" target="_blank" rel="noopener" style="font-size:12.5px; font-weight:700; color:#176B4D; text-decoration:underline;">${it.link.label}</a>` : ''}
      `;
      attWrapper.appendChild(item);
    });

    const actWrapper = document.getElementById('dashcore-gov-activity-list');
    actWrapper.innerHTML = '';
    const activity = stats.recent_activity || [];
    if (activity.length === 0) {
      actWrapper.innerHTML = '<div style="font-size:13.5px; color:#5a655f;">Aucune activité récente.</div>';
    }
    activity.forEach((l) => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; gap:12px; align-items:flex-start; font-size:14px; color:#3f4a45;';
      const firstName = (l.utilisateur_email || '').split('@')[0].split('.')[0] || 'Inconnu';
      const name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
      item.innerHTML = `
        <div style="width:8px; height:8px; border-radius:50%; background:#E97824; margin-top:7px; flex-shrink:0;"></div>
        <div>${name} — ${l.action}${l.details ? ` : ${l.details}` : ''}<span style="color:#9aa39c; font-size:12.5px; display:block; margin-top:2px;">${formatJournalDate(l.created_at)}</span></div>
      `;
      actWrapper.appendChild(item);
    });
  }

  return { load };
}
