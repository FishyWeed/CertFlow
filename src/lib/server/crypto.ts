import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getRuntimeConfig } from './runtime-config.ts';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
	const raw = getRuntimeConfig().encryptionKey.trim();
	if (!raw || raw.length < 16) {
		throw new Error('ENCRYPTION_KEY must be a 64-character hex string or a strong secret.');
	}
	if (/^[0-9a-fA-F]{64}$/.test(raw)) {
		return Buffer.from(raw, 'hex');
	}
	// Support auto-generated secrets from one-click cloud hosts (such as Render) by deriving 32 bytes.
	return createHash('sha256').update(raw, 'utf8').digest();
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
