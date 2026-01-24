import { Markup } from 'telegraf';
import { pool } from '../config/database.js';

// Emojis for task types
const TASK_TYPE_EMOJI = {
  check_out: '🚪',
  stay_over: '🧹',
  deep_cleaning: '🧼'
};

const TASK_TYPE_LABELS = {
  check_out: 'CHECK OUT - Aseo completo',
  stay_over: 'STAY OVER - Aseo ligero',
  deep_cleaning: 'DEEP CLEANING - Aseo profundo'
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

    return ctx.reply(
      `⚠️ *Ya tienes una tarea ${statusText}*\n\n` +
      `${emoji} *${TASK_TYPE_LABELS[activeTask.task_type]}*\n` +
      `📍 Propiedad: *${property.rows[0]?.name || 'N/A'}*\n\n` +
      `Debes completar esta tarea antes de tomar otra.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          activeTask.started_at
            ? [Markup.button.callback('✅ Marcar como Completada', `complete_task_${activeTask.id}`)]
            : [Markup.button.callback('▶️ Iniciar Trabajo', `start_task_${activeTask.id}`)]
        ])
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
 * Show user's settlement status
 */
export async function showSettlementStatus(ctx) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.reply('❌ No estás vinculado a ningún usuario del sistema.');
  }

  const today = new Date().toISOString().split('T')[0];

  // Get today's completed tasks (not in settlement)
  const tasksResult = await pool.query(
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

  // Get today's settlement if exists
  const settlementResult = await pool.query(
    `SELECT * FROM cleaning_settlements
     WHERE user_id = $1 AND settlement_date = $2`,
    [contact.user_id, today]
  );

  let message = '📊 *MI LIQUIDACIÓN DE HOY*\n\n';

  if (tasksResult.rows.length === 0 && settlementResult.rows.length === 0) {
    message += '📭 No tienes tareas completadas hoy.';
    return ctx.reply(message, { parse_mode: 'Markdown' });
  }

  if (settlementResult.rows.length > 0) {
    const settlement = settlementResult.rows[0];
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

    message += `${statusEmoji[settlement.status]} Estado: *${statusLabels[settlement.status]}*\n`;
    message += `📋 Total tareas: ${settlement.total_tasks}\n`;
    message += `💵 Total: $${parseFloat(settlement.total_amount).toFixed(0)}\n`;

    if (settlement.status === 'rejected' && settlement.review_notes) {
      message += `\n❌ Motivo rechazo:\n_${settlement.review_notes}_\n`;
    }

    if (settlement.status === 'approved' || settlement.status === 'paid') {
      message += `\n✅ Aprobada por: ${settlement.reviewer_name || 'Admin'}\n`;
    }

    return ctx.reply(message, { parse_mode: 'Markdown' });
  }

  // Show tasks not yet in settlement
  message += `📝 *Tareas pendientes de reportar:*\n\n`;

  let totalAmount = 0;

  tasksResult.rows.forEach((task, index) => {
    const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';
    const rate = parseFloat(task.rate || 0);
    totalAmount += rate;
    const durationMinutes = Math.round(task.duration_minutes);

    message += `${index + 1}. ${emoji} ${task.property_name}\n`;
    message += `   ⏱️ ${durationMinutes}m | 💰 $${rate.toFixed(0)}\n`;
  });

  message += `\n💵 *Total del día: $${totalAmount.toFixed(0)}*\n\n`;
  message += '💡 Al terminar tu jornada, reporta tu liquidación para que sea revisada por el administrador.';

  return ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📤 Reportar Liquidación', 'report_settlement')]
    ])
  });
}

/**
 * Handle settlement reporting
 */
export async function handleReportSettlement(ctx) {
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

    return ctx.reply(
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

    const message =
      `🚪 *CHECKOUT REPORTADO*\n\n` +
      `📍 Propiedad: *${property_name}*\n` +
      `⏰ Hora: ${timeStr}\n` +
      `👥 Huéspedes: ${totalGuests}\n\n` +
      `La propiedad está disponible para limpieza.\n` +
      `Usa /tareas para ver y tomar la tarea.`;

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

    console.log(`✅ Checkout notification sent to ${result.rows.length} housekeeping staff`);
  } catch (error) {
    console.error('Error sending checkout notification:', error);
  }
}

// Export for use in bot
export default {
  showCleaningTasks,
  handleTakeTask,
  handleStartTask,
  handleCompleteTask,
  showSettlementStatus,
  handleReportSettlement,
  notifyCheckout
};
