import { DurableObject } from 'cloudflare:workers';

/**
 * @typedef {Object} Env
 * @property {DurableObjectNamespace} MY_DURABLE_OBJECT
 * @property {D1Database} DB
 */

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export class MyDurableObject extends DurableObject {
	constructor(ctx, env) {
		super(ctx, env);
	}
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === '/feedback' && request.method === 'POST') {
			let body;
			try {
				body = await request.json();
			} catch {
				return json({ error: 'Invalid JSON' }, 400);
			}

			if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
				return json({ error: '"text" is required and must be a non-empty string' }, 400);
			}

			const text = body.text.trim();
			const source = (body.source && typeof body.source === 'string') ? body.source.trim() : 'unknown';

			const result = await env.DB.prepare(
				'INSERT INTO feedback (text, source) VALUES (?, ?) RETURNING id, text, source, created_at'
			)
				.bind(text, source)
				.first();

			return json(result, 201);
		}

		if (url.pathname === '/summary' && request.method === 'GET') {
			const { results } = await env.DB.prepare(
				'SELECT id, text, source, created_at FROM feedback ORDER BY created_at DESC'
			).all();

			return json(results);
		}

		return json({ error: 'Not found' }, 404);
	},
};
