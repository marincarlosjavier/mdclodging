import { Markup } from 'telegraf';
import { pool } from '../config/database.js';
import { userSessions } from './bot.js';

/**
 * Show admin main menu
 */
export async function showAdminMenu(ctx) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.reply('❌ No estás vinculado al sistema.');
  }

  // Check if user has admin permissions
  const permissions = await pool.query(
    `SELECT tpc.code
     FROM telegram_contact_permissions tcp
     JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
     WHERE tcp.contact_id = $1 AND tpc.is_active = true`,
    [contact.id]
  );

  const permissionCodes = permissions.rows.map(p => p.code);
  const isAdmin = permissionCodes.includes('admin');

  if (!isAdmin) {
    return ctx.reply('❌ No tienes permisos de administrador.');
  }

  return ctx.reply(
    '⚙️ *MENÚ DE ADMINISTRACIÓN*\n\n' +
    'Selecciona una opción:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 Liquidaciones Pendientes', 'admin_settlements_pending')],
        [Markup.button.callback('💰 Registrar Pago', 'admin_register_payment')],
        [Markup.button.callback('💵 Gestionar Tarifas', 'admin_manage_rates')],
        [Markup.button.callback('🚪 Reportar Checkout', 'admin_report_checkout')],
        [Markup.button.callback('📊 Reportes', 'admin_reports')],
        [Markup.button.callback('🔙 Volver', 'main_menu')]
      ])
    }
  );
}

/**
 * Show pending settlements for approval
 */
export async function showPendingSettlements(ctx) {
  const contact = ctx.contact;

  try {
    const result = await pool.query(
      `SELECT cs.*, u.full_name as user_name
       FROM cleaning_settlements cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.tenant_id = $1 AND cs.status = 'submitted'
       ORDER BY cs.settlement_date DESC
       LIMIT 10`,
      [contact.tenant_id]
    );

    if (result.rows.length === 0) {
      return ctx.reply(
        '✅ *No hay liquidaciones pendientes*\n\n' +
        'Todas las liquidaciones están procesadas.',
        { parse_mode: 'Markdown' }
      );
    }

    let message = '📋 *LIQUIDACIONES PENDIENTES DE APROBACIÓN*\n\n';

    const buttons = [];

    result.rows.forEach((settlement, index) => {
      const date = new Date(settlement.settlement_date).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit'
      });

      message += `${index + 1}. *${settlement.user_name}*\n`;
      message += `   📅 ${date} | `;
      message += `📋 ${settlement.total_tasks} tareas | `;
      message += `💰 $${parseFloat(settlement.total_amount).toFixed(0)}\n\n`;

      buttons.push([
        Markup.button.callback(
          `${index + 1}. Ver y Revisar`,
          `admin_review_${settlement.id}`
        )
      ]);
    });

    buttons.push([Markup.button.callback('🔙 Volver', 'admin_menu')]);

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Error fetching pending settlements:', error);
    return ctx.reply('❌ Error al cargar liquidaciones pendientes.');
  }
}

/**
 * Show settlement detail for review
 */
export async function showSettlementForReview(ctx, settlementId) {
  try {
    const result = await pool.query(
      `SELECT cs.*, u.full_name as user_name, u.email as user_email
       FROM cleaning_settlements cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.id = $1`,
      [settlementId]
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery('❌ Liquidación no encontrada');
      return;
    }

    const settlement = result.rows[0];

    // Get items
    const itemsResult = await pool.query(
      `SELECT * FROM cleaning_settlement_items
       WHERE settlement_id = $1
       ORDER BY completed_at`,
      [settlementId]
    );

    const TASK_TYPE_EMOJI = {
      check_out: '🚪',
      stay_over: '🧹',
      deep_cleaning: '🧼'
    };

    let message = '📋 *DETALLE DE LIQUIDACIÓN*\n\n';
    message += `👤 *Usuario:* ${settlement.user_name}\n`;
    message += `📅 *Fecha:* ${new Date(settlement.settlement_date).toLocaleDateString('es-CO')}\n`;
    message += `📊 *Total tareas:* ${settlement.total_tasks}\n`;
    message += `💵 *Total a pagar:* $${parseFloat(settlement.total_amount).toFixed(0)}\n\n`;

    message += '*📝 Tareas realizadas:*\n\n';

    itemsResult.rows.forEach((item, index) => {
      const emoji = TASK_TYPE_EMOJI[item.task_type] || '🏠';
      message += `${index + 1}. ${emoji} *${item.property_name}*\n`;

      if (item.work_duration_minutes) {
        const hours = Math.floor(item.work_duration_minutes / 60);
        const minutes = item.work_duration_minutes % 60;
        const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        message += `   ⏱️ ${duration} | `;
      }

      message += `💰 $${parseFloat(item.rate).toFixed(0)}\n`;
    });

    await ctx.answerCbQuery();

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Aprobar', `approve_settlement_${settlementId}`),
          Markup.button.callback('❌ Rechazar', `reject_settlement_${settlementId}`)
        ],
        [Markup.button.callback('🔙 Volver', 'admin_settlements_pending')]
      ])
    });
  } catch (error) {
    console.error('Error showing settlement detail:', error);
    await ctx.answerCbQuery('❌ Error al cargar detalle');
  }
}

/**
 * Approve settlement
 */
export async function approveSettlement(ctx, settlementId) {
  const contact = ctx.contact;

  try {
    const result = await pool.query(
      `UPDATE cleaning_settlements
       SET status = 'approved',
           reviewed_by = $1,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND status = 'submitted'
       RETURNING *, (SELECT full_name FROM users WHERE id = user_id) as user_name`,
      [contact.user_id, settlementId, contact.tenant_id]
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery('❌ No se pudo aprobar');
      return;
    }

    const settlement = result.rows[0];

    await ctx.answerCbQuery('✅ Liquidación aprobada!');

    // Notify the user
    try {
      const userContact = await pool.query(
        'SELECT telegram_id FROM telegram_contacts WHERE user_id = $1 AND is_linked = true',
        [settlement.user_id]
      );

      if (userContact.rows.length > 0) {
        await ctx.telegram.sendMessage(
          userContact.rows[0].telegram_id,
          `✅ *Liquidación Aprobada*\n\n` +
          `Tu liquidación del ${new Date(settlement.settlement_date).toLocaleDateString('es-CO')} ` +
          `ha sido aprobada por valor de $${parseFloat(settlement.total_amount).toFixed(0)}.\n\n` +
          `El pago será procesado próximamente.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (notifyError) {
      console.error('Error notifying user:', notifyError);
    }

    return ctx.reply(
      `✅ *Liquidación Aprobada*\n\n` +
      `Usuario: ${settlement.user_name}\n` +
      `Monto: $${parseFloat(settlement.total_amount).toFixed(0)}\n\n` +
      `Ahora puedes registrar el pago cuando lo efectúes.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💰 Registrar Pago Ahora', `admin_pay_${settlementId}`)],
          [Markup.button.callback('🔙 Ver Pendientes', 'admin_settlements_pending')]
        ])
      }
    );
  } catch (error) {
    console.error('Error approving settlement:', error);
    await ctx.answerCbQuery('❌ Error al aprobar');
  }
}

/**
 * Start rejection flow (ask for reason)
 */
export async function startRejectSettlement(ctx, settlementId) {
  await ctx.answerCbQuery();

  // Store settlement ID in session
  const session = ctx.session || {};
  session.rejectingSettlement = settlementId;
  userSessions.set(ctx.telegramId.toString(), session);

  return ctx.reply(
    '❌ *Rechazar Liquidación*\n\n' +
    'Por favor escribe el motivo del rechazo.\n' +
    'El usuario recibirá esta explicación.\n\n' +
    'Usa /cancel para cancelar.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle rejection reason input
 */
export async function handleRejectReason(ctx, reason, settlementId) {
  const contact = ctx.contact;

  if (!reason || reason.trim().length < 5) {
    return ctx.reply(
      '⚠️ *Motivo muy corto*\n\n' +
      'Por favor proporciona un motivo más detallado (mínimo 5 caracteres).\n\n' +
      'Usa /cancel para cancelar.',
      { parse_mode: 'Markdown' }
    );
  }

  try {
    const result = await pool.query(
      `UPDATE cleaning_settlements
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_notes = $2,
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 AND status = 'submitted'
       RETURNING *, (SELECT full_name FROM users WHERE id = user_id) as user_name`,
      [contact.user_id, reason.trim(), settlementId, contact.tenant_id]
    );

    if (result.rows.length === 0) {
      userSessions.delete(ctx.telegramId.toString());
      return ctx.reply('❌ No se pudo rechazar la liquidación. Puede que ya haya sido procesada.');
    }

    const settlement = result.rows[0];

    // Clear session
    userSessions.delete(ctx.telegramId.toString());

    // Notify the user
    try {
      const userContact = await pool.query(
        'SELECT telegram_id FROM telegram_contacts WHERE user_id = $1 AND is_linked = true',
        [settlement.user_id]
      );

      if (userContact.rows.length > 0) {
        await ctx.telegram.sendMessage(
          userContact.rows[0].telegram_id,
          `❌ *Liquidación Rechazada*\n\n` +
          `Tu liquidación del ${new Date(settlement.settlement_date).toLocaleDateString('es-CO')} ` +
          `ha sido rechazada.\n\n` +
          `*Motivo:*\n${reason.trim()}\n\n` +
          `Por favor revisa las tareas y vuelve a reportar.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (notifyError) {
      console.error('Error notifying user:', notifyError);
    }

    return ctx.reply(
      `❌ *Liquidación Rechazada*\n\n` +
      `Usuario: ${settlement.user_name}\n` +
      `Motivo: ${reason.trim()}\n\n` +
      `El usuario ha sido notificado.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver Pendientes', 'admin_settlements_pending')],
          [Markup.button.callback('🔙 Menú Admin', 'admin_menu')]
        ])
      }
    );
  } catch (error) {
    console.error('Error rejecting settlement:', error);
    userSessions.delete(ctx.telegramId.toString());
    return ctx.reply('❌ Error al rechazar liquidación.');
  }
}

/**
 * Show approved settlements ready for payment
 */
export async function showApprovedSettlements(ctx) {
  const contact = ctx.contact;

  try {
    const result = await pool.query(
      `SELECT cs.*, u.full_name as user_name,
              COALESCE((SELECT SUM(amount) FROM cleaning_payments WHERE settlement_id = cs.id), 0) as paid_amount
       FROM cleaning_settlements cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.tenant_id = $1 AND cs.status = 'approved'
       ORDER BY cs.settlement_date DESC
       LIMIT 10`,
      [contact.tenant_id]
    );

    if (result.rows.length === 0) {
      return ctx.reply(
        '✅ *No hay liquidaciones por pagar*\n\n' +
        'Todas las liquidaciones aprobadas han sido pagadas.',
        { parse_mode: 'Markdown' }
      );
    }

    let message = '💰 *LIQUIDACIONES APROBADAS - REGISTRAR PAGO*\n\n';

    const buttons = [];

    result.rows.forEach((settlement, index) => {
      const date = new Date(settlement.settlement_date).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit'
      });
      const pending = parseFloat(settlement.total_amount) - parseFloat(settlement.paid_amount);

      message += `${index + 1}. *${settlement.user_name}*\n`;
      message += `   📅 ${date} | `;
      message += `💵 Total: $${parseFloat(settlement.total_amount).toFixed(0)} | `;
      message += `💰 Pendiente: $${pending.toFixed(0)}\n\n`;

      buttons.push([
        Markup.button.callback(
          `${index + 1}. Pagar $${pending.toFixed(0)}`,
          `admin_pay_${settlement.id}`
        )
      ]);
    });

    buttons.push([Markup.button.callback('🔙 Volver', 'admin_menu')]);

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Error fetching approved settlements:', error);
    return ctx.reply('❌ Error al cargar liquidaciones.');
  }
}

/**
 * Start payment flow
 */
export async function startPaymentFlow(ctx, settlementId) {
  await ctx.answerCbQuery();

  try {
    const result = await pool.query(
      `SELECT cs.*, u.full_name as user_name,
              COALESCE((SELECT SUM(amount) FROM cleaning_payments WHERE settlement_id = cs.id), 0) as paid_amount
       FROM cleaning_settlements cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.id = $1`,
      [settlementId]
    );

    if (result.rows.length === 0) {
      return ctx.reply('❌ Liquidación no encontrada.');
    }

    const settlement = result.rows[0];
    const pending = parseFloat(settlement.total_amount) - parseFloat(settlement.paid_amount);

    // Store in session
    const session = ctx.session || {};
    session.payingSettlement = settlementId;
    session.paymentAmount = pending;
    ctx.telegram.context.session = session;

    return ctx.reply(
      `💰 *Registrar Pago*\n\n` +
      `Usuario: ${settlement.user_name}\n` +
      `Fecha: ${new Date(settlement.settlement_date).toLocaleDateString('es-CO')}\n` +
      `Monto pendiente: *$${pending.toFixed(0)}*\n\n` +
      `Selecciona el método de pago:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💵 Efectivo', `pay_method_cash_${settlementId}`)],
          [Markup.button.callback('🏦 Transferencia', `pay_method_transfer_${settlementId}`)],
          [Markup.button.callback('📄 Cheque', `pay_method_check_${settlementId}`)],
          [Markup.button.callback('🔙 Cancelar', 'admin_register_payment')]
        ])
      }
    );
  } catch (error) {
    console.error('Error starting payment flow:', error);
    return ctx.reply('❌ Error al iniciar pago.');
  }
}

/**
 * Confirm and register payment
 */
export async function registerPayment(ctx, settlementId, method) {
  const contact = ctx.contact;

  try {
    await ctx.answerCbQuery();

    const result = await pool.query(
      `SELECT cs.*, u.full_name as user_name,
              COALESCE((SELECT SUM(amount) FROM cleaning_payments WHERE settlement_id = cs.id), 0) as paid_amount
       FROM cleaning_settlements cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.id = $1`,
      [settlementId]
    );

    if (result.rows.length === 0) {
      return ctx.reply('❌ Liquidación no encontrada.');
    }

    const settlement = result.rows[0];
    const pending = parseFloat(settlement.total_amount) - parseFloat(settlement.paid_amount);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Register payment
      await client.query(
        `INSERT INTO cleaning_payments (
          settlement_id, amount, payment_date, payment_method, paid_by
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
        [settlementId, pending, method, contact.user_id]
      );

      // Update settlement status to paid if fully paid
      if (pending >= parseFloat(settlement.total_amount)) {
        await client.query(
          'UPDATE cleaning_settlements SET status = $1, updated_at = NOW() WHERE id = $2',
          ['paid', settlementId]
        );
      }

      await client.query('COMMIT');

      // Notify user
      try {
        const userContact = await pool.query(
          'SELECT telegram_id FROM telegram_contacts WHERE user_id = $1 AND is_linked = true',
          [settlement.user_id]
        );

        if (userContact.rows.length > 0) {
          const methodLabels = {
            cash: 'Efectivo',
            transfer: 'Transferencia',
            check: 'Cheque'
          };

          await ctx.telegram.sendMessage(
            userContact.rows[0].telegram_id,
            `💰 *Pago Registrado*\n\n` +
            `Tu liquidación del ${new Date(settlement.settlement_date).toLocaleDateString('es-CO')} ` +
            `ha sido pagada.\n\n` +
            `Monto: $${pending.toFixed(0)}\n` +
            `Método: ${methodLabels[method] || method}\n\n` +
            `¡Gracias por tu trabajo! 🎉`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (notifyError) {
        console.error('Error notifying user:', notifyError);
      }

      return ctx.reply(
        `✅ *Pago Registrado*\n\n` +
        `Usuario: ${settlement.user_name}\n` +
        `Monto: $${pending.toFixed(0)}\n` +
        `Método: ${method}\n\n` +
        `El usuario ha sido notificado.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💰 Registrar Otro Pago', 'admin_register_payment')],
            [Markup.button.callback('🔙 Menú Admin', 'admin_menu')]
          ])
        }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error registering payment:', error);
    return ctx.reply('❌ Error al registrar pago.');
  }
}

/**
 * Show rates management
 */
export async function showRatesManagement(ctx) {
  const contact = ctx.contact;

  try {
    const result = await pool.query(
      `SELECT cr.*, pt.name as property_type_name
       FROM cleaning_rates cr
       LEFT JOIN property_types pt ON pt.id = cr.property_type_id
       WHERE cr.tenant_id = $1
       ORDER BY pt.name, cr.task_type`,
      [contact.tenant_id]
    );

    const TASK_TYPE_EMOJI = {
      check_out: '🚪',
      stay_over: '🧹',
      deep_cleaning: '🧼'
    };

    const TASK_TYPE_LABELS = {
      check_out: 'CHECK OUT',
      stay_over: 'STAY OVER',
      deep_cleaning: 'DEEP CLEANING'
    };

    let message = '💵 *TARIFAS DE PAGO*\n\n';

    if (result.rows.length === 0) {
      message += 'No hay tarifas configuradas.\n\n';
    } else {
      result.rows.forEach((rate) => {
        const emoji = TASK_TYPE_EMOJI[rate.task_type] || '🏠';
        message += `${emoji} *${rate.property_type_name}* - ${TASK_TYPE_LABELS[rate.task_type]}\n`;
        message += `   💰 $${parseFloat(rate.rate).toFixed(0)}\n\n`;
      });
    }

    message += '💡 Usa la web para gestionar tarifas:\n';
    message += 'Menu → Liquidaciones → Tab Tarifas';

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Volver', 'admin_menu')]
      ])
    });
  } catch (error) {
    console.error('Error showing rates:', error);
    return ctx.reply('❌ Error al cargar tarifas.');
  }
}

/**
 * Show properties for checkout reporting
 */
export async function showPropertiesForCheckout(ctx) {
  const contact = ctx.contact;

  try {
    // Get today's checkouts
    const result = await pool.query(
      `SELECT r.id, r.actual_checkout_time, r.adults, r.children, r.infants,
              p.name as property_name, pt.name as property_type_name
       FROM reservations r
       LEFT JOIN properties p ON p.id = r.property_id
       LEFT JOIN property_types pt ON pt.id = p.property_type_id
       WHERE r.tenant_id = $1
         AND r.check_out_date = CURRENT_DATE
         AND r.status = 'active'
       ORDER BY r.checkout_time NULLS LAST, p.name`,
      [contact.tenant_id]
    );

    if (result.rows.length === 0) {
      return ctx.reply(
        '✅ *No hay checkouts programados para hoy*',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Volver', 'admin_menu')]
          ])
        }
      );
    }

    let message = '🚪 *CHECKOUTS DE HOY*\n\n';

    const buttons = [];

    result.rows.forEach((checkout, index) => {
      const totalGuests = (checkout.adults || 0) + (checkout.children || 0) + (checkout.infants || 0);
      const status = checkout.actual_checkout_time ? '✅' : '⏰';

      message += `${status} ${index + 1}. *${checkout.property_name}*\n`;
      message += `   🏷️ ${checkout.property_type_name}\n`;
      message += `   👥 ${totalGuests} huésped${totalGuests !== 1 ? 'es' : ''}\n`;

      if (checkout.actual_checkout_time) {
        const time = new Date(checkout.actual_checkout_time).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        });
        message += `   ⏰ Reportado: ${time}\n`;
      } else {
        buttons.push([
          Markup.button.callback(
            `${index + 1}. Reportar Checkout`,
            `checkout_report_${checkout.id}`
          )
        ]);
      }

      message += '\n';
    });

    buttons.push([Markup.button.callback('🔙 Volver', 'admin_menu')]);

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Error showing checkouts:', error);
    return ctx.reply('❌ Error al cargar checkouts.');
  }
}

/**
 * Report checkout
 */
export async function reportCheckout(ctx, reservationId) {
  const contact = ctx.contact;

  try {
    await ctx.answerCbQuery();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get reservation
      const resResult = await client.query(
        `SELECT r.*, p.name as property_name
         FROM reservations r
         LEFT JOIN properties p ON p.id = r.property_id
         WHERE r.id = $1 AND r.tenant_id = $2`,
        [reservationId, contact.tenant_id]
      );

      if (resResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return ctx.reply('❌ Reservación no encontrada.');
      }

      const reservation = resResult.rows[0];

      // Update reservation
      await client.query(
        `UPDATE reservations
         SET actual_checkout_time = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [reservationId]
      );

      // Create or update cleaning task
      const taskCheck = await client.query(
        `SELECT id FROM cleaning_tasks
         WHERE reservation_id = $1 AND task_type = 'check_out'`,
        [reservationId]
      );

      if (taskCheck.rows.length > 0) {
        await client.query(
          `UPDATE cleaning_tasks
           SET status = 'pending',
               checkout_reported_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [taskCheck.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO cleaning_tasks (
            tenant_id, property_id, reservation_id, task_type,
            scheduled_date, status, checkout_reported_at
          ) VALUES ($1, $2, $3, 'check_out', CURRENT_DATE, 'pending', NOW())`,
          [contact.tenant_id, reservation.property_id, reservationId]
        );
      }

      await client.query('COMMIT');

      // Notify housekeeping
      const { notifyCheckout } = await import('./bot.js');
      await notifyCheckout(contact.tenant_id, {
        reservation_id: reservationId,
        property_name: reservation.property_name,
        checkout_time: reservation.checkout_time,
        actual_checkout_time: new Date(),
        adults: reservation.adults,
        children: reservation.children,
        infants: reservation.infants
      });

      return ctx.reply(
        `✅ *Checkout Reportado*\n\n` +
        `📍 Propiedad: ${reservation.property_name}\n` +
        `⏰ Hora: ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}\n\n` +
        `Se ha notificado al equipo de housekeeping.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚪 Ver Checkouts', 'admin_report_checkout')],
            [Markup.button.callback('🔙 Menú Admin', 'admin_menu')]
          ])
        }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reporting checkout:', error);
    return ctx.reply('❌ Error al reportar checkout.');
  }
}

/**
 * Show cleaning tasks available for assignment
 */
export async function showTasksForAssignment(ctx) {
  const contact = ctx.contact;

  if (!contact.user_id) {
    return ctx.reply('❌ No estás vinculado al sistema.');
  }

  // Get user role
  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [contact.user_id]
  );

  if (!userRows.length || !['admin', 'supervisor'].includes(userRows[0].role)) {
    return ctx.reply('❌ No tienes permisos para asignar tareas.');
  }

  // Get pending cleaning tasks
  const result = await pool.query(
    `SELECT ct.id, ct.task_type, ct.checkout_reported_at, ct.scheduled_date, ct.is_priority,
            p.name as property_name, pt.name as property_type_name,
            r.adults, r.children, r.infants
     FROM cleaning_tasks ct
     LEFT JOIN properties p ON p.id = ct.property_id
     LEFT JOIN property_types pt ON pt.id = p.property_type_id
     LEFT JOIN reservations r ON r.id = ct.reservation_id
     WHERE ct.tenant_id = $1
       AND ct.status = 'pending'
       AND ct.assigned_to IS NULL
     ORDER BY ct.is_priority DESC NULLS LAST, ct.checkout_reported_at, ct.scheduled_date, ct.created_at
     LIMIT 10`,
    [contact.tenant_id]
  );

  if (result.rows.length === 0) {
    return ctx.editMessageText(
      '✨ *No hay tareas pendientes de asignar*\n\n' +
      'Todas las tareas están asignadas o completadas.',
      { parse_mode: 'Markdown' }
    );
  }

  const TASK_TYPE_EMOJI = {
    check_out: '🚪',
    stay_over: '🧹',
    deep_cleaning: '🧼'
  };

  const TASK_TYPE_LABELS = {
    check_out: 'CHECK OUT',
    stay_over: 'STAY OVER',
    deep_cleaning: 'DEEP CLEANING'
  };

  let message = '👥 *ASIGNAR TAREAS DE LIMPIEZA*\n\n';
  message += `Selecciona una tarea para asignar a un empleado:\n\n`;

  const buttons = [];

  for (const task of result.rows) {
    const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';
    const typeLabel = TASK_TYPE_LABELS[task.task_type] || task.task_type;
    const totalGuests = (task.adults || 0) + (task.children || 0) + (task.infants || 0);
    const priorityTag = task.is_priority ? ' 🔴 *PRIORIDAD*' : '';
    const priorityButton = task.is_priority ? '🔴 ' : '';

    message += `${emoji} *${typeLabel}*${priorityTag}\n`;
    message += `📍 ${task.property_name}\n`;
    if (totalGuests > 0) {
      message += `👥 ${totalGuests} huéspedes\n`;
    }
    message += `\n`;

    buttons.push([
      Markup.button.callback(
        `${priorityButton}${emoji} ${task.property_name} - ${typeLabel}`,
        `assign_select_task_${task.id}`
      )
    ]);
  }

  buttons.push([Markup.button.callback('🔙 Volver', 'main_menu')]);

  return ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

/**
 * Show housekeeping staff to assign task to
 */
export async function showHousekeepingStaff(ctx, taskId) {
  const contact = ctx.contact;

  // Get task details
  const taskResult = await pool.query(
    `SELECT ct.*, p.name as property_name
     FROM cleaning_tasks ct
     LEFT JOIN properties p ON p.id = ct.property_id
     WHERE ct.id = $1 AND ct.tenant_id = $2`,
    [taskId, contact.tenant_id]
  );

  if (taskResult.rows.length === 0) {
    return ctx.answerCbQuery('❌ Tarea no encontrada');
  }

  const task = taskResult.rows[0];

  if (task.assigned_to) {
    return ctx.answerCbQuery('❌ Esta tarea ya está asignada');
  }

  // Get housekeeping staff
  const staffResult = await pool.query(
    `SELECT u.id, u.full_name,
            COUNT(DISTINCT ct.id) as active_tasks
     FROM users u
     LEFT JOIN cleaning_tasks ct ON ct.assigned_to = u.id
       AND ct.status IN ('pending', 'in_progress')
     WHERE u.tenant_id = $1
       AND u.role = 'housekeeping'
       AND u.is_active = true
     GROUP BY u.id, u.full_name
     ORDER BY active_tasks ASC, u.full_name`,
    [contact.tenant_id]
  );

  if (staffResult.rows.length === 0) {
    return ctx.editMessageText(
      '❌ *No hay empleados de housekeeping disponibles*\n\n' +
      'Contacta al administrador.',
      { parse_mode: 'Markdown' }
    );
  }

  const TASK_TYPE_LABELS = {
    check_out: 'CHECK OUT',
    stay_over: 'STAY OVER',
    deep_cleaning: 'DEEP CLEANING'
  };

  let message = '👥 *ASIGNAR TAREA*\n\n';
  message += `📍 Propiedad: *${task.property_name}*\n`;
  message += `🧹 Tipo: ${TASK_TYPE_LABELS[task.task_type]}\n\n`;
  message += `Selecciona el empleado:\n\n`;

  const buttons = [];

  for (const staff of staffResult.rows) {
    const tasksInfo = staff.active_tasks > 0 ? ` (${staff.active_tasks} activas)` : ' ✅';
    buttons.push([
      Markup.button.callback(
        `${staff.full_name}${tasksInfo}`,
        `assign_confirm_${taskId}_${staff.id}`
      )
    ]);
  }

  buttons.push([Markup.button.callback('🔙 Volver', 'assign_tasks')]);

  return ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

/**
 * Assign task to staff member
 */
export async function assignTaskToStaff(ctx, taskId, staffId) {
  const contact = ctx.contact;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify task is still available
    const taskCheck = await client.query(
      `SELECT ct.*, p.name as property_name, pt.name as property_type_name
       FROM cleaning_tasks ct
       LEFT JOIN properties p ON p.id = ct.property_id
       LEFT JOIN property_types pt ON pt.id = p.property_type_id
       WHERE ct.id = $1 AND ct.tenant_id = $2 AND ct.assigned_to IS NULL`,
      [taskId, contact.tenant_id]
    );

    if (taskCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return ctx.answerCbQuery('❌ Esta tarea ya no está disponible');
    }

    const task = taskCheck.rows[0];

    // Get staff member info
    const staffResult = await client.query(
      'SELECT full_name FROM users WHERE id = $1',
      [staffId]
    );

    if (staffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return ctx.answerCbQuery('❌ Empleado no encontrado');
    }

    const staffName = staffResult.rows[0].full_name;

    // Assign task
    await client.query(
      `UPDATE cleaning_tasks
       SET assigned_to = $1,
           assigned_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [staffId, taskId]
    );

    await client.query('COMMIT');

    const TASK_TYPE_LABELS = {
      check_out: 'CHECK OUT',
      stay_over: 'STAY OVER',
      deep_cleaning: 'DEEP CLEANING'
    };

    // Notify the assigned staff member via Telegram (if they have telegram linked)
    const telegramResult = await pool.query(
      `SELECT telegram_id FROM telegram_contacts
       WHERE user_id = $1 AND is_linked = true AND is_active = true`,
      [staffId]
    );

    if (telegramResult.rows.length > 0) {
      const { getBotInstance } = await import('./bot.js');
      const bot = getBotInstance(contact.tenant_id);

      if (bot) {
        try {
          const TASK_TYPE_EMOJI = {
            check_out: '🚪',
            stay_over: '🧹',
            deep_cleaning: '🧼'
          };

          const emoji = TASK_TYPE_EMOJI[task.task_type] || '🏠';

          await bot.telegram.sendMessage(
            telegramResult.rows[0].telegram_id,
            `📋 *NUEVA TAREA ASIGNADA*\n\n` +
            `${emoji} *${TASK_TYPE_LABELS[task.task_type]}*\n` +
            `📍 Propiedad: *${task.property_name}*\n` +
            `🏷️ Tipo: ${task.property_type_name}\n\n` +
            `Asignada por tu supervisor.\n` +
            `Usa /tareas para ver los detalles.`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          console.error('Error notifying staff member:', error);
        }
      }
    }

    await ctx.answerCbQuery('✅ Tarea asignada correctamente');

    return ctx.editMessageText(
      `✅ *Tarea Asignada*\n\n` +
      `📍 Propiedad: *${task.property_name}*\n` +
      `🧹 Tipo: ${TASK_TYPE_LABELS[task.task_type]}\n` +
      `👤 Asignada a: *${staffName}*\n\n` +
      `Se ha notificado al empleado.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('👥 Asignar Otra', 'assign_tasks')],
          [Markup.button.callback('🔙 Menú Principal', 'main_menu')]
        ])
      }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning task:', error);
    return ctx.answerCbQuery('❌ Error asignando tarea');
  } finally {
    client.release();
  }
}

export default {
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
  showTasksForAssignment,
  showHousekeepingStaff,
  assignTaskToStaff
};
