const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Таблица пользователей
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      ip_address TEXT,
      mac_address TEXT,
      hwid TEXT,
      network TEXT,
      provider TEXT,
      olt TEXT,
      ont TEXT,
      switch TEXT,
      router TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Миграция для старых таблиц
  db.run(`ALTER TABLE users ADD COLUMN hwid TEXT`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN olt TEXT`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN ont TEXT`, (err) => {});

  // Таблица банов
  db.run(`
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

  // Таблица мут
  db.run(`
    CREATE TABLE IF NOT EXISTS mutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      reason TEXT NOT NULL,
      muted_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (muted_by) REFERENCES users(id)
    )
  `);

  // Таблица кик
  db.run(`
    CREATE TABLE IF NOT EXISTS kicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      reason TEXT NOT NULL,
      kicked_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (kicked_by) REFERENCES users(id)
    )
  `);

  // Таблица сообщений
  db.run(`
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
  db.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица обучения ботов
  db.run(`
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
  db.run(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      total_users INTEGER DEFAULT 0,
      total_messages INTEGER DEFAULT 0,
      total_bans INTEGER DEFAULT 0
    )
  `);

  // Добавляем правила по умолчанию
  db.get('SELECT COUNT(*) as count FROM rules', (err, row) => {
    if (err) return console.error(err);
    if (row.count === 0) {
      const rules = [
        ['Уважение', 'Уважайте других пользователей и не допускайте оскорблений'],
        ['Без спама', 'Не спамьте и не отправляйте повторяющиеся сообщения'],
        ['Без рекламы', 'Запрещена реклама сторонних ресурсов и сервисов'],
        ['Без угроз', 'Запрещены угрозы, шантаж и запугивание'],
        ['Конфиденциальность', 'Не разглашайте личные данные других пользователей'],
        ['Соблюдайте законы', 'Не нарушайте законодательство вашей страны']
      ];
      const stmt = db.prepare('INSERT INTO rules (title, description) VALUES (?, ?)');
      rules.forEach(r => stmt.run(r[0], r[1]));
      stmt.finalize();
    }
  });

  // Добавляем обучение ботов по умолчанию
  db.get('SELECT COUNT(*) as count FROM bot_training', (err, row) => {
    if (err) return console.error(err);
    if (row.count === 0) {
      const training = [
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
      const stmt = db.prepare('INSERT INTO bot_training (bot_name, trigger_text, response, category) VALUES (?, ?, ?, ?)');
      training.forEach(t => stmt.run(t[0], t[1], t[2], t[3]));
      stmt.finalize();
    }
  });

  console.log('✅ База данных инициализирована');
});

// Обёртки для async запросов
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { run, get, all };
