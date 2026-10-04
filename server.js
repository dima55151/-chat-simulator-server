const express = require('express');
const cors = require('cors');
const { run, get, all } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================== Проверка банов =====================

async function checkBan(ip, mac, network, provider, switchInfo, router, username) {
  const bans = [];
  
  if (ip) {
    const ban = await get('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1', ['ip', ip]);
    if (ban) bans.push(ban);
  }
  if (mac) {
    const ban = await get('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1', ['mac', mac]);
    if (ban) bans.push(ban);
  }
  if (network) {
    const ban = await get('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1', ['network', network]);
    if (ban) bans.push(ban);
  }
  if (provider) {
    const ban = await get('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1', ['provider', provider]);
    if (ban) bans.push(ban);
  }
  if (switchInfo) {
    const ban = await get('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1', ['switch', switchInfo]);
    if (ban) bans.push(ban);
  }
  if (router) {
    const ban = await get('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1', ['router', router]);
    if (ban) bans.push(ban);
  }
  
  const userBan = await get('SELECT * FROM bans WHERE ban_type = ? AND ban_value = ? AND is_active = 1', ['username', username]);
  if (userBan) bans.push(userBan);
  
  return bans;
}

// ===================== Регистрация =====================

app.post('/api/register', async (req, res) => {
  const { username, password, ip, mac, network, provider, switchInfo, router } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, message: 'Введите имя пользователя и пароль' });
  }
  
  if (password.length < 4) {
    return res.json({ success: false, message: 'Пароль должен быть минимум 4 символа' });
  }
  
  try {
    const bans = await checkBan(ip, mac, network, provider, switchInfo, router, username);
    if (bans.length > 0) {
      return res.json({ success: false, message: 'Вы забанены! Причина: ' + bans[0].reason });
    }
    
    await run('INSERT INTO users (username, password, ip_address, mac_address, network, provider, router) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, password, ip, mac, network, provider, router || '']);
    
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

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, message: 'Введите имя пользователя и пароль' });
  }
  
  const user = await get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  
  if (!user) {
    return res.json({ success: false, message: 'Неверное имя пользователя или пароль' });
  }
  
  await run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  
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

app.get('/api/users', async (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const user = await get('SELECT * FROM users WHERE username = ?', [session.username]);
  if (!user || user.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const users = await all('SELECT id, username, role, created_at, last_login FROM users ORDER BY created_at DESC');
  res.json({ success: true, users });
});

// ===================== Бан пользователя =====================

app.post('/api/ban', async (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const admin = await get('SELECT * FROM users WHERE username = ?', [session.username]);
  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const { target_username, ban_type, ban_value, reason, duration } = req.body;
  
  if (!target_username || !ban_type || !reason) {
    return res.json({ success: false, message: 'Заполните все поля' });
  }
  
  try {
    const expires_at = duration && duration !== 'never' ? new Date(Date.now() + duration * 60000).toISOString() : null;
    await run('INSERT INTO bans (username, ban_type, ban_value, reason, banned_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [target_username, ban_type, ban_value, reason, admin.id, expires_at]);
    
    res.json({ success: true, message: 'Пользователь забанен' });
  } catch (err) {
    res.json({ success: false, message: 'Ошибка бана' });
  }
});

// ===================== Разбан =====================

app.post('/api/unban', async (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const admin = await get('SELECT * FROM users WHERE username = ?', [session.username]);
  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const { ban_id } = req.body;
  await run('UPDATE bans SET is_active = 0 WHERE id = ?', [ban_id]);
  res.json({ success: true, message: 'Бан снят' });
});

// ===================== Получение банов =====================

app.get('/api/bans', async (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const user = await get('SELECT * FROM users WHERE username = ?', [session.username]);
  if (!user || user.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const bans = await all(`
    SELECT b.*, u.username as banned_by_name 
    FROM bans b 
    LEFT JOIN users u ON b.banned_by = u.id 
    ORDER BY b.created_at DESC
  `);
  
  res.json({ success: true, bans });
});

// ===================== Отправка сообщения =====================

app.post('/api/message', async (req, res) => {
  const { username, message, bot_name } = req.body;
  
  if (!username || !message) {
    return res.json({ success: false, message: 'Заполните все поля' });
  }
  
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.json({ success: false, message: 'Пользователь не найден' });
  }
  
  const bans = await checkBan(user.ip_address, user.mac_address, user.network, user.provider, user.switch, user.router, username);
  if (bans.length > 0) {
    return res.json({ success: false, message: 'Вы забанены! Причина: ' + bans[0].reason });
  }
  
  try {
    await run('INSERT INTO messages (user_id, username, message, bot_name) VALUES (?, ?, ?, ?)',
      [user.id, username, message, bot_name || null]);
    
    res.json({ success: true, message: 'Сообщение отправлено' });
  } catch (err) {
    res.json({ success: false, message: 'Ошибка отправки' });
  }
});

// ===================== Ответы ботов =====================

app.get('/api/bots/responses', async (req, res) => {
  const { bot_name, message } = req.query;
  
  if (!bot_name || !message) {
    return res.json({ success: false, message: 'Укажите имя бота и сообщение' });
  }
  
  const messages = message.toLowerCase().split(/\s+/);
  const training = await all('SELECT * FROM bot_training WHERE bot_name = ?', [bot_name]);
  
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

app.get('/api/rules', async (req, res) => {
  const rules = await all('SELECT * FROM rules ORDER BY id');
  res.json({ success: true, rules });
});

// ===================== Статистика =====================

app.get('/api/stats', async (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const user = await get('SELECT * FROM users WHERE username = ?', [session.username]);
  if (!user) {
    return res.json({ success: false });
  }
  
  const totalUsers = (await get('SELECT COUNT(*) as count FROM users')).count;
  const totalMessages = (await get('SELECT COUNT(*) as count FROM messages')).count;
  const totalBans = (await get('SELECT COUNT(*) as count FROM bans WHERE is_active = 1')).count;
  
  res.json({
    success: true,
    stats: {
      totalUsers,
      totalMessages,
      totalBans,
      onlineUsers: totalUsers
    }
  });
});

// ===================== Обучение ботов =====================

app.post('/api/bot/training', async (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const admin = await get('SELECT * FROM users WHERE username = ?', [session.username]);
  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const { bot_name, trigger_text, response, category } = req.body;
  
  try {
    await run('INSERT INTO bot_training (bot_name, trigger_text, response, category) VALUES (?, ?, ?, ?)',
      [bot_name, trigger_text, response, category || 'general']);
    res.json({ success: true, message: 'Бот обучен!' });
  } catch (err) {
    res.json({ success: false, message: 'Ошибка обучения' });
  }
});

app.get('/api/bot/training', async (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const user = await get('SELECT * FROM users WHERE username = ?', [session.username]);
  if (!user || user.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const training = await all('SELECT * FROM bot_training ORDER BY bot_name, id');
  res.json({ success: true, training });
});

// ===================== Обновление роли =====================

app.post('/api/user/update-role', async (req, res) => {
  const session = req.headers['x-session'];
  if (!session) return res.json({ success: false });
  
  const admin = await get('SELECT * FROM users WHERE username = ?', [session.username]);
  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Нет доступа' });
  }
  
  const { username, role } = req.body;
  await run('UPDATE users SET role = ? WHERE username = ?', [role, username]);
  res.json({ success: true, message: 'Роль обновлена' });
});

// ===================== Запуск =====================

app.listen(PORT, () => {
  console.log('✅ Сервер запущен на порту ' + PORT);
});
