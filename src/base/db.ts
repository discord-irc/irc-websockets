import Database from 'better-sqlite3'
const db = new Database('./db/main.db')
db.pragma('journal_mode = WAL')

export interface IUserRow {
  ID: number,
  username: string,
  password: string,
  register_ip: string,
  login_ip: string,
  created_at: string,
  updated_at: string,
  is_admin: number,
  blocked: number
}

try {
  // TODO: read own source code or use db cli to find latest migration timestamp
  //       and verify that is set
  //       otherwise accounts might exist but newer migrations are missing
  db.exec('SELECT * FROM Accounts LIMIT 1')
} catch (SqliteError) {
  console.log(`[!] Error: test select failed`)
  console.log(`[!]        try running 'npm run db migrate'`)
  process.exit(1)
}

export const addNewUser = (username: string, password: string, ipAddr: string) => {
  const insertQuery = `INSERT INTO Accounts(
    username, password, register_ip, login_ip, created_at, updated_at, is_admin
  ) VALUES (?, ? , ?, ?, DateTime('now'), DateTime('now'), ?);
  `
  const stmt = db.prepare(insertQuery)
  stmt.run(
    username,
    password,
    ipAddr,
    ipAddr,
    0
  )
}

export const isUsernameTaken = (username: string): boolean => {
  const row = db.prepare('SELECT * FROM Accounts WHERE username = ?').get(username)
  if(!row) {
    return false
  }
  return true
}

export const getUser = (username: string, password: string): null | IUserRow => {
  const row: undefined | IUserRow = db.
    prepare('SELECT * FROM Accounts WHERE username = ? AND password = ?')
    .get(username, password) as undefined | IUserRow
  if(!row) {
    return null
  }
  return row
}

export const getDb = () => db
