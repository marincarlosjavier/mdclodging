import { Markup } from 'telegraf';
import { pool } from '../config/database.js';

/**
 * Show main housekeeping menu
 */
/**
 * Navigate to previous/next task
 */
export async function navigateTask(ctx, direction, context) {
  const { userSessions } = await import('./bot.js');

  if (!ctx.session) ctx.session = {};

  const tasksKey = context === 'pending' ? 'tasks_pending' : 'tasks_active';
  const tasks = ctx.session[tasksKey];

  if (!tasks || tasks.length === 0) {
    return await ctx.answerCbQuery('No hay tareas disponibles');
  }

  let currentIndex = ctx.session.current_task_index || 0;

  if (direction === 'next') {
    currentIndex = Math.min(currentIndex + 1, tasks.length - 1);
  } else if (direction === 'prev') {
    currentIndex = Math.max(currentIndex - 1, 0);
  }

  ctx.session.current_task_index = currentIndex;

  // Save to userSessions
  userSessions.set(ctx.telegramId.toString(), ctx.session);

  if (context === 'pending') {
    await showTaskDetail(ctx, tasks, currentIndex, 'pending');
  } else {
    await showActiveTaskDetail(ctx, tasks, currentIndex);
  }
}

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
      Markup.button.callback('📋 Tareas Pendientes', 'hk_tasks_pending'),
      Markup.button.callback('📋 Mis tareas Activas', 'hk_my_active_tasks')
    ],
    [
      Markup.button.callback('📊 Mi Resumen del día', 'hk_daily_summary'),
      Markup.button.callback('💰 Mi Liquidación', 'hk_settlement')
    ],
    [
      Markup.button.callback('📅 Tareas de mañana', 'hk_tasks_tomorrow'),
      Markup.button.callback('🏠 Llegadas', 'hk_arrivals')
    ],
    [
      Markup.button.callback('🧴 Ordenar Insumos', 'hk_order_supplies'),
      Markup.button.callback('❓ Ayuda', 'hk_help')
    ],
    [
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
 * Show pending tasks (available to take, up to today)
 */
export async function showTasksPending(ctx) {
  const contact = ctx.contact;

  // Calculate today based on Colombia timezone
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD format

  const { rows } = await pool.query(
    `SELECT
      r.id as reservation_id,
      r.actual_checkout_time,
      r.checkout_time,
      r.check_out_date,
      r.adults,
      r.children,
      r.infants,
      r.reference,
      p.name as property_name,
      ct.id as cleaning_task_id,
      ct.task_type,
      ct.status,
      ct.assigned_to,
      ct.assigned_at,
      ct.started_at,
      ct.is_priority,
      ct.scheduled_date,
      u.full_name as assigned_to_name
     FROM cleaning_tasks ct
     JOIN reservations r ON r.id = ct.reservation_id
     JOIN properties p ON p.id = r.property_id
     LEFT JOIN users u ON u.id = ct.assigned_to
     WHERE ct.tenant_id = $1
       AND ct.status = 'pending'
       AND ct.assigned_to IS NULL
       AND ct.scheduled_date <= $2
       AND (
         (ct.task_type = 'check_out' AND r.status = 'checked_out')
         OR (ct.task_type = 'stay_over' AND r.status IN ('active', 'checked_in'))
         OR (ct.task_type = 'deep_cleaning')
       )
     ORDER BY
       ct.is_priority DESC,
       ct.scheduled_date ASC,
       r.actual_checkout_time ASC NULLS LAST,
       COALESCE(r.checkout_time, '12:00')`,
    [contact.tenant_id, today]
  );

  if (rows.length === 0) {
    await ctx.editMessageText(
      '✅ *No hay tareas pendientes*\n\n' +
      'Todas las tareas disponibles están asignadas o completadas.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Volver', 'hk_menu')]])
      }
    );
    return;
  }

  // Store tasks in session for pagination
  const { userSessions } = await import('./bot.js');

  if (!ctx.session) ctx.session = {};
  ctx.session.tasks_pending = rows;
  ctx.session.current_task_index = 0;

  // Save to userSessions
  userSessions.set(ctx.telegramId.toString(), ctx.session);

  // Show first task
  await showTaskDetail(ctx, rows, 0, 'pending');
}

/**
 * Show individual task detail with pagination
 */
async function showTaskDetail(ctx, tasks, index, context = 'pending') {
  const contact = ctx.contact;
  const task = tasks[index];
  const totalTasks = tasks.length;

  // Check if checkout has been reported
  const hasCheckout = task.actual_checkout_time !== null;
  const taskTypeEmoji = getTaskTypeEmoji(task.task_type);
  const taskTypeName = getTaskTypeName(task.task_type);
  const priorityFlag = task.is_priority ? '🔴 PRIORIDAD\n' : '';
  const time = task.actual_checkout_time || task.checkout_time || '';
  const timeStr = time ? formatTime(time) : '';
  const totalGuests = (task.adults || 0) + (task.children || 0) + (task.infants || 0);

  const contextTitle = context === 'pending' ? 'TAREA PENDIENTE' : 'TAREA';
  let message = `📋 *${contextTitle} ${index + 1}/${totalTasks}*\n\n`;

  const buttons = [];

  if (!hasCheckout) {
    // Waiting for checkout
    const checkoutTimeStr = task.checkout_time ? formatTime(task.checkout_time) : '';
    message += `${priorityFlag}*${task.property_name}*\n`;
    message += `🔖 Reserva #${task.reservation_id}\n\n`;
    message += `👥 Huéspedes: ${totalGuests}\n`;
    if (checkoutTimeStr) message += `🕐 Salida esperada: ${checkoutTimeStr}\n`;
    message += `\n⏳ *Esperando Check out*`;
  } else {
    // Has checkout - show full task details
    let statusText = '';
    let actionButton = null;

    if (task.status === 'in_progress' && task.assigned_to === contact.user_id) {
      statusText = '⚙️ EN PROGRESO';
      actionButton = Markup.button.callback('✅ Completar Tarea', `hk_complete_${task.cleaning_task_id}`);
    } else if (task.status === 'in_progress') {
      statusText = `⚙️ En progreso - ${task.assigned_to_name}`;
    } else if (task.assigned_to === contact.user_id) {
      statusText = '📌 Asignada a mí';
      actionButton = Markup.button.callback('▶️ Iniciar Tarea', `hk_start_${task.cleaning_task_id}`);
    } else if (task.assigned_to) {
      statusText = `👤 Asignada - ${task.assigned_to_name}`;
    } else {
      statusText = '🆓 Disponible';
      actionButton = Markup.button.callback('✋ Tomar Tarea', `hk_take_${task.cleaning_task_id}`);
    }

    message += `${priorityFlag}*${task.property_name}*\n`;
    message += `🔖 Reserva #${task.reservation_id}\n`;
    if (task.reference) {
      message += `📝 Ref: ${task.reference}\n`;
    }
    message += `\n${taskTypeEmoji} *${taskTypeName}*\n`;
    message += `🕐 ${timeStr}\n`;
    message += `👥 Huéspedes: ${totalGuests}\n`;
    message += `\n📊 Estado: ${statusText}`;

    // Add main action button
    if (actionButton) {
      buttons.push([actionButton]);
    }

    // Add report damage button if task is assigned to user
    if (task.assigned_to === contact.user_id) {
      buttons.push([Markup.button.callback('📸 Reportar Daños', `hk_damage_${task.cleaning_task_id || task.reservation_id}`)]);
    }
  }

  // Navigation buttons
  const navButtons = [];
  if (index > 0) {
    navButtons.push(Markup.button.callback('◀️ Anterior', `hk_task_prev_${context}`));
  }
  if (index < totalTasks - 1) {
    navButtons.push(Markup.button.callback('Siguiente ▶️', `hk_task_next_${context}`));
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  // Back button
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
      r.id as reservation_id,
      r.actual_checkout_time,
      r.checkout_time,
      r.adults,
      r.children,
      r.infants,
      r.reference,
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

  // Store tasks in session for pagination
  const { userSessions } = await import('./bot.js');

  if (!ctx.session) ctx.session = {};
  ctx.session.tasks_active = rows;
  ctx.session.current_task_index = 0;

  // Save to userSessions
  userSessions.set(ctx.telegramId.toString(), ctx.session);

  // Show first task
  await showActiveTaskDetail(ctx, rows, 0);
}

/**
 * Show individual active task detail with pagination
 */
async function showActiveTaskDetail(ctx, tasks, index) {
  const contact = ctx.contact;
  const task = tasks[index];
  const totalTasks = tasks.length;

  const taskTypeEmoji = getTaskTypeEmoji(task.task_type);
  const taskTypeName = getTaskTypeName(task.task_type);
  const priorityFlag = task.is_priority ? '🔴 PRIORIDAD\n' : '';
  const time = task.actual_checkout_time || task.checkout_time || '';
  const timeStr = time ? formatTime(time) : '';
  const totalGuests = (task.adults || 0) + (task.children || 0) + (task.infants || 0);

  const statusText = task.status === 'in_progress' ? '⚙️ EN PROGRESO' : '📌 PENDIENTE';

  let message = `📋 *MI TAREA ${index + 1}/${totalTasks}*\n\n`;
  message += `${priorityFlag}*${task.property_name}*\n`;
  message += `🔖 Reserva #${task.reservation_id}\n`;
  if (task.reference) {
    message += `📝 Ref: ${task.reference}\n`;
  }
  message += `\n${taskTypeEmoji} *${taskTypeName}*\n`;
  message += `🕐 ${timeStr}\n`;
  message += `👥 Huéspedes: ${totalGuests}\n`;
  message += `\n📊 Estado: ${statusText}`;

  const buttons = [];

  // Add action button
  if (task.status === 'pending') {
    buttons.push([Markup.button.callback('▶️ Iniciar Tarea', `hk_start_${task.id}`)]);
  } else if (task.status === 'in_progress') {
    buttons.push([Markup.button.callback('✅ Completar Tarea', `hk_complete_${task.id}`)]);
  }

  // Add report damage button (always available for my tasks)
  buttons.push([Markup.button.callback('📸 Reportar Daños', `hk_damage_${task.id}`)]);

  // Navigation buttons
  const navButtons = [];
  if (index > 0) {
    navButtons.push(Markup.button.callback('◀️ Anterior', 'hk_task_prev_active'));
  }
  if (index < totalTasks - 1) {
    navButtons.push(Markup.button.callback('Siguiente ▶️', 'hk_task_next_active'));
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  // Back button
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

  // Calculate today based on Colombia timezone
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD format

  const { rows } = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE ct.status = 'completed' AND DATE(ct.completed_at AT TIME ZONE 'America/Bogota') = $3) as completed,
      COUNT(*) FILTER (WHERE ct.status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE ct.status = 'pending') as pending
     FROM cleaning_tasks ct
     WHERE ct.tenant_id = $1
       AND ct.assigned_to = $2
       AND (
         (ct.status = 'completed' AND DATE(ct.completed_at AT TIME ZONE 'America/Bogota') = $3)
         OR (ct.status IN ('in_progress', 'pending') AND ct.scheduled_date = $3)
       )`,
    [contact.tenant_id, contact.user_id, today]
  );

  // Get earnings (from completed tasks)
  const { rows: earningsRows } = await pool.query(
    `SELECT
      ct.task_type,
      COUNT(*) as count,
      cr.rate
     FROM cleaning_tasks ct
     LEFT JOIN properties p ON p.id = ct.property_id
     LEFT JOIN cleaning_rates cr ON cr.tenant_id = ct.tenant_id
       AND cr.property_type_id = p.property_type_id
       AND cr.task_type = ct.task_type
     WHERE ct.tenant_id = $1
       AND ct.assigned_to = $2
       AND ct.status = 'completed'
       AND DATE(ct.completed_at AT TIME ZONE 'America/Bogota') = $3
     GROUP BY ct.task_type, cr.rate`,
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

  // Calculate tomorrow based on Colombia timezone
  const now = new Date();
  const colombiaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
  const [year, month, day] = colombiaDateStr.split('-').map(Number);
  const tomorrow = new Date(year, month - 1, day + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  const { rows } = await pool.query(
    `SELECT
      r.id as reservation_id,
      r.checkout_time,
      r.adults,
      r.children,
      r.infants,
      r.reference,
      p.name as property_name,
      pt.name as property_type_name,
      ct.task_type,
      ct.is_priority
     FROM reservations r
     JOIN properties p ON p.id = r.property_id
     JOIN property_types pt ON p.property_type_id = pt.id
     LEFT JOIN cleaning_tasks ct ON ct.reservation_id = r.id
       AND ct.status = 'pending'
       AND ct.scheduled_date = $2
     WHERE r.tenant_id = $1
       AND r.check_out_date = $2
       AND r.status IN ('active', 'checked_in')
     ORDER BY
       COALESCE(r.checkout_time, '12:00') ASC,
       p.name`,
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
    const timeStr = task.checkout_time ? formatTime(task.checkout_time) : '';
    const totalGuests = (task.adults || 0) + (task.children || 0) + (task.infants || 0);
    const taskTypeEmoji = task.task_type ? getTaskTypeEmoji(task.task_type) : '🚪';
    const taskTypeName = task.task_type ? getTaskTypeName(task.task_type) : 'Aseo Completo';
    const priorityFlag = task.is_priority ? ' 🔴' : '';

    message += `*${task.property_name}*${priorityFlag}\n`;
    message += `🔖 Reserva #${task.reservation_id}\n`;
    if (task.reference) {
      message += `📝 Ref: ${task.reference}\n`;
    }
    message += `${taskTypeEmoji} ${taskTypeName}\n`;
    message += `🏠 ${task.property_type_name}\n`;
    if (timeStr) message += `🕐 Salida: ${timeStr}\n`;
    message += `👥 Huéspedes: ${totalGuests}`;

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
    `🚪 Aseo Completo (Checkout)\n` +
    `🧹 Aseo Liviano (Stay over)\n` +
    `🧼 Aseo Profundo (Deep clean)\n\n` +
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
    deep_cleaning: '🧼'
  };
  return emojis[taskType] || '🧹';
}

function getTaskTypeName(taskType) {
  const names = {
    check_out: 'Aseo Completo',
    stay_over: 'Aseo Liviano',
    deep_cleaning: 'Aseo Profundo'
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

/**
 * Show arrivals (check-ins) for today
 */
export async function showArrivals(ctx) {
  const contact = ctx.contact;

  try {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const { rows } = await pool.query(
      `SELECT r.id as reservation_id, r.checkin_time, r.check_in_date,
              r.adults, r.children, r.infants, r.status,
              p.name as property_name, pt.name as property_type_name,
              r.reference
       FROM reservations r
       JOIN properties p ON p.id = r.property_id
       JOIN property_types pt ON p.property_type_id = pt.id
       WHERE r.tenant_id = $1
         AND r.check_in_date = $2
         AND r.status IN ('active', 'checked_in')
       ORDER BY COALESCE(r.checkin_time, '15:00') ASC, p.name`,
      [contact.tenant_id, today]
    );

    if (rows.length === 0) {
      const message = `🏠 *LLEGADAS DE HOY*\n\n` +
        `No hay check-ins programados para hoy.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📅 Ver mañana', 'hk_arrivals_tomorrow')],
        [Markup.button.callback('◀️ Volver al menú', 'module_housekeeping')]
      ]);

      return await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    }

    let message = `🏠 *LLEGADAS DE HOY*\n\n`;
    message += `📊 Total: ${rows.length} ${rows.length === 1 ? 'llegada' : 'llegadas'}\n\n`;

    rows.forEach((arrival, index) => {
      const timeStr = arrival.checkin_time ? formatTime(arrival.checkin_time) : 'Por definir';
      const totalGuests = (arrival.adults || 0) + (arrival.children || 0) + (arrival.infants || 0);
      const statusIcon = arrival.status === 'checked_in' ? '✅' : '⏳';

      message += `${statusIcon} *${arrival.property_name}*\n`;
      message += `🔖 Reserva #${arrival.reservation_id}\n`;
      message += `🕐 Hora: ${timeStr}\n`;
      message += `👥 Huéspedes: ${totalGuests}\n`;
      if (arrival.reference) {
        message += `📝 Ref: ${arrival.reference}\n`;
      }

      if (index < rows.length - 1) {
        message += '\n';
      }
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📅 Ver mañana', 'hk_arrivals_tomorrow')],
      [Markup.button.callback('◀️ Volver al menú', 'module_housekeeping')]
    ]);

    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  } catch (error) {
    console.error('Error showing arrivals:', error);
    await ctx.reply('❌ Error al cargar las llegadas');
  }
}

/**
 * Show arrivals (check-ins) for tomorrow
 */
export async function showArrivalsTomorrow(ctx) {
  const contact = ctx.contact;

  try {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const [year, month, day] = today.split('-').map(Number);
    const tomorrow = new Date(year, month - 1, day + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const { rows } = await pool.query(
      `SELECT r.id as reservation_id, r.checkin_time, r.check_in_date,
              r.adults, r.children, r.infants, r.status,
              p.name as property_name, pt.name as property_type_name,
              r.reference
       FROM reservations r
       JOIN properties p ON p.id = r.property_id
       JOIN property_types pt ON p.property_type_id = pt.id
       WHERE r.tenant_id = $1
         AND r.check_in_date = $2
         AND r.status IN ('active', 'checked_in')
       ORDER BY COALESCE(r.checkin_time, '15:00') ASC, p.name`,
      [contact.tenant_id, tomorrowDate]
    );

    if (rows.length === 0) {
      const message = `🏠 *LLEGADAS DE MAÑANA*\n\n` +
        `No hay check-ins programados para mañana.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Ver hoy', 'hk_arrivals')],
        [Markup.button.callback('🏠 Volver al menú', 'module_housekeeping')]
      ]);

      return await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    }

    let message = `🏠 *LLEGADAS DE MAÑANA*\n\n`;
    message += `📊 Total: ${rows.length} ${rows.length === 1 ? 'llegada' : 'llegadas'}\n\n`;

    rows.forEach((arrival, index) => {
      const timeStr = arrival.checkin_time ? formatTime(arrival.checkin_time) : 'Por definir';
      const totalGuests = (arrival.adults || 0) + (arrival.children || 0) + (arrival.infants || 0);
      const statusIcon = arrival.status === 'checked_in' ? '✅' : '⏳';

      message += `${statusIcon} *${arrival.property_name}*\n`;
      message += `🔖 Reserva #${arrival.reservation_id}\n`;
      message += `🕐 Hora: ${timeStr}\n`;
      message += `👥 Huéspedes: ${totalGuests}\n`;
      if (arrival.reference) {
        message += `📝 Ref: ${arrival.reference}\n`;
      }

      if (index < rows.length - 1) {
        message += '\n';
      }
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('◀️ Ver hoy', 'hk_arrivals')],
      [Markup.button.callback('🏠 Volver al menú', 'module_housekeeping')]
    ]);

    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  } catch (error) {
    console.error('Error showing arrivals tomorrow:', error);
    await ctx.reply('❌ Error al cargar las llegadas de mañana');
  }
}
