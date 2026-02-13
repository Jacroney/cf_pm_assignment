const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

const feedbackItems = [
	{ text: 'Dashboard takes 10+ seconds to load after the last update', source: 'slack' },
	{ text: 'Love the new dark mode, works great on mobile', source: 'survey' },
	{ text: 'Export to CSV has been broken for two weeks, this is blocking our monthly reporting', source: 'support' },
	{ text: 'Would be nice to have keyboard shortcuts for common actions', source: 'email' },
	{ text: 'App crashes when uploading files over 5MB', source: 'support' },
	{ text: 'The onboarding flow is confusing — took me 20 minutes to figure out how to invite teammates', source: 'survey' },
	{ text: 'Search is blazing fast now, great improvement!', source: 'slack' },
	{ text: 'Getting 500 errors intermittently on the billing page', source: 'support' },
	{ text: 'Please add SSO support, our security team requires it for compliance', source: 'email' },
	{ text: 'Charts on the analytics page render incorrectly in Firefox', source: 'support' },
	{ text: 'The API rate limiting is too aggressive — we hit limits during normal usage', source: 'slack' },
	{ text: 'Notifications are unreliable, sometimes I get them hours late', source: 'email' },
	{ text: 'Really impressed with the new collaboration features, our team productivity is up', source: 'survey' },
	{ text: 'Mobile app drains battery very quickly in the background', source: 'support' },
	{ text: 'Would love a Slack integration for real-time alerts', source: 'email' },
];

async function seed() {
	console.log(`Seeding ${feedbackItems.length} feedback items to ${WORKER_URL}/feedback\n`);

	for (const item of feedbackItems) {
		try {
			const res = await fetch(`${WORKER_URL}/feedback`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(item),
			});

			const data = await res.json();

			if (res.ok) {
				console.log(`✓ id=${data.id} source=${item.source} — ${item.text.slice(0, 60)}`);
			} else {
				console.error(`✗ ${res.status} — ${data.error}`);
			}
		} catch (err) {
			console.error(`✗ Network error — ${err.message}`);
		}
	}

	console.log('\nDone. Run: curl http://localhost:8787/summary | jq .');
}

seed();
