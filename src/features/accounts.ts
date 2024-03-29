import { WsState } from ".."
import { getConfig } from "../base/config"
import { joinChannel } from "./channels"
import { getWebsocket } from "../network/server"
import { AuthRequest, IrcMessage, RegisterRequest } from "../socket.io"
import { getUserByName, getUserBySocket, logoutUser, usernamePattern } from "../session_users"
import { getUser, isUsernameTaken } from "../base/db"
import { IUserRow, User } from "../models/user"

export const useAccounts = (): boolean => {
  return getConfig().requirePasswords
}

export const checkAuth = (message: IrcMessage): boolean => {
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

const isValidCredentials = (auth: AuthRequest, dbUser: null | IUserRow): boolean => {
  // there are two valid logins
  // username and password with a proper account
  // or one master password that does not auth a full account and where users pick the username freely
  if(!useAccounts()) {
    return true
  }
  return process.env.ACCOUNTS_PASSWORD === auth.password || dbUser != null
}

const authError = (wsState: WsState, msg: string): void => {
  wsState.socket.emit(
    'authResponse',
    {
      username: '',
      admin: false,
      token: '',
      success: false,
      message: msg
    }
  )
}

const isValidStr = (str: string): boolean => {
  if(typeof str !== 'string') {
    return false
  }
  if(str === '') {
    return false
  }
  return true
}

export const onRegisterRequest = (wsState: WsState, register: RegisterRequest) => {
  console.log(`[*] register request ip=${wsState.ipAddr} username=${register.username} password=${register.password} token=${register.token}`)
  if(!isValidStr(register.username)) {
    authError(wsState, 'invalid username')
    return
  }
  if(!isValidStr(register.password)) {
    authError(wsState, 'invalid password')
    return
  }
  if(!usernamePattern().test(register.username)) {
    authError(wsState, `username has to match ${usernamePattern()}`)
    return
  }
  if(register.password.length < 3 || register.password.length > 1024) {
    authError(wsState, 'password has to be between 3 and 1024 characters long')
    return
  }
  if(register.password === process.env.SIGN_UP_TOKEN || register.password === process.env.ACCOUNTS_PASSWORD) {
    authError(wsState, 'please choose a different password')
    return
  }
  if(isUsernameTaken(register.username)) {
    authError(wsState, 'this username is already taken')
    return
  }
  if(process.env.SIGN_UP_TOKEN && register.token !== process.env.SIGN_UP_TOKEN) {
    authError(wsState, 'invalid sign up token')
    return
  }
  console.log(`[*] register success username=${register.username}`)
  const user = new User({
    username: register.username,
    password: register.password,
    register_ip: wsState.ipAddr
  })
  user.insert()
  wsState.socket.emit(
    'authResponse',
    {
      username: register.username,
      admin: false,
      token: '',
      success: true,
      message: 'Successfully registered! You can now log in!'
    }
  )
}

export const onAuthRequest = (wsState: WsState, auth: AuthRequest) => {
  const dbUser = getUser(auth.username, auth.password)
  const conflictingUser = getUserByName(auth.username)
  if(conflictingUser) {
    logoutUser(conflictingUser, 'logged in from another location')
  }
  if (!isValidCredentials(auth, dbUser)) {
    authError(wsState, 'wrong credentials')
    return
  }
  if (dbUser) {
    if (dbUser.is_blocked) {
      authError(wsState, 'this account is blocked')
      return
    }
  } else if(isUsernameTaken(auth.username)) {
    authError(wsState, 'this username needs a different password')
    return
  }
  const user = getUserBySocket(wsState.socket)
  if (!user) {
    throw 'User not found'
  }
  user.username = auth.username
  user.loggedIn = true
  user.dbUser = dbUser
  if (!joinChannel(wsState.socket, auth.channel, auth.server)) {
    authError(wsState, 'failed to join channel')
    user.loggedIn = false
    return
  }
  console.log(`[*] '${user.username}' logged in ${user.dbUser ? 'to account' : 'with master password'}`)
  getWebsocket().emit('userJoin', user.username)
  wsState.socket.emit(
    'authResponse',
    {
      username: user.username,
      admin: dbUser && dbUser.is_admin === 1 || false,
      token: user.sessionToken,
      success: true,
      message: 'logged in'
    }
  )
}
