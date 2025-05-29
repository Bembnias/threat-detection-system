require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const path = require('path')

const BOT_TOKEN = process.env.BOT_TOKEN || 'DOMYSLNY_TOKEN_BOTA_DISCORD_JEŚLI_BRAK_W_ENV'
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000'
const TEMP_FILE_DIR = path.join(__dirname, '..', 'temp_files')

const ADMIN_USER_IDS_STRING = process.env.ADMIN_USER_IDS || ''
const ADMIN_USER_IDS = ADMIN_USER_IDS_STRING ? ADMIN_USER_IDS_STRING.split(',').map((id) => id.trim()) : []

const TOXICITY_THRESHOLD_WARN = parseFloat(process.env.TOXICITY_THRESHOLD_WARN) || 0.3
const TOXICITY_THRESHOLD_DELETE = parseFloat(process.env.TOXICITY_THRESHOLD_DELETE) || 0.7
const ADMIN_NOTIFICATION_CHANNEL_ID = process.env.ADMIN_NOTIFICATION_CHANNEL_ID || ''

const COMMAND_PREFIX = process.env.COMMAND_PREFIX || '!'

if (!BOT_TOKEN || BOT_TOKEN === 'DOMYSLNY_TOKEN_BOTA_DISCORD_JEŚLI_BRAK_W_ENV') {
  console.warn(
    '⚠️ OSTRZEŻENIE: Zmienna BOT_TOKEN nie jest ustawiona w pliku .env lub jest wartością domyślną. Bot może nie działać poprawnie.'
  )
}
if (!API_BASE_URL || (API_BASE_URL === 'http://localhost:8000' && process.env.API_BASE_URL === undefined)) {
  console.warn(
    "⚠️ OSTRZEŻENIE: Zmienna API_BASE_URL używa wartości domyślnej 'http://localhost:8000'. Upewnij się, że to poprawny adres Twojego API."
  )
}

module.exports = {
  BOT_TOKEN,
  API_BASE_URL,
  TEMP_FILE_DIR,
  ADMIN_USER_IDS,
  TOXICITY_THRESHOLD_WARN,
  TOXICITY_THRESHOLD_DELETE,
  ADMIN_NOTIFICATION_CHANNEL_ID,
  COMMAND_PREFIX,
}
