const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice')
const WebSocket = require('ws')
const prism = require('prism-media')
const client = require('../discordClient')
const config = require('../config')
const { notifyAdmins } = require('./utils')

let websocketBaseUrl = config.API_BASE_URL
if (websocketBaseUrl.startsWith('http://127.0.0.1') || websocketBaseUrl.startsWith('http://localhost')) {
  websocketBaseUrl = websocketBaseUrl.replace(/^http/, 'ws')
} else if (websocketBaseUrl.startsWith('https://127.0.0.1') || websocketBaseUrl.startsWith('https://localhost')) {
  websocketBaseUrl = websocketBaseUrl.replace(/^https/, 'wss')
} else {
  websocketBaseUrl = websocketBaseUrl.replace(/^http/, 'ws')
  if (config.API_BASE_URL.startsWith('https')) {
    websocketBaseUrl = config.API_BASE_URL.replace(/^https/, 'wss')
  }
}
const WEBSOCKET_URL = `${websocketBaseUrl}/ws/audio`
console.log(`[VoiceHandler] WebSocket URL configured to: ${WEBSOCKET_URL}`)

const guildVoiceConnections = new Map()
const userVoiceSessions = new Map()

const SILENCE_TIMEOUT_MS = 2000

async function joinChannelCmd(message) {
  if (!message.member.voice.channel) {
    return message.reply('Musisz być na kanale głosowym, abym mógł dołączyć!')
  }
  const targetChannel = message.member.voice.channel

  if (guildVoiceConnections.has(targetChannel.guild.id)) {
    return message.reply(`Już jestem na kanale głosowym na tym serwerze.`)
  }

  try {
    const connection = joinVoiceChannel({
      channelId: targetChannel.id,
      guildId: targetChannel.guild.id,
      adapterCreator: targetChannel.guild.voiceAdapterCreator,
      selfDeaf: false, // BOT Nasłuchuje
      selfMute: true, // BOT jest wyciszony - nie musi mówić
    })

    await entersState(connection, VoiceConnectionStatus.Ready, 30e3)
    guildVoiceConnections.set(targetChannel.guild.id, connection)
    message.reply(`Dołączono do kanału głosowego: **${targetChannel.name}**! Rozpoczynam nasłuchiwanie.`)
    console.log(
      `[VoiceHandler] Bot dołączył do kanału ${targetChannel.name} (ID: ${targetChannel.id}) na serwerze ${targetChannel.guild.name}`
    )

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ])
      } catch (error) {
        console.log(
          `[VoiceHandler] Połączenie głosowe na serwerze ${targetChannel.guild.name} zostało przerwane i nie można go przywrócić. Usuwanie...`
        )
        connection.destroy()
        guildVoiceConnections.delete(targetChannel.guild.id)
        userVoiceSessions.forEach((session, key) => {
          if (key.startsWith(targetChannel.guild.id + '-')) {
            cleanupUserSession(key)
          }
        })
      }
    })

    connection.receiver.speaking.on('start', (userId) => {
      const user = client.users.cache.get(userId)
      if (user && !user.bot) {
        console.log(`[VoiceHandler] Użytkownik ${user.tag} zaczął mówić na serwerze ${targetChannel.guild.name}.`)
        startListeningToUser(targetChannel.guild.id, userId, user.tag, connection.receiver)
      }
    })
  } catch (error) {
    console.error('[VoiceHandler] Błąd podczas dołączania do kanału głosowego:', error)
    message.reply('Nie udało się dołączyć do kanału głosowego.')
    const existingConnection = guildVoiceConnections.get(targetChannel.guild.id)
    if (existingConnection) {
      existingConnection.destroy()
      guildVoiceConnections.delete(targetChannel.guild.id)
    }
  }
}

function leaveChannelCmd(message) {
  const connection = guildVoiceConnections.get(message.guild.id)
  if (connection) {
    connection.destroy()
    guildVoiceConnections.delete(message.guild.id)
    message.reply('Opuściłem kanał głosowy.')
    console.log(`[VoiceHandler] Bot opuścił kanał głosowy na serwerze ${message.guild.name}`)
    userVoiceSessions.forEach((session, key) => {
      if (key.startsWith(message.guild.id + '-')) {
        cleanupUserSession(key)
      }
    })
  } else {
    message.reply('Nie jestem na żadnym kanale głosowym na tym serwerze.')
  }
}

function startListeningToUser(guildId, userId, userTag, receiver) {
  const sessionKey = `${guildId}-${userId}`
  if (userVoiceSessions.has(sessionKey)) {
    const existingSession = userVoiceSessions.get(sessionKey)
    if (existingSession.silenceTimeout) clearTimeout(existingSession.silenceTimeout)
    existingSession.silenceTimeout = setTimeout(() => {
      sendAudioAndFinalize(sessionKey)
    }, SILENCE_TIMEOUT_MS)
    return
  }

  console.log(`[VoiceHandler] Rozpoczynam nasłuchiwanie użytkownika: ${userTag} (ID: ${userId})`)

  const wsOptions = {}
  if (
    WEBSOCKET_URL.startsWith('wss:') &&
    (WEBSOCKET_URL.includes('127.0.0.1') || WEBSOCKET_URL.includes('localhost'))
  ) {
    wsOptions.rejectUnauthorized = false
    console.log(`[VoiceHandler] Używam rejectUnauthorized: false dla ${WEBSOCKET_URL}`)
  }

  const ws = new WebSocket(WEBSOCKET_URL, wsOptions)
  const session = { ws, audioStream: null, silenceTimeout: null, userTag }
  userVoiceSessions.set(sessionKey, session)

  ws.on('open', () => {
    console.log(`[VoiceHandler] Połączono z WebSocket dla ${userTag}`)
    const connection = guildVoiceConnections.get(guildId)
    if (!connection || !connection.receiver) {
      console.error(
        `[VoiceHandler] Brak połączenia głosowego lub receivera dla guildId: ${guildId} przy próbie subskrypcji audio dla ${userTag}.`
      )
      cleanupUserSession(sessionKey)
      return
    }

    session.audioStream = connection.receiver.subscribe(userId, {
      // end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }, // Można eksperymentować
      mode: 'pcm',
    })

    session.silenceTimeout = setTimeout(() => {
      sendAudioAndFinalize(sessionKey)
    }, SILENCE_TIMEOUT_MS)

    session.audioStream.on('data', (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk)
      }
      if (session.silenceTimeout) clearTimeout(session.silenceTimeout)
      session.silenceTimeout = setTimeout(() => {
        sendAudioAndFinalize(sessionKey)
      }, SILENCE_TIMEOUT_MS)
    })

    session.audioStream.on('error', (error) => {
      console.error(`[VoiceHandler] Błąd strumienia audio od ${userTag}:`, error)
      cleanupUserSession(sessionKey)
    })

    session.audioStream.on('end', () => {
      console.log(`[VoiceHandler] Strumień audio od ${userTag} zakończył się.`)
      setTimeout(() => {
        if (userVoiceSessions.has(sessionKey)) {
          sendAudioAndFinalize(sessionKey)
        }
      }, 250)
    })
  })

  ws.on('message', (messageData) => {
    try {
      const response = JSON.parse(messageData.toString())
      console.log(`[VoiceHandler] Otrzymano odpowiedź od API dla ${userTag}:`, response)

      if (response.toxicity_score > config.TOXICITY_THRESHOLD_WARN) {
        const warningMessage = `🎤⚠️ Użytkownik **${userTag}** na kanale głosowym: _"${
          response.transcription
        }"_ (Toksyczność: ${response.toxicity_score.toFixed(2)})`
        notifyAdmins(warningMessage, config)
      }
    } catch (e) {
      console.error(
        '[VoiceHandler] Błąd parsowania odpowiedzi JSON z WebSocket:',
        e,
        'Otrzymano:',
        messageData.toString()
      )
    }
  })

  ws.on('close', (code, reason) => {
    const reasonString = reason ? reason.toString() : 'Brak powodu'
    console.log(`[VoiceHandler] Rozłączono WebSocket dla ${userTag}. Kod: ${code}, Powód: ${reasonString}`)
    cleanupUserSession(sessionKey)
  })

  ws.on('error', (error) => {
    console.error(`[VoiceHandler] Błąd WebSocket dla ${userTag}: ${error.message}`)
    cleanupUserSession(sessionKey)
  })
}

function sendAudioAndFinalize(sessionKey) {
  const session = userVoiceSessions.get(sessionKey)
  if (!session || !session.ws || session.ws.readyState !== WebSocket.OPEN) {
    if (session)
      console.log(
        `[VoiceHandler] Nie można wysłać __END__ dla ${session.userTag} - WS nie jest otwarty lub brak sesji.`
      )
    cleanupUserSession(sessionKey)
    return
  }

  console.log(`[VoiceHandler] Wysyłanie __END__ do WebSocket dla użytkownika ${session.userTag}`)
  try {
    session.ws.send(Buffer.from('__END__'))
  } catch (e) {
    console.error(`[VoiceHandler] Błąd podczas wysyłania __END__ dla ${session.userTag}: ${e.message}`)
  }

  if (session.silenceTimeout) clearTimeout(session.silenceTimeout)
  session.silenceTimeout = null
}

function cleanupUserSession(sessionKey) {
  const session = userVoiceSessions.get(sessionKey)
  if (session) {
    console.log(
      `[VoiceHandler] Czyszczenie sesji dla klucza: ${sessionKey} (użytkownik: ${session.userTag || 'nieznany'})`
    )
    if (session.audioStream && !session.audioStream.destroyed) {
      session.audioStream.destroy()
      console.log(`[VoiceHandler] Strumień audio dla ${session.userTag} zniszczony.`)
    }
    if (session.ws) {
      if (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING) {
        session.ws.terminate()
        console.log(`[VoiceHandler] WebSocket dla ${session.userTag} zakończony.`)
      }
    }
    if (session.silenceTimeout) {
      clearTimeout(session.silenceTimeout)
    }
    userVoiceSessions.delete(sessionKey)
  }
}

module.exports = {
  joinChannelCmd,
  leaveChannelCmd,
}
