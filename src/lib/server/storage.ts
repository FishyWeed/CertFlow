import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { getRuntimeConfig } from './runtime-config.ts';

export interface StoredFileResult {
	storageKey: string;
	publicUrl: string;
}

export interface StorageProvider {
	put(key: string, data: Uint8Array, mimeType: string): Promise<StoredFileResult>;
	delete(key: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
	private baseDir: string;

	constructor(baseDir: string) {
		this.baseDir = resolve(baseDir);
	}

	async put(key: string, data: Uint8Array): Promise<StoredFileResult> {
		const safeKey = key.replace(/^\/+/, '').replace(/\.\./g, '');
		const targetPath = join(this.baseDir, safeKey);
		await mkdir(dirname(targetPath), { recursive: true });
		await writeFile(targetPath, data);
		return {
			storageKey: safeKey,
			publicUrl: `/api/assets/file/${encodeURIComponent(safeKey)}`
		};
	}

	async delete(key: string): Promise<void> {
		const safeKey = key.replace(/^\/+/, '').replace(/\.\./g, '');
		const targetPath = join(this.baseDir, safeKey);
		await unlink(targetPath).catch(() => {});
	}
}

/**
 * Returns the configured storage provider.
 * Local disk is used in development; S3 / Cloudflare R2 can be plugged in via STORAGE_DRIVER="s3".
 */
export function getStorage(): StorageProvider {
	const cfg = getRuntimeConfig();
	if (cfg.storageDriver === 'local') {
		return new LocalStorageProvider(cfg.localUploadDir);
	}
	throw new Error(
		`Storage driver "${cfg.storageDriver}" is not yet configured. Add S3/R2 credentials.`
	);
}
