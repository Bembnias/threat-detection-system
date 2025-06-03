const { PermissionsBitField } = require('discord.js')
const fs = require('fs')
const client = require('../discordClient')

/**
 * Sprawdza, czy użytkownik jest administratorem.
 * @param {import('discord.js').GuildMember | null} member
 * @param {object} config Obiekt konfiguracyjny
 * @returns {boolean}
 */
function isAdministrator(member, config) {
  if (!member) return false
  if (config.ADMIN_USER_IDS.includes(member.id)) {
    return true
  }
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return true
  }
  return false
}

/**
 * Wysyła powiadomienie do kanału administratorów (jeśli skonfigurowano).
 * @param {string} messageContent
 * @param {object} config Obiekt konfiguracyjny
 */
async function notifyAdmins(messageContent, config) {
  if (config.ADMIN_NOTIFICATION_CHANNEL_ID && config.ADMIN_NOTIFICATION_CHANNEL_ID !== 'ID_KANAŁU_DLA_ADMINÓW') {
    try {
      const adminChannel = await client.channels.fetch(config.ADMIN_NOTIFICATION_CHANNEL_ID)
      if (adminChannel && adminChannel.isTextBased()) {
        await adminChannel.send(messageContent)
      } else {
        console.warn(
          `Kanał administratora (${config.ADMIN_NOTIFICATION_CHANNEL_ID}) nie został znaleziony lub nie jest tekstowy.`
        )
      }
    } catch (error) {
      console.error(`Nie można wysłać powiadomienia do administratorów: ${error}`)
    }
  } else {
    console.log(`Powiadomienie dla adminów (nie skonfigurowano kanału lub ID domyślne): ${messageContent}`)
  }
}

/**
 * Wysyła prywatną wiadomość z ostrzeżeniem do użytkownika.
 * @param {string} userId ID użytkownika do ostrzeżenia
 * @param {string} warningMessage Treść ostrzeżenia
 */
async function warnUser(userId, warningMessage) {
  try {
    const user = await client.users.fetch(userId)
    if (user) {
      await user.send(warningMessage)
      console.log(`Wysłano ostrzeżenie do użytkownika ${user.tag} (${userId})`)
    }
  } catch (err) {
    console.warn(`Nie udało się wysłać ostrzeżenia do użytkownika ${userId}: ${err.message}`)
  }
}

/**
 * Zapewnia istnienie katalogu tymczasowego.
 * @param {string} directoryPath Ścieżka do katalogu
 */
function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true })
    console.log(`Utworzono katalog tymczasowy: ${directoryPath}`)
  }
}

module.exports = {
  isAdministrator,
  warnUser,
  notifyAdmins,
  ensureDirectoryExists,
}
