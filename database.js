const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'chat.db');
const db = new Database(dbPath);

// Включаем WAL режим для лучшей производительности
db.pragma('journal_mode = WAL');

// Создаём все таблицы
function initDatabase() {
  // Таблица пользователей
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      ip_address TEXT,
      mac_address TEXT,
      network TEXT,
      provider TEXT,
      switch TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Таблица банов
  db.exec(`
    CREATE TABLE IF NOT EXISTS bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ban_type TEXT NOT NULL,
      ban_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      banned_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (banned_by) REFERENCES users(id)
    )
  `);

  // Таблица сообщений
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      bot_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Таблица правил
  db.exec(`
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица обучения ботов
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_training (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_name TEXT NOT NULL,
      trigger_text TEXT NOT NULL,
      response TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица статистики
  db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      total_users INTEGER DEFAULT 0,
      total_messages INTEGER DEFAULT 0,
      total_bans INTEGER DEFAULT 0
    )
  `);

  // Добавляем правила по умолчанию
  const existingRules = db.prepare('SELECT COUNT(*) as count FROM rules').get();
  if (existingRules.count === 0) {
    const defaultRules = [
      ['Уважение', 'Уважайте других пользователей и не допускайте оскорблений'],
      ['Без спама', 'Не спамьте и не отправляйте повторяющиеся сообщения'],
      ['Без рекламы', 'Запрещена реклама сторонних ресурсов и сервисов'],
      ['Без угроз', 'Запрещены угрозы, шантаж и запугивание'],
      ['Конфиденциальность', 'Не разглашайте личные данные других пользователей'],
      ['Соблюдайте законы', 'Не нарушайте законодательство вашей страны']
    ];

    const insertRule = db.prepare('INSERT INTO rules (title, description) VALUES (?, ?)');
    defaultRules.forEach(rule => {
      insertRule.run(rule[0], rule[1]);
    });
  }

  // Добавляем обучение ботов по умолчанию
  const existingTraining = db.prepare('SELECT COUNT(*) as count FROM bot_training').get();
  if (existingTraining.count === 0) {
    const defaultTraining = [
      ['assistant', 'привет', 'Привет! Чем могу помочь?', 'general'],
      ['assistant', 'как дела', 'У меня всё отлично, спасибо! А у вас?', 'general'],
      ['assistant', 'что ты умеешь', 'Я могу общаться, помогать с вопросами и поддерживать беседу!', 'general'],
      ['assistant', 'пока', 'До свидания! Возвращайтесь ещё!', 'general'],
      ['assistant', 'спасибо', 'Пожалуйста! Рад был помочь!', 'general'],
      ['assistant', 'кто ты', 'Я умный бот-ассистент, созданный для помощи и общения', 'general'],
      ['moderator', 'привет', 'Здравствуйте! Я модератор чата, готов помочь', 'general'],
      ['moderator', 'какие правила', 'Правила чата: уважение, без спама, без рекламы, без угроз, конфиденциальность, соблюдение законов', 'general'],
      ['moderator', 'ты кто', 'Я модератор этого чата, слежу за порядком и помогаю пользователям', 'general'],
      ['moderator', 'что ты делаешь', 'Я контролирую порядок в чате и помогаю соблюдать правила', 'general'],
      ['support', 'привет', 'Добрый день! Я бот поддержки, задайте ваш вопрос', 'general'],
      ['support', 'помощь', 'Конечно! Опишите вашу проблему, и я постараюсь помочь', 'general'],
      ['support', 'проблема', 'Опишите проблему подробнее, и я найду решение', 'general'],
      ['support', 'не работает', 'Давайте разберёмся. Что именно не работает и когда началось?', 'general']
    ];

    const insertTraining = db.prepare('INSERT INTO bot_training (bot_name, trigger_text, response, category) VALUES (?, ?, ?, ?)');
    defaultTraining.forEach(training => {
      insertTraining.run(training[0], training[1], training[2], training[3]);
    });
  }

  console.log('✅ База данных инициализирована');
}

initDatabase();

module.exports = db;
