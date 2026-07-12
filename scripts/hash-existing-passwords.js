/**
 * Script de migration one-shot à exécuter UNE SEULE FOIS en local
 * pour hasher les mots de passe en clair déjà présents dans D1.
 *
 * Usage :
 *   npx wrangler d1 execute <DB_NAME> --local < scripts/hash-existing-passwords.js
 *
 * ⚠️  Ce script suppose que les mots de passe actuels sont en clair.
 *     Après exécution, supprimez ce fichier du dépôt.
 *
 * Ce script génère des instructions SQL UPDATE à copier-coller
 * dans wrangler d1 execute. Exécutez-le avec Node :
 *   node scripts/hash-existing-passwords.js
 */

import { hashPassword } from '../src/lib/password.js';

// Remplacez cette liste par les couples (id, mot_de_passe_en_clair)
// que vous exportez de D1 via : wrangler d1 execute DB --command "SELECT id, mot_de_passe FROM utilisateurs"
const users = [
  // { id: 1, plainPassword: 'motdepasseexemple' },
];

for (const u of users) {
  const hashed = await hashPassword(u.plainPassword);
  console.log(`UPDATE utilisateurs SET mot_de_passe = '${hashed}' WHERE id = ${u.id};`);
}

console.log('\n-- Copiez les lignes ci-dessus dans wrangler d1 execute --');
