import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getRuntimeConfig } from '../runtime-config.ts';
import * as schema from './schema.ts';

// Expose a single concrete Drizzle PgDatabase type so method overloads (such as .returning(cols)) resolve cleanly.
export type Database = PostgresJsDatabase<typeof schema>;

export function isRemotePostgresUrl(url: string): boolean {
	return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

interface DbSlot {
	url: string;
	db: Database;
	close: () => Promise<void>;
}

// Reuse one database handle across Vite HMR reloads in dev so PGlite never double-locks the data folder.
const globalForDb = globalThis as unknown as { __certflowDbSlot?: DbSlot };

function createDatabaseSlot(databaseUrl: string): DbSlot {
	if (isRemotePostgresUrl(databaseUrl)) {
		const client = postgres(databaseUrl, {
			max: 10,
			idle_timeout: 20,
			connect_timeout: 10
		});
		return {
			url: databaseUrl,
			db: drizzlePostgres(client, { schema }),
			close: async () => {
				await client.end({ timeout: 5 }).catch(() => {});
			}
		};
	}

	const dataDir = resolve(databaseUrl.replace(/^pglite:\/\//, '') || './.local/pgdata');
	mkdirSync(dataDir, { recursive: true });
	const pgliteClient = new PGlite(dataDir);
	return {
		url: databaseUrl,
		db: drizzlePglite(pgliteClient, { schema }) as unknown as Database,
		close: async () => {
			await pgliteClient.close().catch(() => {});
		}
	};
}

function getDatabase(): Database {
	const desiredUrl = getRuntimeConfig().databaseUrl;
	const existing = globalForDb.__certflowDbSlot;
	if (existing && existing.url === desiredUrl) {
		return existing.db;
	}
	if (existing) {
		void existing.close();
	}
	const next = createDatabaseSlot(desiredUrl);
	globalForDb.__certflowDbSlot = next;
	return next.db;
}

/**
 * Closes the current database pool/PGlite handle so the next query reconnects using updated runtime config.
 */
export async function resetDatabaseConnection(): Promise<void> {
	const existing = globalForDb.__certflowDbSlot;
	globalForDb.__certflowDbSlot = undefined;
	if (existing) {
		await existing.close();
	}
}

/**
 * Runs Drizzle SQL migrations against the configured database (remote PostgreSQL or embedded PGlite).
 */
export async function runDatabaseMigrations(databaseUrl: string): Promise<void> {
	const migrationsFolder = resolve('./drizzle');
	if (isRemotePostgresUrl(databaseUrl)) {
		const client = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
		try {
			await migratePostgres(drizzlePostgres(client), { migrationsFolder });
		} finally {
			await client.end({ timeout: 5 }).catch(() => {});
		}
		return;
	}

	// Ensure any existing PGlite handle releases the directory lock before migrating.
	await resetDatabaseConnection();
	const dataDir = resolve(databaseUrl.replace(/^pglite:\/\//, '') || './.local/pgdata');
	mkdirSync(dataDir, { recursive: true });
	const pgliteClient = new PGlite(dataDir);
	try {
		await migratePglite(drizzlePglite(pgliteClient), { migrationsFolder });
	} finally {
		await pgliteClient.close().catch(() => {});
	}
}

// Lazily initialise the database handle on first query so `vite build` route analysis never opens PGlite or a network pool.
export const db: Database = new Proxy({} as Database, {
	get(_target, prop, receiver) {
		const instance = getDatabase();
		const value = Reflect.get(instance as object, prop, receiver);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
