const { AttachmentBuilder } = require('discord.js')
const { fetchUserReportApi, updateToxicityScoreApi } = require('./apiService')
const { isAdministrator } = require('./utils')

async function handleAdminCommand(message, config) {
  if (!message.content.startsWith(config.COMMAND_PREFIX) || !isAdministrator(message.member, config)) {
    return false
  }

  const [command, ...args] = message.content.slice(config.COMMAND_PREFIX.length).trim().split(/\s+/)

  if (command.toLowerCase() === 'checkuser') {
    const targetUserId = args[0]
    if (!targetUserId) {
      message.reply(
        `Podaj ID użytkownika, dla którego chcesz wygenerować raport. Przykład: \`${config.COMMAND_PREFIX}checkuser 123456789012345678\``
      )
      return true
    }

    const adminUserId = message.author.id
    try {
      await message.channel.sendTyping()
      message.reply(`Generuję raport naruszeń dla użytkownika \`${targetUserId}\` z ostatnich dni...`)

      const response = await fetchUserReportApi(targetUserId, config.API_BASE_URL, adminUserId)

      if (response.status === 200 && response.headers['content-type'] === 'application/pdf') {
        const pdfBuffer = Buffer.from(response.data)
        const attachment = new AttachmentBuilder(pdfBuffer, { name: `raport_naruszen_${targetUserId}.pdf` })
        await message.reply({
          content: `Oto raport naruszeń dla użytkownika \`${targetUserId}\`:`,
          files: [attachment],
        })
      } else {
        message.reply(
          `Nie udało się pobrać raportu. API zwróciło status ${response.status} lub niepoprawny typ zawartości.`
        )
        console.error('Błąd pobierania raportu PDF:', response.status, response.headers['content-type'])
      }
    } catch (error) {
      console.error(`💥 Błąd podczas pobierania raportu PDF dla użytkownika ${targetUserId}:`, error.message)
      message.reply(`Wystąpił błąd podczas próby pobrania raportu dla użytkownika \`${targetUserId}\`.`)
      if (error.response) {
        console.error(
          'Odpowiedź API (raport):',
          error.response.status,
          error.response.data ? error.response.data.toString() : 'Brak danych'
        )
      }
    }
    return true
  }

  if (command.toLowerCase() === 'settoxicity') {
    const scoreValue = parseFloat(args[0])

    if (isNaN(scoreValue) || scoreValue < 0 || scoreValue > 1) {
      message.reply(
        `Podaj prawidłową wartość progu toksyczności (liczba od 0 do 1). Przykład: \`${config.COMMAND_PREFIX}settoxicity 0.7\``
      )
      return true
    }

    try {
      await message.channel.sendTyping()

      const response = await updateToxicityScoreApi(scoreValue, config.API_BASE_URL)

      const formattedScore = parseFloat(response.toxicity_score).toFixed(2)
      await message.reply(
        `✅ Próg toksyczności został zaktualizowany na: **${formattedScore}**\n` +
          `Wiadomości z wynikiem powyżej ${formattedScore} będą teraz raportowane.`
      )

      console.log(
        `🔄 Admin ${message.author.tag} (${message.author.id}) zmienił próg toksyczności na ${formattedScore}`
      )
    } catch (error) {
      console.error(`💥 Błąd podczas aktualizacji progu toksyczności:`, error.message)
      message.reply(`Wystąpił błąd podczas próby aktualizacji progu toksyczności.`)
      if (error.response) {
        console.error(
          'Odpowiedź API:',
          error.response.status,
          error.response.data ? JSON.stringify(error.response.data) : 'Brak danych'
        )
      }
    }
    return true
  }

  return false
}

module.exports = {
  handleAdminCommand,
}
