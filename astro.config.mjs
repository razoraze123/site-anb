// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),
  // Expiration de session côté serveur — 24h. Correctif P0.3 (audit-auth.md
  // §5/§18) : la session ne s'arrêtait auparavant jamais automatiquement.
  // Astro ne renouvelle jamais le TTL sur simple lecture (requireRole()) —
  // seul un nouvel appel à context.session.set() le ferait (login, ou
  // auto-édition de profil). C'est donc un délai fixe depuis la connexion,
  // pas une expiration par inactivité. 24h a été choisi précisément pour
  // cette raison : couvrir une pleine journée de travail sans déconnecter
  // un bénévole en pleine tâche, en l'absence de renouvellement glissant
  // (item de confort futur, voir audit-auth.md plan P1/P2).
  session: {
    ttl: 86400,
  },
});
