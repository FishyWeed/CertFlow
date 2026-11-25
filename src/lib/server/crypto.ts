import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ENCRYPTION_KEY } from '$app/env/private';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
	if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
		throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
	}
	return Buffer.from(ENCRYPTION_KEY, 'hex');
}

export function encryptSecret(plaintext: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
	const [ivHex, tagHex, dataHex] = payload.split(':');
	if (!ivHex || !tagHex || !dataHex) {
		throw new Error('Invalid encrypted secret format');
	}
	const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
	decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(dataHex, 'hex')),
		decipher.final()
	]);
	return decrypted.toString('utf8');
}
