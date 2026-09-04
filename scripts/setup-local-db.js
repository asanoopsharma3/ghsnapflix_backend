/**
 * Creates MTN tables on the local DB from .env (localhost only).
 * Refuses to run if DB_HOST is not local — production must not be modified.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv(path.join(__dirname, '..', '.env'));

const host = process.env.DB_HOST ?? 'localhost';
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

if (!localHosts.has(host)) {
  console.error(
    `Refusing to run: DB_HOST=${host} is not local. Use localhost for local setup.`,
  );
  process.exit(1);
}

const sqlFiles = [
  'create-mtn-subscription-tables.sql',
  'create-subscription-misdn-table.sql',
  'alter-subscription-misdns-response-columns.sql',
  'alter-mtn-queue-transaction-id.sql',
  'alter-mtn-callback-auto-subscribe.sql',
  'create-cgw-tables.sql',
];

const sql = sqlFiles
  .map((f) =>
    fs.readFileSync(path.join(__dirname, f), 'utf8'),
  )
  .join('\n');

const client = new Client({
  host,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

client
  .connect()
  .then(() => client.query(sql))
  .then(() => {
    console.log(
      `MTN tables ready on local database "${process.env.DB_DATABASE}" (${host}).`,
    );
    return client.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
