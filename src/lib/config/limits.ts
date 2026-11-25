export const MAX_PROJECTS_PER_USER = 10;
export const MAX_STORAGE_BYTES_PER_USER = 30 * 1024 * 1024; // 30 MB per account
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per single image upload
export const MAX_RECIPIENTS_PER_PROJECT = 5000;

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
