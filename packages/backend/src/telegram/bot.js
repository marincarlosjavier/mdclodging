import { Telegraf, Markup } from 'telegraf';
import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';

let bot = null;
let lastError = null; // Store last error for status reporting
const userSessions = new Map(); // Store user sessions { telegramId: {state, data} }

/**
 * Get bot instance for specific tenant (multi-tenant support)
 */
export function getBotInstance(tenantId) {
  // For now, we use a single bot instance
  // In production, you might want multiple bots per tenant
  return bot;
}

/**
 * Check if bot is currently running
 */
export function isBotRunning() {
  return bot !== null;
}

/**
 * Get last error message
 */
export function getLastError() {
  return lastError;
}

/**
 * Clear last error
 */
export function clearLastError() {
  lastError = null;
}

/**
 * Start Telegram bot
 */
export async function startTelegramBot() {
  // Check if bot is already running
  if (bot) {
    console.log('⚠️  Telegram bot is already running');
    return bot;
  }

  // Get bot token from first active tenant (or default)
  const tokenResult = await pool.query(
    `SELECT t.id,
            ss_token.setting_value as token,
            ss_username.setting_value as username
     FROM tenants t
     JOIN system_settings ss_token ON ss_token.tenant_id = t.id AND ss_token.setting_key = 'telegram_bot_token'
     JOIN system_settings ss_enabled ON ss_enabled.tenant_id = t.id AND ss_enabled.setting_key = 'telegram_bot_enabled'
     LEFT JOIN system_settings ss_username ON ss_username.tenant_id = t.id AND ss_username.setting_key = 'telegram_bot_username'
     WHERE ss_enabled.setting_value = 'true' AND ss_token.setting_value != ''
     LIMIT 1`
  );

  if (tokenResult.rows.length === 0) {
    throw new Error('No Telegram bot configured. Please configure bot token in settings.');
  }

  const token = tokenResult.rows[0].token;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  bot = new Telegraf(token);

  // Middleware to get user context
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      ctx.telegramId = ctx.from.id;

      // Get or create telegram_contact
      const contact = await getOrCreateContact(ctx.from);
      ctx.contact = contact;

      // Get user session
      ctx.session = userSessions.get(ctx.telegramId.toString()) || {};

      // Check if user is linked and active (except for /start command)
      if (ctx.updateType !== 'callback_query' && ctx.message?.text !== '/start') {
        if (contact.user_id && !contact.is_active) {
          return ctx.reply(
            '⛔ *Acceso Desactivado*\n\n' +
            'Tu acceso al bot ha sido desactivado.\n\n' +
            'Por favor contacta a tu supervisor si crees que esto es un error.',
            { parse_mode: 'Markdown' }
          );
        }
      }
    }

    await next();
  });

  // Commands
  bot.command('start', handleStart);
  bot.command('tasks', handleMyTasks);
  bot.command('help', handleHelp);
  bot.command('logout', handleLogout);
  bot.command('cancel', handleCancel);

  // Text handlers (link codes, PIN, notes, etc.)
  bot.on('text', handleText);

  // Callback query handlers (inline buttons)
  bot.action(/.*/, handleCallback);

  // Photo handlers
  bot.on('photo', handlePhoto);

  // Error handling
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ Ocurrió un error. Por favor intenta nuevamente o contacta al administrador.');
  });

  // Launch bot
  try {
    await bot.launch();
    console.log('✅ Telegram bot started successfully');

    // Log bot info
    const botInfo = await bot.telegram.getMe();
    console.log(`   Bot username: @${botInfo.username}`);
    console.log(`   Bot ID: ${botInfo.id}`);

    // Clear any previous errors
    lastError = null;
  } catch (error) {
    console.error('❌ Failed to launch bot:', error.message);

    // Store error for status reporting
    if (error.response && error.response.description) {
      lastError = `${error.response.error_code}: ${error.response.description}`;
    } else {
      lastError = error.message;
    }

    bot = null;
    throw error;
  }

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}

/**
 * Stop Telegram bot
 */
export function stopTelegramBot() {
  if (bot) {
    bot.stop();
    bot = null;
    console.log('✅ Telegram bot stopped');
  }
}

/**
 * Get or create Telegram contact
 */
async function getOrCreateContact(from) {
  const { rows } = await pool.query(
    'SELECT * FROM telegram_contacts WHERE telegram_id = $1',
    [from.id]
  );

  if (rows.length > 0) {
    // Update interaction stats
    await pool.query(
      `UPDATE telegram_contacts SET
        last_interaction_at = NOW(),
        total_messages = total_messages + 1,
        username = $2,
        first_name = $3,
        last_name = $4
       WHERE telegram_id = $1`,
      [from.id, from.username, from.first_name, from.last_name]
    );
    return rows[0];
  }

  // Create new contact
  const result = await pool.query(
    `INSERT INTO telegram_contacts (telegram_id, username, first_name, last_name, language_code)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [from.id, from.username, from.first_name, from.last_name, from.language_code]
  );

  return result.rows[0];
}

/**
 * /start command
 */
async function handleStart(ctx) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    // Not linked yet
    return ctx.reply(
      '👋 ¡Bienvenido al Sistema de Gestión Hotelera!\n\n' +
      'Para comenzar, solicita un *código de vinculación* a tu supervisor y envíalo aquí.\n\n' +
      '📝 Ejemplo: `ABC12XYZ`\n\n' +
      'Si ya tienes un código, envíalo ahora.',
      { parse_mode: 'Markdown' }
    );
  }

  // Check if PIN is set
  if (!contact.login_pin) {
    // Linked but no PIN
    userSessions.set(ctx.telegramId.toString(), { state: 'setting_pin', userId: contact.user_id });

    return ctx.reply(
      '🔐 Para continuar, configura tu PIN de acceso.\n\n' +
      'Envía un PIN de *4 dígitos* (solo números):\n\n' +
      '📝 Ejemplo: `1234`',
      { parse_mode: 'Markdown' }
    );
  }

  // Check if contact is active
  if (!contact.is_active) {
    return ctx.reply(
      '⛔ *Acceso Desactivado*\n\n' +
      'Tu acceso al bot ha sido desactivado.\n\n' +
      'Por favor contacta a tu supervisor si crees que esto es un error.',
      { parse_mode: 'Markdown' }
    );
  }

  // Linked, has PIN, and is active - show main menu
  await showMainMenu(ctx, contact);
}

/**
 * Handle text messages
 */
async function handleText(ctx) {
  const text = ctx.message.text;
  const session = ctx.session;

  // State: awaiting link code
  if (!ctx.contact.user_id || session.state === 'awaiting_link_code') {
    return handleLinkCode(ctx, text);
  }

  // State: setting PIN
  if (session.state === 'setting_pin') {
    return handlePinSetup(ctx, text);
  }

  // State: awaiting PIN for login
  if (session.state === 'awaiting_pin') {
    return handlePinLogin(ctx, text);
  }

  // State: awaiting task notes
  if (session.state === 'awaiting_task_notes') {
    return handleTaskNotes(ctx, text);
  }

  // Default
  ctx.reply(
    '❓ No entiendo ese mensaje.\n\n' +
    'Usa /help para ver los comandos disponibles o /tasks para ver tus tareas.'
  );
}

/**
 * Handle link code submission
 */
async function handleLinkCode(ctx, code) {
  const cleanCode = code.trim().toUpperCase();

  // Find valid link code
  const { rows } = await pool.query(
    `SELECT lc.*, u.full_name, u.role, u.tenant_id
     FROM telegram_link_codes lc
     JOIN users u ON u.id = lc.user_id
     WHERE lc.code = $1
       AND lc.used = false
       AND lc.expires_at > NOW()`,
    [cleanCode]
  );

  if (rows.length === 0) {
    return ctx.reply(
      '❌ Código inválido o expirado.\n\n' +
      'Verifica el código e intenta nuevamente, o solicita uno nuevo a tu supervisor.'
    );
  }

  const linkData = rows[0];

  // Link contact to user
  await pool.query(
    `UPDATE telegram_contacts SET
      user_id = $1,
      tenant_id = $2,
      linked_at = NOW(),
      updated_at = NOW()
     WHERE telegram_id = $3`,
    [linkData.user_id, linkData.tenant_id, ctx.telegramId]
  );

  // Mark code as used
  await pool.query(
    `UPDATE telegram_link_codes SET
      used = true,
      used_at = NOW(),
      used_by_telegram_id = $2
     WHERE code = $1`,
    [cleanCode, ctx.telegramId]
  );

  // Set session for PIN setup
  userSessions.set(ctx.telegramId.toString(), {
    state: 'setting_pin',
    userId: linkData.user_id,
    tenantId: linkData.tenant_id
  });

  await ctx.reply(
    `✅ *¡Cuenta vinculada exitosamente!*\n\n` +
    `👤 ${linkData.full_name}\n` +
    `🏷️ Rol: ${getRoleDisplayName(linkData.role)}\n\n` +
    `🔐 Ahora configura tu PIN de acceso.\n\n` +
    `Envía un PIN de *4 dígitos* (solo números):`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle PIN setup
 */
async function handlePinSetup(ctx, pin) {
  const session = ctx.session;

  if (!/^\d{4}$/.test(pin)) {
    return ctx.reply(
      '❌ El PIN debe ser de *4 dígitos numéricos*.\n\n' +
      '📝 Ejemplo: `1234`\n\n' +
      'Intenta nuevamente:',
      { parse_mode: 'Markdown' }
    );
  }

  // Hash PIN
  const hashedPin = await bcrypt.hash(pin, 10);

  // Save PIN
  await pool.query(
    `UPDATE telegram_contacts SET
      login_pin = $1,
      updated_at = NOW()
     WHERE telegram_id = $2`,
    [hashedPin, ctx.telegramId]
  );

  // Clear session
  userSessions.delete(ctx.telegramId.toString());

  await ctx.reply(
    '✅ *PIN configurado correctamente*\n\n' +
    'Ya puedes usar el sistema.\n\n' +
    'Usa /tasks para ver tus tareas.',
    { parse_mode: 'Markdown' }
  );

  // Refresh contact
  const { rows } = await pool.query(
    'SELECT * FROM telegram_contacts WHERE telegram_id = $1',
    [ctx.telegramId]
  );

  await showMainMenu(ctx, rows[0]);
}

/**
 * Show main menu
 */
async function showMainMenu(ctx, contact) {
  const { rows } = await pool.query(
    `SELECT u.role, u.full_name FROM users u
     WHERE u.id = $1`,
    [contact.user_id]
  );

  if (rows.length === 0) {
    return ctx.reply('❌ Error: Usuario no encontrado. Contacta al administrador.');
  }

  const user = rows[0];

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📋 Mis Tareas', 'my_tasks')],
    [Markup.button.callback('✅ Tareas Pendientes', 'pending_tasks')],
    [Markup.button.callback('📊 Mi Resumen', 'my_summary')],
    [Markup.button.callback('❓ Ayuda', 'help')],
  ]);

  await ctx.reply(
    `🏨 *Sistema de Gestión Hotelera*\n\n` +
    `Bienvenido, *${user.full_name}*!\n` +
    `Rol: ${getRoleDisplayName(user.role)}\n\n` +
    `Selecciona una opción:`,
    { parse_mode: 'Markdown', ...keyboard }
  );
}

/**
 * Handle callback queries (inline buttons)
 */
async function handleCallback(ctx) {
  const action = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  if (action === 'my_tasks') {
    await showMyTasks(ctx);
  } else if (action === 'pending_tasks') {
    await showPendingTasks(ctx);
  } else if (action === 'my_summary') {
    await showMySummary(ctx);
  } else if (action === 'help') {
    await handleHelpCallback(ctx);
  } else if (action === 'main_menu') {
    await showMainMenu(ctx, ctx.contact);
  } else if (action.startsWith('task_')) {
    const taskId = action.split('_')[1];
    await showTaskDetail(ctx, taskId);
  } else if (action.startsWith('claim_')) {
    const taskId = action.split('_')[1];
    await claimTask(ctx, taskId);
  } else if (action.startsWith('start_')) {
    const taskId = action.split('_')[1];
    await startTask(ctx, taskId);
  } else if (action.startsWith('complete_')) {
    const taskId = action.split('_')[1];
    await completeTask(ctx, taskId);
  }
}

/**
 * Show user's tasks
 */
async function showMyTasks(ctx) {
  const { rows } = await pool.query(
    `SELECT t.* FROM tasks t
     WHERE t.tenant_id = $1
       AND t.assigned_to = $2
       AND t.status IN ('pending', 'in_progress')
     ORDER BY
       CASE t.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       t.due_date ASC NULLS LAST`,
    [ctx.contact.tenant_id, ctx.contact.user_id]
  );

  if (rows.length === 0) {
    return ctx.editMessageText(
      '✅ *No tienes tareas asignadas*\n\n' +
      'Usa /tasks para actualizar.',
      { parse_mode: 'Markdown' }
    );
  }

  const buttons = rows.map(task => {
    const priorityEmoji = getPriorityEmoji(task.priority);
    const statusEmoji = getStatusEmoji(task.status);
    return [Markup.button.callback(
      `${priorityEmoji}${statusEmoji} ${task.location} - ${task.title}`,
      `task_${task.id}`
    )];
  });

  buttons.push([Markup.button.callback('🔙 Volver', 'main_menu')]);

  await ctx.editMessageText(
    `📋 *Mis Tareas* (${rows.length})\n\nSelecciona una tarea:`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
  );
}

/**
 * Show pending tasks (available to claim)
 */
async function showPendingTasks(ctx) {
  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [ctx.contact.user_id]
  );

  const userRole = userRows[0].role;
  const taskType = userRole === 'housekeeping' ? 'cleaning' : userRole === 'maintenance' ? 'maintenance' : null;

  let query = `
    SELECT t.* FROM tasks t
    WHERE t.tenant_id = $1
      AND t.status = 'pending'
      AND t.assigned_to IS NULL
  `;

  const params = [ctx.contact.tenant_id];

  if (taskType) {
    query += ` AND t.task_type = $2`;
    params.push(taskType);
  }

  query += ` ORDER BY
    CASE t.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    t.due_date ASC NULLS LAST
    LIMIT 10`;

  const { rows } = await pool.query(query, params);

  if (rows.length === 0) {
    return ctx.editMessageText(
      '✅ *No hay tareas pendientes*\n\n' +
      'Todas las tareas están asignadas.',
      { parse_mode: 'Markdown' }
    );
  }

  const buttons = rows.map(task => {
    const priorityEmoji = getPriorityEmoji(task.priority);
    return [Markup.button.callback(
      `${priorityEmoji} ${task.location} - ${task.title}`,
      `task_${task.id}`
    )];
  });

  buttons.push([Markup.button.callback('🔙 Volver', 'main_menu')]);

  await ctx.editMessageText(
    `✅ *Tareas Pendientes* (${rows.length})\n\nSelecciona para ver detalles:`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
  );
}

/**
 * Show task detail
 */
async function showTaskDetail(ctx, taskId) {
  const { rows } = await pool.query(
    `SELECT t.*,
            u_assigned.full_name as assigned_to_name,
            u_created.full_name as created_by_name
     FROM tasks t
     LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN users u_created ON u_created.id = t.created_by
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [taskId, ctx.contact.tenant_id]
  );

  if (rows.length === 0) {
    return ctx.editMessageText('❌ Tarea no encontrada.');
  }

  const task = rows[0];
  const priorityEmoji = getPriorityEmoji(task.priority);
  const statusEmoji = getStatusEmoji(task.status);

  let message = `${priorityEmoji} *${task.title}*\n\n`;
  message += `📍 *Ubicación:* ${task.location}`;
  if (task.room_number) message += ` - Hab. ${task.room_number}`;
  message += `\n`;
  message += `📊 *Estado:* ${statusEmoji} ${getStatusDisplayName(task.status)}\n`;
  message += `🔴 *Prioridad:* ${getPriorityDisplayName(task.priority)}\n`;
  message += `🏷️ *Tipo:* ${getTaskTypeDisplayName(task.task_type)}\n`;

  if (task.description) message += `\n📝 ${task.description}\n`;
  if (task.notes) message += `\n💬 *Notas:* ${task.notes}\n`;
  if (task.due_date) message += `\n⏰ *Vence:* ${formatDate(task.due_date)}\n`;
  if (task.assigned_to_name) message += `\n👤 *Asignado a:* ${task.assigned_to_name}\n`;

  const buttons = [];

  // Action buttons based on status and assignment
  if (task.status === 'pending' && !task.assigned_to) {
    buttons.push([Markup.button.callback('✋ Tomar Tarea', `claim_${task.id}`)]);
  } else if (task.assigned_to === ctx.contact.user_id) {
    if (task.status === 'pending') {
      buttons.push([Markup.button.callback('▶️ Iniciar', `start_${task.id}`)]);
    } else if (task.status === 'in_progress') {
      buttons.push([Markup.button.callback('✅ Completar', `complete_${task.id}`)]);
    }
  }

  buttons.push([Markup.button.callback('🔙 Volver', 'my_tasks')]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

/**
 * Claim task
 */
async function claimTask(ctx, taskId) {
  const result = await pool.query(
    `UPDATE tasks SET
      assigned_to = $1,
      updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND assigned_to IS NULL
     RETURNING *`,
    [ctx.contact.user_id, taskId, ctx.contact.tenant_id]
  );

  if (result.rows.length === 0) {
    await ctx.answerCbQuery('❌ Esta tarea ya fue asignada a otro usuario.');
    return;
  }

  await ctx.answerCbQuery('✅ Tarea asignada correctamente');
  await showTaskDetail(ctx, taskId);
}

/**
 * Start task
 */
async function startTask(ctx, taskId) {
  const result = await pool.query(
    `UPDATE tasks SET
      status = 'in_progress',
      started_at = NOW(),
      updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND assigned_to = $3
     RETURNING *`,
    [taskId, ctx.contact.tenant_id, ctx.contact.user_id]
  );

  if (result.rows.length === 0) {
    await ctx.answerCbQuery('❌ No puedes iniciar esta tarea.');
    return;
  }

  await ctx.answerCbQuery('✅ Tarea iniciada');
  await showTaskDetail(ctx, taskId);
}

/**
 * Complete task
 */
async function completeTask(ctx, taskId) {
  const result = await pool.query(
    `UPDATE tasks SET
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND assigned_to = $3
     RETURNING *`,
    [taskId, ctx.contact.tenant_id, ctx.contact.user_id]
  );

  if (result.rows.length === 0) {
    await ctx.answerCbQuery('❌ No puedes completar esta tarea.');
    return;
  }

  await ctx.answerCbQuery('✅ Tarea completada!');
  await ctx.editMessageText(
    `✅ *Tarea Completada*\n\n` +
    `${result.rows[0].title}\n` +
    `📍 ${result.rows[0].location}\n\n` +
    `¡Buen trabajo! 👏`,
    { parse_mode: 'Markdown' }
  );
}

// Helper functions
function getPriorityEmoji(priority) {
  const emojis = { low: '🟢', medium: '🟡', high: '🔴', urgent: '🔴🔴' };
  return emojis[priority] || '⚪';
}

function getStatusEmoji(status) {
  const emojis = { pending: '⏳', in_progress: '⚙️', completed: '✅', cancelled: '❌' };
  return emojis[status] || '❓';
}

function getRoleDisplayName(role) {
  const names = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    housekeeping: 'Housekeeping',
    maintenance: 'Mantenimiento'
  };
  return names[role] || role;
}

function getStatusDisplayName(status) {
  const names = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    completed: 'Completada',
    cancelled: 'Cancelada'
  };
  return names[status] || status;
}

function getPriorityDisplayName(priority) {
  const names = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
  return names[priority] || priority;
}

function getTaskTypeDisplayName(type) {
  const names = {
    cleaning: 'Limpieza',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    other: 'Otro'
  };
  return names[type] || type;
}

function formatDate(date) {
  return new Date(date).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
}

async function handleMyTasks(ctx) {
  await ctx.reply('📋 Cargando tus tareas...');
  await showMyTasks(ctx);
}

async function handleHelp(ctx) {
  ctx.reply(
    `❓ *Ayuda - Sistema de Gestión Hotelera*\n\n` +
    `*Comandos disponibles:*\n` +
    `/start - Ver menú principal\n` +
    `/tasks - Ver mis tareas\n` +
    `/help - Mostrar esta ayuda\n` +
    `/logout - Cerrar sesión\n\n` +
    `*Uso básico:*\n` +
    `1. Solicita un código de vinculación a tu supervisor\n` +
    `2. Envía el código al bot\n` +
    `3. Configura tu PIN de 4 dígitos\n` +
    `4. ¡Listo! Usa /tasks para ver tus tareas\n\n` +
    `¿Problemas? Contacta a tu supervisor.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleHelpCallback(ctx) {
  await handleHelp(ctx);
}

async function handleLogout(ctx) {
  userSessions.delete(ctx.telegramId.toString());
  ctx.reply('👋 Sesión cerrada. Usa /start para iniciar nuevamente.');
}

async function handleCancel(ctx) {
  userSessions.delete(ctx.telegramId.toString());
  ctx.reply('❌ Operación cancelada.');
}

async function handlePhoto(ctx) {
  ctx.reply('📸 Función de fotos en desarrollo...');
}

async function showMySummary(ctx) {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
     FROM tasks
     WHERE tenant_id = $1 AND assigned_to = $2`,
    [ctx.contact.tenant_id, ctx.contact.user_id]
  );

  const stats = rows[0];

  ctx.editMessageText(
    `📊 *Mi Resumen*\n\n` +
    `✅ Completadas: ${stats.completed}\n` +
    `⚙️ En Progreso: ${stats.in_progress}\n` +
    `⏳ Pendientes: ${stats.pending}\n\n` +
    `Total: ${parseInt(stats.completed) + parseInt(stats.in_progress) + parseInt(stats.pending)}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Volver', 'main_menu')]])
    }
  );
}

async function handleTaskNotes(ctx, text) {
  // Implementation for adding notes to tasks
  ctx.reply('💬 Notas guardadas.');
  userSessions.delete(ctx.telegramId.toString());
}

async function handlePinLogin(ctx, pin) {
  // Implementation for PIN login
  const contact = ctx.contact;

  if (!contact.login_pin) {
    return ctx.reply('❌ No tienes un PIN configurado.');
  }

  const validPin = await bcrypt.compare(pin, contact.login_pin);

  if (!validPin) {
    return ctx.reply('❌ PIN incorrecto. Intenta nuevamente.');
  }

  userSessions.delete(ctx.telegramId.toString());
  ctx.reply('✅ Acceso concedido.');
  await showMainMenu(ctx, contact);
}

/**
 * Send notification to housekeeping staff when checkout is reported
 */
export async function notifyCheckout(tenantId, reservationData) {
  if (!bot) {
    console.warn('⚠️ Telegram bot not running, cannot send checkout notification');
    return;
  }

  try {
    // Get all housekeeping staff telegram IDs for this tenant
    const result = await pool.query(
      `SELECT DISTINCT tc.telegram_id
       FROM telegram_contacts tc
       JOIN users u ON u.id = tc.user_id
       WHERE u.tenant_id = $1
         AND u.role IN ('cleaner', 'supervisor', 'admin')
         AND tc.is_linked = true`,
      [tenantId]
    );

    const { property_name, actual_checkout_time, adults, children, infants } = reservationData;
    const totalGuests = adults + children + infants;
    const timeStr = new Date(actual_checkout_time).toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit'
    });

    const message =
      `🚪 *Checkout Reportado*\n\n` +
      `🏨 Propiedad: ${property_name}\n` +
      `⏰ Hora: ${timeStr}\n` +
      `👥 Huéspedes: ${totalGuests}\n\n` +
      `📋 Se ha creado una tarea de limpieza pendiente.`;

    // Send notification to all housekeeping staff
    for (const row of result.rows) {
      try {
        await bot.telegram.sendMessage(row.telegram_id, message, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error(`Failed to send notification to ${row.telegram_id}:`, err.message);
      }
    }

    console.log(`✅ Checkout notification sent to ${result.rows.length} staff members`);
  } catch (error) {
    console.error('Error sending checkout notification:', error);
  }
}
