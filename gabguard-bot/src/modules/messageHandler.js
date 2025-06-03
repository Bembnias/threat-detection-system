const { analyzeTextApi, analyzeFileApi } = require('./apiService')
const { notifyAdmins, warnUser } = require('./utils')
const { handleAdminCommand } = require('./adminCommands')

async function handleTextMessage(message, config) {
  const userId = message.author.id
  try {
    const apiResponseData = await analyzeTextApi(message.content, userId, config.API_BASE_URL)
    const analyzedUserId = String(apiResponseData.user_id || userId)
    const analyzedText = String(apiResponseData.text || message.content)
    const toxicityScore = Number(apiResponseData.toxicity_score)

    console.log(`🔍 Wynik analizy tekstu (ID: ${analyzedUserId}): toxicity_score = ${toxicityScore}`)

    if (isNaN(toxicityScore)) {
      console.error(`🚫 Otrzymano nieprawidłową wartość toxicity_score: ${apiResponseData.toxicity_score}`)
      return
    }

    if (toxicityScore === -1) {
      console.error(`🚫 Błąd analizy tekstu przez API dla użytkownika ${analyzedUserId}.`)
    } else if (toxicityScore >= config.TOXICITY_THRESHOLD_DELETE) {
      console.warn(`🗑️ Wysoka toksyczność (${toxicityScore})! Usuwanie wiadomości od ${message.author.tag}.`)
      if (message.deletable) await message.delete().catch((err) => console.error('Błąd usuwania wiadomości:', err))
      try {
        await message.author.send(
          `Twoja wiadomość na serwerze "${
            message.guild.name
          }" została usunięta z powodu wysokiego wskaźnika toksyczności (${toxicityScore.toFixed(
            2
          )}).\nTreść: "${analyzedText}"`
        )
      } catch (dmError) {
        console.warn(`Nie udało się wysłać DM do ${message.author.tag}: ${dmError.message}`)
      }
      await notifyAdmins(
        `🗑️ Usunięto wiadomość od użytkownika @${
          message.author.tag
        } (ID: ${userId}) z powodu wysokiej toksyczności (${toxicityScore.toFixed(2)}).\nTreść: "${analyzedText.slice(
          0,
          100
        )}"\nKanał: #${message.channel.name}`,
        config
      )
      await warnUser(
        session.userId,
        `Twoja wiadomość "${analyzedText.slice(
          0,
          100
        )}" została oznaczona jako toksyczna i usunięta (${toxicityScore.toFixed(
          2
        )}). Prosimy o zachowanie kultury wypowiedzi.`
      )
    } else if (toxicityScore >= config.TOXICITY_THRESHOLD_WARN) {
      console.info(`⚠️ Wiadomość od ${message.author.tag} oznaczona jako potencjalnie toksyczna (${toxicityScore}).`)
      await message.reply(
        `⚠️ Twoja wiadomość może zawierać nieodpowiednie treści (wskaźnik toksyczności: ${toxicityScore.toFixed(
          2
        )}). Prosimy o zachowanie kultury wypowiedzi.`
      )
      await notifyAdmins(
        `⚠️ Wiadomość od ${
          message.author.tag
        } (ID: ${userId}) oznaczona jako potencjalnie toksyczna (${toxicityScore.toFixed(
          2
        )}).\nTreść: "${analyzedText}"\nKanał: #${message.channel.name}`,
        config
      )
    }
  } catch (error) {
    console.error(`💥 Błąd podczas analizy tekstu dla użytkownika ${userId}:`, error.message)
    if (error.response) console.error('Odpowiedź API (text):', error.response.status, error.response.data)
  }
}

async function handleFileAttachment(attachment, message, config) {
  const userId = message.author.id
  try {
    const fileApiResponseData = await analyzeFileApi(attachment, userId, config.API_BASE_URL, config.TEMP_FILE_DIR)
    const fileAnalyzedUserId = String(fileApiResponseData.user_id || userId)
    const toxicityScore = Number(fileApiResponseData.toxicity_score)
    const description = fileApiResponseData.description ? String(fileApiResponseData.description) : null

    console.log(
      `📊 Wynik analizy pliku ${attachment.name} (ID: ${fileAnalyzedUserId}): toxicity_score = ${toxicityScore}`
    )
    if (description) console.log(`📄 Opis: ${description}`)

    if (isNaN(toxicityScore)) {
      console.error(
        `🚫 Otrzymano nieprawidłową wartość toxicity_score dla pliku: ${fileApiResponseData.toxicity_score}`
      )
      return
    }

    const contentIdentifier = description || `plik "${attachment.name}"`

    if (toxicityScore === -1) {
      console.error(`🚫 Błąd analizy pliku przez API dla użytkownika ${fileAnalyzedUserId}.`)
    } else if (toxicityScore >= config.TOXICITY_THRESHOLD_DELETE) {
      console.warn(
        `🗑️ Wysoka toksyczność (${toxicityScore}) w pliku! Usuwanie wiadomości z załącznikiem od ${message.author.tag}.`
      )
      if (message.deletable)
        await message.delete().catch((err) => console.error('Błąd usuwania wiadomości z plikiem:', err))
      try {
        await message.author.send(
          `Twoja wiadomość z plikiem "${attachment.name}" na serwerze "${
            message.guild.name
          }" została usunięta z powodu wysokiego wskaźnika toksyczności zawartości (${toxicityScore.toFixed(2)}).`
        )
      } catch (dmError) {
        console.warn(`Nie udało się wysłać DM do ${message.author.tag} o usunięciu pliku: ${dmError.message}`)
      }
      await notifyAdmins(
        `🗑️ Usunięto wiadomość z plikiem od ${
          message.author.tag
        } (ID: ${userId}) z powodu wysokiej toksyczności (${toxicityScore.toFixed(2)}).\nPlik: ${
          attachment.name
        }\nZidentyfikowana treść: "${contentIdentifier}"\nKanał: #${message.channel.name}`,
        config
      )
      await warnUser(
        session.userId,
        `Twoja wiadomość "${attachment.name}" została oznaczona jako toksyczna i usunięta (${toxicityScore.toFixed(
          2
        )}). Prosimy o zachowanie kultury wypowiedzi.`
      )
    } else if (toxicityScore >= config.TOXICITY_THRESHOLD_WARN) {
      console.info(
        `⚠️ Plik ${attachment.name} od ${message.author.tag} oznaczony jako potencjalnie toksyczny (${toxicityScore}).`
      )
      await message.reply(
        `⚠️ Twój plik "${
          attachment.name
        }" może zawierać nieodpowiednie treści (wskaźnik toksyczności: ${toxicityScore.toFixed(2)}).`
      )
      await notifyAdmins(
        `⚠️ Plik od ${
          message.author.tag
        } (ID: ${userId}) oznaczony jako potencjalnie toksyczny (${toxicityScore.toFixed(2)}).\nPlik: ${
          attachment.name
        }\nZidentyfikowana treść: "${contentIdentifier}"\nKanał: #${message.channel.name}`,
        config
      )
    }
  } catch (error) {
    console.error(`💥 Błąd podczas przetwarzania pliku ${attachment.name} od użytkownika ${userId}:`, error.message)
    if (error.response) console.error('Odpowiedź API (file):', error.response.status, error.response.data)
  }
}

async function onMessageCreate(message, config) {
  if (message.author.bot) return

  const isAdminCommandHandled = await handleAdminCommand(message, config)
  if (isAdminCommandHandled) {
    return
  }

  console.log(
    `💬 Otrzymano wiadomość od ${message.author.tag} (ID: ${message.author.id}) w kanale ${message.channel.name} na serwerze ${message.guild.name}`
  )

  // Analiza tekstu wiadomości
  if (message.content) {
    await handleTextMessage(message, config)
  }

  // Analiza załączników (plików)
  if (message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      await handleFileAttachment(attachment, message, config)
    }
  }
}

module.exports = {
  onMessageCreate,
}
