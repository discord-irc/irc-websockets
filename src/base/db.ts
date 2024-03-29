import Database from 'better-sqlite3'
import { IUserRow } from '../models/user'
const db = new Database('./db/main.db')
db.pragma('journal_mode = WAL')

export const checkPendingMigrations = () => {
  try {
    // TODO: read own source code or use db cli to find latest migration timestamp
    //       and verify that is set
    //       otherwise accounts might exist but newer migrations are missing
    db.exec('SELECT * FROM servers')
  } catch (SqliteError) {
    console.log(`[!] Error: test select failed`)
    console.log(`[!]        try running 'npm run db migrate'`)
    process.exit(1)
  }
}

checkPendingMigrations()

export const isUsernameTaken = (username: string): boolean => {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if(!row) {
    return false
  }
  return true
}

export const getUser = (username: string, password: string): null | IUserRow => {
  const row: undefined | IUserRow = db.
    prepare('SELECT * FROM users WHERE username = ? AND password = ?')
    .get(username, password) as undefined | IUserRow
  if(!row) {
    return null
  }
  return row
}

export const getDb = () => db
