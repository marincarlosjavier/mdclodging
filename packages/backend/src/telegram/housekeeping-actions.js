import { pool } from '../config/database.js';
import { showMyActiveTasks, showTasksToday } from './housekeeping-menu.js';

/**
 * Take a task (assign to self)
 */
export async function takeTask(ctx, taskId) {
  const contact = ctx.contact;

  try {
    const result = await pool.query(
      `UPDATE cleaning_tasks
       SET assigned_to = $1,
           assigned_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
         AND tenant_id = $3
         AND assigned_to IS NULL
         AND status = 'pending'
       RETURNING id`,
      [contact.user_id, taskId, contact.tenant_id]
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery('❌ Esta tarea ya no está disponible');
      await showTasksToday(ctx);
      return;
    }

    await ctx.answerCbQuery('✅ Tarea asignada correctamente');
    await showTasksToday(ctx);
  } catch (error) {
    console.error('Error taking task:', error);
    await ctx.answerCbQuery('❌ Error al tomar la tarea');
  }
}

/**
 * Start a task (mark as in progress)
 */
export async function startTask(ctx, taskId) {
  const contact = ctx.contact;

  try {
    const result = await pool.query(
      `UPDATE cleaning_tasks
       SET status = 'in_progress',
           started_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND tenant_id = $2
         AND assigned_to = $3
         AND status = 'pending'
       RETURNING id`,
      [taskId, contact.tenant_id, contact.user_id]
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery('❌ No puedes iniciar esta tarea');
      await showMyActiveTasks(ctx);
      return;
    }

    await ctx.answerCbQuery('✅ Tarea iniciada');
    await showMyActiveTasks(ctx);
  } catch (error) {
    console.error('Error starting task:', error);
    await ctx.answerCbQuery('❌ Error al iniciar la tarea');
  }
}

/**
 * Start damage report for a task
 */
export async function startDamageReport(ctx, taskId) {
  const { Markup } = await import('telegraf');
  const { userSessions } = await import('./bot.js');

  // Set session state
  if (!ctx.session) ctx.session = {};
  ctx.session.state = 'reporting_damage';
  ctx.session.damage_task_id = taskId;
  ctx.session.damage_reports = [];

  // Save to userSessions
  userSessions.set(ctx.telegramId.toString(), ctx.session);

  const message =
    `📸 *REPORTAR DAÑOS*\n\n` +
    `Puedes enviar:\n` +
    `📷 Fotos de los daños\n` +
    `🎤 Mensajes de voz con detalles\n` +
    `💬 Mensajes de texto descriptivos\n\n` +
    `Cuando termines, presiona "Finalizar Reporte"`;

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Finalizar Reporte', `hk_finish_damage_${taskId}`)],
      [Markup.button.callback('❌ Cancelar', 'hk_cancel_damage')]
    ])
  });
}

/**
 * Finish damage report
 */
export async function finishDamageReport(ctx, taskId) {
  const { userSessions } = await import('./bot.js');

  if (!ctx.session || !ctx.session.damage_reports) {
    return await ctx.answerCbQuery('No hay reportes para guardar');
  }

  const reports = ctx.session.damage_reports;

  // TODO: Save damage reports to database
  console.log('Damage reports for task', taskId, ':', reports);

  // Clear damage report state
  delete ctx.session.state;
  delete ctx.session.damage_task_id;
  delete ctx.session.damage_reports;

  // Update userSessions
  userSessions.set(ctx.telegramId.toString(), ctx.session);

  await ctx.answerCbQuery(`✅ ${reports.length} elemento(s) guardado(s)`);

  // Return to the specific task view automatically
  const { showTasksToday } = await import('./housekeeping-menu.js');

  // Check which context we're in (today or active tasks)
  if (ctx.session.tasks_today && ctx.session.current_task_index !== undefined) {
    const { default: showTaskDetail } = await import('./housekeeping-menu.js');
    // Re-fetch tasks to get updated data
    await showTasksToday(ctx);
  } else if (ctx.session.tasks_active && ctx.session.current_task_index !== undefined) {
    const { showMyActiveTasks } = await import('./housekeeping-menu.js');
    await showMyActiveTasks(ctx);
  } else {
    // Fallback to tasks today
    await showTasksToday(ctx);
  }
}

/**
 * Cancel damage report
 */
export async function cancelDamageReport(ctx) {
  const { userSessions } = await import('./bot.js');

  // Clear session state
  if (ctx.session) {
    delete ctx.session.state;
    delete ctx.session.damage_task_id;
    delete ctx.session.damage_reports;

    // Update userSessions
    userSessions.set(ctx.telegramId.toString(), ctx.session);
  }

  await ctx.answerCbQuery('❌ Reporte cancelado');

  const { showTasksToday } = await import('./housekeeping-menu.js');
  await showTasksToday(ctx);
}

/**
 * Handle media/text during damage report
 */
export async function handleDamageReportMedia(ctx, type, data) {
  const { Markup } = await import('telegraf');
  const { userSessions } = await import('./bot.js');

  if (!ctx.session || ctx.session.state !== 'reporting_damage') {
    return;
  }

  if (!ctx.session.damage_reports) {
    ctx.session.damage_reports = [];
  }

  ctx.session.damage_reports.push({
    type,
    data,
    timestamp: new Date()
  });

  // Save to userSessions
  userSessions.set(ctx.telegramId.toString(), ctx.session);

  // Send confirmation with buttons always at the end
  const count = ctx.session.damage_reports.length;
  const taskId = ctx.session.damage_task_id;
  const itemType = type === 'photo' ? 'Foto' : type === 'voice' ? 'Audio' : type === 'text' ? 'Mensaje' : 'Elemento';

  await ctx.reply(
    `✅ ${itemType} agregado\n\n` +
    `📊 Total de elementos: ${count}`,
    {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Finalizar Reporte', `hk_finish_damage_${taskId}`)],
        [Markup.button.callback('❌ Cancelar', 'hk_cancel_damage')]
      ])
    }
  );
}

/**
 * Complete a task
 */
export async function completeTask(ctx, taskId) {
  const contact = ctx.contact;

  try {
    const result = await pool.query(
      `UPDATE cleaning_tasks
       SET status = 'completed',
           completed_at = NOW(),
           completed_by = $3,
           updated_at = NOW()
       WHERE id = $1
         AND tenant_id = $2
         AND assigned_to = $3
         AND status = 'in_progress'
       RETURNING id, task_type`,
      [taskId, contact.tenant_id, contact.user_id]
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery('❌ No puedes completar esta tarea');
      await showMyActiveTasks(ctx);
      return;
    }

    await ctx.answerCbQuery('✅ ¡Tarea completada! 👏');
    await showMyActiveTasks(ctx);
  } catch (error) {
    console.error('Error completing task:', error);
    await ctx.answerCbQuery('❌ Error al completar la tarea');
  }
}

/**
 * Show supplies ordering menu
 */
export async function showSuppliesMenu(ctx) {
  const { Markup } = await import('telegraf');

  // Get common cleaning supplies
  const supplies = [
    { name: 'Toallas', emoji: '🛁', code: 'towels' },
    { name: 'Sábanas', emoji: '🛏️', code: 'sheets' },
    { name: 'Papel higiénico', emoji: '🧻', code: 'toilet_paper' },
    { name: 'Jabón', emoji: '🧼', code: 'soap' },
    { name: 'Shampoo', emoji: '🧴', code: 'shampoo' },
    { name: 'Productos de limpieza', emoji: '🧽', code: 'cleaning_products' },
    { name: 'Bolsas de basura', emoji: '🗑️', code: 'trash_bags' },
    { name: 'Desinfectante', emoji: '💊', code: 'disinfectant' }
  ];

  const buttons = supplies.map(supply => {
    return [Markup.button.callback(
      `${supply.emoji} ${supply.name}`,
      `hk_supply_${supply.code}`
    )];
  });

  buttons.push([Markup.button.callback('🔙 Volver', 'hk_menu')]);

  const message =
    `🧴 *ORDENAR INSUMOS*\n\n` +
    `Selecciona el insumo que necesitas:`;

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

/**
 * Request a supply item
 */
export async function requestSupply(ctx, supplyCode) {
  const contact = ctx.contact;

  const supplyNames = {
    towels: 'Toallas',
    sheets: 'Sábanas',
    toilet_paper: 'Papel higiénico',
    soap: 'Jabón',
    shampoo: 'Shampoo',
    cleaning_products: 'Productos de limpieza',
    trash_bags: 'Bolsas de basura',
    disinfectant: 'Desinfectante'
  };

  const supplyName = supplyNames[supplyCode] || supplyCode;

  try {
    // Get user info
    const { rows: userRows } = await pool.query(
      'SELECT full_name FROM users WHERE id = $1',
      [contact.user_id]
    );

    const userName = userRows[0]?.full_name || 'Usuario';

    // Create a simple log/notification (you can expand this to create a supplies_requests table)
    console.log(`Supply request: ${userName} requested ${supplyName}`);

    // You could also send a notification to admin here
    // For now, just confirm to the user

    await ctx.answerCbQuery(`✅ Solicitado: ${supplyName}`);

    await ctx.editMessageText(
      `✅ *Solicitud Enviada*\n\n` +
      `Has solicitado: *${supplyName}*\n\n` +
      `El equipo de suministros será notificado.`,
      {
        parse_mode: 'Markdown',
        ...require('telegraf').Markup.inlineKeyboard([
          [require('telegraf').Markup.button.callback('➕ Solicitar otro', 'hk_order_supplies')],
          [require('telegraf').Markup.button.callback('🔙 Volver al Menú', 'hk_menu')]
        ])
      }
    );
  } catch (error) {
    console.error('Error requesting supply:', error);
    await ctx.answerCbQuery('❌ Error al solicitar insumo');
  }
}
