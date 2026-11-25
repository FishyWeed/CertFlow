// Set safe production defaults for @sveltejs/adapter-node before loading the built server.
process.env.HOST ??= '0.0.0.0';
process.env.BODY_SIZE_LIMIT ??= '50M';
process.env.PROTOCOL_HEADER ??= 'x-forwarded-proto';
process.env.HOST_HEADER ??= 'x-forwarded-host';

await import('../build/index.js');
