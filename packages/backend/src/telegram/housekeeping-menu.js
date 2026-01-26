import { Markup } from 'telegraf';
import { pool } from '../config/database.js';

/**
 * Show main housekeeping menu
 */
export async function showHousekeepingMenu(ctx) {
  const contact = ctx.contact;

  // Check if user has multiple permissions to show module switcher
  const { rows: permRows } = await pool.query(
    `SELECT tpc.code
     FROM telegram_contact_permissions tcp
     JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
     WHERE tcp.contact_id = $1 AND tpc.is_active = true`,
    [contact.id]
  );

  const permissions = permRows.map(p => p.code);
  const hasMultipleModules = permissions.length > 1;

  const buttons = [
    [
      Markup.button.callback('📋 Tareas de Hoy', 'hk_tasks_today'),
      Markup.button.callback('📋 Mis tareas Activas', 'hk_my_active_tasks')
    ],
    [
      Markup.button.callback('📊 Mi Resumen del día', 'hk_daily_summary'),
      Markup.button.callback('💰 Mi Liquidación', 'hk_settlement')
    ],
    [
      Markup.button.callback('📅 Tareas de mañana', 'hk_tasks_tomorrow'),
      Markup.button.callback('🧴 Ordenar Insumos', 'hk_order_supplies')
    ],
    [
      Markup.button.callback('❓ Ayuda', 'hk_help'),
      Markup.button.callback('🚪 Salir', 'logout')
    ]
  ];

  // Add module switcher if user has multiple permissions
  if (hasMultipleModules) {
    buttons.push([Markup.button.callback('🔄 Cambiar de módulo', 'switch_module')]);
  }

  const keyboard = Markup.inlineKeyboard(buttons);

  const message =
    `🧹 *HOUSEKEEPING*\n\n` +
    `Selecciona una opción:`;

  // Try to edit if it's a callback, otherwise send new message
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  } else {
    await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  }
}

/**
 * Show tasks for today
 */
export async function showTasksToday(ctx) {
  const contact = ctx.contact;
  const today = new Date().toISOString().split('T')[0];

  const { rows } = await pool.query(
    `SELECT
      ct.id,
      ct.task_type,
      ct.status,
      ct.assigned_to,
      ct.assigned_at,
      ct.started_at,
      ct.is_priority,
      r.actual_checkout_time,
      r.checkout_time,
      p.name as property_name,
      u.full_name as assigned_to_name
     FROM cleaning_tasks ct
     JOIN reservations r ON r.id = ct.reservation_id
     JOIN properties p ON p.id = r.property_id
     LEFT JOIN users u ON u.id = ct.assigned_to
     WHERE ct.tenant_id = $1
       AND ct.scheduled_date = $2
       AND ct.status IN ('pending', 'in_progress')
     ORDER BY
       ct.is_priority DESC,
       ct.status ASC,
       r.actual_checkout_time ASC NULLS LAST`,
    [contact.tenant_id, today]
  );

  if (rows.length === 0) {
    await ctx.editMessageText(
      '✅ *No hay tareas para hoy*\n\n' +
      'Todas las tareas del día están completadas.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Volver', 'hk_menu')]])
      }
    );
    return;
  }

  let message = `📋 *TAREAS DE HOY* (${rows.length})\n\n`;

  const buttons = [];

  rows.forEach((task, index) => {
    const taskTypeEmoji = getTaskTypeEmoji(task.task_type);
    const taskTypeName = getTaskTypeName(task.task_type);
    const priorityFlag = task.is_priority ? '🔴 PRIORIDAD - ' : '';
    const time = task.actual_checkout_time || task.checkout_time || '';
    const timeStr = time ? formatTime(time) : '';

    // Determine status and action button
    let statusText = '';
    let actionButton = null;

    if (task.status === 'in_progress' && task.assigned_to === contact.user_id) {
      statusText = '⚙️ EN PROGRESO';
      actionButton = Markup.button.callback('✅ Completar', `hk_complete_${task.id}`);
    } else if (task.status === 'in_progress') {
      statusText = `⚙️ En progreso - ${task.assigned_to_name}`;
    } else if (task.assigned_to === contact.user_id) {
      statusText = '📌 Asignada a mí';
      actionButton = Markup.button.callback('▶️ Iniciar', `hk_start_${task.id}`);
    } else if (task.assigned_to) {
      statusText = `👤 Asignada - ${task.assigned_to_name}`;
    } else {
      statusText = '🆓 Disponible';
      actionButton = Markup.button.callback('✋ Tomar', `hk_take_${task.id}`);
    }

    message += `${priorityFlag}*${task.property_name}*\n`;
    message += `${taskTypeEmoji} ${taskTypeName}`;
    if (timeStr) message += ` | ${timeStr}`;
    message += `\n${statusText}\n`;

    if (actionButton) {
      buttons.push([actionButton]);
    }

    if (index < rows.length - 1) {
      message += '\n';
    }
  });

  buttons.push([Markup.button.callback('🔙 Volver al Menú', 'hk_menu')]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

/**
 * Show my active tasks (assigned to me, pending or in progress)
 */
export async function showMyActiveTasks(ctx) {
  const contact = ctx.contact;

  const { rows } = await pool.query(
    `SELECT
      ct.id,
      ct.task_type,
      ct.status,
      ct.started_at,
      ct.is_priority,
      ct.scheduled_date,
      r.actual_checkout_time,
      r.checkout_time,
      p.name as property_name
     FROM cleaning_tasks ct
     JOIN reservations r ON r.id = ct.reservation_id
     JOIN properties p ON p.id = r.property_id
     WHERE ct.tenant_id = $1
       AND ct.assigned_to = $2
       AND ct.status IN ('pending', 'in_progress')
     ORDER BY
       ct.is_priority DESC,
       ct.status DESC,
       ct.scheduled_date ASC`,
    [contact.tenant_id, contact.user_id]
  );

  if (rows.length === 0) {
    await ctx.editMessageText(
      '✅ *No tienes tareas activas*\n\n' +
      'Puedes tomar tareas desde "Tareas de Hoy".',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Volver', 'hk_menu')]])
      }
    );
    return;
  }

  let message = `📋 *MIS TAREAS ACTIVAS* (${rows.length})\n\n`;

  const buttons = [];

  rows.forEach((task, index) => {
    const taskTypeEmoji = getTaskTypeEmoji(task.task_type);
    const taskTypeName = getTaskTypeName(task.task_type);
    const priorityFlag = task.is_priority ? '🔴 PRIORIDAD - ' : '';
    const time = task.actual_checkout_time || task.checkout_time || '';
    const timeStr = time ? formatTime(time) : '';

    const statusText = task.status === 'in_progress' ? '⚙️ EN PROGRESO' : '📌 PENDIENTE';

    message += `${priorityFlag}*${task.property_name}*\n`;
    message += `${taskTypeEmoji} ${taskTypeName}`;
    if (timeStr) message += ` | ${timeStr}`;
    message += `\n${statusText}\n`;

    // Action button
    if (task.status === 'pending') {
      buttons.push([Markup.button.callback('▶️ Iniciar', `hk_start_${task.id}`)]);
    } else if (task.status === 'in_progress') {
      buttons.push([Markup.button.callback('✅ Completar', `hk_complete_${task.id}`)]);
    }

    if (index < rows.length - 1) {
      message += '\n';
    }
  });

  buttons.push([Markup.button.callback('🔙 Volver al Menú', 'hk_menu')]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

/**
 * Show daily summary
 */
export async function showDailySummary(ctx) {
  const contact = ctx.contact;
  const today = new Date().toISOString().split('T')[0];

  const { rows } = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE ct.status = 'completed') as completed,
      COUNT(*) FILTER (WHERE ct.status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE ct.status = 'pending' AND ct.assigned_to = $2) as pending
     FROM cleaning_tasks ct
     WHERE ct.tenant_id = $1
       AND ct.assigned_to = $2
       AND ct.scheduled_date = $3`,
    [contact.tenant_id, contact.user_id, today]
  );

  // Get earnings (from completed tasks)
  const { rows: earningsRows } = await pool.query(
    `SELECT
      ct.task_type,
      COUNT(*) as count,
      tr.rate
     FROM cleaning_tasks ct
     LEFT JOIN task_rates tr ON tr.tenant_id = ct.tenant_id AND tr.task_type = ct.task_type
     WHERE ct.tenant_id = $1
       AND ct.assigned_to = $2
       AND ct.status = 'completed'
       AND DATE(ct.completed_at AT TIME ZONE 'America/Bogota') = $3
     GROUP BY ct.task_type, tr.rate`,
    [contact.tenant_id, contact.user_id, today]
  );

  const stats = rows[0];
  let totalEarnings = 0;

  earningsRows.forEach(row => {
    totalEarnings += (row.count * (row.rate || 0));
  });

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
  };

  let message =
    `📊 *MI RESUMEN DEL DÍA*\n\n` +
    `✅ Completadas: *${stats.completed}*\n` +
    `⚙️ En progreso: *${stats.in_progress}*\n` +
    `📌 Pendientes: *${stats.pending}*\n\n` +
    `💵 Total ganado: *${formatMoney(totalEarnings)}*`;

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Volver', 'hk_menu')]])
  });
}

/**
 * Show tasks for tomorrow
 */
export async function showTasksTomorrow(ctx) {
  const contact = ctx.contact;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  const { rows } = await pool.query(
    `SELECT
      ct.id,
      ct.task_type,
      ct.is_priority,
      r.checkout_time,
      p.name as property_name
     FROM cleaning_tasks ct
     JOIN reservations r ON r.id = ct.reservation_id
     JOIN properties p ON p.id = r.property_id
     WHERE ct.tenant_id = $1
       AND ct.scheduled_date = $2
       AND ct.status = 'pending'
     ORDER BY
       ct.is_priority DESC,
       r.checkout_time ASC NULLS LAST`,
    [contact.tenant_id, tomorrowDate]
  );

  if (rows.length === 0) {
    await ctx.editMessageText(
      '✅ *No hay tareas programadas para mañana*',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Volver', 'hk_menu')]])
      }
    );
    return;
  }

  let message = `📅 *TAREAS DE MAÑANA* (${rows.length})\n\n`;

  rows.forEach((task, index) => {
    const taskTypeEmoji = getTaskTypeEmoji(task.task_type);
    const taskTypeName = getTaskTypeName(task.task_type);
    const priorityFlag = task.is_priority ? '🔴 ' : '';
    const timeStr = task.checkout_time ? formatTime(task.checkout_time) : '';

    message += `${priorityFlag}*${task.property_name}*\n`;
    message += `${taskTypeEmoji} ${taskTypeName}`;
    if (timeStr) message += ` | ${timeStr}`;

    if (index < rows.length - 1) {
      message += '\n\n';
    }
  });

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Volver', 'hk_menu')]])
  });
}

/**
 * Show help
 */
export async function showHousekeepingHelp(ctx) {
  const message =
    `❓ *AYUDA - HOUSEKEEPING*\n\n` +
    `*Cómo usar el sistema:*\n\n` +
    `1️⃣ *Tareas de Hoy*\n` +
    `   Ver todas las tareas del día y tomar las disponibles\n\n` +
    `2️⃣ *Mis tareas Activas*\n` +
    `   Ver solo tus tareas asignadas\n\n` +
    `3️⃣ *Flujo de trabajo:*\n` +
    `   ✋ Tomar → ▶️ Iniciar → ✅ Completar\n\n` +
    `4️⃣ *Liquidación*\n` +
    `   Al final del día, envía tu liquidación para aprobación\n\n` +
    `*Tipos de limpieza:*\n` +
    `🚪 CHECK OUT - Aseo completo\n` +
    `🧹 STAY OVER - Aseo ligero\n` +
    `🧼 DEEP CLEAN - Aseo profundo\n\n` +
    `🔴 Las tareas PRIORITARIAS aparecen marcadas`;

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Volver', 'hk_menu')]])
  });
}

// Helper functions
function getTaskTypeEmoji(taskType) {
  const emojis = {
    check_out: '🚪',
    stay_over: '🧹',
    deep_clean: '🧼'
  };
  return emojis[taskType] || '🧹';
}

function getTaskTypeName(taskType) {
  const names = {
    check_out: 'CHECK OUT',
    stay_over: 'STAY OVER',
    deep_clean: 'DEEP CLEAN'
  };
  return names[taskType] || taskType;
}

function formatTime(timeString) {
  if (!timeString) return '';

  // Handle TIME format (HH:MM:SS)
  if (/^\d{2}:\d{2}/.test(timeString)) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  }

  return timeString;
}
