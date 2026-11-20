import { readdirSync, readFileSync } from 'node:fs';

// The production migrations assume these legacy columns already exist.
// Model that baseline explicitly without changing the deployed migrations.
export function applyProductionMigrations(db: { exec(sql: string): unknown }, before?: string) {
  for (const file of readdirSync('migrations').filter(name => name.endsWith('.sql') && (!before || name < before)).sort()) {
    if (file.startsWith('0014_')) db.exec(`
      ALTER TABLE artworks ADD COLUMN fulfillment_uri TEXT;
      ALTER TABLE artworks ADD COLUMN buyer_email TEXT;
      ALTER TABLE artworks ADD COLUMN access_token TEXT;
      ALTER TABLE artworks ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1));
    `);
    if (file.startsWith('0017_')) db.exec('ALTER TABLE transactions ADD COLUMN buyer_wallet TEXT');
    db.exec(readFileSync(`migrations/${file}`, 'utf8'));
  }
}
