DROP TABLE IF EXISTS feedback;
CREATE TABLE feedback (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	text TEXT NOT NULL,
	source TEXT NOT NULL DEFAULT 'unknown',
	theme TEXT,
	sentiment TEXT,
	urgency TEXT,
	summary TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
