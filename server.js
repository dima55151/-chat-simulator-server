const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================== Баны =====================

function checkBan(ip, mac, network, provider, switchInfo, username) {
  const bans = [];
  
  if (ip) {
    const ban = db.prepare('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1').get('ip', ip);
    if (ban) bans.push(ban);
  }
  if (mac) {
    const ban = db.prepare('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1').get('mac', mac);
    if (ban) bans.push(ban);
  }
  if (network) {
    const ban = db.prepare('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1').get('network', network);
    if (ban) bans.push(ban);
  }
  if (provider) {
    const ban = db.prepare('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1').get('provider', provider);
    if (ban) bans.push(ban);
  }
  if (switchInfo) {
    const ban = db.prepare('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1').get('switch', switchInfo);
    if (ban) bans.push(ban);
  }
  
  const userBan = db.prepare('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1').get('username', username);
  if (userBan) bans.push(userBan);
  
  return bans;
}

// ===================== Регистрация =====================

app.post('/api/register', (req, res) => {
  const { username, password, ip, mac, network, provider, switchInfo } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, message: 'Введите имя пользователя и пароль' });
  }
  
  if (password.length < 4) {
    return res.json({ success: false, message: 'Пароль должен быть минимум 4 символа' });
  }
  
  try {
    const bans = checkBan(ip, mac, network, provider, switchInfo, username);
    if (bans.length > 0) {
      return res.json({ success: false, message: 'Вы забанены! Причина: ' + bans[0].reason });
    }
    
    db.prepare('INSERT INTO users (username, password, ip_address, mac_address, network, provider) VALUES (?, ?, ?, ?, ?, ?)')
      .run(username, password, ip, mac, network, provider);
    
    res.json({ success: true, message: 'Регистрация успешна!' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.json({ success: false, message: 'Пользователь с таким именем уже существует' });
    } else {
      res.json({ success: false, message: 'Ошибка регистрации' });
    }
  }
});

// ===================== Авторизация =====================

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, message: 'Введите имя пользователя и пароль' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  
  if (!user) {
    return res.json({ success: false, message: 'Неверное имя пользователя или пароль' });
  }
  
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

// ===================== Получение пользователей =====================

app.get('/api/users', (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(session.username);
  if (!user || user.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const users = db.prepare('SELECT id, username, role, created_at, last_login FROM users ORDER BY created_at DESC').all();
  res.json({ success: true, users });
});

// ===================== Бан пользователя =====================

app.post('/api/ban', (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get(session.username);
  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const { target_username, ban_type, ban_value, reason, duration } = req.body;
  
  if (!target_username || !ban_type || !reason) {
    return res.json({ success: false, message: 'Заполните все поля' });
  }
  
  try {
    const expires_at = duration && duration !== 'never' ? new Date(Date.now() + duration * 60000).toISOString() : null;
    db.prepare('INSERT INTO bans (username, ban_type, ban_value, reason, banned_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(target_username, ban_type, ban_value, reason, admin.id, expires_at);
    
    res.json({ success: true, message: 'Пользователь забанен' });
  } catch (err) {
    res.json({ success: false, message: 'Ошибка бана' });
  }
});

// ===================== Разбан =====================

app.post('/api/unban', (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get(session.username);
  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const { ban_id } = req.body;
  db.prepare('UPDATE bans SET is_active = 0 WHERE id = ?').run(ban_id);
  res.json({ success: true, message: 'Бан снят' });
});

// ===================== Получение банов =====================

app.get('/api/bans', (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(session.username);
  if (!user || user.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const bans = db.prepare(`
    SELECT b.*, u.username as banned_by_name 
    FROM bans b 
    LEFT JOIN users u ON b.banned_by = u.id 
    ORDER BY b.created_at DESC
  `).all();
  
  res.json({ success: true, bans });
});

// ===================== Отправка сообщения =====================

app.post('/api/message', (req, res) => {
  const { username, message, bot_name } = req.body;
  
  if (!username || !message) {
    return res.json({ success: false, message: 'Заполните все поля' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.json({ success: false, message: 'Пользователь не найден' });
  }
  
  const bans = checkBan(user.ip_address, user.mac_address, user.network, user.provider, user.switch, username);
  if (bans.length > 0) {
    return res.json({ success: false, message: 'Вы забанены! Причина: ' + bans[0].reason });
  }
  
  try {
    db.prepare('INSERT INTO messages (user_id, username, message, bot_name) VALUES (?, ?, ?, ?)')
      .run(user.id, username, message, bot_name || null);
    
    res.json({ success: true, message: 'Сообщение отправлено' });
  } catch (err) {
    res.json({ success: false, message: 'Ошибка отправки' });
  }
});

// ===================== Ответы ботов =====================

app.get('/api/bots/responses', (req, res) => {
  const { bot_name, message } = req.query;
  
  if (!bot_name || !message) {
    return res.json({ success: false, message: 'Укажите имя бота и сообщение' });
  }
  
  const messages = message.toLowerCase().split(/\s+/);
  const training = db.prepare('SELECT * FROM bot_training WHERE bot_name = ?').all(bot_name);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const row of training) {
    const trigger = row.trigger_text.toLowerCase().split(/\s+/);
    let score = 0;
    
    for (const word of trigger) {
      if (messages.includes(word)) {
        score += word.length === trigger.length ? 3 : 1;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = row;
    }
  }
  
  if (bestMatch && bestScore > 0) {
    res.json({ success: true, response: bestMatch.response });
  } else {
    const defaultResponses = {
      assistant: ['Я пока не знаю, как на это ответить. Попробуйте обучить меня!', 'Хм, интересный вопрос. Дайте подумать...', 'Я учусь у модераторов, пока не знаю ответа на это'],
      moderator: ['Я модератор, но пока не знаю ответа. Напишите администрации.', 'Это вопрос к администрации чата.', 'Я пока не обучен отвечать на такие вопросы.'],
      support: ['Я бот поддержки, но пока не знаю решения. Опишите проблему детальнее.', 'Попробуйте обратиться к модератору.', 'Я учусь помогать, но пока не справился с этим.']
    };
    
    const responses = defaultResponses[bot_name] || ['Я пока не знаю, как ответить на это.'];
    res.json({ success: true, response: responses[Math.floor(Math.random() * responses.length)] });
  }
});

// ===================== Получение правил =====================

app.get('/api/rules', (req, res) => {
  const rules = db.prepare('SELECT * FROM rules ORDER BY id').all();
  res.json({ success: true, rules });
});

// ===================== Статистика =====================

app.get('/api/stats', (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(session.username);
  if (!user) {
    return res.json({ success: false });
  }
  
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
  const totalBans = db.prepare('SELECT COUNT(*) as count FROM bans WHERE is_active = 1').get().count;
  
  res.json({
    success: true,
    stats: {
      totalUsers,
      totalMessages,
      totalBans,
      onlineUsers: totalUsers // упрощённо
    }
  });
});

// ===================== Обучение ботов =====================

app.post('/api/bot/training', (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get(session.username);
  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const { bot_name, trigger_text, response, category } = req.body;
  
  try {
    db.prepare('INSERT INTO bot_training (bot_name, trigger_text, response, category) VALUES (?, ?, ?, ?)')
      .run(bot_name, trigger_text, response, category || 'general');
    res.json({ success: true, message: 'Бот обучен!' });
  } catch (err) {
    res.json({ success: false, message: 'Ошибка обучения' });
  }
});

app.get('/api/bot/training', (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(session.username);
  if (!user || user.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const training = db.prepare('SELECT * FROM bot_training ORDER BY bot_name, id').all();
  res.json({ success: true, training });
});

// ===================== Обновление роли =====================

app.post('/api/user/update-role', (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get(session.username);
  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const { username, role } = req.body;
  db.prepare('UPDATE users SET role = ? WHERE username = ?').run(role, username);
  res.json({ success: true, message: 'Роль обновлена' });
});

// ===================== Запуск =====================

app.listen(PORT, () => {
  console.log('✅ Сервер запущен на порту ' + PORT);
});
