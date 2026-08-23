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
export function createAdminContent({ goPage, getBadgeHtml, onViewRegistrants }) {
  const data = { actualites: [], evenements: [], messages: [] };

  const state = {
    newsTab: 'Publiées',
    eventsFilter: 'À venir',
    messagesTab: 'Tous',
    messageSelectedIdx: 0,
    editingNewsId: null,
    editingEventId: null,
  };

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
  }

  /** Recharge les données depuis l'API puis rejoue le rendu demandé. */
  async function refresh(rerender) {
    setData(await fetchData());
    if (rerender) rerender();
  }

  // ------------------------------------------------------- helpers partagés

  function isImageUrl(value) {
    return typeof value === 'string' && (value.startsWith('/') || value.startsWith('http'));
  }

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

  function resetUploadZone(type) {
    const zone = document.getElementById(`${type}-upload-zone`);
    const placeholder = document.getElementById(`${type}-upload-placeholder`);
    const urlInput = document.getElementById(`${type}-form-image-url`);
    if (urlInput) urlInput.value = '';
    if (zone && placeholder) {
      zone.style.background = '#FFFFFF';
      placeholder.innerHTML = 'Glissez-déposez une image ici, ou cliquez pour parcourir';
    }
  }

  function setUploadPreview(type, url) {
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
  async function compressImage(file, maxDimension = 1600, quality = 0.82) {
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

  async function handleImageUpload(file, type) {
    const zone = document.getElementById(`${type}-upload-zone`);
    const placeholder = document.getElementById(`${type}-upload-placeholder`);
    const urlInput = document.getElementById(`${type}-form-image-url`);
    if (!zone || !placeholder || !urlInput) return;

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

      card.querySelector('.edit-news-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.editingNewsId = n.id;
        goPage('actualites-new');
        document.getElementById('news-form-title').value = n.title;
        document.getElementById('news-form-slug').value = '/actualites/' + n.slug;
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
    ['news-form-title', 'news-form-slug', 'news-form-excerpt', 'news-form-content'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    resetUploadZone('news');
    const heading = document.querySelector('#view-actualites-new h1');
    if (heading) heading.textContent = 'Nouvelle actualité';
    const submitBtn = document.getElementById('publish-news-submit-btn');
    if (submitBtn) submitBtn.textContent = "Publier l'actualité";
  }

  // ------------------------------------------------------------ Événements

  function renderEvenements() {
    renderTabs('.events-tab-container', ['À venir', 'Passés', 'Brouillons', 'Annulés'], state.eventsFilter, (label) => {
      state.eventsFilter = label;
      renderEvenements();
    });

    // Encart « Mis en avant » : le prochain événement à venir.
    const promo = data.evenements.find((e) => e.tab === 'À venir');
    const promoTitle = document.getElementById('promo-event-title');
    const promoDetails = document.getElementById('promo-event-details');
    const promoCover = document.getElementById('promo-event-cover');
    if (promoTitle && promoDetails) {
      promoTitle.textContent = promo ? promo.title : 'Aucun événement à venir';
      promoDetails.textContent = promo ? `${promo.date} · ${promo.place}` : '—';
      if (promoCover && promo) promoCover.style.cssText += coverStyleFor(promo.bg_gradient);
    }

    const container = document.getElementById('events-list-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = data.evenements.filter((e) => e.tab === state.eventsFilter);
    if (filtered.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--color-muted-text); font-size: 14.5px;">Aucun événement dans cette rubrique.</div>';
      return;
    }

    filtered.forEach((ev) => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 8px 24px rgba(31,41,37,0.05); display: flex; flex-direction: column;';
      card.innerHTML = `
        <div style="aspect-ratio:16/9; ${coverStyleFor(ev.bg_gradient)}"></div>
        <div style="padding:20px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
              <div style="font-size:12px; font-weight:700; color:#E97824; text-transform:uppercase;">${ev.category} · ${ev.date}</div>
              ${getBadgeHtml(ev.status, ev.status === 'Ouvert' ? 'g' : 'o')}
            </div>
            <h3 style="font-size:16px; font-weight:700; color:#1F2925; margin:0 0 6px;">${ev.title}</h3>
            <p style="font-size:13px; color:#5a655f; margin:0 0 16px;">${ev.place} · ${ev.registered_count}/${ev.max_places} inscrits</p>
          </div>
          <div style="display:flex; gap:8px;">
            ${onViewRegistrants ? '<button class="view-registrants-btn" style="flex:1; background:#F8F4EC; border:none; padding:10px; border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; color:#1F2925;">Inscrits</button>' : ''}
            <button class="edit-event-btn" style="flex:1; background:#176B4D; border:none; padding:10px; border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; color:#FFFFFF;">Modifier</button>
            <button class="delete-event-btn" style="background:rgba(177,69,36,0.08); border:none; padding:10px 14px; border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; color:#B14524;">Supprimer</button>
          </div>
        </div>
      `;

      card.querySelector('.view-registrants-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        onViewRegistrants(ev.id);
      });

      // L'API refuse en 409 tant que la perte des inscriptions liées n'est
      // pas explicitement confirmée (ON DELETE CASCADE côté schéma).
      card.querySelector('.delete-event-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
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
      });

      card.querySelector('.edit-event-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.editingEventId = ev.id;
        goPage('evenements-new');
        document.getElementById('event-form-title').value = ev.title;
        document.getElementById('event-form-date').value = ev.date;
        document.getElementById('event-form-place').value = ev.place;
        document.getElementById('event-form-category').value = ev.category;
        document.getElementById('event-form-places').value = ev.max_places;
        document.getElementById('event-form-desc').value = ev.desc || '';
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
    ['event-form-title', 'event-form-date', 'event-form-place', 'event-form-desc'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    resetUploadZone('event');
    const heading = document.querySelector('#view-evenements-new h1');
    if (heading) heading.textContent = 'Créer un événement';
    const submitBtn = document.getElementById('publish-event-submit-btn');
    if (submitBtn) submitBtn.textContent = "Publier l'événement";
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
          <div style="font-size:14px; font-weight:700; color:#1F2925;">${m.from_name}</div>
          ${getBadgeHtml(m.status, tone)}
        </div>
        <div style="font-size:13px; color:#3f4a45; margin-top:3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.subject}</div>
      `;
      item.addEventListener('click', () => {
        state.messageSelectedIdx = realIdx;
        renderMessages();
      });
      listWrapper.appendChild(item);
    });

    const selected = data.messages[state.messageSelectedIdx] || filtered[0];
    if (!selected) return;

    const alreadyDone = selected.status === 'Traité';
    const isArchived = selected.status === 'Archivé';
    detailBox.innerHTML = `
      <h3 style="font-size:16px; font-weight:700; color:#1F2925; margin:0 0 4px;">${selected.subject}</h3>
      <div style="font-size:13px; color:#5a655f; margin-bottom:16px;">De ${selected.from_name} · Catégorie : ${selected.category}</div>
      <p style="font-size:13.5px; line-height:1.6; color:#3f4a45; margin:0 0 18px; background: rgba(31,41,37,0.02); padding: 12px; border-radius: 8px;">${selected.content}</p>
      <textarea id="message-reply-text" rows="3" style="width:100%; padding:12px 14px; border-radius:10px; border:1.5px solid #e3dccb; font-size:13.5px; resize:vertical; margin-bottom:14px;" placeholder="Votre réponse…"></textarea>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="message-reply-btn" style="background:#176B4D; color:#FFFFFF; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:pointer;">Répondre</button>
        <button id="message-done-btn" ${alreadyDone ? 'disabled' : ''} style="background:#F8F4EC; color:#1F2925; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:${alreadyDone ? 'default' : 'pointer'}; opacity:${alreadyDone ? '0.5' : '1'};">Marquer comme traité</button>
        <button id="message-archive-btn" ${isArchived ? 'disabled' : ''} style="background:#F8F4EC; color:#1F2925; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:${isArchived ? 'default' : 'pointer'}; opacity:${isArchived ? '0.5' : '1'};">Archiver</button>
        ${isArchived ? '<button id="message-delete-btn" style="background:#c0392b; color:#FFFFFF; border:none; padding:11px 20px; border-radius:999px; font-weight:700; font-size:13.5px; cursor:pointer;">Supprimer définitivement</button>' : ''}
      </div>
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

    document.getElementById('message-reply-btn').addEventListener('click', async () => {
      const text = document.getElementById('message-reply-text').value.trim();
      if (!text) {
        alert('Le message de réponse est vide.');
        return;
      }
      try {
        // Aucun envoi d'e-mail n'est branché : on trace seulement le
        // traitement côté base, la réponse se fait hors de l'outil.
        await updateStatus('Traité', 'Message marqué comme traité. (Aucun e-mail n\'est envoyé par l\'outil : répondez depuis votre messagerie.)');
      } catch (err) {
        alert(err.message);
      }
    });

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

  // ------------------------------------------- câblage des zones statiques

  function wireUploadZone(type) {
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

  function wireNewsForm() {
    const titleInput = document.getElementById('news-form-title');
    const slugInput = document.getElementById('news-form-slug');
    if (titleInput && slugInput) {
      titleInput.addEventListener('input', (e) => {
        // On ne régénère pas le slug d'un article existant : il fait partie
        // de son URL publique.
        if (state.editingNewsId) return;
        slugInput.value = '/actualites/' + e.target.value
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-');
      });
    }

    document.getElementById('publish-news-submit-btn')?.addEventListener('click', async () => {
      const title = document.getElementById('news-form-title').value.trim();
      const slug = document.getElementById('news-form-slug').value.trim().replace('/actualites/', '');
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
            status: 'Publié',
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
      const date = document.getElementById('event-form-date').value.trim();
      const place = document.getElementById('event-form-place').value.trim();
      const category = document.getElementById('event-form-category').value;
      const maxPlaces = parseInt(document.getElementById('event-form-places').value, 10) || 100;
      const imageUrl = document.getElementById('event-form-image-url').value;

      if (!title || !date || !place) {
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
            place,
            category,
            max_places: maxPlaces,
            status: 'Ouvert',
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
    wireNewsForm();
    wireEventForm();
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
    resetNewsForm,
    resetEventForm,
  };
}
