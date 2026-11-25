import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Set safe production defaults for @sveltejs/adapter-node before loading the built server.
process.env.HOST ??= '0.0.0.0';
process.env.BODY_SIZE_LIMIT ??= '50M';
process.env.PROTOCOL_HEADER ??= 'x-forwarded-proto';
process.env.HOST_HEADER ??= 'x-forwarded-host';

const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
	? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
	: null;
const authUrl = process.env.BETTER_AUTH_URL || railwayUrl || 'http://localhost:5678';
console.log(`[certflow] Auth base URL: ${authUrl}`);

const dbUrl = (process.env.DATABASE_URL ?? '').trim();
if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
	console.log('[certflow] Database mode: PostgreSQL. Running migrations...');
	const migrationClient = postgres(dbUrl, { max: 1 });
	try {
		await migrate(drizzle(migrationClient), { migrationsFolder: resolve('./drizzle') });
		console.log('[certflow] PostgreSQL migrations complete.');
	} finally {
		await migrationClient.end();
	}
} else {
	console.warn(
		'[certflow] WARNING: DATABASE_URL is not a postgresql:// URL. Set DATABASE_URL to your Railway Postgres service reference.'
	);
}

await import('../build/index.js');
