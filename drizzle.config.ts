import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const dbUrl = process.env.DATABASE_URL || './.local/pgdata';
const isRemote = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

if (!isRemote) {
	mkdirSync(resolve(dbUrl.replace(/^pglite:\/\//, '')), { recursive: true });
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	...(isRemote ? {} : { driver: 'pglite' as const }),
	dbCredentials: {
		url: isRemote ? dbUrl : resolve(dbUrl.replace(/^pglite:\/\//, ''))
	},
	verbose: true,
	strict: true
});
