CREATE TABLE IF NOT EXISTS channels(
  ID              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT UNIQUE NOT NULL,
  description     TEXT        NOT NULL DEFAULT '',
  discord_server  TEXT        NOT NULL,
  discord_channel TEXT        NOT NULL,
  channel_id      INTEGER     NOT NULL DEFAULT 0,
  irc_channel     TEXT        NOT NULL,
  irc_server_ip   TEXT        NOT NULL,
  irc_server_name TEXT        NOT NULL,
  created_at      TEXT        NOT NULL,
  updated_at      TEXT        NOT NULL,
  is_private      INTEGER     NOT NULL DEFAULT 0,
  owner_id        INTEGER     NOT NULL
);
