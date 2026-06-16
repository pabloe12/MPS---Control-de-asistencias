const TelegramBot = require('node-telegram-bot-api');

// El token se lee de las variables de entorno
const token = process.env.TELEGRAM_BOT_TOKEN;

// Inicializar el bot (solo si hay token)
const bot = token ? new TelegramBot(token, { polling: false }) : null;

/**
 * Envía un mensaje de alerta a un chat_id específico
 */
const sendAlert = async (chatId, message) => {
  if (!bot || !chatId) return;
  try {
    // parse_mode: 'Markdown' permite usar negritas y emojis
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error enviando mensaje de Telegram:', error.message);
  }
};

module.exports = { sendAlert };