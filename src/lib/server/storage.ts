import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { LOCAL_UPLOAD_DIR, STORAGE_DRIVER } from '$app/env/private';

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
	if (STORAGE_DRIVER === 'local') {
		return new LocalStorageProvider(LOCAL_UPLOAD_DIR);
	}
	throw new Error(`Storage driver "${STORAGE_DRIVER}" is not yet configured. Add S3/R2 credentials.`);
}
