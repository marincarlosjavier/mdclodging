/**
 * User roles and translations
 */

// Valid role values (stored in database)
export const VALID_ROLES = [
  'admin',
  'supervisor',
  'housekeeping',
  'maintenance',
  'skater'
];

// Role translations (English -> Spanish)
export const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  housekeeping: 'Housekeeping',
  maintenance: 'Mantenimiento',
  skater: 'Patinador'
};

// Role descriptions
export const ROLE_DESCRIPTIONS = {
  admin: 'Acceso completo al sistema',
  supervisor: 'Gestión de tareas y personal',
  housekeeping: 'Limpieza y mantenimiento de habitaciones',
  maintenance: 'Mantenimiento técnico y reparaciones',
  skater: 'Entregas y servicios rápidos'
};

// Get role label in Spanish
export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

// Get multiple role labels
export function getRoleLabels(roles) {
  if (!Array.isArray(roles)) return [];
  return roles.map(role => getRoleLabel(role));
}

// Check if role is valid
export function isValidRole(role) {
  return VALID_ROLES.includes(role);
}
