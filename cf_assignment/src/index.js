import { DurableObject } from 'cloudflare:workers';

/**
 * @typedef {Object} Env
 * @property {DurableObjectNamespace} MY_DURABLE_OBJECT
 * @property {D1Database} DB
 * @property {Ai} AI
 */

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

/**
 * Classify feedback text using Workers AI.
 * Returns { theme, sentiment, urgency, summary } or nulls on failure.
 */
async function classifyFeedback(ai, text) {
	try {
		const prompt = `You are a feedback classifier. Analyze the following user feedback and return ONLY valid JSON (no markdown, no explanation) with these exact fields:

- "theme": a short lowercase label, e.g. "performance", "bug", "feature-request", "ux", "praise", "reliability", "security"
- "sentiment": exactly one of "positive", "negative", "neutral"
- "urgency": exactly one of "low", "medium", "high"
- "summary": a one-line summary of the feedback, max 15 words

Feedback: "${text}"`;

		const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			prompt,
			max_tokens: 150,
		});

		let raw = response.response || '';
		// Strip markdown code fences if present
		raw = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();

		const parsed = JSON.parse(raw);

		const validSentiments = ['positive', 'negative', 'neutral'];
		const validUrgencies = ['low', 'medium', 'high'];

		return {
			theme: typeof parsed.theme === 'string' ? parsed.theme.toLowerCase().slice(0, 50) : null,
			sentiment: validSentiments.includes(parsed.sentiment) ? parsed.sentiment : null,
			urgency: validUrgencies.includes(parsed.urgency) ? parsed.urgency : null,
			summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : null,
		};
	} catch {
		return { theme: null, sentiment: null, urgency: null, summary: null };
	}
}

export class MyDurableObject extends DurableObject {
	constructor(ctx, env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS theme_counts (
				theme TEXT PRIMARY KEY,
				count INTEGER NOT NULL DEFAULT 0
			)
		`);
	}

	async recordTheme(theme) {
		this.sql.exec(
			`INSERT INTO theme_counts (theme, count) VALUES (?, 1)
			 ON CONFLICT(theme) DO UPDATE SET count = count + 1`,
			theme
		);
	}

	async getThemeCounts() {
		return this.sql.exec('SELECT theme, count FROM theme_counts ORDER BY count DESC').toArray();
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

			const ai = await classifyFeedback(env.AI, text);

			const result = await env.DB.prepare(
				'INSERT INTO feedback (text, source, theme, sentiment, urgency, summary) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, text, source, theme, sentiment, urgency, summary, created_at'
			)
				.bind(text, source, ai.theme, ai.sentiment, ai.urgency, ai.summary)
				.first();

			// Record theme in Durable Object for real-time aggregation
			if (ai.theme) {
				const stub = env.MY_DURABLE_OBJECT.get(env.MY_DURABLE_OBJECT.idFromName('theme-counter'));
				ctx.waitUntil(stub.recordTheme(ai.theme));
			}

			return json(result, 201);
		}

		if (url.pathname === '/summary' && request.method === 'GET') {
			// Fetch feedback from D1 and theme counts from DO in parallel
			const stub = env.MY_DURABLE_OBJECT.get(env.MY_DURABLE_OBJECT.idFromName('theme-counter'));
			const [{ results }, themeRows] = await Promise.all([
				env.DB.prepare('SELECT id, text, source, theme, sentiment, urgency, summary, created_at FROM feedback').all(),
				stub.getThemeCounts(),
			]);

			// Build theme count map from DO data
			const themeCounts = {};
			for (const row of themeRows) {
				themeCounts[row.theme] = row.count;
			}
			const maxThemeCount = Math.max(1, ...Object.values(themeCounts));

			const urgencyScore = { high: 3, medium: 2, low: 1 };
			const sentimentScore = { negative: 3, neutral: 2, positive: 1 };

			const scored = results.map((row) => {
				const uScore = urgencyScore[row.urgency] || 0;
				const sScore = sentimentScore[row.sentiment] || 0;
				// Normalize theme frequency to 1-3 range
				const tCount = row.theme ? (themeCounts[row.theme] || 0) : 0;
				const tScore = maxThemeCount > 0 ? Math.round((tCount / maxThemeCount) * 2) + 1 : 0;
				const importance = uScore + sScore + tScore;
				return { ...row, importance };
			});

			scored.sort((a, b) => b.importance - a.importance);

			return json(scored);
		}

		return json({ error: 'Not found' }, 404);
	},
};
