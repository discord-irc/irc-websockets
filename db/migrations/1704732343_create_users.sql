CREATE TABLE IF NOT EXISTS users(
  ID          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT        NOT NULL,
  register_ip TEXT        NOT NULL,
  login_ip    TEXT        NOT NULL,
  created_at  TEXT        NOT NULL,
  updated_at  TEXT        NOT NULL,
  is_admin    INTEGER     NOT NULL DEFAULT 0,
  is_blocked  INTEGER     NOT NULL DEFAULT 0,
  -- full account access used by front end for http requests
  -- not to be confused with the sessionToken which expires
  -- when the websocket connection dies
  -- as of right now this permanent full access token is unused
  -- and the front end uses the session token for the http requests
  -- but in the future this token should also work for
  -- http requests
  -- it will come in handy for external clients, bots, weebooks and so on i think ...
  token       TEXT        UNIQUE
);

