// Journal d'activité (audit log) — utilisé par les routes /api/superadmin/*
// pour tracer chaque action sensible dans la table journal_activite.

const ROLE_LABELS = { admin: 'Admin', super_admin: 'Super Admin', editeur: 'Éditeur' };

/**
 * Enregistre une entrée dans journal_activite. N'échoue jamais l'appelant :
 * une erreur de journalisation est avalée (log Cloudflare) plutôt que de
 * faire échouer l'action métier qu'elle trace.
 */
export async function logActivity(db, context, actor, action, details) {
  try {
    const ip = context.request.headers.get('cf-connecting-ip') || 'local';
    const role = ROLE_LABELS[actor.role] || actor.role;
    await db.prepare(
      "INSERT INTO journal_activite (utilisateur_email, role, action, details, adresse_ip) VALUES (?, ?, ?, ?, ?)"
    ).bind(actor.email, role, action, details, ip).run();
  } catch (err) {
    console.error('logActivity a échoué:', err);
  }
}
