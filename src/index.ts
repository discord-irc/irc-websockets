import irc = require('irc')
import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, IrcMessage, AuthRequest, AuthResponse } from './socket.io'
import express, { Request, Response } from 'express'
import { createServer } from "http";
import { Server } from "socket.io";
import bodyParser from 'body-parser';
const cors = require('cors')

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
})

require('dotenv').config()

const generateToken = (len: number): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for(let i = 0; i < len; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

const isTrue = (envbool: string) => {
  return new RegExp('^(1|true|yes|on)$', 'i').test(envbool)
}

interface User {
  username: string,
  sessionToken: string,
  socket: Socket,
  loggedIn: boolean
}
interface UserList {
  [index: string]: User
}

/*
  users

  list of currently connected users
*/
const users: UserList = {}

const getUserByName = (username: string): User | null => {
  if (username === '') {
    return null
  }
  return Object.values(users).find((user) => user.loggedIn && user.username === username) || null
}

const getUserBySocket = (socket: Socket): User | null => {
  return users[socket.id]
  // return users.find((user) => user.loggedIn && user.socket.id === socket.id) || null
}

if (!process.env.IRC_CHANNEL) {
	console.log('Error: IRC_CHANNEL is not set! check your .env file')
	process.exit(1)
}
if (!process.env.IRC_SERVER) {
	console.log('Error: IRC_SERVER is not set! check your .env file')
	process.exit(1)
}
if (!process.env.ACCOUNTS_PASSWORD) {
	console.log('Error: ACCOUNTS_PASSWORD is not set! check your .env file')
	process.exit(1)
}
if (!process.env.ADMIN_TOKEN) {
	console.log('Error: ADMIN_TOKEN is not set! check your .env file')
	process.exit(1)
}
if (process.env.ADMIN_TOKEN === 'xxx') {
  console.log('Error: using the default ADMIN_TOKEN is not allowed')
  process.exit(1)
}
if (!process.env.BACKLOG_SIZE) {
	console.log('Error: BACKLOG_SIZE is not set! check your .env file')
	process.exit(1)
}


// log of last BACKLOG_SIZE messages
const BACKLOG_SIZE = parseInt(process.env.BACKLOG_SIZE, 10)
const messageRobin: IrcMessage[] = []

const logMessage = (msg: IrcMessage): void => {
  messageRobin.push(msg)
  while (messageRobin.length > BACKLOG_SIZE) {
    messageRobin.shift()
  }
}

interface Config {
  requirePasswords: boolean
}

const config: Config = {
  requirePasswords: isTrue(process.env.ACCOUNTS || '0')
}

const useAccounts = (): boolean => {
  return config.requirePasswords
}

const client = new irc.Client(process.env.IRC_SERVER, 'ws-client', {
	channels: [`#${process.env.IRC_CHANNEL}`],
})

client.addListener('error', (message) => {
    console.log('error: ', message)
})

const logoutUser = (user: User) => {
  console.log(`[*] logging out ${user.username}`)
  user.loggedIn = false
  user.socket.emit(
    'logout',
    {
      message: 'logged out'
    }
  )
}

// http

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  console.log('WWW: %s %s %s', req.method, req.originalUrl, req.ip)
  next()
})
app.use(cors())
app.get('/messages', (req, res) => {
  res.end(JSON.stringify(messageRobin))
})

const checkAdminAuth = (req: Request, res: Response): boolean => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.send(JSON.stringify({
      error: 'Authentication is required please set the bearer authorization header.'
    }))
    return false
  }
  const authToken = authHeader.slice('Bearer '.length)
  console.log(`Auth token: ${authToken}`)
  if (authToken !== process.env.ADMIN_TOKEN) {
    res.send(JSON.stringify({
      error: 'Invalid API key provided'
     }))
    return false
  }
  return true
}

// curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer youradmintoken" --data '{"required": true }' http://localhost:6969/admin/logout_all
app.post('/admin/logout_all', (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) {
    return
  }
  console.log(`[*] admin logged out all users`)
  Object.values(users).forEach((user) => logoutUser(user))
  res.send({
    message: 'OK'
  })
})

// curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer youradmintoken" --data '{"required": true }' http://localhost:6969/admin/password
app.post('/admin/password', (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) {
    return
  }
  console.log(req.body)
  if (!req.body || req.body.required === undefined) {
    res.send({
      error: "missing key 'required'"
    })
    return
  }
  const { required } = req.body
  config.requirePasswords = required ? true : false
  console.log(`[*] admin set password required to ${required}`)
  res.send({
    message: 'OK'
  })
})

// ws

const checkAuth = (message: IrcMessage): boolean => {
  const user = getUserByName(message.from)
  if (!user) {
    return false
  }
  if (!user.loggedIn) {
    return false
  }
  if (user.sessionToken !== message.token) {
    console.log(`[!] Wrong token expected='${user.sessionToken}' got='${message.token}'`)
    return false
  }
  return true
}

client.addListener(`message#${process.env.IRC_CHANNEL}`, (from, message) => {
  console.log(from + ' => #yourchannel: ' + message)
  const ircMessage = { from: from, message: message }
  logMessage(ircMessage)
  io.emit('message', ircMessage)
})

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>): void => {
    const ipAddr = socket.client.conn.remoteAddress
    const userAgent = socket.handshake.headers['user-agent']
    console.log(`[*] connect ${ipAddr} ${userAgent}`)
    const user: User = {
      username: 'connecting',
      sessionToken: generateToken(32),
      socket: socket,
      loggedIn: false
    }
    users[socket.id] = user

    socket.on('disconnect', (): void => {
      const user = getUserBySocket(socket)
      if (user) {
        console.log(`[*] '${user.username}' left`)
      } else {
        console.log(`[*] leave before login ${userAgent}`)
      }
      delete users[socket.id]
    })

    socket.on('authRequest', (auth: AuthRequest): void => {
      if(getUserByName(auth.username)) {
        socket.emit(
          'authResponse',
          {
            username: auth.username,
            token: '',
            success: false,
            message: 'this user is already logged in'
          }
        )
        return
      }
      if (useAccounts() && process.env.ACCOUNTS_PASSWORD !== auth.password) {
        socket.emit(
          'authResponse',
          {
            username: auth.username,
            token: '',
            success: false,
            message: 'wrong password'
          }
        )
        return
      }
      const user = getUserBySocket(socket)
      if (!user) {
        throw 'User not found'
      }
      user.username = auth.username
      user.loggedIn = true
      console.log(`[*] '${user.username}' logged in`)
      socket.emit(
        'authResponse',
        {
          username: user.username,
          token: user.sessionToken,
          success: true,
          message: 'logged in'
        }
      )
    })
    socket.on('message', (message: IrcMessage): void => {
      if(useAccounts()) {
        if (!checkAuth(message)) {
          console.log(`[!] WARNING invalid token from ${ipAddr} ${userAgent}`)
          return
        }
      }
      console.log(`[*] message from ${ipAddr} ${userAgent}`)
      const messageStr = `<${message.from}> ${message.message}`
      console.log(`    ${messageStr}`)
      client.say(`#${process.env.IRC_CHANNEL}`, messageStr)
      logMessage(message)
      io.emit('message', message)
    })
})

httpServer.listen(6969, (): void => {
    console.log('[*] listening on http://localhost:6969')
    console.log(`[*] accounts are ${useAccounts() ? 'on' : 'off'}`)
})
