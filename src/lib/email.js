// Point d'entrée unique vers Resend — jamais appelé directement depuis une
// route API, pour que le "From" et l'adresse de notification restent
// centralisés (les changer ne touche qu'ici, pas chaque appelant).
//
// ANB_FROM : identité d'envoi vérifiée dans Resend (domaine anb33.fr).
// ADMIN_NOTIFICATION_EMAIL : adresse personnelle qui reçoit les alertes de
// nouveaux messages — jamais utilisée comme adresse d'envoi du système,
// uniquement comme destinataire (voir api/messages.js).
export const ANB_FROM = 'ANB Bordeaux <contact@anb33.fr>';
export const ADMIN_NOTIFICATION_EMAIL = 'anbordeaux33@outlook.fr';

// Échappement HTML pour toute donnée non fiable (nom/sujet/message d'un
// visiteur, réponse d'un admin) interpolée dans un corps d'e-mail HTML —
// même fonction que escapeHtml() dans lib/adminContent.js (usage
// équivalent, copie locale volontaire pour ne pas faire dépendre ce module
// serveur d'un fichier de logique d'UI admin côté navigateur).
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Envoie un email via l'API Resend. Lève une erreur si RESEND_API_KEY est
 * absent ou si Resend répond en erreur — c'est à l'appelant de décider si
 * l'échec est bloquant (réponse à un visiteur) ou tolérable en best-effort
 * (notification interne), jamais à ce module.
 */
export async function sendEmail(env, { to, subject, text, html, replyTo }) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY n'est pas configuré.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: ANB_FROM,
      to,
      subject,
      text,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Échec de l'envoi Resend (${res.status})${detail ? ` : ${detail}` : ''}`);
  }

  return res;
}
