import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mdclodging',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Support for DATABASE_URL (Heroku/Railway style)
if (process.env.DATABASE_URL) {
  config.connectionString = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === 'production') {
    config.ssl = {
      rejectUnauthorized: false
    };
  }
}

export const pool = new Pool(config);

// Error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

// Helper function to execute queries with tenant isolation
export async function queryWithTenant(text, params, tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required for this query');
  }

  // Automatically add tenant_id to WHERE clause
  const modifiedText = text.replace(/WHERE/i, `WHERE tenant_id = ${tenantId} AND`);
  return pool.query(modifiedText, params);
}

// Helper to get a single row
export async function queryOne(text, params) {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

// Helper to get all rows
export async function queryAll(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

// Transaction helper
export async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
