const { joinVoiceChannel, entersState, VoiceConnectionStatus, EndBehaviorType } = require('@discordjs/voice')
const { OpusEncoder } = require('@discordjs/opus')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('path')
const client = require('../discordClient')
const config = require('../config')
const { notifyAdmins, warnUser } = require('./utils')
const { analyzeVoiceAudioApi } = require('./apiService')

const guildVoiceConnections = new Map()
const userVoiceSessions = new Map()

const SILENCE_TIMEOUT_MS = 3000
const MIN_RECORDING_MS = 2500
const TARGET_SAMPLE_RATE = 48000
const TARGET_CHANNELS = 2

function safeFileName(str) {
  return str.replace(/[^\w.-]/g, '_')
}

async function joinChannelCmd(message) {
  if (!message.member.voice.channel) {
    return message.reply('Musisz być na kanale głosowym, abym mógł dołączyć!')
  }
  const targetChannel = message.member.voice.channel

  if (guildVoiceConnections.has(targetChannel.guild.id)) {
    const oldConnection = guildVoiceConnections.get(targetChannel.guild.id)
    if (oldConnection) {
      console.log(`[VoiceHandler] Niszczenie istniejącego połączenia dla serwera ${targetChannel.guild.name}`)
      oldConnection.destroy() // To powinno wywołać 'stateChange' na Destroyed
    }
    // Nie usuwaj guildVoiceConnections.delete tutaj, poczekaj na event 'Destroyed'
  }

  try {
    const connection = joinVoiceChannel({
      channelId: targetChannel.id,
      guildId: targetChannel.guild.id,
      adapterCreator: targetChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    })

    connection.on('stateChange', (oldState, newState) => {
      console.log(
        `[VoiceHandler] Stan połączenia głosowego: ${oldState.status} -> ${newState.status} (Serwer: ${targetChannel.guild.name})`
      )
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        setTimeout(() => {
          if (
            connection.state.status !== VoiceConnectionStatus.Destroyed &&
            connection.state.status !== VoiceConnectionStatus.Ready
          ) {
            try {
              console.log('[VoiceHandler] Próba ręcznego rejoin...')
              connection.rejoin()
            } catch (e) {
              console.error('[VoiceHandler] Błąd podczas ręcznego rejoin, niszczenie połączenia:', e)
              connection.destroy()
            }
          }
        }, 5000)
      } else if (newState.status === VoiceConnectionStatus.Destroyed) {
        console.log(
          `[VoiceHandler] Połączenie głosowe zniszczone na serwerze ${targetChannel.guild.name}. Czyszczenie...`
        )
        guildVoiceConnections.delete(targetChannel.guild.id)
        // Wyczyść wszystkie sesje użytkowników powiązane z tym serwerem
        const prefix = targetChannel.guild.id + '-'
        for (const key of userVoiceSessions.keys()) {
          if (key.startsWith(prefix)) {
            cleanupUserSession(key)
          }
        }
      }
    })
    connection.on('error', (error) => console.error(`[VoiceHandler] Błąd połączenia głosowego:`, error))

    await entersState(connection, VoiceConnectionStatus.Ready, 30e3)
    guildVoiceConnections.set(targetChannel.guild.id, connection)
    message.reply(`✅ Dołączono do kanału głosowego: **${targetChannel.name}**! Rozpoczynam nasłuchiwanie.`)

    connection.receiver.speaking.on('start', (userId) => {
      const user = client.users.cache.get(userId)
      if (user && !user.bot) {
        startListeningToUser(targetChannel.guild.id, userId, user.tag, connection.receiver)
      }
    })
  } catch (error) {
    message.reply(`❌ Nie udało się dołączyć do kanału głosowego: ${error.message}`)
    const existingConnection = guildVoiceConnections.get(targetChannel.guild.id)
    if (existingConnection) existingConnection.destroy()
    guildVoiceConnections.delete(targetChannel.guild.id)
  }
}

function leaveChannelCmd(message) {
  const connection = guildVoiceConnections.get(message.guild.id)
  if (connection) {
    connection.destroy()
    message.reply('Opuściłem kanał głosowy.')
  } else {
    message.reply('Nie jestem na żadnym kanale głosowym na tym serwerze.')
  }
}

function startListeningToUser(guildId, userId, userTag, receiver) {
  const sessionKey = `${guildId}-${userId}`
  let session = userVoiceSessions.get(sessionKey)

  if (session) {
    // Sesja istnieje. Sprawdź, czy strumień audio jest aktywny.
    // Jeśli użytkownik przestał mówić (stream 'end') i teraz zaczyna znowu,
    // poprzedni stream jest zakończony.
    if (session.audioStream && !session.audioStream.destroyed) {
      // Strumień wciąż istnieje, prawdopodobnie użytkownik mówi dalej lub z krótką przerwą
      if (session.silenceTimeout) clearTimeout(session.silenceTimeout)
      session.silenceTimeout = setTimeout(() => sendAudioToRestApi(sessionKey), SILENCE_TIMEOUT_MS)
      // console.log(`[VoiceHandler] Użytkownik ${userTag} kontynuuje mówienie w istniejącej sesji.`);
      return
    } else {
      // Strumień nie istnieje lub jest zniszczony, ale sesja tak. Przygotuj na nowy strumień.
      console.log(
        `[VoiceHandler] Użytkownik ${userTag} zaczął mówić ponownie, tworzę nowy strumień audio w istniejącej sesji.`
      )
      prepareForNextPcmSegment(sessionKey) // Czyści bufor PCM
    }
  } else {
    // Nowa sesja dla tego użytkownika
    console.log(`[VoiceHandler] Tworzę NOWĄ sesję nasłuchiwania dla użytkownika: ${userTag}`)
    session = {
      // audioStream zostanie ustawiony poniżej
      silenceTimeout: null,
      userTag,
      userId,
      guildId,
      pcmBuffer: [],
      pcmDataSize: 0,
      opusEncoder: new OpusEncoder(TARGET_SAMPLE_RATE, TARGET_CHANNELS),
    }
    userVoiceSessions.set(sessionKey, session)
  }

  if (userVoiceSessions.has(sessionKey)) {
    const existingSession = userVoiceSessions.get(sessionKey)
    if (existingSession.silenceTimeout) clearTimeout(existingSession.silenceTimeout)
    existingSession.silenceTimeout = setTimeout(() => sendAudioToRestApi(sessionKey), SILENCE_TIMEOUT_MS)
  }

  const connection = guildVoiceConnections.get(guildId)
  if (!connection || !connection.receiver) {
    console.error(
      `[VoiceHandler] Brak połączenia głosowego lub receivera dla guildId: ${guildId} przy próbie subskrypcji dla ${userTag}.`
    )
    cleanupUserSession(sessionKey)
    return
  }

  if (session.audioStream && !session.audioStream.destroyed) {
    console.warn(
      `[VoiceHandler] Próba utworzenia nowego strumienia dla ${userTag}, gdy stary jeszcze istnieje i nie jest zniszczony. To nie powinno się zdarzyć.`
    )
    session.audioStream.destroy() // Zniszcz stary na wszelki wypadek
  }

  session.audioStream = connection.receiver.subscribe(userId, {
    mode: 'opus',
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 500,
    },
  })
  if (session.silenceTimeout) clearTimeout(session.silenceTimeout)
  session.silenceTimeout = setTimeout(() => sendAudioToRestApi(sessionKey), SILENCE_TIMEOUT_MS)

  session.audioStream.on('data', (chunk) => {
    try {
      const pcm = session.opusEncoder.decode(chunk)
      session.pcmBuffer.push(pcm)
      session.pcmDataSize += pcm.length
    } catch (err) {
      console.error('[VoiceHandler] Błąd dekodowania Opus:', err)
    }
    if (session.silenceTimeout) clearTimeout(session.silenceTimeout)
    session.silenceTimeout = setTimeout(() => sendAudioToRestApi(sessionKey), SILENCE_TIMEOUT_MS)
  })
  session.audioStream.on('error', () => cleanupUserSession(sessionKey))
  session.audioStream.on('end', () => {
    console.log(
      `[VoiceHandler] Strumień audio Opus od ${userTag} ZAKOŃCZYŁ SIĘ (np. przez AfterSilence). Przetwarzam zebrane dane.`
    )
    if (session.silenceTimeout) clearTimeout(session.silenceTimeout)
    setTimeout(() => {
      if (userVoiceSessions.has(sessionKey) && userVoiceSessions.get(sessionKey) === session) {
        sendAudioToRestApi(sessionKey)
      }
    }, 250)
  })
}

function prepareForNextPcmSegment(sessionKey) {
  const session = userVoiceSessions.get(sessionKey)
  if (session) {
    session.pcmBuffer = []
    session.pcmDataSize = 0
  }
}

function encodePcmToMp3(pcmFilePath, mp3FilePath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(pcmFilePath)
      .inputFormat('s16le')
      .inputOptions([
        '-ar 96000', // Sample rate
        '-ac 1', // Mono
      ])
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .on('start', (commandLine) => console.log('FFmpeg command:', commandLine)) // Optional: for debug
      .on('error', (err) => reject(err))
      .on('end', () => {
        fs.readFile(mp3FilePath, (err, data) => {
          if (err) return reject(err)
          resolve(data)
        })
      })
      .save(mp3FilePath)
  })
}

async function sendAudioToRestApi(sessionKey) {
  const session = userVoiceSessions.get(sessionKey)
  if (!session) {
    console.log(`[VoiceHandler] Sesja dla klucza ${sessionKey} już nie istnieje. Pomijam wysyłanie.`)
    return
  }

  if (session.silenceTimeout) clearTimeout(session.silenceTimeout)
  session.silenceTimeout = null

  if (session.pcmDataSize === 0 || !session.pcmBuffer || session.pcmBuffer.length === 0) {
    prepareForNextPcmSegment(sessionKey)
    return
  }

  let rawPcmData = Buffer.concat(session.pcmBuffer, session.pcmDataSize)
  prepareForNextPcmSegment(sessionKey)

  // Debug: zapisz PCM
  const debugDir = path.join(__dirname, '..', '..', 'debug-audio')
  if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true })
  const safeUsername = safeFileName(session.userTag)
  const timestamp = Date.now()
  const pcmFilePath = path.join(debugDir, `${timestamp}_${safeUsername}_raw.pcm`)
  const mp3FilePath = path.join(debugDir, `${timestamp}_${safeUsername}.mp3`)
  try {
    fs.writeFileSync(pcmFilePath, rawPcmData)
    const mp3Buffer = await encodePcmToMp3(pcmFilePath, mp3FilePath)

    // Wyślij do REST API
    const apiResult = await analyzeVoiceAudioApi(
      mp3Buffer,
      session.userId,
      config.API_BASE_URL,
      'audio.mp3',
      'audio/mpeg'
    )
    if (apiResult.transcription) {
      console.log(
        `[VoiceHandler] TRANSKRYPCJA (z MP3) dla ${session.userTag}: "${apiResult.transcription.slice(0, 50)}..."`
      )
      if (apiResult.toxicity_score >= config.TOXICITY_THRESHOLD_DELETE) {
        await notifyAdmins(
          `Ostrzeżenie dla użytkownika ${session.userTag}, wiadomość głosowa: "${apiResult.transcription.slice(
            0,
            50
          )}..." Poziom toksyczności: ${apiResult.toxicity_score}`,
          config
        )
        await warnUser(
          session.userId,
          `Twoja wiadomość głosowa "${apiResult.transcription.slice(0, 50)}" została oznaczona jako toksyczna (${
            apiResult.toxicity_score
          }). Prosimy o zachowanie kultury wypowiedzi.`
        )
      }
    } else if (apiResult.error) {
      console.warn(`[VoiceHandler] Błąd od API dla ${session.userTag}: ${apiResult.error}`)
    }
  } catch (err) {
    console.error('[VoiceHandler] Błąd podczas przetwarzania audio:', err)
  } finally {
    const session = userVoiceSessions.get(sessionKey)
    if (session) {
      // Zamknij poprzedni stream, jeśli istnieje
      if (session.audioStream && !session.audioStream.destroyed) {
        session.audioStream.destroy()
        session.audioStream = null
      }
      const connection = guildVoiceConnections.get(session.guildId)
      if (connection && connection.receiver) {
        startListeningToUser(session.guildId, session.userId, session.userTag, connection.receiver)
      }
    }
  }
}

function cleanupUserSession(sessionKey) {
  const session = userVoiceSessions.get(sessionKey)
  if (session) {
    console.log(
      `[VoiceHandler] Czyszczenie pełnej sesji dla klucza: ${sessionKey} (użytkownik: ${session.userTag || 'nieznany'})`
    )
    if (session.audioStream && !session.audioStream.destroyed) {
      session.audioStream.destroy()
    }
    if (session.silenceTimeout) clearTimeout(session.silenceTimeout)
    userVoiceSessions.delete(sessionKey)
  }
}

module.exports = {
  joinChannelCmd,
  leaveChannelCmd,
}
