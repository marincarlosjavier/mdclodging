import { Markup } from 'telegraf';
import { pool } from '../config/database.js';

// Emojis for task types
const TASK_TYPE_EMOJI = {
  check_out: '🚪',
  stay_over: '🧹',
  deep_cleaning: '🧼'
};

const TASK_TYPE_LABELS = {
  check_out: 'Aseo Completo',
  stay_over: 'Aseo Liviano',
  deep_cleaning: 'Aseo Profundo'
};

/**
 * Check if user has an active cleaning task
 */
export async function hasActiveTask(userId) {
  const result = await pool.query(
    `SELECT id, task_type, property_id, started_at
     FROM cleaning_tasks
     WHERE assigned_to = $1
       AND status IN ('pending', 'in_progress')
     ORDER BY assigned_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Show available cleaning tasks
 */
export async function showCleaningTasks(ctx) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.reply('❌ No estás vinculado a ningún usuario del sistema.');
  }

  // Check if user has active task
  const activeTask = await hasActiveTask(contact.user_id);

  if (activeTask) {
    const property = await pool.query(
      'SELECT name FROM properties WHERE id = $1',
      [activeTask.property_id]
    );

    const statusText = activeTask.started_at ? 'en progreso' : 'asignada';
    const emoji = TASK_TYPE_EMOJI[activeTask.task_type] || '🏠';

    const buttons = [
      activeTask.started_at
        ? [Markup.button.callback('✅ Marcar como Completada', `complete_task_${activeTask.id}`)]
        : [Markup.button.callback('▶️ Iniciar Trabajo', `start_task_${activeTask.id}`)],
      [Markup.button.callback('🚫 Abandonar Tarea', `abandon_task_${activeTask.id}`)],
      [Markup.button.callback('🔙 Menú Principal', 'back_to_menu')]
    ];

    return ctx.reply(
      `⚠️ *Ya tienes una tarea ${statusText}*\n\n` +
      `${emoji} *${TASK_TYPE_LABELS[activeTask.task_type]}*\n` +
      `📍 Propiedad: *${property.rows[0]?.name || 'N/A'}*\n\n` +
      `Debes completar esta tarea antes de tomar otra.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      }
    );
  }

  // Get available tasks (pending, not assigned)
  const result = await pool.query(
    `SELECT ct.id, ct.task_type, ct.checkout_reported_at, ct.scheduled_date, ct.is_priority,
            p.name as property_name, pt.name as property_type_name,
            r.adults, r.children, r.infants,
            cr.rate
     FROM cleaning_tasks ct
     LEFT JOIN properties p ON p.id = ct.property_id
     LEFT JOIN property_types pt ON pt.id = p.property_type_id
     LEFT JOIN reservations r ON r.id = ct.reservation_id
     LEFT JOIN cleaning_rates cr ON cr.property_type_id = p.property_type_id AND cr.task_type = ct.task_type AND cr.tenant_id = ct.tenant_id
     WHERE ct.tenant_id = $1
       AND ct.status = 'pending'
       AND ct.assigned_to IS NULL
     ORDER BY ct.is_priority DESC NULLS LAST, ct.checkout_reported_at, ct.scheduled_date, ct.created_at
     LIMIT 10`,
    [contact.tenant_id]
  );

  if (result.rows.length === 0) {
    return ctx.reply(
      '✨ *No hay tareas de limpieza disponibles*\n\n' +
      'Todas las tareas están asignadas o completadas.',
      { parse_mode: 'Markdown' }
    );
  }

  let message = '🏠 *TAREAS DE LIMPIEZA DISPONIBLES*\n\n';

  const buttons = [];

  result.rows.forEach((task, index) => {
    const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';
    const taskLabel = TASK_TYPE_LABELS[task.task_type];
    const totalGuests = (task.adults || 0) + (task.children || 0) + (task.infants || 0);
    const rate = task.rate ? `💰 $${parseFloat(task.rate).toFixed(0)}` : '';
    const priorityTag = task.is_priority ? ' 🔴 *PRIORIDAD*' : '';

    message += `${index + 1}. ${emoji} *${taskLabel}*${priorityTag}\n`;
    message += `   📍 ${task.property_name}\n`;
    message += `   🏷️ ${task.property_type_name}\n`;

    if (totalGuests > 0) {
      message += `   👥 ${totalGuests} huésped${totalGuests !== 1 ? 'es' : ''}\n`;
    }

    if (rate) {
      message += `   ${rate}\n`;
    }

    message += '\n';

    buttons.push([Markup.button.callback(
      `${index + 1}. Tomar ${emoji}`,
      `take_task_${task.id}`
    )]);
  });

  message += '💡 *Selecciona una tarea para asignártela*';

  return ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

/**
 * Handle task assignment
 */
export async function handleTakeTask(ctx, taskId) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.answerCbQuery('❌ No estás vinculado al sistema');
  }

  // Double check user doesn't have active task
  const activeTask = await hasActiveTask(contact.user_id);

  if (activeTask) {
    await ctx.answerCbQuery('⚠️ Ya tienes una tarea activa');
    return showCleaningTasks(ctx);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check task is still available
    const taskCheck = await client.query(
      `SELECT ct.*, p.name as property_name, pt.name as property_type_name
       FROM cleaning_tasks ct
       LEFT JOIN properties p ON p.id = ct.property_id
       LEFT JOIN property_types pt ON pt.id = p.property_type_id
       WHERE ct.id = $1 AND ct.status = 'pending' AND ct.assigned_to IS NULL`,
      [taskId]
    );

    if (taskCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      await ctx.answerCbQuery('❌ Esta tarea ya no está disponible');
      return showCleaningTasks(ctx);
    }

    const task = taskCheck.rows[0];

    // Assign task
    await client.query(
      `UPDATE cleaning_tasks
       SET assigned_to = $1,
           assigned_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [contact.user_id, taskId]
    );

    await client.query('COMMIT');

    const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';

    await ctx.answerCbQuery('✅ Tarea asignada!');

    return ctx.reply(
      `✅ *Tarea Asignada*\n\n` +
      `${emoji} *${TASK_TYPE_LABELS[task.task_type]}*\n` +
      `📍 Propiedad: *${task.property_name}*\n` +
      `🏷️ Tipo: ${task.property_type_name}\n\n` +
      `Cuando llegues a la propiedad, presiona *"▶️ Iniciar"* para comenzar el cronómetro.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('▶️ Iniciar Trabajo', `start_task_${taskId}`)]
        ])
      }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error taking task:', error);
    return ctx.answerCbQuery('❌ Error asignando tarea');
  } finally {
    client.release();
  }
}

/**
 * Handle task start
 */
export async function handleStartTask(ctx, taskId) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.answerCbQuery('❌ No estás vinculado al sistema');
  }

  const result = await pool.query(
    `UPDATE cleaning_tasks ct
     SET status = 'in_progress',
         started_at = NOW(),
         updated_at = NOW()
     FROM properties p
     WHERE ct.id = $1
       AND ct.assigned_to = $2
       AND ct.started_at IS NULL
       AND p.id = ct.property_id
     RETURNING ct.*, p.name as property_name`,
    [taskId, contact.user_id]
  );

  if (result.rows.length === 0) {
    return ctx.answerCbQuery('❌ No se pudo iniciar la tarea');
  }

  const task = result.rows[0];
  const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';

  await ctx.answerCbQuery('✅ Cronómetro iniciado!');

  return ctx.reply(
    `▶️ *Trabajo Iniciado*\n\n` +
    `${emoji} *${TASK_TYPE_LABELS[task.task_type]}*\n` +
    `📍 ${task.property_name}\n` +
    `⏱️ Hora de inicio: ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}\n\n` +
    `Cuando termines el trabajo, presiona *"✅ Completar"*.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Marcar como Completada', `complete_task_${taskId}`)]
      ])
    }
  );
}

/**
 * Handle task completion
 */
export async function handleCompleteTask(ctx, taskId) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.answerCbQuery('❌ No estás vinculado al sistema');
  }

  const result = await pool.query(
    `UPDATE cleaning_tasks ct
     SET status = 'completed',
         completed_at = NOW(),
         completed_by = $2,
         updated_at = NOW()
     FROM properties p, property_types pt
     WHERE ct.id = $1
       AND ct.assigned_to = $2
       AND ct.status = 'in_progress'
       AND p.id = ct.property_id
       AND pt.id = p.property_type_id
     RETURNING ct.*, p.name as property_name, pt.name as property_type_name,
               EXTRACT(EPOCH FROM (NOW() - ct.started_at))/60 as duration_minutes`,
    [taskId, contact.user_id]
  );

  if (result.rows.length === 0) {
    return ctx.answerCbQuery('❌ No se pudo completar la tarea');
  }

  const task = result.rows[0];
  const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';
  const durationMinutes = Math.round(task.duration_minutes);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Get rate for this task
  const rateResult = await pool.query(
    `SELECT rate FROM cleaning_rates
     WHERE tenant_id = $1
       AND property_type_id = (SELECT property_type_id FROM properties WHERE id = $2)
       AND task_type = $3`,
    [task.tenant_id, task.property_id, task.task_type]
  );

  const rate = rateResult.rows[0]?.rate;
  const rateText = rate ? `\n💰 Pago: $${parseFloat(rate).toFixed(0)}` : '';

  await ctx.answerCbQuery('✅ Tarea completada!');

  return ctx.reply(
    `✅ *Trabajo Completado*\n\n` +
    `${emoji} *${TASK_TYPE_LABELS[task.task_type]}*\n` +
    `📍 ${task.property_name}\n` +
    `🏷️ ${task.property_type_name}\n` +
    `⏱️ Duración: ${durationText}${rateText}\n\n` +
    `¡Excelente trabajo! 🎉`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Show user's settlement status grouped by day
 */
export async function showSettlementStatus(ctx) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.reply('❌ No estás vinculado a ningún usuario del sistema.');
  }

  const today = new Date().toISOString().split('T')[0];

  // Get today's completed tasks (not in settlement)
  const todayTasksResult = await pool.query(
    `SELECT ct.id, ct.task_type, p.name as property_name,
            EXTRACT(EPOCH FROM (ct.completed_at - ct.started_at))/60 as duration_minutes,
            cr.rate
     FROM cleaning_tasks ct
     LEFT JOIN properties p ON p.id = ct.property_id
     LEFT JOIN property_types pt ON pt.id = p.property_type_id
     LEFT JOIN cleaning_rates cr ON cr.property_type_id = pt.id AND cr.task_type = ct.task_type AND cr.tenant_id = ct.tenant_id
     WHERE ct.assigned_to = $1
       AND ct.status = 'completed'
       AND DATE(ct.completed_at) = $2
       AND ct.id NOT IN (SELECT cleaning_task_id FROM cleaning_settlement_items)
     ORDER BY ct.completed_at`,
    [contact.user_id, today]
  );

  // Get all settlements (last 30 days)
  const settlementsResult = await pool.query(
    `SELECT cs.*, u.full_name as reviewer_name
     FROM cleaning_settlements cs
     LEFT JOIN users u ON u.id = cs.reviewed_by
     WHERE cs.user_id = $1
       AND cs.settlement_date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY cs.settlement_date DESC`,
    [contact.user_id]
  );

  let message = '💰 *MI LIQUIDACIÓN*\n\n';

  // Show today's pending tasks
  if (todayTasksResult.rows.length > 0) {
    message += `📝 *Hoy (${today}) - Pendiente de reportar*\n`;

    let todayTotal = 0;
    todayTasksResult.rows.forEach((task) => {
      const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';
      const rate = parseFloat(task.rate || 0);
      todayTotal += rate;
      const taskName = TASK_TYPE_LABELS[task.task_type];

      message += `  ${emoji} ${task.property_name} - ${taskName} | $${rate.toFixed(0)}\n`;
    });

    message += `  💵 *Subtotal: $${todayTotal.toFixed(0)}*\n\n`;
    message += '  ⬇️ _Reporta al terminar tu jornada_\n\n';
  }

  // Show settlements grouped by status
  if (settlementsResult.rows.length > 0) {
    const statusEmoji = {
      draft: '📝',
      submitted: '⏳',
      approved: '✅',
      rejected: '❌',
      paid: '💰'
    };
    const statusLabels = {
      draft: 'Borrador',
      submitted: 'Enviada',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      paid: 'Pagada'
    };

    message += `📜 *Historial (últimos 30 días)*\n\n`;

    settlementsResult.rows.forEach((settlement) => {
      const date = new Date(settlement.settlement_date).toLocaleDateString('es-CO');
      const status = settlement.status;

      message += `${statusEmoji[status]} *${date}*\n`;
      message += `  Estado: ${statusLabels[status]}\n`;
      message += `  Tareas: ${settlement.total_tasks} | Total: $${parseFloat(settlement.total_amount).toFixed(0)}\n`;

      if (status === 'rejected' && settlement.review_notes) {
        message += `  ❌ Motivo: _${settlement.review_notes}_\n`;
      }
      if ((status === 'approved' || status === 'paid') && settlement.reviewer_name) {
        message += `  ✅ Aprobada por: ${settlement.reviewer_name}\n`;
      }

      message += '\n';
    });
  }

  if (todayTasksResult.rows.length === 0 && settlementsResult.rows.length === 0) {
    message += '📭 No tienes tareas completadas ni liquidaciones registradas.';
    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Menú Principal', 'back_to_menu')]
      ])
    });
  }

  const buttons = [];
  if (todayTasksResult.rows.length > 0) {
    buttons.push([Markup.button.callback('📤 Reportar Liquidación Hoy', 'report_settlement')]);
  }
  buttons.push([Markup.button.callback('🔙 Menú Principal', 'back_to_menu')]);

  return ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

/**
 * Handle settlement reporting - Show confirmation first
 */
export async function handleReportSettlement(ctx) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.answerCbQuery('❌ No estás vinculado al sistema');
  }

  const today = new Date().toISOString().split('T')[0];

  // Get today's completed tasks to show summary
  const tasksResult = await pool.query(
    `SELECT ct.id, ct.task_type, p.name as property_name,
            cr.rate
     FROM cleaning_tasks ct
     LEFT JOIN properties p ON p.id = ct.property_id
     LEFT JOIN property_types pt ON pt.id = p.property_type_id
     LEFT JOIN cleaning_rates cr ON cr.property_type_id = pt.id AND cr.task_type = ct.task_type AND cr.tenant_id = ct.tenant_id
     WHERE ct.assigned_to = $1
       AND ct.status = 'completed'
       AND DATE(ct.completed_at) = $2
       AND ct.id NOT IN (SELECT cleaning_task_id FROM cleaning_settlement_items)
     ORDER BY ct.completed_at`,
    [contact.user_id, today]
  );

  if (tasksResult.rows.length === 0) {
    return ctx.answerCbQuery('❌ No tienes tareas completadas hoy');
  }

  let totalAmount = 0;
  let message = '⚠️ *CONFIRMAR LIQUIDACIÓN*\n\n';
  message += `📝 Estás por reportar ${tasksResult.rows.length} ${tasksResult.rows.length === 1 ? 'tarea' : 'tareas'}:\n\n`;

  tasksResult.rows.forEach((task, index) => {
    const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';
    const rate = parseFloat(task.rate || 0);
    totalAmount += rate;
    const taskName = TASK_TYPE_LABELS[task.task_type];

    message += `${index + 1}. ${emoji} ${task.property_name}\n`;
    message += `   ${taskName} - $${rate.toFixed(0)}\n`;
  });

  message += `\n💵 *Total: $${totalAmount.toFixed(0)}*\n\n`;
  message += '❓ ¿Deseas reportar esta liquidación para revisión?';

  await ctx.answerCbQuery();

  return ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Sí, Reportar', 'confirm_report_settlement')],
      [Markup.button.callback('❌ Cancelar', 'back_to_menu')]
    ])
  });
}

/**
 * Confirm and create settlement
 */
export async function handleConfirmReportSettlement(ctx) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.answerCbQuery('❌ No estás vinculado al sistema');
  }

  const today = new Date().toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if settlement already exists
    const existingCheck = await client.query(
      'SELECT id, status FROM cleaning_settlements WHERE user_id = $1 AND settlement_date = $2',
      [contact.user_id, today]
    );

    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return ctx.answerCbQuery('⚠️ Ya tienes una liquidación para hoy');
    }

    // Get completed tasks for today (not in any settlement)
    const tasksResult = await client.query(
      `SELECT ct.id, ct.task_type, ct.started_at, ct.completed_at,
              p.name as property_name, pt.id as property_type_id, pt.name as property_type_name,
              cr.rate,
              EXTRACT(EPOCH FROM (ct.completed_at - ct.started_at))/60 as duration_minutes
       FROM cleaning_tasks ct
       LEFT JOIN properties p ON p.id = ct.property_id
       LEFT JOIN property_types pt ON pt.id = p.property_type_id
       LEFT JOIN cleaning_rates cr ON cr.property_type_id = pt.id AND cr.task_type = ct.task_type AND cr.tenant_id = ct.tenant_id
       WHERE ct.assigned_to = $1
         AND ct.status = 'completed'
         AND DATE(ct.completed_at) = $2
         AND ct.id NOT IN (SELECT cleaning_task_id FROM cleaning_settlement_items)
       ORDER BY ct.completed_at`,
      [contact.user_id, today]
    );

    if (tasksResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return ctx.answerCbQuery('❌ No tienes tareas completadas hoy');
    }

    // Calculate totals
    let totalAmount = 0;
    const itemsData = [];

    for (const task of tasksResult.rows) {
      const rate = parseFloat(task.rate || 0);
      totalAmount += rate;

      itemsData.push({
        cleaning_task_id: task.id,
        property_name: task.property_name,
        property_type_name: task.property_type_name,
        task_type: task.task_type,
        rate: rate,
        started_at: task.started_at,
        completed_at: task.completed_at,
        work_duration_minutes: Math.round(task.duration_minutes)
      });
    }

    // Create settlement
    const settlementResult = await client.query(
      `INSERT INTO cleaning_settlements (tenant_id, user_id, settlement_date, total_tasks, total_amount, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, 'submitted', NOW())
       RETURNING *`,
      [contact.tenant_id, contact.user_id, today, tasksResult.rows.length, totalAmount]
    );

    const settlement = settlementResult.rows[0];

    // Insert items
    for (const item of itemsData) {
      await client.query(
        `INSERT INTO cleaning_settlement_items (
          settlement_id, cleaning_task_id, property_name, property_type_name,
          task_type, rate, started_at, completed_at, work_duration_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          settlement.id, item.cleaning_task_id, item.property_name, item.property_type_name,
          item.task_type, item.rate, item.started_at, item.completed_at, item.work_duration_minutes
        ]
      );
    }

    await client.query('COMMIT');

    await ctx.answerCbQuery('✅ Liquidación reportada!');

    return ctx.editMessageText(
      `✅ *Liquidación Reportada*\n\n` +
      `📋 Total tareas: ${settlement.total_tasks}\n` +
      `💵 Total: $${parseFloat(settlement.total_amount).toFixed(0)}\n\n` +
      `Tu liquidación ha sido enviada para revisión del administrador. Recibirás una notificación cuando sea aprobada.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating settlement:', error);
    return ctx.answerCbQuery('❌ Error creando liquidación');
  } finally {
    client.release();
  }
}

/**
 * Send notification to housekeeping when checkout is reported
 */
export async function notifyCheckout(tenantId, reservationData) {
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
         AND tc.is_linked = true
         AND tpc.code IN ('housekeeping', 'admin')
         AND tpc.is_active = true`,
      [tenantId]
    );

    const { property_name, actual_checkout_time, adults, children, infants } = reservationData;
    const totalGuests = (adults || 0) + (children || 0) + (infants || 0);
    const timeStr = new Date(actual_checkout_time).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const { task_type } = reservationData;
    const taskTypeLabels = {
      'check_out': '🚪 Aseo Completo (Checkout)',
      'stay_over': '🧹 Aseo Liviano (Stay Over)',
      'deep_cleaning': '🧼 Aseo Profundo'
    };
    const taskTypeLabel = taskTypeLabels[task_type] || task_type;

    const message =
      `🚪 *CHECKOUT REPORTADO*\n\n` +
      `📍 Propiedad: *${property_name}*\n` +
      `⏰ Hora: ${timeStr}\n` +
      `👥 Huéspedes: ${totalGuests}\n` +
      `🧹 Tipo: ${taskTypeLabel}\n\n` +
      `La propiedad está disponible para limpieza.`;

    // Send to all housekeeping staff
    for (const contact of result.rows) {
      try {
        await bot.telegram.sendMessage(contact.telegram_id, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Ver Tareas Pendientes', callback_data: 'cleaning_pending_tasks' }]
            ]
          }
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
 * Handle abandoning a task (return to available tasks)
 */
export async function handleAbandonTask(ctx, taskId) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.answerCbQuery('❌ No estás vinculado al sistema');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify task belongs to user
    const taskCheck = await client.query(
      `SELECT ct.*, p.name as property_name
       FROM cleaning_tasks ct
       LEFT JOIN properties p ON p.id = ct.property_id
       WHERE ct.id = $1 AND ct.assigned_to = $2 AND ct.status IN ('pending', 'in_progress')`,
      [taskId, contact.user_id]
    );

    if (taskCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return ctx.answerCbQuery('❌ Tarea no encontrada o ya completada');
    }

    const task = taskCheck.rows[0];

    // Return task to pending state (unassign)
    await client.query(
      `UPDATE cleaning_tasks
       SET assigned_to = NULL,
           assigned_at = NULL,
           started_at = NULL,
           status = 'pending',
           updated_at = NOW()
       WHERE id = $1`,
      [taskId]
    );

    await client.query('COMMIT');

    await ctx.answerCbQuery('✅ Tarea liberada');

    return ctx.reply(
      `✅ *Tarea Abandonada*\n\n` +
      `📍 Propiedad: ${task.property_name}\n\n` +
      `La tarea ha sido devuelta a la lista de tareas disponibles.\n` +
      `Otro miembro del equipo podrá tomarla.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver Tareas Disponibles', 'cleaning_tasks')],
          [Markup.button.callback('🔙 Menú Principal', 'back_to_menu')]
        ])
      }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error abandoning task:', error);
    return ctx.answerCbQuery('❌ Error liberando tarea');
  } finally {
    client.release();
  }
}

// Export for use in bot
export default {
  showCleaningTasks,
  handleTakeTask,
  handleStartTask,
  handleCompleteTask,
  handleAbandonTask,
  showSettlementStatus,
  handleReportSettlement,
  handleConfirmReportSettlement,
  notifyCheckout
};
