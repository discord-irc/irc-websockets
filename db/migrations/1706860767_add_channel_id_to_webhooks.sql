-- TODO: remove DEFAULT 0
ALTER TABLE webhooks ADD COLUMN channel_id INTEGER NOT NULL DEFAULT 0;