const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')
const https = require('https')
const { user } = require('../discordClient')

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

/**
 * Analizuje dostarczony tekst.
 * @param {string} text Tekst do analizy.
 * @param {string} baseUrl Bazowy URL API.
 * @returns {Promise<object>} Dane odpowiedzi z API.
 */
async function analyzeTextApi(text, userId, baseUrl) {
  console.log(`📝 API: Analizowanie tekstu: "${text}"`)
  const response = await axios.post(
    `${baseUrl}/analyze_text`,
    {
      text: text,
      user_id: userId,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      httpsAgent:
        baseUrl.startsWith('https://127.0.0.1') || baseUrl.startsWith('https://server') ? httpsAgent : undefined,
    }
  )
  return response.data
}

/**
 * Analizuje plik (audio lub inny).
 * @param {import('discord.js').Attachment} attachment Załącznik Discord.
 * @param {string} userId ID użytkownika Discord.
 * @param {string} baseUrl Bazowy URL API.
 * @param {string} tempDir Katalog na pliki tymczasowe.
 * @returns {Promise<object>} Dane odpowiedzi z API.
 */
async function analyzeFileApi(attachment, userId, baseUrl, tempDir) {
  console.log(`📎 API: Przetwarzanie załącznika: ${attachment.name}`)
  const tempFilePath = path.join(tempDir, `${Date.now()}_${attachment.name}`)

  try {
    const fileResponse = await axios.get(attachment.url, { responseType: 'arraybuffer' })
    const fileBuffer = Buffer.from(fileResponse.data)
    fs.writeFileSync(tempFilePath, fileBuffer)

    const fileExtension = path.extname(attachment.name).toLowerCase()
    let apiEndpoint = `${baseUrl}/analyze-file/`
    let formData = new FormData()
    formData.append('file', fs.createReadStream(tempFilePath), attachment.name)

    if (['.mp3', '.wav', '.ogg', '.m4a'].includes(fileExtension)) {
      apiEndpoint = `${baseUrl}/analyze_audio`
      apiEndpoint += `?user_id=${encodeURIComponent(userId)}`
    } else {
      apiEndpoint += `?user_id=${encodeURIComponent(userId)}`
    }

    console.log(`📤 API: Wysyłanie pliku ${attachment.name} do ${apiEndpoint}`)
    const apiFileResponse = await axios.post(apiEndpoint, formData, {
      headers: { ...formData.getHeaders() },
      httpsAgent:
        baseUrl.startsWith('https://127.0.0.1') || baseUrl.startsWith('https://server') ? httpsAgent : undefined,
    })
    return apiFileResponse.data
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
    }
  }
}

/**
 * Analizuje dane audio poprzez bezpośrednie wysłanie do API.
 * @param {Buffer} audioBuffer Bufor zawierający dane audio (WAV).
 * @param {string} userId ID użytkownika, do którego należy nagranie.
 * @param {string} baseUrl Bazowy URL API.
 * @returns {Promise<object>} Dane odpowiedzi z API.
 */
async function analyzeVoiceAudioApi(audioBuffer, userId, baseUrl, filename, contentType) {
  const formData = new FormData()
  formData.append('file', audioBuffer, {
    filename: filename,
    contentType: contentType,
  })

  const endpoint = `${baseUrl}/analyze_audio?user_id=${encodeURIComponent(userId)}`
  console.log(
    `🎤 API: Analizowanie nagrania głosowego użytkownika ${userId} (${audioBuffer.length} bajtów) jako ${filename} do ${endpoint}`
  )

  try {
    const response = await axios.post(endpoint, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      httpsAgent:
        baseUrl.startsWith('https://127.0.0.1') ||
        baseUrl.startsWith('https://localhost') ||
        baseUrl.startsWith('https://server')
          ? httpsAgent
          : undefined,
    })
    return response.data
  } catch (error) {
    console.error(`💥 Błąd API podczas analizy audio dla użytkownika ${userId}:`, error.message)
    if (error.response) {
      console.error('Odpowiedź API (audio error):', error.response.status, error.response.data)
    }
    throw error // Rzuć błąd dalej, aby voiceHandler mógł go złapać
  }
}

/**
 * Pobiera raport naruszeń użytkownika.
 * @param {string} targetUserId ID użytkownika, dla którego generowany jest raport.
 * @param {string} baseUrl Bazowy URL API.
 * @param {string} adminId ID Administratora który wywołał komendę.
 * @returns {Promise<import('axios').AxiosResponse<ArrayBuffer>>} Odpowiedź Axios z danymi PDF.
 */
async function fetchUserReportApi(targetUserId, baseUrl, adminId) {
  console.log(`🛡️ API: Żądanie raportu dla użytkownika ${targetUserId}`)
  return axios.get(`${baseUrl}/users/${targetUserId}/violations/recent?user_id_admin=${adminId}`, {
    responseType: 'arraybuffer',
    httpsAgent:
      baseUrl.startsWith('https://127.0.0.1') || baseUrl.startsWith('https://server') ? httpsAgent : undefined,
  })
}

/**
 * Aktualizuje wartość progu toksyczności na serwerze.
 * @param {number} scoreValue Nowa wartość progu toksyczności (0.0-1.0).
 * @param {string} baseUrl Bazowy URL API.
 * @returns {Promise<object>} Dane odpowiedzi z API.
 */
async function updateToxicityScoreApi(scoreValue, baseUrl) {
  console.log(`⚙️ API: Aktualizacja progu toksyczności na: ${scoreValue}`)
  const response = await axios.put(
    `${baseUrl}/toxicity/${scoreValue}`,
    {},
    {
      httpsAgent:
        baseUrl.startsWith('https://127.0.0.1') || baseUrl.startsWith('https://server') ? httpsAgent : undefined,
    }
  )
  return response.data
}

module.exports = {
  analyzeTextApi,
  analyzeFileApi,
  analyzeVoiceAudioApi,
  fetchUserReportApi,
  updateToxicityScoreApi,
}
