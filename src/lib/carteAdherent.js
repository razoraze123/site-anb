// Carte d'adhérent PDF — logique partagée entre la route de téléchargement
// publique (token HMAC) et la route admin (session). Une seule fonction de
// génération PDF pour éviter toute divergence de mise en page entre les
// deux (voir src/pages/api/recensement/[id]/carte.pdf.js et
// src/pages/api/admin/recensement/[id]/carte.pdf.js).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ------------------------------------------------------------- Numéro adhérent
//
// Dérivé de l'id D1 (auto-incrément, déjà garanti unique par SQLite) et de
// l'année — aucune nouvelle colonne, aucun compteur, aucune migration (voir
// db/schema.sql : `recensement.id` suffit). C'est un identifiant MÉTIER
// affichable, jamais un secret : ce qui protège le téléchargement, c'est le
// token HMAC ci-dessous, pas ce numéro.
export function formatNumeroAdherent(id, annee) {
  return `ANB-${annee}-${String(id).padStart(6, '0')}`;
}

// ------------------------------------------------------------------ Token HMAC
//
// Recalculable à l'identique à partir de (id + secret serveur) : rien à
// stocker en D1, rien à faire expirer. `CARTE_HMAC_SECRET` est un secret
// Cloudflare (voir .dev.vars en local, `wrangler secret put` en prod) —
// jamais commité, jamais renvoyé au client, jamais loggé.
const encoder = new TextEncoder();

async function getHmacKey(env) {
  if (!env.CARTE_HMAC_SECRET) {
    throw new Error('CARTE_HMAC_SECRET absent');
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(env.CARTE_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function genererToken(env, id) {
  const key = await getHmacKey(env);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(id)));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparaison en temps constant — évite qu'une différence de timing sur la
// comparaison caractère par caractère laisse deviner le token attendu.
export async function verifierToken(env, id, token) {
  if (!token) return false;
  let attendu;
  try {
    attendu = await genererToken(env, id);
  } catch {
    return false; // CARTE_HMAC_SECRET absent : jamais de validation permissive
  }
  if (attendu.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) diff |= attendu.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------- Génération PDF
//
// Contenu volontairement minimal (logo, prénom, nom, numéro, date
// d'adhésion, statut) — jamais l'email ni le téléphone sur la carte.
// Le logo est lu depuis l'asset existant public/logo.png via le binding
// ASSETS (pas de nouvelle version du logo, pas de copie en base64 dans le
// code source — ça garderait ses octets hors du bundle du Worker).
async function chargerLogo(env, requestUrl) {
  try {
    const res = await env.ASSETS.fetch(new URL('/logo.png', requestUrl));
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null; // pas de logo -> carte générée sans logo, jamais bloquant
  }
}

// La police standard pdf-lib (WinAnsi) couvre le français courant (accents,
// œ, «», etc.) mais pas l'intégralité d'Unicode — un caractère imprévu dans
// une donnée saisie par un visiteur (prénom, statut) ferait planter
// drawText() et donc tout le téléchargement. On retente avec une version
// assainie plutôt que de renvoyer une erreur 500 pour un simple caractère.
function dessinerTexteSur(page, valeur, options) {
  try {
    page.drawText(valeur, options);
  } catch {
    const secours = String(valeur ?? '')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '') // enlève les accents combinables restants
      .replace(/[^\x20-\x7E]/g, '?'); // tout le reste hors ASCII imprimable -> '?'
    try {
      page.drawText(secours || '?', options);
    } catch {
      // Dernier recours : ne jamais faire échouer toute la carte pour un
      // seul champ illisible.
      page.drawText('?', options);
    }
  }
}

function formatDateFr(sqlDate) {
  // "2026-08-30 20:46:00" -> "30/08/2026" (même format que les autres
  // affichages de date déjà présents dans le projet, ex. galerie.astro)
  const datePart = (sqlDate || '').split(' ')[0];
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return sqlDate || '';
  return `${d}/${m}/${y}`;
}

/**
 * Génère le PDF de la carte adhérent. `membre` = { id, first_name, last_name,
 * status, created_at } (colonnes déjà présentes dans `recensement`, aucune
 * nouvelle donnée nécessaire). Retourne un Uint8Array (bytes du PDF).
 */
export async function genererPdfCarte(env, requestUrl, membre) {
  const annee = new Date(membre.created_at.replace(' ', 'T')).getUTCFullYear();
  const numero = formatNumeroAdherent(membre.id, annee);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([340, 214]); // format carte, paysage
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const vert = rgb(0x17 / 255, 0x6B / 255, 0x4D / 255);
  const sombre = rgb(0x1F / 255, 0x29 / 255, 0x25 / 255);
  const gris = rgb(0x5a / 255, 0x65 / 255, 0x5f / 255);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: vert });

  const logoBytes = await chargerLogo(env, requestUrl);
  let textX = 24;
  if (logoBytes) {
    try {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoSize = 46;
      page.drawImage(logoImage, { x: 20, y: height - logoSize - 26, width: logoSize, height: logoSize });
      textX = 20 + logoSize + 14;
    } catch {
      // Logo illisible (format inattendu) : carte générée sans logo plutôt
      // que d'échouer tout le téléchargement pour un simple visuel.
    }
  }

  page.drawText('ASSOCIATION DES NIGÉRIENS À BORDEAUX', {
    x: textX, y: height - 30, size: 8, font: fontBold, color: gris,
  });
  page.drawText('CARTE ADHÉRENT', {
    x: textX, y: height - 44, size: 13, font: fontBold, color: sombre,
  });

  let y = height - 78;
  const ligne = (label, valeur) => {
    page.drawText(label, { x: 20, y, size: 8, font, color: gris });
    dessinerTexteSur(page, valeur, { x: 20, y: y - 14, size: 13, font: fontBold, color: sombre });
    y -= 38;
  };

  ligne('PRÉNOM NOM', `${membre.first_name} ${membre.last_name}`);
  ligne('N° ADHÉRENT', numero);
  ligne('ADHÉRENT DEPUIS', formatDateFr(membre.created_at));
  page.drawText('STATUT', { x: 20, y, size: 8, font, color: gris });
  dessinerTexteSur(page, membre.status || '—', { x: 20, y: y - 14, size: 13, font: fontBold, color: sombre });

  return pdfDoc.save();
}
