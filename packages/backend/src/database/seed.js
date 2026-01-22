import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create demo tenant
    const tenantResult = await pool.query(
      `INSERT INTO tenants (name, subdomain, email, phone, plan_type, max_users, max_tasks_per_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (subdomain) DO NOTHING
       RETURNING id`,
      ['Hotel Demo', 'demo', 'admin@demo.com', '+1234567890', 'pro', 50, 5000]
    );

    let tenantId;
    if (tenantResult.rows.length > 0) {
      tenantId = tenantResult.rows[0].id;
      console.log(`  ✅ Created demo tenant (ID: ${tenantId})`);
    } else {
      // Get existing tenant
      const existing = await pool.query(
        `SELECT id FROM tenants WHERE subdomain = $1`,
        ['demo']
      );
      tenantId = existing.rows[0].id;
      console.log(`  ℹ️  Demo tenant already exists (ID: ${tenantId})`);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const apiToken = uuidv4();

    const userResult = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role, api_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           api_token = EXCLUDED.api_token
       RETURNING id, email, api_token`,
      [tenantId, 'admin@demo.com', hashedPassword, 'Admin Demo', 'admin', apiToken]
    );

    console.log(`  ✅ Created/updated admin user`);
    console.log(`     Email: ${userResult.rows[0].email}`);
    console.log(`     Password: admin123`);
    console.log(`     API Token: ${userResult.rows[0].api_token}`);

    // Create sample users
    const sampleUsers = [
      { email: 'supervisor@demo.com', name: 'Juan Supervisor', role: 'supervisor', password: 'super123' },
      { email: 'maria@demo.com', name: 'María Housekeeping', role: 'housekeeping', password: 'maria123' },
      { email: 'carlos@demo.com', name: 'Carlos Mantenimiento', role: 'maintenance', password: 'carlos123' }
    ];

    for (const user of sampleUsers) {
      const hash = await bcrypt.hash(user.password, 10);
      await pool.query(
        `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [tenantId, user.email, hash, user.name, user.role]
      );
      console.log(`  ✅ Created ${user.role}: ${user.email} (password: ${user.password})`);
    }

    // Create default system settings
    const settings = [
      { key: 'telegram_bot_enabled', value: 'false', type: 'boolean', desc: 'Enable/disable Telegram bot' },
      { key: 'telegram_bot_token', value: '', type: 'string', desc: 'Bot token from @BotFather' },
      { key: 'telegram_bot_username', value: '', type: 'string', desc: 'Bot username' },
      { key: 'task_auto_assign', value: 'false', type: 'boolean', desc: 'Auto-assign tasks based on workload' },
      { key: 'notification_enabled', value: 'true', type: 'boolean', desc: 'Enable notifications' }
    ];

    for (const setting of settings) {
      await pool.query(
        `INSERT INTO system_settings (tenant_id, setting_key, setting_value, setting_type, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, setting_key) DO NOTHING`,
        [tenantId, setting.key, setting.value, setting.type, setting.desc]
      );
    }

    console.log(`  ✅ Created system settings`);

    // Create sample tasks
    const adminUser = await pool.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND role = 'admin' LIMIT 1`,
      [tenantId]
    );
    const housekeepingUser = await pool.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND role = 'housekeeping' LIMIT 1`,
      [tenantId]
    );

    const sampleTasks = [
      {
        title: 'Limpieza habitación 101',
        description: 'Limpieza profunda después de check-out',
        type: 'cleaning',
        location: 'Piso 1',
        room: '101',
        priority: 'high',
        assignedTo: housekeepingUser.rows[0]?.id
      },
      {
        title: 'Revisar aire acondicionado 205',
        description: 'Cliente reporta que no enfría correctamente',
        type: 'maintenance',
        location: 'Piso 2',
        room: '205',
        priority: 'urgent',
        assignedTo: null
      },
      {
        title: 'Limpieza área común - Lobby',
        description: 'Limpieza diaria del lobby',
        type: 'cleaning',
        location: 'Lobby',
        room: null,
        priority: 'medium',
        assignedTo: housekeepingUser.rows[0]?.id
      }
    ];

    for (const task of sampleTasks) {
      await pool.query(
        `INSERT INTO tasks (tenant_id, title, description, task_type, location, room_number, priority, assigned_to, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tenantId,
          task.title,
          task.description,
          task.type,
          task.location,
          task.room,
          task.priority,
          task.assignedTo,
          adminUser.rows[0].id
        ]
      );
    }

    console.log(`  ✅ Created ${sampleTasks.length} sample tasks`);

    console.log('\n✅ Database seeded successfully!\n');
    console.log('📝 Login credentials:');
    console.log('   Admin: admin@demo.com / admin123');
    console.log('   Supervisor: supervisor@demo.com / super123');
    console.log('   Housekeeping: maria@demo.com / maria123');
    console.log('   Maintenance: carlos@demo.com / carlos123\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
