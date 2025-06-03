const client = require('./src/discordClient')
const config = require('./src/config')
const { onMessageCreate } = require('./src/modules/messageHandler')
const { ensureDirectoryExists, isAdministrator } = require('./src/modules/utils')
const { joinChannelCmd, leaveChannelCmd } = require('./src/modules/voiceHandler')
const { PermissionsBitField } = require('discord.js')

ensureDirectoryExists(config.TEMP_FILE_DIR)

client.once('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} (v. modular) jest gotowy!`)
  console.log(`Prefix komend: ${config.COMMAND_PREFIX}`)
  console.log(
    `Próg ostrzeżenia: ${config.TOXICITY_THRESHOLD_WARN}, Próg usunięcia: ${config.TOXICITY_THRESHOLD_DELETE}`
  )
  if (config.ADMIN_NOTIFICATION_CHANNEL_ID && config.ADMIN_NOTIFICATION_CHANNEL_ID !== 'ID_KANAŁU_DLA_ADMINÓW') {
    console.log(`Kanał powiadomień adminów: ${config.ADMIN_NOTIFICATION_CHANNEL_ID}`)
  } else {
    console.log('Kanał powiadomień adminów nie jest skonfigurowany lub używa ID domyślnego.')
  }
  console.log('Administratorzy User IDs:', config.ADMIN_USER_IDS)
  client.user.setPresence({
    activities: [{ name: `Discord`, type: 'PLAYING' }],
    status: 'online',
  })
})

client.on('messageCreate', async (message) => {
  if (message.content.startsWith(config.COMMAND_PREFIX)) {
    const args = message.content.slice(config.COMMAND_PREFIX.length).trim().split(/ +/)
    const command = args.shift().toLowerCase()

    if (command === 'joinvoice') {
      if (
        !isAdministrator(message.member, config) &&
        !message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)
      )
        return message.reply('Brak uprawnień.')
      await joinChannelCmd(message)
      return
    } else if (command === 'leavevoice') {
      if (
        !isAdministrator(message.member, config) &&
        !message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)
      )
        return message.reply('Brak uprawnień.')
      await leaveChannelCmd(message)
      return
    }
  }

  try {
    await onMessageCreate(message, config)
  } catch (error) {
    console.error('Nieoczekiwany błąd w głównym handlerze messageCreate:', error)
  }
})

client.on('error', (error) => {
  console.error('🔥 Wystąpił błąd klienta Discord:', error)
})

if (!config.BOT_TOKEN || config.BOT_TOKEN === 'TWÓJ_TOKEN_BOTA_DISCORD') {
  console.error('❌ BŁĄD KRYTYCZNY: Token bota nie jest skonfigurowany w src/config.js lub zmiennych środowiskowych!')
  process.exit(1)
}

client.login(config.BOT_TOKEN).catch((error) => {
  console.log(config.BOT_TOKEN)
  console.error('❌ Nie udało się zalogować bota. Sprawdź token i połączenie internetowe.', error)
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  console.error('🚫 Nieobsłużony błąd Promise:', error)
})
process.on('uncaughtException', (error) => {
  console.error('💥 Nieprzechwycony wyjątek:', error)
})

console.log('🚀 Uruchamianie bota...')
