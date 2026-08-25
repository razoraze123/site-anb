// Logique partagée des vues « Actualités », « Événements » et « Messages ».
//
// Ces trois vues sont identiques dans /admin et /superadmin : plutôt que de
// dupliquer ~600 lignes entre les deux pages, le markup vit dans
// src/components/admin/View*.astro et toute la logique ici.
//
// La page hôte injecte ce dont le module a besoin d'elle (navigation entre
// vues, rendu des badges), et lui fournit les données. Le module ne connaît
// donc rien de la structure de navigation propre à chaque espace.
//
// Usage :
//   const content = createAdminContent({ goPage, getBadgeHtml, onViewRegistrants });
//   content.setData(await content.fetchData());
//   content.wire();                  // une seule fois, au chargement
//   content.renderActualites();      // depuis le routeur de vues de la page

/**
 * @param {object} deps
 * @param {(pageKey: string) => void} deps.goPage  Navigation vers une vue.
 * @param {(label: string, tone: string) => string} deps.getBadgeHtml  Rendu d'un badge.
 * @param {((eventId: number) => void)} [deps.onViewRegistrants]  Appelé au clic sur
 *   « Inscrits » d'un événement. Si absent, le bouton n'est pas affiché — /superadmin
 *   n'a pas de vue Inscriptions, contrairement à /admin.
 */
// "Complet" n'est pas un statut stocké : un événement Ouvert dont le
// nombre d'inscrits atteint la capacité est complet, point — ça se
// recalcule à chaque lecture, rien à mettre à jour manuellement quand une
// inscription est ajoutée/supprimée. Terminé/Annulé restent des statuts
// posés à la main par un admin (boutons dédiés dans renderEvenements).
// Exporté (et pas seulement interne à createAdminContent) car des pages
// hôtes comme /admin en ont aussi besoin en dehors des vues partagées
// (ex. l'encart "prochain événement" du tableau de bord).
// BOM UTF-8 pour les exports CSV (Excel a besoin de ce marqueur pour
// reconnaître l'encodage) — String.fromCharCode plutôt qu'un caractère
// littéral ou un échappement \u, pour éviter tout risque de corruption
// d'encodage au moment de la sauvegarde du fichier.
const CSV_BOM = String.fromCharCode(0xFEFF);

// Échappement HTML minimal, utilisé pour tout champ pouvant provenir d'une
// source publique non authentifiée (formulaire de contact -> table
// `messages`) avant interpolation dans innerHTML. Contrairement aux
// actualités/événements (toujours créés par un compte Admin/Éditeur
// authentifié), un message peut désormais être écrit par n'importe quel
// visiteur anonyme : from_name/subject/content/email doivent être
// échappés partout où ils sont affichés dans l'espace admin.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function eventBucket(ev) {
  if (ev.status === 'Annulé') return 'Annulé';
  if (ev.status === 'Terminé') return 'Terminé';
  const full = ev.max_places > 0 && ev.registered_count >= ev.max_places;
  return full ? 'Complet' : 'Ouvert';
}

// ------------------------------------------------ upload d'image (partagé)
//
// Générique par `type` (ex. "news", "event", "draft" pour l'éditeur) —
// n'importe quelle page peut s'en servir tant qu'elle a les éléments
// `${type}-upload-zone`, `${type}-upload-placeholder`, `${type}-image-input`
// et `${type}-form-image-url` dans le DOM. Exporté (pas seulement interne à
// createAdminContent) pour que l'espace Éditeur, qui n'utilise pas le reste
// du module partagé, réutilise quand même le même système d'upload plutôt
// que d'en refaire un second.

export function isImageUrl(value) {
  return typeof value === 'string' && (value.startsWith('/') || value.startsWith('http'));
}

export function resetUploadZone(type) {
  const zone = document.getElementById(`${type}-upload-zone`);
  const placeholder = document.getElementById(`${type}-upload-placeholder`);
  const urlInput = document.getElementById(`${type}-form-image-url`);
  if (urlInput) urlInput.value = '';
  if (zone && placeholder) {
    zone.style.background = '#FFFFFF';
    placeholder.innerHTML = 'Glissez-déposez une image ici, ou cliquez pour parcourir';
  }
}

export function setUploadPreview(type, url) {
  const zone = document.getElementById(`${type}-upload-zone`);
  const placeholder = document.getElementById(`${type}-upload-placeholder`);
  const urlInput = document.getElementById(`${type}-form-image-url`);
  if (urlInput) urlInput.value = url;
  if (zone && placeholder) {
    zone.style.background = `url('${url}') center/cover no-repeat`;
    placeholder.innerHTML = '<span style="background:rgba(31,41,37,0.75); color:#FFFFFF; padding:6px 14px; border-radius:999px; font-weight:700;">Image chargée — cliquez pour remplacer</span>';
  }
}

// Réduit l'image côté navigateur avant l'envoi vers R2 (économise la bande
// passante et le stockage). En cas d'échec, on renvoie le fichier d'origine.
export async function compressImage(file, maxDimension = 1600, quality = 0.82) {
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400_000) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function handleImageUpload(file, type) {
  const zone = document.getElementById(`${type}-upload-zone`);
  const placeholder = document.getElementById(`${type}-upload-placeholder`);
  const urlInput = document.getElementById(`${type}-form-image-url`);
  if (!zone || !placeholder || !urlInput) return;

  // Galerie et Équipe n'acceptent que des photos (pas de vidéo) —
  // l'attribut `accept` du champ fichier ne filtre que le sélecteur, pas
  // un glisser-déposer, donc on revérifie ici avant tout upload. N'affecte
  // que ces deux types : Actualités/Événements gardent leur comportement
  // exact d'avant (accept="image/*", pas de cette vérification).
  if ((type === 'galerie' || type === 'equipe') && !file.type.startsWith('image/')) {
    placeholder.innerHTML = '<span style="color:#B14524; font-weight:700;">❌ Seules les images sont acceptées (JPEG, PNG, WebP, GIF) — pas de vidéo.</span>';
    return;
  }

  placeholder.innerHTML = '<span style="color:#176B4D; font-weight:700;">Compression de l\'image…</span>';
  zone.style.opacity = '0.7';
  const compressed = await compressImage(file);
  placeholder.innerHTML = '<span style="color:#176B4D; font-weight:700;">Téléversement en cours…</span>';

  const formData = new FormData();
  formData.append('file', compressed);

  try {
    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Erreur de téléversement R2');
    const payload = await res.json();
    zone.style.opacity = '1';
    setUploadPreview(type, payload.url);
  } catch (err) {
    zone.style.opacity = '1';
    zone.style.background = '#FFFFFF';
    placeholder.innerHTML = `<span style="color:#B14524; font-weight:700;">❌ Échec : ${err.message}</span>`;
  }
}

export function wireUploadZone(type) {
  const zone = document.getElementById(`${type}-upload-zone`);
  const input = document.getElementById(`${type}-image-input`);
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.style.borderColor = '#176B4D';
    zone.style.background = 'rgba(23,107,77,0.03)';
  });
  zone.addEventListener('dragleave', () => {
    zone.style.borderColor = '#d8cfb8';
    zone.style.background = '#FFFFFF';
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.style.borderColor = '#d8cfb8';
    zone.style.background = '#FFFFFF';
    if (e.dataTransfer.files?.[0]) handleImageUpload(e.dataTransfer.files[0], type);
  });
  input.addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleImageUpload(e.target.files[0], type);
  });
}

export function createAdminContent({ goPage, getBadgeHtml, onViewRegistrants }) {
  // galerie/equipe ne sont volontairement pas dans ce data partagé ni dans
  // fetchData()/setData() : indépendantes des Actualités/Événements
  // (media_galerie/equipe, pas les mêmes tables), elles se rechargent
  // elles-mêmes via renderGalerie()/renderEquipe() plutôt que via le
  // cycle refresh() commun.
  const data = { actualites: [], evenements: [], messages: [], inscriptions: [], recensement: [], galerie: [], equipe: [] };

  const state = {
    newsTab: 'Publiées',
    eventsFilter: 'Ouvert',
    messagesTab: 'Tous',
    messageSelectedIdx: 0,
    editingNewsId: null,
    editingEventId: null,
    editingGalerieId: null,
    editingEquipeId: null,
    // Id d'événement à présélectionner la prochaine fois que la vue
    // Inscrits s'affiche (posé par le bouton "Inscrits" d'une carte
    // événement, consommé une fois par renderInscriptions()).
    pendingInscriptionsEventId: null,
    recensementFilter: 'Tous',
    validationSelectedIdx: 0,
  };

  // Recherche texte libre de la vue Recensement — pas dans `state` (même
  // choix que dans l'ancien admin.astro : ce n'est pas une donnée de
  // navigation, juste l'état local d'un champ de saisie).
  let recensementSearch = '';

  // ---------------------------------------------------------------- données

  async function fetchData() {
    const res = await fetch('/api/admin/data');
    if (!res.ok) throw new Error('Erreur de récupération des données');
    return res.json();
  }

  function setData(payload) {
    data.actualites = payload.actualites || [];
    data.evenements = payload.evenements || [];
    data.messages = payload.messages || [];
    data.inscriptions = payload.inscriptions || [];
    data.recensement = payload.recensement || [];
  }

  /** Recharge les données depuis l'API puis rejoue le rendu demandé. */
  async function refresh(rerender) {
    setData(await fetchData());
    if (rerender) rerender();
  }

  // ------------------------------------------------------- helpers partagés
  // isImageUrl / resetUploadZone / setUploadPreview / compressImage /
  // handleImageUpload / wireUploadZone sont désormais des exports du module
  // (voir plus haut) — accessibles ici tels quels par portée lexicale.

  function coverStyleFor(value) {
    return isImageUrl(value)
      ? `background: url('${value}') center/cover no-repeat;`
      : `background: ${value};`;
  }

  function renderTabs(wrapperSelector, tabDefs, currentValue, onSelect) {
    const wrapper = document.querySelector(wrapperSelector);
    if (!wrapper) return;
    wrapper.innerHTML = '';
    tabDefs.forEach((label) => {
      const btn = document.createElement('button');
      btn.style.cssText = 'border:2px solid #176B4D; padding:9px 18px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:pointer;';
      if (currentValue === label) {
        btn.style.background = '#176B4D';
        btn.style.color = '#FFFFFF';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#176B4D';
      }
      btn.textContent = label;
      btn.addEventListener('click', () => onSelect(label));
      wrapper.appendChild(btn);
    });
  }

  // Menu contextuel « ⋯ » générique (actions secondaires d'une carte).
  // Positionné en `fixed` et ajouté à <body> plutôt qu'à l'intérieur de la
  // carte : les cartes ont `overflow:hidden` (pour les coins arrondis de
  // l'image de couverture), un menu en position absolue à l'intérieur
  // serait donc coupé.
  let closeOpenActionsMenu = null;

  function openActionsMenu(anchorBtn, items) {
    const reopening = closeOpenActionsMenu;
    if (reopening) reopening();
    // Un deuxième clic sur le même bouton doit juste refermer le menu, pas
    // le rouvrir aussitôt.
    if (reopening && reopening.anchor === anchorBtn) return;

    const MENU_WIDTH = 190;
    const MARGIN = 8;
    const rect = anchorBtn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.style.cssText = `position:fixed; width:${MENU_WIDTH}px; background:#FFFFFF; border-radius:12px; box-shadow:0 12px 32px rgba(31,41,37,0.18); padding:6px; z-index:1000; display:flex; flex-direction:column; gap:2px; visibility:hidden;`;

    items.forEach(({ label, onClick, danger }) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = label;
      item.style.cssText = `text-align:left; background:none; border:none; padding:10px 12px; border-radius:8px; font-size:13.5px; font-weight:700; cursor:pointer; color:${danger ? '#B14524' : '#1F2925'};`;
      item.addEventListener('mouseenter', () => { item.style.background = danger ? 'rgba(177,69,36,0.08)' : '#F8F4EC'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
      item.addEventListener('click', () => {
        close();
        onClick();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Positionné une fois la vraie hauteur connue (dépend du nombre
    // d'items) — recalé pour ne JAMAIS déborder du viewport visible :
    // au-dessus du bouton s'il n'y a pas la place en dessous, et clampé
    // horizontalement. Sans ça, le menu d'une carte en bas de page se
    // retrouvait hors écran, impossible à voir ni à utiliser.
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuHeight + MARGIN
      ? rect.bottom + 6
      : Math.max(MARGIN, rect.top - menuHeight - 6);
    const left = Math.min(
      Math.max(MARGIN, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - MARGIN
    );
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = 'visible';

    function close() {
      menu.remove();
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onEscape, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      closeOpenActionsMenu = null;
    }
    function onOutside(e) {
      if (!menu.contains(e.target) && e.target !== anchorBtn) close();
    }
    function onEscape(e) {
      if (e.key === 'Escape') close();
    }
    // setTimeout : évite que le mousedown qui a ouvert le menu (le clic sur
    // "⋯") ne le referme immédiatement via onOutside.
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
    document.addEventListener('keydown', onEscape, true);
    // Le menu est en `position:fixed` : il ne suit pas la carte pendant un
    // scroll. Le fermer au scroll évite qu'il reste affiché, décroché de
    // son bouton, par-dessus le contenu — le scroll de la page, lui,
    // n'a jamais été bloqué par ce menu.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    close.anchor = anchorBtn;
    closeOpenActionsMenu = close;
  }


  // ------------------------------------------------------------ Actualités

  function renderActualites() {
    // Un admin/super-admin publie toujours directement (le formulaire n'a
    // pas de champ statut) — pas de notion de brouillon ni de programmation
    // ici. Les statuts intermédiaires de l'éditeur (Brouillon/En attente/
    // Renvoyé) restent gérés dans son propre espace et dans la vue
    // "Contenus & validations" du super-admin, pas dans cette liste.
    const statusMap = { Publiées: 'Publié', Archivées: 'Archivé' };
    renderTabs('.news-tab-container', Object.keys(statusMap), state.newsTab, (label) => {
      state.newsTab = label;
      renderActualites();
    });

    const container = document.getElementById('news-list-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = data.actualites.filter((n) => n.status === statusMap[state.newsTab]);
    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--color-muted-text); font-size: 14.5px;">Aucune actualité dans cette rubrique.</div>';
      return;
    }

    filtered.forEach((n) => {
      const tone = n.status === 'Publié' ? 'g' : (n.status === 'Archivé' ? 'n' : 'o');
      const card = document.createElement('div');
      card.style.cssText = 'display:flex; align-items:center; gap:16px; padding:16px; border-bottom:1px solid rgba(31,41,37,0.06); flex-wrap:wrap;';
      card.innerHTML = `
        <div style="width:64px; height:48px; border-radius:10px; ${coverStyleFor(n.bg_gradient)} flex-shrink:0;"></div>
        <div style="flex:2; min-width:220px;">
          <div style="font-size:14.5px; font-weight:700; color:#1F2925;">${n.title}</div>
          <div style="font-size:12.5px; color:#5a655f; margin-top:3px;">${n.category}</div>
        </div>
        <div style="font-size:12.5px; color:#5a655f; min-width:120px;">Modifié le ${n.created_at.split(' ')[0]}</div>
        <div style="display:flex; align-items:center; gap:10px; margin-left:auto;">
          ${getBadgeHtml(n.status, tone)}
          <button class="archive-news-btn" style="background:#F8F4EC; border:none; padding:8px 14px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; color:#1F2925;">${n.status === 'Archivé' ? 'Publier' : 'Archiver'}</button>
          <button class="edit-news-btn" style="background:#F8F4EC; border:none; padding:8px 14px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; color:#176B4D;">Modifier</button>
          <button class="delete-news-btn" style="background:rgba(177,69,36,0.08); border:none; padding:8px 14px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; color:#B14524;">Supprimer</button>
        </div>
      `;

      card.querySelector('.delete-news-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`Supprimer définitivement l'actualité « ${n.title} » ? Cette action est irréversible.`)) return;
        try {
          const res = await fetch(`/api/admin/news?id=${n.id}`, { method: 'DELETE' });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error || 'Erreur lors de la suppression.');
          await refresh(renderActualites);
        } catch (err) {
          alert(err.message);
        }
      });

      // Archiver retire l'article du site public sans le supprimer ; Publier
      // le fait redevenir visible. Réservé à admin/super-admin côté API (un
      // éditeur ne peut pas passer par ce bouton — le circuit éditeur reste
      // brouillon -> soumission -> validation).
      card.querySelector('.archive-news-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const nextStatus = n.status === 'Archivé' ? 'Publié' : 'Archivé';
        try {
          const res = await fetch('/api/admin/news', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: n.id, title: n.title, slug: n.slug, excerpt: n.excerpt,
              content: n.content, category: n.category, bg_gradient: n.bg_gradient,
              status: nextStatus,
            }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error || 'Erreur serveur');
          await refresh(renderActualites);
        } catch (err) {
          alert(err.message);
        }
      });

      card.querySelector('.edit-news-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.editingNewsId = n.id;
        goPage('actualites-new');
        document.getElementById('news-form-title').value = n.title;
        document.getElementById('news-form-slug').textContent = '/actualites/' + n.slug;
        document.getElementById('news-form-excerpt').value = n.excerpt;
        document.getElementById('news-form-content').value = n.content;
        document.getElementById('news-form-category').value = n.category;
        if (isImageUrl(n.bg_gradient)) setUploadPreview('news', n.bg_gradient);
        else resetUploadZone('news');
        document.querySelector('#view-actualites-new h1').textContent = "Modifier l'actualité";
        document.getElementById('publish-news-submit-btn').textContent = 'Sauvegarder les modifications';
      });

      container.appendChild(card);
    });
  }

  function resetNewsForm() {
    state.editingNewsId = null;
    ['news-form-title', 'news-form-excerpt', 'news-form-content'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const slugDisplay = document.getElementById('news-form-slug');
    if (slugDisplay) slugDisplay.textContent = '/actualites/';
    resetUploadZone('news');
    const heading = document.querySelector('#view-actualites-new h1');
    if (heading) heading.textContent = 'Nouvelle actualité';
    const submitBtn = document.getElementById('publish-news-submit-btn');
    if (submitBtn) submitBtn.textContent = "Publier l'actualité";
  }

  // ---------------------------------------------------------------- Galerie
  //
  // media_galerie est la source de vérité de /galerie et de la galerie de
  // la home (remplace demo-data.ts fullGallery/homeGallery). Se recharge
  // elle-même via GET /api/galerie (route publique, mêmes données que ce
  // que l'admin lit) — pas de route /api/admin/galerie en GET séparée,
  // rien de sensible à cacher dans ces métadonnées.

  async function renderGalerie() {
    const container = document.getElementById('galerie-list-container');
    if (!container) return;

    try {
      const res = await fetch('/api/galerie');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Erreur de chargement.');
      data.galerie = payload.medias || [];
    } catch (err) {
      container.innerHTML = `<div style="padding: 30px; text-align: center; color: #B14524; font-size: 14.5px;">${escapeHtml(err.message)}</div>`;
      return;
    }

    container.innerHTML = '';
    if (data.galerie.length === 0) {
      container.innerHTML = '<div style="grid-column:1/-1; padding: 30px; text-align: center; color: var(--color-muted-text); font-size: 14.5px;">Aucun média dans la galerie pour l\'instant.</div>';
      return;
    }

    data.galerie.forEach((m) => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(31,41,37,0.05); display:flex; flex-direction:column;';
      card.innerHTML = `
        <div style="aspect-ratio:4/3; background:url('${m.url}') center/cover no-repeat, #F8F4EC;"></div>
        <div style="padding:14px; display:flex; flex-direction:column; gap:6px; flex:1;">
          <div style="font-size:14px; font-weight:700; color:#1F2925;">${escapeHtml(m.titre)}</div>
          <div style="font-size:12px; color:#5a655f;">${escapeHtml(m.credit)}</div>
          <div style="font-size:11.5px; color:#9aa39c;">${(m.created_at || '').split(' ')[0]}</div>
          <div style="display:flex; gap:8px; margin-top:auto; padding-top:8px;">
            <button class="edit-galerie-btn" style="flex:1; background:#F8F4EC; border:none; padding:8px 10px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; color:#176B4D;">Modifier</button>
            <button class="delete-galerie-btn" style="flex:1; background:rgba(177,69,36,0.08); border:none; padding:8px 10px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; color:#B14524;">Supprimer</button>
          </div>
        </div>
      `;

      card.querySelector('.edit-galerie-btn').addEventListener('click', () => {
        state.editingGalerieId = m.id;
        goPage('galerie-new');
        document.getElementById('galerie-form-titre').value = m.titre;
        document.getElementById('galerie-form-alt').value = m.texte_alternatif;
        document.getElementById('galerie-form-credit').value = m.credit;
        setUploadPreview('galerie', m.url);
        // nom_fichier existant, jamais ré-uploadé lors d'une simple
        // modification de métadonnées.
        document.getElementById('galerie-form-image-url').dataset.existingKey = m.nom_fichier;
        document.querySelector('#view-galerie-new h1').textContent = 'Modifier le média';
        document.getElementById('publish-galerie-submit-btn').textContent = 'Sauvegarder les modifications';
      });

      card.querySelector('.delete-galerie-btn').addEventListener('click', async () => {
        if (!confirm(`Supprimer définitivement « ${m.titre} » ? Le fichier sera aussi retiré de R2. Cette action est irréversible.`)) return;
        try {
          const res = await fetch(`/api/admin/galerie?id=${m.id}`, { method: 'DELETE' });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Erreur lors de la suppression.');
          await renderGalerie();
        } catch (err) {
          alert(err.message);
        }
      });

      container.appendChild(card);
    });
  }

  function resetGalerieForm() {
    state.editingGalerieId = null;
    ['galerie-form-titre', 'galerie-form-alt', 'galerie-form-credit'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    resetUploadZone('galerie');
    const urlInput = document.getElementById('galerie-form-image-url');
    if (urlInput) delete urlInput.dataset.existingKey;
    const heading = document.querySelector('#view-galerie-new h1');
    if (heading) heading.textContent = 'Ajouter un média';
    const submitBtn = document.getElementById('publish-galerie-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Ajouter à la galerie';
  }

  function wireGalerieForm() {
    document.getElementById('publish-galerie-submit-btn')?.addEventListener('click', async () => {
      const titre = document.getElementById('galerie-form-titre').value.trim();
      const texte_alternatif = document.getElementById('galerie-form-alt').value.trim();
      const credit = document.getElementById('galerie-form-credit').value.trim();
      // Galerie = photos uniquement pour l'instant, jamais de vidéo (plus
      // de champ Type dans le formulaire).
      const type = 'Photo';
      const urlInput = document.getElementById('galerie-form-image-url');
      const imageUrl = urlInput.value;
      // Nouvel upload : URL "/api/media/{key}" -> on isole la clé réelle.
      // Modification sans changer le fichier : on garde la clé d'origine.
      const nom_fichier = imageUrl
        ? imageUrl.replace('/api/media/', '')
        : urlInput.dataset.existingKey;

      if (!titre || !texte_alternatif || !credit) {
        alert('Veuillez remplir le titre, le texte alternatif et le crédit.');
        return;
      }
      if (!nom_fichier) {
        alert('Veuillez téléverser un fichier.');
        return;
      }

      const isEdit = state.editingGalerieId !== null;
      try {
        const res = await fetch('/api/admin/galerie', {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isEdit
              ? { id: state.editingGalerieId, nom_fichier, titre, texte_alternatif, credit, type }
              : { nom_fichier, titre, texte_alternatif, credit, type }
          ),
        });
        if (!res.ok) {
          const errBody = await res.json();
          throw new Error(errBody.error || "Erreur lors de l'enregistrement");
        }

        const alertBox = document.getElementById('galerie-publish-success-alert');
        alertBox?.classList.remove('hidden');
        await renderGalerie();

        setTimeout(() => {
          alertBox?.classList.add('hidden');
          resetGalerieForm();
          goPage('galerie');
        }, 1200);
      } catch (err) {
        alert('Erreur de sauvegarde : ' + err.message);
      }
    });
  }

  // ----------------------------------------------------------------- Équipe
  //
  // equipe est la source de vérité du bloc Bureau/Équipe de /association
  // (remplace demo-data.ts teamMembers). Se recharge elle-même via
  // GET /api/admin/equipe (tous les membres, actifs ou non — nécessaire
  // pour pouvoir réactiver quelqu'un ; la route publique /api/equipe ne
  // sert qu'à /association, filtrée sur actif=1).

  async function renderEquipe() {
    const container = document.getElementById('equipe-list-container');
    if (!container) return;

    try {
      const res = await fetch('/api/admin/equipe');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Erreur de chargement.');
      data.equipe = payload.membres || [];
    } catch (err) {
      container.innerHTML = `<div style="padding: 30px; text-align: center; color: #B14524; font-size: 14.5px;">${escapeHtml(err.message)}</div>`;
      return;
    }

    container.innerHTML = '';
    if (data.equipe.length === 0) {
      container.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--color-muted-text); font-size: 14.5px;">Aucun membre dans l\'équipe pour l\'instant.</div>';
      return;
    }

    data.equipe.forEach((m, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === data.equipe.length - 1;
      const thumb = m.photo_url
        ? `background:url('${m.photo_url}') center/cover no-repeat;`
        : `background:linear-gradient(150deg,#176B4D,#1F2925);`;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:14px; padding:14px 16px; background:#FFFFFF; border-radius:14px; box-shadow:0 8px 24px rgba(31,41,37,0.05); flex-wrap:wrap;';
      row.innerHTML = `
        <div style="width:48px; height:48px; border-radius:50%; flex-shrink:0; ${thumb}"></div>
        <div style="flex:1; min-width:180px;">
          <div style="font-size:14px; font-weight:700; color:#1F2925;">${escapeHtml(m.nom)}</div>
          <div style="font-size:12.5px; color:#5a655f;">${escapeHtml(m.fonction)}</div>
        </div>
        ${getBadgeHtml(m.actif ? 'Actif' : 'Désactivé', m.actif ? 'g' : 'n')}
        <div style="display:flex; gap:6px; align-items:center;">
          <button class="order-up-equipe-btn" ${isFirst ? 'disabled' : ''} title="Monter" style="width:30px; height:30px; border-radius:8px; background:#F8F4EC; border:none; cursor:${isFirst ? 'default' : 'pointer'}; opacity:${isFirst ? '0.4' : '1'}; font-weight:700;">↑</button>
          <button class="order-down-equipe-btn" ${isLast ? 'disabled' : ''} title="Descendre" style="width:30px; height:30px; border-radius:8px; background:#F8F4EC; border:none; cursor:${isLast ? 'default' : 'pointer'}; opacity:${isLast ? '0.4' : '1'}; font-weight:700;">↓</button>
          <button class="toggle-actif-equipe-btn" style="background:#F8F4EC; border:none; padding:8px 12px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; color:#1F2925;">${m.actif ? 'Désactiver' : 'Activer'}</button>
          <button class="edit-equipe-btn" style="background:#F8F4EC; border:none; padding:8px 12px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; color:#176B4D;">Modifier</button>
          <button class="delete-equipe-btn" style="background:rgba(177,69,36,0.08); border:none; padding:8px 12px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; color:#B14524;">Supprimer</button>
        </div>
      `;

      async function saveMember(patch) {
        const res = await fetch('/api/admin/equipe', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: m.id, nom: m.nom, fonction: m.fonction, photo: m.photo, ordre: m.ordre, actif: m.actif, ...patch }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Erreur serveur.');
      }

      row.querySelector('.order-up-equipe-btn').addEventListener('click', async () => {
        if (isFirst) return;
        const neighbor = data.equipe[idx - 1];
        try {
          // Échange simple des deux ordres (deux PUT successifs) — pas de
          // route de réordonnancement en lot, cohérent avec le reste de
          // l'API (une action = un PUT).
          await fetch('/api/admin/equipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, nom: m.nom, fonction: m.fonction, photo: m.photo, actif: m.actif, ordre: neighbor.ordre }) });
          await fetch('/api/admin/equipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neighbor.id, nom: neighbor.nom, fonction: neighbor.fonction, photo: neighbor.photo, actif: neighbor.actif, ordre: m.ordre }) });
          await renderEquipe();
        } catch (err) {
          alert(err.message);
        }
      });

      row.querySelector('.order-down-equipe-btn').addEventListener('click', async () => {
        if (isLast) return;
        const neighbor = data.equipe[idx + 1];
        try {
          await fetch('/api/admin/equipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, nom: m.nom, fonction: m.fonction, photo: m.photo, actif: m.actif, ordre: neighbor.ordre }) });
          await fetch('/api/admin/equipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neighbor.id, nom: neighbor.nom, fonction: neighbor.fonction, photo: neighbor.photo, actif: neighbor.actif, ordre: m.ordre }) });
          await renderEquipe();
        } catch (err) {
          alert(err.message);
        }
      });

      row.querySelector('.toggle-actif-equipe-btn').addEventListener('click', async () => {
        try {
          await saveMember({ actif: m.actif ? 0 : 1 });
          await renderEquipe();
        } catch (err) {
          alert(err.message);
        }
      });

      row.querySelector('.edit-equipe-btn').addEventListener('click', () => {
        state.editingEquipeId = m.id;
        goPage('equipe-new');
        document.getElementById('equipe-form-nom').value = m.nom;
        document.getElementById('equipe-form-fonction').value = m.fonction;
        if (m.photo_url) setUploadPreview('equipe', m.photo_url);
        else resetUploadZone('equipe');
        // Photo existante, jamais ré-uploadée si l'admin ne change rien.
        document.getElementById('equipe-form-image-url').dataset.existingKey = m.photo || '';
        document.querySelector('#view-equipe-new h1').textContent = 'Modifier le membre';
        document.getElementById('publish-equipe-submit-btn').textContent = 'Sauvegarder les modifications';
      });

      row.querySelector('.delete-equipe-btn').addEventListener('click', async () => {
        if (!confirm(`Supprimer définitivement « ${m.nom} » de l'équipe ? ${m.photo ? 'Sa photo sera aussi retirée de R2. ' : ''}Cette action est irréversible.`)) return;
        try {
          const res = await fetch(`/api/admin/equipe?id=${m.id}`, { method: 'DELETE' });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Erreur lors de la suppression.');
          await renderEquipe();
        } catch (err) {
          alert(err.message);
        }
      });

      container.appendChild(row);
    });
  }

  function resetEquipeForm() {
    state.editingEquipeId = null;
    ['equipe-form-nom', 'equipe-form-fonction'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    resetUploadZone('equipe');
    const urlInput = document.getElementById('equipe-form-image-url');
    if (urlInput) delete urlInput.dataset.existingKey;
    const heading = document.querySelector('#view-equipe-new h1');
    if (heading) heading.textContent = 'Ajouter un membre';
    const submitBtn = document.getElementById('publish-equipe-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Ajouter à l\'équipe';
  }

  function wireEquipeForm() {
    document.getElementById('publish-equipe-submit-btn')?.addEventListener('click', async () => {
      const nom = document.getElementById('equipe-form-nom').value.trim();
      const fonction = document.getElementById('equipe-form-fonction').value.trim();
      const urlInput = document.getElementById('equipe-form-image-url');
      const imageUrl = urlInput.value;
      // Nouvel upload : URL "/api/media/{key}" -> on isole la clé réelle.
      // Pas de nouvel upload : on garde la photo existante (ou aucune).
      const photo = imageUrl
        ? imageUrl.replace('/api/media/', '')
        : (urlInput.dataset.existingKey || null);

      if (!nom || !fonction) {
        alert('Veuillez remplir le nom et la fonction.');
        return;
      }

      const isEdit = state.editingEquipeId !== null;
      try {
        const res = await fetch('/api/admin/equipe', {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isEdit
              ? (() => {
                  const existing = data.equipe.find((mb) => mb.id === state.editingEquipeId);
                  return { id: state.editingEquipeId, nom, fonction, photo, actif: existing?.actif ?? 1, ordre: existing?.ordre ?? 0 };
                })()
              : { nom, fonction, photo }
          ),
        });
        if (!res.ok) {
          const errBody = await res.json();
          throw new Error(errBody.error || "Erreur lors de l'enregistrement");
        }

        const alertBox = document.getElementById('equipe-publish-success-alert');
        alertBox?.classList.remove('hidden');
        await renderEquipe();

        setTimeout(() => {
          alertBox?.classList.add('hidden');
          resetEquipeForm();
          goPage('equipe');
        }, 1200);
      } catch (err) {
        alert('Erreur de sauvegarde : ' + err.message);
      }
    });
  }

  // ------------------------------------------------------------ Événements

  // Le backend attend toujours `date` comme un simple texte affiché tel
  // quel (aucun changement de schéma pour ce champ) — ces deux fonctions
  // ne servent qu'à donner à l'admin un vrai calendrier/horaire en
  // interface, tout en produisant/relisant le même format texte qu'avant
  // ("20 sept. 2026 — 11h00").
  const FRENCH_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const FRENCH_MONTH_LOOKUP = {
    'janv': 0, 'janvier': 0, 'févr': 1, 'fevrier': 1, 'février': 1, 'mars': 2,
    'avr': 3, 'avril': 3, 'mai': 4, 'juin': 5, 'juil': 6, 'juillet': 6,
    'août': 7, 'aout': 7, 'sept': 8, 'septembre': 8, 'oct': 9, 'octobre': 9,
    'nov': 10, 'novembre': 10, 'déc': 11, 'decembre': 11, 'décembre': 11,
  };

  function formatEventDateText(dateValue, timeValue) {
    if (!dateValue) return '';
    const [y, m, d] = dateValue.split('-').map(Number);
    const base = `${d} ${FRENCH_MONTHS[m - 1]} ${y}`;
    return timeValue ? `${base} — ${timeValue.replace(':', 'h')}` : base;
  }

  // Best-effort : les événements créés avant ce formulaire (ou via le seed)
  // ont des dates en texte libre pas toujours structurées ("juin 2026",
  // "à définir"...). Quand on n'arrive pas à en extraire un jour exact, le
  // sélecteur de date reste vide plutôt que de deviner — l'admin repart
  // d'une sélection propre au lieu d'un texte non fiable.
  function parseEventDateText(text) {
    if (!text) return { date: '', time: '' };
    const m = text.match(/^(\d{1,2})\s+([a-zA-Zéûîôâêàäëïöü]+)\.?\s+(\d{4})(?:\s*—\s*(\d{1,2})h(\d{2}))?/i);
    if (!m) return { date: '', time: '' };
    const [, day, monthWord, year, hh, mm] = m;
    const monthIdx = FRENCH_MONTH_LOOKUP[monthWord.toLowerCase().replace(/\.$/, '')];
    if (monthIdx === undefined) return { date: '', time: '' };
    const date = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const time = hh !== undefined ? `${hh.padStart(2, '0')}:${mm}` : '';
    return { date, time };
  }

  function renderEvenements() {
    // Le menu "⋯" vit dans <body>, pas dans #events-list-container : s'il
    // reste ouvert au moment où on change d'onglet ou qu'on rafraîchit la
    // liste, il faut le fermer explicitement (sinon il flotte, orphelin,
    // par-dessus le nouveau contenu).
    if (closeOpenActionsMenu) closeOpenActionsMenu();

    renderTabs('.events-tab-container', ['Ouvert', 'Complet', 'Terminé', 'Annulé'], state.eventsFilter, (label) => {
      state.eventsFilter = label;
      renderEvenements();
    });

    // Encart « Mis en avant » : le premier événement encore ouvert (ni
    // complet, ni terminé, ni annulé).
    const promo = data.evenements.find((e) => eventBucket(e) === 'Ouvert');
    const promoTitle = document.getElementById('promo-event-title');
    const promoDetails = document.getElementById('promo-event-details');
    const promoCover = document.getElementById('promo-event-cover');
    if (promoTitle && promoDetails) {
      promoTitle.textContent = promo ? promo.title : 'Aucun événement ouvert';
      promoDetails.textContent = promo ? `${promo.date} · ${promo.place}` : '—';
      if (promoCover && promo) promoCover.style.cssText += coverStyleFor(promo.bg_gradient);
    }

    const container = document.getElementById('events-list-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = data.evenements.filter((e) => eventBucket(e) === state.eventsFilter);
    if (filtered.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--color-muted-text); font-size: 14.5px;">Aucun événement dans cette rubrique.</div>';
      return;
    }

    filtered.forEach((ev) => {
      const bucket = eventBucket(ev);
      const tone = { Ouvert: 'g', Complet: 'o', Terminé: 'n', Annulé: 'r' }[bucket];
      const card = document.createElement('div');
      card.style.cssText = 'background:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 8px 24px rgba(31,41,37,0.05); display: flex; flex-direction: column;';
      card.innerHTML = `
        <div style="aspect-ratio:16/9; ${coverStyleFor(ev.bg_gradient)}"></div>
        <div style="padding:20px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
              <div style="font-size:12px; font-weight:700; color:#E97824; text-transform:uppercase;">${ev.category} · ${ev.date}</div>
              ${getBadgeHtml(bucket, tone)}
            </div>
            <h3 style="font-size:16px; font-weight:700; color:#1F2925; margin:0 0 6px;">${ev.title}</h3>
            <p style="font-size:13px; color:#5a655f; margin:0 0 4px;">${ev.place} · ${ev.registered_count}/${ev.max_places} inscrits</p>
            <p style="font-size:12.5px; margin:0 0 16px;">${getBadgeHtml(ev.inscriptions_ouvertes ? 'Inscriptions ouvertes' : 'Inscriptions fermées', ev.inscriptions_ouvertes ? 'g' : 'n')}</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${onViewRegistrants ? '<button class="view-registrants-btn" style="flex:1; background:#F8F4EC; border:none; padding:10px; border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; color:#1F2925;">Inscrits</button>' : ''}
            <button class="edit-event-btn" style="flex:1; background:#176B4D; border:none; padding:10px; border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; color:#FFFFFF;">Modifier</button>
            <button class="more-event-actions-btn" aria-label="Plus d'actions" style="background:#F8F4EC; border:none; width:38px; padding:10px 0; border-radius:999px; font-size:16px; font-weight:700; cursor:pointer; color:#1F2925; line-height:1;">⋯</button>
          </div>
        </div>
      `;

      card.querySelector('.view-registrants-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        onViewRegistrants(ev.id);
      });

      // Bascule de statut : envoie toujours la ligne complète (comme
      // "Modifier" le ferait), avec juste `status` en plus — même
      // architecture que le bouton Archiver/Publier des actualités.
      // Logique inchangée : simplement déplacée du bouton de carte vers
      // une entrée du menu "⋯".
      async function setEventStatus(newStatus) {
        try {
          const res = await fetch('/api/admin/events', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: ev.id, title: ev.title, date: ev.date, event_date: ev.event_date, place: ev.place,
              category: ev.category, max_places: ev.max_places,
              inscriptions_ouvertes: ev.inscriptions_ouvertes,
              bg_gradient: ev.bg_gradient, status: newStatus,
            }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error || 'Erreur serveur');
          await refresh(renderEvenements);
        } catch (err) {
          alert(err.message);
        }
      }

      function completeEvent() {
        if (!confirm(`Marquer « ${ev.title} » comme terminé ? Il restera visible publiquement mais ne sera plus inscriptible.`)) return;
        setEventStatus('Terminé');
      }

      function cancelEvent() {
        if (!confirm(`Annuler « ${ev.title} » ? Il disparaîtra du site public mais restera visible ici, et ses inscriptions existantes sont conservées.`)) return;
        setEventStatus('Annulé');
      }

      // L'API refuse en 409 tant que la perte des inscriptions liées n'est
      // pas explicitement confirmée (ON DELETE CASCADE côté schéma).
      async function deleteEvent() {
        if (!confirm(`Supprimer définitivement l'événement « ${ev.title} » ?`)) return;
        try {
          let res = await fetch(`/api/admin/events?id=${ev.id}`, { method: 'DELETE' });
          let payload = await res.json();

          if (res.status === 409 && payload.needsConfirmation) {
            if (!confirm(`Cet événement a ${payload.inscrits} inscription(s). Elles seront supprimées elles aussi. Confirmer ?`)) return;
            res = await fetch(`/api/admin/events?id=${ev.id}&confirm=1`, { method: 'DELETE' });
            payload = await res.json();
          }

          if (!res.ok) throw new Error(payload.error || 'Erreur lors de la suppression.');
          await refresh(renderEvenements);
        } catch (err) {
          alert(err.message);
        }
      }

      // Contenu du menu selon le statut (règle métier inchangée : Terminé
      // reste une action manuelle, jamais proposée si déjà Terminé/Annulé ;
      // Annuler reste possible tant que ce n'est pas déjà Annulé).
      card.querySelector('.more-event-actions-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const items = [];
        if (ev.status === 'Ouvert') items.push({ label: 'Marquer comme terminé', onClick: completeEvent });
        if (ev.status !== 'Annulé') items.push({ label: "Annuler l'événement", onClick: cancelEvent, danger: true });
        items.push({ label: 'Supprimer', onClick: deleteEvent, danger: true });
        openActionsMenu(e.currentTarget, items);
      });

      card.querySelector('.edit-event-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.editingEventId = ev.id;
        goPage('evenements-new');
        document.getElementById('event-form-title').value = ev.title;
        const { date, time } = parseEventDateText(ev.date);
        document.getElementById('event-form-date-picker').value = date;
        document.getElementById('event-form-time-picker').value = time;
        document.getElementById('event-form-place').value = ev.place;
        document.getElementById('event-form-category').value = ev.category;
        document.getElementById('event-form-places').value = ev.max_places;
        document.getElementById('event-form-desc').value = ev.desc || '';
        document.getElementById('event-form-registration').value = ev.inscriptions_ouvertes ? '1' : '0';
        if (isImageUrl(ev.bg_gradient)) setUploadPreview('event', ev.bg_gradient);
        else resetUploadZone('event');
        document.querySelector('#view-evenements-new h1').textContent = "Modifier l'événement";
        document.getElementById('publish-event-submit-btn').textContent = 'Sauvegarder les modifications';
      });

      container.appendChild(card);
    });
  }

  function resetEventForm() {
    state.editingEventId = null;
    ['event-form-title', 'event-form-date-picker', 'event-form-time-picker', 'event-form-place', 'event-form-desc'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const regSelect = document.getElementById('event-form-registration');
    if (regSelect) regSelect.value = '1';
    resetUploadZone('event');
    const heading = document.querySelector('#view-evenements-new h1');
    if (heading) heading.textContent = 'Créer un événement';
    const submitBtn = document.getElementById('publish-event-submit-btn');
    if (submitBtn) submitBtn.textContent = "Publier l'événement";
  }

  // --------------------------------------------------------- Inscriptions

  // Une inscription n'a pas de statut (existe ou n'existe pas) — cette vue
  // est donc juste : choisir un événement, voir qui s'est inscrit, pouvoir
  // supprimer une inscription (ce qui libère mécaniquement une place,
  // puisque la capacité restante est toujours recomptée en direct).
  function renderInscriptions() {
    const select = document.getElementById('registrants-event-select');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '';
    data.evenements.forEach((e) => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.title} — ${e.date}`;
      select.appendChild(opt);
    });
    if (state.pendingInscriptionsEventId !== null) {
      select.value = state.pendingInscriptionsEventId;
      state.pendingInscriptionsEventId = null;
    } else if (currentVal) select.value = currentVal;
    else if (data.evenements.length > 0) select.value = data.evenements[0].id;

    const activeEventId = parseInt(select.value);
    const activeEvent = data.evenements.find((e) => e.id === activeEventId);

    const countEl = document.getElementById('event-reg-count');
    const remainingEl = document.getElementById('event-remaining-places');
    if (activeEvent && countEl && remainingEl) {
      countEl.textContent = activeEvent.registered_count;
      remainingEl.textContent = activeEvent.max_places - activeEvent.registered_count;
    }

    // Bind select change — fait AVANT le "return" anticipé ci-dessous :
    // sinon, dès que l'événement affiché par défaut n'a aucun inscrit
    // (fréquent : c'est souvent le plus récent), le sélecteur ne
    // déclenchait plus jamais renderInscriptions() et restait figé.
    select.onchange = () => renderInscriptions();

    const container = document.getElementById('registrants-list-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = data.inscriptions.filter((r) => r.event_id === activeEventId);
    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--color-muted-text); font-size: 13.5px;">Aucune inscription enregistrée pour cet événement.</div>';
      return;
    }

    filtered.forEach((p) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:16px; padding:14px 16px; border-bottom:1px solid rgba(31,41,37,0.06); flex-wrap:wrap;';
      row.innerHTML = `
        <div style="flex:1; min-width:160px; font-size:14px; font-weight:700; color:#1F2925;">${p.first_name} ${p.last_name}</div>
        <div style="min-width:120px; font-size:13px; color:#5a655f;">${p.created_at ? p.created_at.split(' ')[0] : '—'}</div>
        <button class="delete-registrant-btn" style="background:rgba(177,69,36,0.08); border:none; padding:7px 14px; border-radius:999px; font-size:12px; font-weight:700; cursor:pointer; color:#B14524;">Supprimer</button>
      `;
      row.querySelector('.delete-registrant-btn').addEventListener('click', async () => {
        if (!confirm(`Supprimer l'inscription de ${p.first_name} ${p.last_name} ?`)) return;
        try {
          const res = await fetch(`/api/admin/inscriptions?id=${p.id}`, { method: 'DELETE' });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error || 'Erreur lors de la suppression.');
          await refresh(renderInscriptions);
        } catch (err) {
          alert(err.message);
        }
      });
      container.appendChild(row);
    });
  }

  // -------------------------------------------------------------- Messages

  function renderMessages() {
    const statusMap = { 'Non lus': 'Non lu', 'À traiter': 'À traiter', 'Traités': 'Traité', 'Archivés': 'Archivé' };
    renderTabs('.messages-tab-container', ['Tous', ...Object.keys(statusMap)], state.messagesTab, (label) => {
      state.messagesTab = label;
      state.messageSelectedIdx = 0;
      renderMessages();
    });

    const listWrapper = document.getElementById('messages-list-container');
    const detailBox = document.getElementById('message-detail-box');
    if (!listWrapper || !detailBox) return;
    listWrapper.innerHTML = '';

    const filtered = state.messagesTab === 'Tous'
      ? data.messages
      : data.messages.filter((m) => m.status === statusMap[state.messagesTab]);

    if (filtered.length === 0) {
      listWrapper.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-muted-text);">Aucun message dans cette boîte.</div>';
      detailBox.innerHTML = '';
      return;
    }

    filtered.forEach((m) => {
      const realIdx = data.messages.indexOf(m);
      const isSelected = state.messageSelectedIdx === realIdx;
      const tone = m.status === 'Traité' ? 'g' : (m.status === 'Archivé' ? 'n' : 'o');
      const item = document.createElement('div');
      item.style.cssText = `padding:16px; border-bottom:1px solid rgba(31,41,37,0.06); cursor:pointer; background:${isSelected ? '#F8F4EC' : 'transparent'}; border-left: 3px solid ${isSelected ? '#176B4D' : 'transparent'};`;
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:8px; align-items: flex-start;">
          <div style="font-size:14px; font-weight:700; color:#1F2925;">${escapeHtml(m.from_name)}</div>
          ${getBadgeHtml(m.status, tone)}
        </div>
        <div style="font-size:13px; color:#3f4a45; margin-top:3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(m.subject)}</div>
      `;
      item.addEventListener('click', async () => {
        state.messageSelectedIdx = realIdx;
        // Ouverture = marquage "lu" : un message "Non lu" jamais encore
        // ouvert passe automatiquement à "À traiter" (lu, pas encore
        // résolu) — réutilise le PUT existant, aucune nouvelle route,
        // transition silencieuse (pas d'alert(), ce n'est pas une action
        // volontaire de l'admin comme "Marquer comme traité"/"Archiver").
        if (m.status === 'Non lu') {
          try {
            await fetch('/api/admin/messages', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: m.id, status: 'À traiter' }),
            });
            await refresh(renderMessages);
            return;
          } catch {
            // Échec silencieux : le message reste affiché "Non lu" et
            // sera re-tenté à la prochaine ouverture. Pas bloquant pour
            // la consultation elle-même.
          }
        }
        renderMessages();
      });
      listWrapper.appendChild(item);
    });

    const selected = data.messages[state.messageSelectedIdx] || filtered[0];
    if (!selected) return;

    const alreadyDone = selected.status === 'Traité';
    const isArchived = selected.status === 'Archivé';
    // mailto: — Option A du workflow Messages : ANB collecte et organise
    // les messages, mais n'envoie jamais d'e-mail depuis l'outil. Ce lien
    // ouvre le client e-mail habituel de l'admin, destinataire et objet
    // pré-remplis, corps volontairement vide (jamais de réponse fabriquée).
    const mailtoHref = `mailto:${encodeURIComponent(selected.email || '')}?subject=${encodeURIComponent('Re: ' + (selected.subject || ''))}`;
    detailBox.innerHTML = `
      <h3 style="font-size:16px; font-weight:700; color:#1F2925; margin:0 0 4px;">${escapeHtml(selected.subject)}</h3>
      <div style="font-size:13px; color:#5a655f; margin-bottom:4px;">De ${escapeHtml(selected.from_name)} · Catégorie : ${escapeHtml(selected.category)}</div>
      <div style="font-size:13px; color:#5a655f; margin-bottom:16px;">${selected.email ? `<a href="${mailtoHref}" style="color:#176B4D; font-weight:600;">${escapeHtml(selected.email)}</a>` : '<span style="color:#9aa39c;">Adresse e-mail non renseignée</span>'}</div>
      <p style="font-size:13.5px; line-height:1.6; color:#3f4a45; margin:0 0 18px; background: rgba(31,41,37,0.02); padding: 12px; border-radius: 8px; white-space:pre-wrap;">${escapeHtml(selected.content)}</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a id="message-reply-btn" href="${mailtoHref}" style="background:#176B4D; color:#FFFFFF; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center;">Répondre par e-mail</a>
        <button id="message-done-btn" ${alreadyDone ? 'disabled' : ''} style="background:#F8F4EC; color:#1F2925; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:${alreadyDone ? 'default' : 'pointer'}; opacity:${alreadyDone ? '0.5' : '1'};">Marquer comme traité</button>
        <button id="message-archive-btn" ${isArchived ? 'disabled' : ''} style="background:#F8F4EC; color:#1F2925; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:${isArchived ? 'default' : 'pointer'}; opacity:${isArchived ? '0.5' : '1'};">Archiver</button>
        ${isArchived ? '<button id="message-delete-btn" style="background:#c0392b; color:#FFFFFF; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:pointer;">Supprimer définitivement</button>' : ''}
      </div>
      <p style="font-size:11.5px; color:#9aa39c; margin:10px 0 0;">« Répondre par e-mail » ouvre votre messagerie habituelle — ANB n'envoie aucun e-mail depuis cet outil.</p>
    `;

    async function updateStatus(status, successMessage) {
      const res = await fetch('/api/admin/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, status }),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      alert(successMessage);
      await refresh(renderMessages);
    }

    document.getElementById('message-done-btn').addEventListener('click', async () => {
      if (alreadyDone) return;
      try {
        await updateStatus('Traité', 'Message marqué comme traité.');
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('message-archive-btn').addEventListener('click', async () => {
      if (isArchived) return;
      try {
        await updateStatus('Archivé', 'Message archivé.');
      } catch (err) {
        alert(err.message);
      }
    });

    // Suppression définitive : réservée aux messages déjà archivés (garde-fou
    // volontaire, cf. bouton non affiché sinon).
    const deleteBtn = document.getElementById('message-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Supprimer définitivement le message de ${selected.from_name} ? Cette action est irréversible.`)) return;
        try {
          const res = await fetch(`/api/admin/messages?id=${selected.id}`, { method: 'DELETE' });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Erreur serveur');
          alert('Message supprimé.');
          state.messageSelectedIdx = 0;
          await refresh(renderMessages);
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }

  // ------------------------------------------------- Contenus & validations
  //
  // Workflow : un éditeur crée un brouillon, le soumet (statut 'En attente'
  // en base) ; un admin OU un super-admin l'approuve (-> 'Publié') ou le
  // renvoie avec un commentaire (-> 'Renvoyé'). Route GET/PUT
  // /api/superadmin/validations — accepte désormais 'admin' en plus de
  // 'super_admin' (même contrôle serveur pour les deux, aucun statut ni
  // transition ajoutés). Un éditeur ne peut pas l'appeler : requireRole ne
  // liste pas 'editeur' sur cette route.

  const VALIDATIONS_MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // "YYYY-MM-DD HH:MM:SS" (UTC, tel que stocké par D1) -> "12 juillet 2026, 14:32"
  function formatValidationDate(sqlDate) {
    if (!sqlDate) return '—';
    const [datePart, timePart] = sqlDate.split(' ');
    const [y, m, d] = (datePart || '').split('-').map(Number);
    const [h, min] = (timePart || '').split(':');
    if (!y || !m || !d) return sqlDate;
    return `${d} ${VALIDATIONS_MONTHS_FR[m - 1]} ${y}, ${h}:${min}`;
  }

  let validationQueue = [];

  async function loadValidations() {
    const container = document.getElementById('validations-queue-list');
    if (!container) return;
    container.innerHTML = '<div style="padding:24px; font-size:13.5px; color:#5a655f;">Chargement…</div>';
    try {
      const res = await fetch('/api/superadmin/validations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de chargement.');
      validationQueue = data.items.map(it => ({
        id: it.id,
        author: it.auteur_nom || 'Auteur inconnu',
        type: 'Article',
        date: formatValidationDate(it.created_at),
        title: it.title,
        status: it.status,
        excerpt: it.excerpt,
        content: it.content,
        bgGradient: it.bg_gradient,
      }));
      state.validationSelectedIdx = 0;
      renderValidations();
    } catch (err) {
      container.innerHTML = `<div style="padding:24px; font-size:13.5px; color:#B14524;">${err.message}</div>`;
    }
  }

  function renderValidations() {
    const columns = document.getElementById('validations-columns');
    const emptyState = document.getElementById('validations-empty-state');
    if (!columns || !emptyState) return;
    const isEmpty = validationQueue.length === 0;
    columns.classList.toggle('hidden', isEmpty);
    emptyState.classList.toggle('hidden', !isEmpty);
    if (isEmpty) return;

    const listWrapper = document.getElementById('validations-queue-list');
    listWrapper.innerHTML = '';

    validationQueue.forEach((c, i) => {
      const isSelected = state.validationSelectedIdx === i;
      const item = document.createElement('div');
      item.style.cssText = `padding:16px; border-bottom:1px solid rgba(31,41,37,0.06); cursor:pointer; background:${isSelected ? '#F8F4EC' : 'transparent'}; border-left:3px solid ${isSelected ? '#176B4D' : 'transparent'};`;
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <span style="background:rgba(23,107,77,0.08); color:#176B4D; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700;">${c.type}</span>
          <span style="font-size:12px; color:#9aa39c;">${c.date}</span>
        </div>
        <div style="font-size:14px; font-weight:700; color:#1F2925; margin-top:8px;">${c.title}</div>
        <div style="font-size:12.5px; color:#5a655f; margin-top:2px;">Par ${c.author} · ${c.status}</div>
      `;
      item.addEventListener('click', () => {
        state.validationSelectedIdx = i;
        renderValidations();
      });
      listWrapper.appendChild(item);
    });

    const detailBox = document.getElementById('validation-detail-box');
    const selected = validationQueue[state.validationSelectedIdx] || validationQueue[0];

    if (!selected) {
      detailBox.innerHTML = '';
      return;
    }

    // Image de couverture réelle de l'article (URL R2 ou dégradé CSS,
    // exactement comme les cartes Actualités) — plus un dégradé décoratif
    // codé en dur qui ne reflétait jamais le vrai contenu.
    const coverStyle = coverStyleFor(selected.bgGradient || 'linear-gradient(150deg,#E8D8BF,#176B4D)');

    detailBox.innerHTML = `
      <h3 style="font-size:16px; font-weight:700; color:#1F2925; margin:0 0 6px;">${selected.title}</h3>
      <div style="font-size:13px; color:#5a655f; margin-bottom:16px;">Par ${selected.author} · ${selected.date}</div>
      <div style="aspect-ratio:16/9; border-radius:14px; ${coverStyle} margin-bottom:18px;"></div>
      <div style="font-size:13px; font-weight:700; color:#1F2925; margin-bottom:6px;">Résumé</div>
      <div style="font-size:13.5px; color:#3f4a45; line-height:1.5; margin-bottom:16px;">${selected.excerpt || '—'}</div>
      <div style="font-size:13px; font-weight:700; color:#1F2925; margin-bottom:6px;">Contenu de l'article</div>
      <div style="font-size:13.5px; color:#3f4a45; line-height:1.6; white-space:pre-wrap; max-height:320px; overflow-y:auto; background:rgba(31,41,37,0.02); padding:14px; border-radius:10px; margin-bottom:16px;">${selected.content || '—'}</div>
      <div style="font-size:13px; font-weight:700; color:#1F2925; margin-bottom:8px;">Commentaire pour l'auteur</div>
      <textarea id="validation-comment-text" rows="2" style="width:100%; padding:12px 14px; border-radius:10px; border:1.5px solid #e3dccb; font-size:13.5px; resize:vertical; margin-bottom:16px;" placeholder="Optionnel..."></textarea>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="validation-approve-btn" style="background:#176B4D; color:#FFFFFF; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:pointer;">Approuver et publier</button>
        <button id="validation-return-btn" style="background:#F8F4EC; color:#1F2925; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:pointer;">Renvoyer avec commentaire</button>
      </div>
    `;

    document.getElementById('validation-approve-btn').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/superadmin/validations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selected.id, action: 'approve' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur.');
        alert(`Le contenu "${selected.title}" a été approuvé et publié !`);
        // L'article vient de passer à 'Publié' : la copie en mémoire de
        // data.actualites (chargée une seule fois au démarrage de la page,
        // via /api/admin/data) est désormais périmée. refresh() la
        // recharge depuis cette même route existante et rejoue
        // renderActualites() — sans quoi la vue Actualités continuait
        // d'afficher l'ancien état jusqu'à un rechargement complet de la
        // page. Fonction déjà partagée par adminContent.js : le correctif
        // s'applique donc identiquement à /admin et /superadmin.
        await Promise.all([loadValidations(), refresh(renderActualites)]);
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('validation-return-btn').addEventListener('click', async () => {
      const comment = document.getElementById('validation-comment-text').value.trim() || 'Des ajustements sont requis.';
      try {
        const res = await fetch('/api/superadmin/validations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selected.id, action: 'return', comment }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur.');
        alert('Le contenu a été renvoyé avec votre commentaire.');
        // Même raison que pour l'approbation : l'article vient de passer à
        // 'Renvoyé', data.actualites doit être rechargée pour rester
        // cohérente avec la base.
        await Promise.all([loadValidations(), refresh(renderActualites)]);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ----------------------------------------------------------- Recensement

  function renderRecensement() {
    const tbody = document.getElementById('recensement-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Update counters in header
    const countLabel = document.getElementById('rec-count-label');
    const benevoleLabel = document.getElementById('rec-benevole-label');
    if (countLabel) countLabel.textContent = data.recensement.length;
    if (benevoleLabel) benevoleLabel.textContent = data.recensement.filter(r => r.benevole).length;

    const filtered = data.recensement.filter(r => {
      // Filter by tab status
      if (state.recensementFilter === 'benevole') {
        if (!r.benevole) return false;
      } else if (state.recensementFilter !== 'Tous' && r.status !== state.recensementFilter) {
        return false;
      }

      // Filter by search query
      if (recensementSearch) {
        const query = recensementSearch.toLowerCase().trim();
        const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
        return fullName.includes(query) || r.email.toLowerCase().includes(query) || (r.phone && r.phone.includes(query)) || (r.origine && r.origine.toLowerCase().includes(query));
      }

      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="padding:40px; text-align:center; color:#5a655f; font-size:14px;">
            Aucun membre recensé ne correspond à ces critères.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(r => {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid rgba(31,41,37,0.06); transition:background-color 0.15s;';
      tr.onmouseover = () => tr.style.backgroundColor = 'rgba(23,107,77,0.02)';
      tr.onmouseout = () => tr.style.backgroundColor = 'transparent';

      const statusTone = r.status === 'Étudiant' ? 'g' : 'o';
      const dateStr = r.created_at ? r.created_at.split(' ')[0] : '—';
      const benevoleHtml = r.benevole
        ? `<span style="background:rgba(233,120,36,0.12); color:#B75E12; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700;">🤝 Oui</span>`
        : `<span style="color:#9aa39c; font-size:12px;">—</span>`;

      tr.innerHTML = `
        <td style="padding:13px 18px; font-weight:700; color:#1F2925; white-space:nowrap;">${r.first_name} ${r.last_name}</td>
        <td style="padding:13px 18px;">${getBadgeHtml(r.status, statusTone)}</td>
        <td style="padding:13px 18px; color:#5a655f; font-size:13px; max-width:140px; overflow:hidden; text-overflow:ellipsis;">${r.domaine || '—'}</td>
        <td style="padding:13px 18px;">${benevoleHtml}</td>
        <td style="padding:13px 18px; color:#5a655f; font-size:13px;">${r.email}</td>
        <td style="padding:13px 18px; color:#5a655f; font-size:13px; white-space:nowrap;">${r.phone}</td>
        <td style="padding:13px 18px; text-align:right; white-space:nowrap;">
          <span style="font-size:11.5px; color:#9aa39c; margin-right:8px;">${dateStr}</span>
          <button class="delete-rec-btn" data-id="${r.id}" style="background:transparent; border:none; color:#B14524; font-size:12.5px; font-weight:700; cursor:pointer; padding:5px 10px; border-radius:6px; transition:background-color 0.15s;">Suppr.</button>
        </td>
      `;

      // Bind delete action
      tr.querySelector('.delete-rec-btn').addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm("Êtes-vous sûr de vouloir supprimer ce recensement ?")) {
          try {
            const res = await fetch(`/api/admin/recensement?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Échec de la suppression");

            // Remove locally and re-render
            data.recensement = data.recensement.filter(item => item.id != id);
            document.getElementById('stat-census-count').textContent = data.recensement.length;
            renderRecensement();
          } catch (err) {
            alert(err.message);
          }
        }
      });

      tbody.appendChild(tr);
    });
  }

  function wireRecensement() {
    const recSearchInput = document.getElementById('recensement-search-input');
    if (recSearchInput) {
      recSearchInput.addEventListener('input', (e) => {
        recensementSearch = e.target.value;
        renderRecensement();
      });
    }

    document.querySelectorAll('.rec-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.rec-tab-btn').forEach(b => {
          b.style.background = '#F8F4EC';
          b.style.color = '#1F2925';
        });
        e.target.style.background = '#176B4D';
        e.target.style.color = '#FFFFFF';
        state.recensementFilter = e.target.dataset.status;
        renderRecensement();
      });
    });

    const recExportBtn = document.getElementById('recensement-export-csv-btn');
    if (recExportBtn) {
      recExportBtn.addEventListener('click', () => {
        if (data.recensement.length === 0) {
          alert("Aucune donnée à exporter.");
          return;
        }
        const headers = ["ID", "Prénom", "Nom", "Statut", "Téléphone", "E-mail", "Domaine", "Bénévole", "Date d'inscription"];
        const csvRows = [headers.join(";")];
        data.recensement.forEach(r => {
          csvRows.push([
            r.id, r.first_name, r.last_name, r.status, r.phone, r.email,
            r.domaine || '',
            r.benevole ? 'Oui' : 'Non',
            r.created_at
          ].join(";"));
        });
        const blob = new Blob([CSV_BOM + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `recensement_anb_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
  }

  // ------------------------------------------- câblage des zones statiques
  // wireUploadZone est désormais un export du module (voir plus haut).

  function wireNewsForm() {
    const titleInput = document.getElementById('news-form-title');
    const slugInput = document.getElementById('news-form-slug');
    if (titleInput && slugInput) {
      titleInput.addEventListener('input', (e) => {
        // On ne régénère pas le slug d'un article existant : il fait partie
        // de son URL publique.
        if (state.editingNewsId) return;
        slugInput.textContent = '/actualites/' + e.target.value
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-');
      });
    }

    document.getElementById('publish-news-submit-btn')?.addEventListener('click', async () => {
      const title = document.getElementById('news-form-title').value.trim();
      const slug = document.getElementById('news-form-slug').textContent.trim().replace('/actualites/', '');
      const excerpt = document.getElementById('news-form-excerpt').value.trim();
      const content = document.getElementById('news-form-content').value.trim();
      const category = document.getElementById('news-form-category').value;
      const imageUrl = document.getElementById('news-form-image-url').value;

      if (!title || !excerpt || !content) {
        alert("Veuillez remplir le titre, le résumé et le contenu de l'actualité.");
        return;
      }

      const isEdit = state.editingNewsId !== null;
      try {
        const res = await fetch('/api/admin/news', {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: state.editingNewsId,
            title,
            slug,
            excerpt,
            content,
            category,
            // Statut envoyé seulement à la création : "Modifier" ne doit
            // jamais republier silencieusement un article archivé (le
            // statut se change via le bouton dédié Archiver/Publier).
            ...(isEdit ? {} : { status: 'Publié' }),
            bg_gradient: imageUrl || 'linear-gradient(150deg,#176B4D,#1F2925)',
          }),
        });
        if (!res.ok) {
          const errBody = await res.json();
          throw new Error(errBody.error || "Erreur lors de l'enregistrement");
        }

        const alertBox = document.getElementById('news-publish-success-alert');
        alertBox?.classList.remove('hidden');
        await refresh();

        setTimeout(() => {
          alertBox?.classList.add('hidden');
          resetNewsForm();
          goPage('actualites');
        }, 1200);
      } catch (err) {
        alert('Erreur de sauvegarde : ' + err.message);
      }
    });
  }

  function wireEventForm() {
    document.getElementById('publish-event-submit-btn')?.addEventListener('click', async () => {
      const title = document.getElementById('event-form-title').value.trim();
      const datePicker = document.getElementById('event-form-date-picker').value;
      const timePicker = document.getElementById('event-form-time-picker').value;
      const date = formatEventDateText(datePicker, timePicker);
      const place = document.getElementById('event-form-place').value.trim();
      const category = document.getElementById('event-form-category').value;
      const maxPlaces = parseInt(document.getElementById('event-form-places').value, 10) || 100;
      const inscriptionsOuvertes = document.getElementById('event-form-registration').value === '1';
      const imageUrl = document.getElementById('event-form-image-url').value;

      if (!title || !datePicker || !place) {
        alert('Veuillez remplir le titre, la date et le lieu du nouvel événement.');
        return;
      }

      const isEdit = state.editingEventId !== null;
      try {
        const res = await fetch('/api/admin/events', {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: state.editingEventId,
            title,
            date,
            event_date: datePicker, // pour le tri chronologique, cf. api/admin/events.js
            place,
            category,
            max_places: maxPlaces,
            inscriptions_ouvertes: inscriptionsOuvertes,
            // Statut jamais envoyé ici : la création démarre toujours
            // "Ouvert" côté serveur, et "Modifier" ne doit jamais changer
            // le statut tout seul (voir boutons dédiés Annuler/Marquer
            // comme terminé sur la liste).
            bg_gradient: imageUrl || 'linear-gradient(150deg,#E97824,#1F2925)',
          }),
        });
        if (!res.ok) {
          const errBody = await res.json();
          throw new Error(errBody.error || 'Erreur de création serveur');
        }

        const alertBox = document.getElementById('event-publish-success-alert');
        alertBox?.classList.remove('hidden');
        await refresh();

        setTimeout(() => {
          alertBox?.classList.add('hidden');
          resetEventForm();
          goPage('evenements');
        }, 1200);
      } catch (err) {
        alert('Erreur de sauvegarde : ' + err.message);
      }
    });
  }

  /** À appeler une seule fois, après le chargement du DOM. */
  function wire() {
    wireUploadZone('news');
    wireUploadZone('event');
    wireUploadZone('galerie');
    wireUploadZone('equipe');
    wireNewsForm();
    wireEventForm();
    wireGalerieForm();
    wireEquipeForm();
    wireRecensement();
  }

  return {
    state,
    data,
    fetchData,
    setData,
    refresh,
    wire,
    renderActualites,
    renderEvenements,
    renderMessages,
    renderRecensement,
    renderInscriptions,
    renderGalerie,
    renderEquipe,
    loadValidations,
    resetNewsForm,
    resetEventForm,
    resetGalerieForm,
    resetEquipeForm,
  };
}
