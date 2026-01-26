import { Telegraf, Markup } from 'telegraf';
import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';
import {
  showCleaningTasks,
  handleTakeTask,
  handleStartTask,
  handleCompleteTask,
  showSettlementStatus,
  handleReportSettlement
} from './cleaning-handlers.js';
import {
  showAdminMenu,
  showPendingSettlements,
  showSettlementForReview,
  approveSettlement,
  startRejectSettlement,
  handleRejectReason,
  showApprovedSettlements,
  startPaymentFlow,
  registerPayment,
  showRatesManagement,
  showPropertiesForCheckout,
  reportCheckout,
  showHousekeepingStaff,
  assignTaskToStaff
} from './admin-handlers.js';
import {
  showHousekeepingMenu,
  showTasksPending,
  showMyActiveTasks,
  showDailySummary,
  showTasksTomorrow,
  showHousekeepingHelp,
  navigateTask
} from './housekeeping-menu.js';
import {
  takeTask,
  startTask as hkStartTask,
  completeTask as hkCompleteTask,
  showSuppliesMenu,
  requestSupply,
  startDamageReport,
  finishDamageReport,
  cancelDamageReport,
  handleDamageReportMedia
} from './housekeeping-actions.js';

let bot = null;
let lastError = null; // Store last error for status reporting
export const userSessions = new Map(); // Store user sessions { telegramId: {state, data} }

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

      // For callback queries, just continue
      if (ctx.updateType === 'callback_query') {
        return await next();
      }

      // Check if user is active
      if (contact.user_id && !contact.is_active) {
        return ctx.reply(
          '⛔ *Acceso Desactivado*\n\n' +
          'Tu acceso al bot ha sido desactivado.\n\n' +
          'Por favor contacta a tu supervisor si crees que esto es un error.',
          { parse_mode: 'Markdown' }
        );
      }

      // Check session timeout (if user is linked and logged in)
      if (contact.user_id && contact.is_logged_in && contact.last_login_at) {
        const sessionTimeout = await checkSessionTimeout(contact);
        if (sessionTimeout.expired) {
          // Logout user
          await pool.query(
            'UPDATE telegram_contacts SET is_logged_in = false WHERE telegram_id = $1',
            [ctx.telegramId]
          );

          // Clear session
          userSessions.delete(ctx.telegramId.toString());

          return ctx.reply(
            '⏰ *Sesión Expirada*\n\n' +
            `Tu sesión ha expirado por inactividad (${sessionTimeout.timeoutHours} horas).`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([[Markup.button.callback('🔑 Entrar', 'login')]])
            }
          );
        }
      }

      // Auto-prompt for login if user is linked but not logged in
      if (contact.user_id && !contact.is_logged_in && !ctx.session.state) {
        return ctx.reply(
          '👋 *Bienvenido*\n\n' +
          'Para acceder al sistema, presiona el botón de abajo.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔑 Entrar', 'login')]])
          }
        );
      }

      // If not linked, prompt to link
      if (!contact.user_id && !ctx.session.state) {
        return ctx.reply(
          '👋 *Bienvenido*\n\n' +
          'Para comenzar, presiona el botón de abajo.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔑 Entrar', 'login')]])
          }
        );
      }
    }

    await next();
  });

  // Commands
  bot.command('start', handleStart);
  bot.command('tasks', handleMyTasks);
  bot.command('tareas', showCleaningTasks);  // Cleaning tasks
  bot.command('liquidacion', showSettlementStatus);  // Settlement status
  bot.command('admin', showAdminMenu);  // Admin menu
  bot.command('help', handleHelp);
  bot.command('logout', handleLogoutCommand);
  bot.command('cancel', handleCancel);

  // Text handlers (link codes, PIN, notes, etc.)
  bot.on('text', handleText);

  // Callback query handlers (inline buttons)
  bot.action(/.*/, handleCallback);

  // Photo handlers
  bot.on('photo', handlePhoto);

  // Voice/audio handlers
  bot.on('voice', handleVoice);
  bot.on('audio', handleAudio);

  // Error handling
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ Ocurrió un error. Por favor intenta nuevamente o contacta al administrador.');
  });

  // Launch bot
  try {
    // Get bot info before launching (to validate token)
    const botInfo = await bot.telegram.getMe();
    console.log(`   Bot username: @${botInfo.username}`);

    // Launch bot in background (don't await - it runs indefinitely)
    bot.launch().catch((error) => {
      console.error('❌ Bot launch error:', error.message);
      if (error.response && error.response.description) {
        lastError = `${error.response.error_code}: ${error.response.description}`;
      } else {
        lastError = error.message;
      }
      bot = null;
    });

    // Clear any previous errors
    lastError = null;
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error.message);

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
 * Check if session has expired
 */
async function checkSessionTimeout(contact) {
  try {
    // Get tenant's session timeout setting
    const tenantResult = await pool.query(
      'SELECT telegram_session_timeout_hours FROM tenants WHERE id = $1',
      [contact.tenant_id]
    );

    const timeoutHours = tenantResult.rows[0]?.telegram_session_timeout_hours || 8;

    if (!contact.last_login_at) {
      return { expired: true, timeoutHours };
    }

    const lastLogin = new Date(contact.last_login_at);
    const now = new Date();
    const hoursSinceLogin = (now - lastLogin) / (1000 * 60 * 60);

    return {
      expired: hoursSinceLogin >= timeoutHours,
      timeoutHours,
      hoursSinceLogin
    };
  } catch (error) {
    console.error('Error checking session timeout:', error);
    return { expired: false, timeoutHours: 8 };
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

  // If user is logged in, show main menu
  if (contact.user_id && contact.is_logged_in) {
    return await showMainMenu(ctx, contact);
  }

  // Otherwise, show login button
  return ctx.reply(
    '👋 *Bienvenido*\n\n' +
    'Para comenzar, presiona el botón de abajo.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔑 Entrar', 'login')]])
    }
  );
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

  // State: awaiting rejection reason (admin rejecting settlement)
  if (session.rejectingSettlement) {
    return handleRejectReason(ctx, text, session.rejectingSettlement);
  }

  // State: reporting damage
  if (session.state === 'reporting_damage') {
    return handleDamageReportMedia(ctx, 'text', text);
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

  // Save PIN and mark as logged in
  await pool.query(
    `UPDATE telegram_contacts SET
      login_pin = $1,
      is_logged_in = true,
      last_login_at = NOW(),
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

  // Get telegram permissions for this contact
  const { rows: permRows } = await pool.query(
    `SELECT tpc.code
     FROM telegram_contact_permissions tcp
     JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
     WHERE tcp.contact_id = $1 AND tpc.is_active = true`,
    [contact.id]
  );

  const permissions = permRows.map(p => p.code);

  // If user has only one permission, go directly to that module
  if (permissions.length === 1) {
    if (permissions[0] === 'housekeeping') {
      return await showHousekeepingMenu(ctx);
    }
    // Add other modules here (admin, mantenimiento, etc.)
  }

  // If user has multiple permissions, show module selector
  if (permissions.length > 1) {
    return await showModuleSelector(ctx, permissions);
  }

  // No permissions - show error
  return ctx.reply(
    '⛔ *Sin Permisos*\n\n' +
    'No tienes permisos asignados en el sistema.\n\n' +
    'Por favor contacta a tu supervisor.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Show module selector for users with multiple permissions
 */
async function showModuleSelector(ctx, permissions) {
  const buttons = [];

  if (permissions.includes('housekeeping')) {
    buttons.push([Markup.button.callback('🧹 Housekeeping', 'module_housekeeping')]);
  }
  if (permissions.includes('admin')) {
    buttons.push([Markup.button.callback('👨‍💼 Administración', 'module_admin')]);
  }
  if (permissions.includes('mantenimiento')) {
    buttons.push([Markup.button.callback('🔧 Mantenimiento', 'module_mantenimiento')]);
  }
  if (permissions.includes('concesion')) {
    buttons.push([Markup.button.callback('🛎️ Concesión', 'module_concesion')]);
  }

  buttons.push([Markup.button.callback('🚪 Salir', 'logout')]);

  const keyboard = Markup.inlineKeyboard(buttons);

  const message =
    `🏨 *Sistema de Gestión Hotelera*\n\n` +
    `Selecciona el módulo al que deseas acceder:`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  } else {
    await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  }
}

/**
 * Handle callback queries (inline buttons)
 */
async function handleCallback(ctx) {
  const action = ctx.callbackQuery.data;

  // Module selection
  if (action === 'module_housekeeping') {
    return await showHousekeepingMenu(ctx);
  } else if (action === 'switch_module') {
    // Get permissions and show selector
    const { rows: permRows } = await pool.query(
      `SELECT tpc.code
       FROM telegram_contact_permissions tcp
       JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
       WHERE tcp.contact_id = $1 AND tpc.is_active = true`,
      [ctx.contact.id]
    );
    const permissions = permRows.map(p => p.code);
    return await showModuleSelector(ctx, permissions);
  }

  // Housekeeping menu callbacks
  if (action === 'hk_menu') {
    return await showHousekeepingMenu(ctx);
  } else if (action === 'hk_tasks_pending') {
    return await showTasksPending(ctx);
  } else if (action === 'hk_my_active_tasks') {
    return await showMyActiveTasks(ctx);
  } else if (action === 'hk_daily_summary') {
    return await showDailySummary(ctx);
  } else if (action === 'hk_settlement') {
    return await showSettlementStatus(ctx);
  } else if (action === 'hk_tasks_tomorrow') {
    return await showTasksTomorrow(ctx);
  } else if (action === 'hk_order_supplies') {
    return await showSuppliesMenu(ctx);
  } else if (action === 'hk_help') {
    return await showHousekeepingHelp(ctx);
  }

  // Housekeeping task actions
  if (action.startsWith('hk_take_')) {
    const taskId = action.split('_')[2];
    return await takeTask(ctx, taskId);
  } else if (action.startsWith('hk_start_')) {
    const taskId = action.split('_')[2];
    return await hkStartTask(ctx, taskId);
  } else if (action.startsWith('hk_complete_')) {
    const taskId = action.split('_')[2];
    return await hkCompleteTask(ctx, taskId);
  } else if (action.startsWith('hk_supply_')) {
    const supplyCode = action.replace('hk_supply_', '');
    return await requestSupply(ctx, supplyCode);
  }

  // Housekeeping task navigation
  if (action.startsWith('hk_task_prev_')) {
    const context = action.replace('hk_task_prev_', '');
    return await navigateTask(ctx, 'prev', context);
  } else if (action.startsWith('hk_task_next_')) {
    const context = action.replace('hk_task_next_', '');
    return await navigateTask(ctx, 'next', context);
  }

  // Housekeeping damage reports
  if (action.startsWith('hk_damage_')) {
    const taskId = action.split('_')[2];
    return await startDamageReport(ctx, taskId);
  } else if (action.startsWith('hk_finish_damage_')) {
    const taskId = action.split('_')[3];
    return await finishDamageReport(ctx, taskId);
  } else if (action === 'hk_cancel_damage') {
    return await cancelDamageReport(ctx);
  }

  // Old cleaning tasks callbacks (don't answer query yet, handlers will do it)
  if (action.startsWith('take_task_')) {
    const taskId = action.split('_')[2];
    return await handleTakeTask(ctx, taskId);
  } else if (action.startsWith('start_task_')) {
    const taskId = action.split('_')[2];
    return await handleStartTask(ctx, taskId);
  } else if (action.startsWith('complete_task_')) {
    const taskId = action.split('_')[2];
    return await handleCompleteTask(ctx, taskId);
  } else if (action === 'report_settlement') {
    return await handleReportSettlement(ctx);
  }

  // Admin callbacks
  if (action === 'admin_menu') {
    return await showAdminMenu(ctx);
  } else if (action === 'admin_settlements_pending') {
    return await showPendingSettlements(ctx);
  } else if (action.startsWith('admin_review_')) {
    const settlementId = action.split('_')[2];
    return await showSettlementForReview(ctx, settlementId);
  } else if (action.startsWith('approve_settlement_')) {
    const settlementId = action.split('_')[2];
    return await approveSettlement(ctx, settlementId);
  } else if (action.startsWith('reject_settlement_')) {
    const settlementId = action.split('_')[2];
    return await startRejectSettlement(ctx, settlementId);
  } else if (action === 'admin_register_payment') {
    return await showApprovedSettlements(ctx);
  } else if (action.startsWith('admin_pay_')) {
    const settlementId = action.split('_')[2];
    return await startPaymentFlow(ctx, settlementId);
  } else if (action.startsWith('pay_method_')) {
    const parts = action.split('_');
    const method = parts[2];
    const settlementId = parts[3];
    return await registerPayment(ctx, settlementId, method);
  } else if (action === 'admin_manage_rates') {
    return await showRatesManagement(ctx);
  } else if (action === 'admin_report_checkout') {
    return await showPropertiesForCheckout(ctx);
  } else if (action.startsWith('checkout_report_')) {
    const reservationId = action.split('_')[2];
    return await reportCheckout(ctx, reservationId);
  } else if (action.startsWith('assign_select_task_')) {
    const taskId = action.split('_')[3];
    return await showHousekeepingStaff(ctx, taskId);
  } else if (action.startsWith('assign_confirm_')) {
    const parts = action.split('_');
    const taskId = parts[2];
    const staffId = parts[3];
    return await assignTaskToStaff(ctx, taskId, staffId);
  }

  await ctx.answerCbQuery();

  if (action === 'login') {
    // Handle login button click
    const contact = ctx.contact;

    // If not linked, prompt for link code
    if (!contact.user_id) {
      ctx.session.state = 'awaiting_link_code';
      userSessions.set(ctx.telegramId.toString(), ctx.session);

      return await ctx.editMessageText(
        '👋 *Bienvenido al Sistema de Gestión Hotelera*\n\n' +
        'Para comenzar, necesitas vincular tu cuenta de Telegram.\n\n' +
        '📝 Solicita un código de vinculación a tu administrador e ingrésalo aquí:',
        { parse_mode: 'Markdown' }
      );
    }

    // If linked but no PIN, set PIN
    if (!contact.login_pin) {
      ctx.session.state = 'setting_pin';
      userSessions.set(ctx.telegramId.toString(), ctx.session);

      return await ctx.editMessageText(
        '🔐 *Configurar PIN*\n\n' +
        'Para acceder al sistema, necesitas configurar un PIN de 4 dígitos.\n\n' +
        '📝 Ingresa tu PIN (4 dígitos numéricos):',
        { parse_mode: 'Markdown' }
      );
    }

    // Prompt for PIN
    ctx.session.state = 'awaiting_pin';
    userSessions.set(ctx.telegramId.toString(), ctx.session);

    return await ctx.editMessageText(
      '🔐 *Inicio de Sesión*\n\n' +
      'Por favor ingresa tu PIN de 4 dígitos:',
      { parse_mode: 'Markdown' }
    );
  } else if (action === 'my_tasks') {
    await showMyTasks(ctx);
  } else if (action === 'pending_tasks') {
    await showPendingTasks(ctx);
  } else if (action === 'cleaning_tasks') {
    await showCleaningTasks(ctx);
  } else if (action === 'assign_tasks') {
    const { showTasksForAssignment } = await import('./admin-handlers.js');
    await showTasksForAssignment(ctx);
  } else if (action === 'my_summary') {
    await showMySummary(ctx);
  } else if (action === 'help') {
    await handleHelpCallback(ctx);
  } else if (action === 'logout') {
    await handleLogoutCallback(ctx);
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
    `/tasks - Ver mis tareas generales\n` +
    `/tareas - Ver tareas de limpieza 🧹\n` +
    `/liquidacion - Ver mi liquidación del día 💰\n` +
    `/help - Mostrar esta ayuda\n` +
    `/logout - Cerrar sesión\n\n` +
    `*Para Housekeeping:*\n` +
    `1. Usa 🧹 Tareas de Limpieza para ver y tomar tareas\n` +
    `2. Al llegar, presiona "▶️ Iniciar"\n` +
    `3. Al terminar, presiona "✅ Completar"\n` +
    `4. Al final del día, usa /liquidacion para reportar\n\n` +
    `*Para Admin y Supervisores:*\n` +
    `1. Usa 👥 Asignar Tareas para asignar a empleados\n` +
    `2. Selecciona la tarea pendiente\n` +
    `3. Selecciona el empleado disponible\n\n` +
    `*Tipos de aseo:*\n` +
    `🚪 CHECK OUT - Aseo completo después de salida\n` +
    `🧹 STAY OVER - Aseo ligero durante estancia\n` +
    `🧼 DEEP CLEANING - Aseo profundo programado\n\n` +
    `¿Problemas? Contacta a tu supervisor.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleHelpCallback(ctx) {
  await handleHelp(ctx);
}

async function handleLogoutCommand(ctx) {
  try {
    // Update database
    await pool.query(
      'UPDATE telegram_contacts SET is_logged_in = false WHERE telegram_id = $1',
      [ctx.telegramId]
    );

    // Clear session
    userSessions.delete(ctx.telegramId.toString());

    ctx.reply(
      '👋 *Sesión Cerrada*\n\n' +
      'Has cerrado sesión correctamente.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔑 Entrar', 'login')]])
      }
    );
  } catch (error) {
    console.error('Error in logout:', error);
    ctx.reply('❌ Error al cerrar sesión. Intenta nuevamente.');
  }
}

async function handleLogoutCallback(ctx) {
  try {
    // Update database
    await pool.query(
      'UPDATE telegram_contacts SET is_logged_in = false WHERE telegram_id = $1',
      [ctx.telegramId]
    );

    // Clear session
    userSessions.delete(ctx.telegramId.toString());

    await ctx.editMessageText(
      '👋 *Sesión Cerrada*\n\n' +
      'Has cerrado sesión correctamente.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔑 Entrar', 'login')]])
      }
    );
  } catch (error) {
    console.error('Error in logout:', error);
    await ctx.answerCbQuery('❌ Error al cerrar sesión');
  }
}

async function handleCancel(ctx) {
  userSessions.delete(ctx.telegramId.toString());
  ctx.reply('❌ Operación cancelada.');
}

async function handlePhoto(ctx) {
  const session = ctx.session;

  // Check if reporting damage
  if (session && session.state === 'reporting_damage') {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1]; // Get highest resolution
    return handleDamageReportMedia(ctx, 'photo', {
      file_id: largestPhoto.file_id,
      file_unique_id: largestPhoto.file_unique_id
    });
  }

  ctx.reply('📸 Para reportar daños con fotos, ve a la tarea y presiona "Reportar Daños"');
}

async function handleVoice(ctx) {
  const session = ctx.session;

  // Check if reporting damage
  if (session && session.state === 'reporting_damage') {
    return handleDamageReportMedia(ctx, 'voice', {
      file_id: ctx.message.voice.file_id,
      file_unique_id: ctx.message.voice.file_unique_id,
      duration: ctx.message.voice.duration
    });
  }

  ctx.reply('🎤 Para reportar daños con audio, ve a la tarea y presiona "Reportar Daños"');
}

async function handleAudio(ctx) {
  const session = ctx.session;

  // Check if reporting damage
  if (session && session.state === 'reporting_damage') {
    return handleDamageReportMedia(ctx, 'audio', {
      file_id: ctx.message.audio.file_id,
      file_unique_id: ctx.message.audio.file_unique_id,
      duration: ctx.message.audio.duration
    });
  }

  ctx.reply('🎤 Para reportar daños con audio, ve a la tarea y presiona "Reportar Daños"');
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

  // Mark user as logged in
  await pool.query(
    'UPDATE telegram_contacts SET is_logged_in = true, last_login_at = NOW() WHERE telegram_id = $1',
    [ctx.telegramId]
  );

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
    // Get all housekeeping telegram contacts for this tenant
    const result = await pool.query(
      `SELECT DISTINCT tc.telegram_id
       FROM telegram_contacts tc
       JOIN users u ON u.id = tc.user_id
       JOIN telegram_contact_permissions tcp ON tcp.contact_id = tc.id
       JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
       WHERE u.tenant_id = $1
         AND tc.is_active = true
         AND tc.user_id IS NOT NULL
         AND tc.is_logged_in = true
         AND tpc.code IN ('housekeeping', 'admin')
         AND tpc.is_active = true`,
      [tenantId]
    );

    const { reservation_id, property_name, checkout_time, actual_checkout_time, adults, children, infants, is_priority } = reservationData;
    const totalGuests = (adults || 0) + (children || 0) + (infants || 0);

    // Format actual checkout time
    let actualTimeStr = '';
    if (actual_checkout_time) {
      // actual_checkout_time can be TIME (HH:MM:SS) or TIMESTAMP
      if (typeof actual_checkout_time === 'string' && /^\d{2}:\d{2}/.test(actual_checkout_time)) {
        // It's in HH:MM:SS format
        const [hours, minutes] = actual_checkout_time.split(':');
        const hour = parseInt(hours);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        actualTimeStr = `${displayHour}:${minutes} ${period}`;
      } else {
        // It's a timestamp
        actualTimeStr = new Date(actual_checkout_time).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }

    // Format scheduled checkout time
    let scheduledTimeStr = '';
    if (checkout_time) {
      // checkout_time is in HH:MM:SS format
      const [hours, minutes] = checkout_time.split(':');
      const hour = parseInt(hours);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      scheduledTimeStr = `${displayHour}:${minutes} ${period}`;
    }

    const priorityHeader = is_priority ? '🔴 *PRIORIDAD* 🔴\n' : '';
    const priorityFooter = is_priority ? '\n\n⚠️ *ATENCIÓN: Esta limpieza es PRIORITARIA*' : '';

    const message =
      priorityHeader +
      `🚪 *CHECKOUT REPORTADO*\n\n` +
      `🔖 Reserva: #${reservation_id}\n` +
      `📍 Propiedad: *${property_name}*\n` +
      `🕐 Hora programada: ${scheduledTimeStr}\n` +
      `⏰ Hora real: ${actualTimeStr}\n` +
      `👥 Huéspedes: ${totalGuests}\n\n` +
      `La propiedad está disponible para limpieza.` +
      priorityFooter;

    // Send to all housekeeping staff (without keyboard so it appears above menu)
    for (const contact of result.rows) {
      try {
        await bot.telegram.sendMessage(contact.telegram_id, message, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error(`Failed to notify ${contact.telegram_id}:`, error.message);
      }
    }

    console.log(`✅ Checkout notification sent to ${result.rows.length} housekeeping staff`);
  } catch (error) {
    console.error('Error sending checkout notification:', error);
  }
}

/**
 * Send notification to housekeeping staff when check-in is reported
 */
export async function notifyCheckin(tenantId, reservationData) {
  if (!bot) {
    console.warn('⚠️ Telegram bot not running, cannot send checkin notification');
    return;
  }

  try {
    // Get all housekeeping telegram contacts for this tenant
    const result = await pool.query(
      `SELECT DISTINCT tc.telegram_id
       FROM telegram_contacts tc
       JOIN users u ON u.id = tc.user_id
       JOIN telegram_contact_permissions tcp ON tcp.contact_id = tc.id
       JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
       WHERE u.tenant_id = $1
         AND tc.is_active = true
         AND tc.user_id IS NOT NULL
         AND tc.is_logged_in = true
         AND tpc.code IN ('housekeeping', 'admin')
         AND tpc.is_active = true`,
      [tenantId]
    );

    const { reservation_id, property_name, checkin_time, actual_checkin_time, adults, children, infants } = reservationData;
    const totalGuests = (adults || 0) + (children || 0) + (infants || 0);

    // Format arrival time
    let arrivalTimeStr = '';
    if (actual_checkin_time) {
      // actual_checkin_time can be TIME (HH:MM:SS) or TIMESTAMP
      if (typeof actual_checkin_time === 'string' && /^\d{2}:\d{2}/.test(actual_checkin_time)) {
        // It's in HH:MM:SS format
        const [hours, minutes] = actual_checkin_time.split(':');
        const hour = parseInt(hours);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        arrivalTimeStr = `${displayHour}:${minutes} ${period}`;
      } else {
        // It's a timestamp
        arrivalTimeStr = new Date(actual_checkin_time).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } else if (checkin_time) {
      // checkin_time is in HH:MM:SS format
      const [hours, minutes] = checkin_time.split(':');
      const hour = parseInt(hours);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      arrivalTimeStr = `${displayHour}:${minutes} ${period}`;
    }

    const message =
      `🏠 *CHECK-IN REPORTADO*\n\n` +
      `🔖 Reserva: #${reservation_id}\n` +
      `📍 Propiedad: *${property_name}*\n` +
      `🕐 Hora de llegada: ${arrivalTimeStr}\n` +
      `👥 Huéspedes: ${totalGuests}\n\n` +
      `Nuevos huéspedes han llegado a la propiedad.`;

    // Send to all housekeeping staff
    for (const contact of result.rows) {
      try {
        await bot.telegram.sendMessage(contact.telegram_id, message, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error(`Failed to notify ${contact.telegram_id}:`, error.message);
      }
    }

    console.log(`✅ Checkin notification sent to ${result.rows.length} housekeeping staff`);
  } catch (error) {
    console.error('Error sending checkin notification:', error);
  }
}
