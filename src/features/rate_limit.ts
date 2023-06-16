import { IrcMessage } from "../socket.io";

let lastMesgSent = new Date()
const ratelimitLog: Date[] = []

export const isRatelimited = (message: IrcMessage): boolean => {
    // const newDate = new Date(message.date)
    // ^ do not trust what the client claims is the date
    // just check current date
    const now = new Date()
    const diff = now.valueOf() - lastMesgSent.valueOf()
    // delete messages from log that are older than 7s
    while (ratelimitLog.length > 0 && (now.valueOf() - ratelimitLog[0].valueOf()) > 7000) {
        ratelimitLog.shift()
    }
    // if the log is longer than 5
    // we disallow sending any message
    if (ratelimitLog.length > 5) {
        return true
    }
    lastMesgSent = now
    // log messages sent in 2s intervals
    if (diff < 2000) {
        ratelimitLog.push(now)
    }
    return false
}
