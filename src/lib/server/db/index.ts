import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL } from '$app/env/private';
import * as schema from './schema.ts';

// Expose a single concrete Drizzle PgDatabase type so method overloads (such as .returning(cols)) resolve cleanly.
export type Database = PostgresJsDatabase<typeof schema>;

function isRemotePostgresUrl(url: string): boolean {
	return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

// Reuse one database handle across Vite HMR reloads in dev so PGlite never double-locks the data folder.
const globalForDb = globalThis as unknown as { __certflowDb?: Database };

function createDatabase(): Database {
	if (isRemotePostgresUrl(DATABASE_URL)) {
		const client = postgres(DATABASE_URL, {
			max: 10,
			idle_timeout: 20,
			connect_timeout: 10
		});
		return drizzlePostgres(client, { schema });
	}

	const dataDir = resolve(DATABASE_URL.replace(/^pglite:\/\//, '') || './.local/pgdata');
	mkdirSync(dataDir, { recursive: true });
	const pgliteClient = new PGlite(dataDir);
	return drizzlePglite(pgliteClient, { schema }) as unknown as Database;
}

function getDatabase(): Database {
	return (globalForDb.__certflowDb ??= createDatabase());
}

// Lazily initialise the database handle on first query so `vite build` route analysis never opens PGlite or a network pool.
export const db: Database = new Proxy({} as Database, {
	get(_target, prop, receiver) {
		const instance = getDatabase();
		const value = Reflect.get(instance as object, prop, receiver);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
