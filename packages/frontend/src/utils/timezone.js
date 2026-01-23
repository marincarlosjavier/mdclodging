/**
 * Timezone utilities for Colombia (UTC-5)
 */

const COLOMBIA_TZ = 'America/Bogota';

/**
 * Get current date/time in Colombia timezone
 * @returns {Date} Date object representing current time in Colombia
 */
export function getColombiaTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: COLOMBIA_TZ }));
}

/**
 * Convert a date string to Colombia timezone
 * @param {string} dateString - ISO date string or date string
 * @returns {Date} Date object in Colombia timezone
 */
export function toColombiaTime(dateString) {
  const date = new Date(dateString);
  return new Date(date.toLocaleString('en-US', { timeZone: COLOMBIA_TZ }));
}

/**
 * Create a Date with specific time in Colombia timezone and convert to ISO string
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timeStr - Time in HH:MM format
 * @returns {string} ISO string representing the date/time in UTC
 */
export function createColombiaDateTime(dateStr, timeStr) {
  // Parse the input
  const [hours, minutes] = timeStr.split(':').map(Number);
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create date string in Colombia timezone
  const colombiaDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // Create a date treating it as Colombia time
  const date = new Date(colombiaDateStr);

  // Get the timezone offset for Colombia (UTC-5 = 300 minutes)
  const colombiaOffset = 5 * 60; // Colombia is UTC-5
  const localOffset = date.getTimezoneOffset(); // Browser's offset from UTC in minutes

  // Adjust for the difference between local timezone and Colombia timezone
  const offsetDiff = localOffset + colombiaOffset;
  date.setMinutes(date.getMinutes() - offsetDiff);

  return date.toISOString();
}

/**
 * Format a date/time string to Colombia timezone
 * @param {string} dateString - ISO date string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date/time string
 */
export function formatColombiaTime(dateString, options = { hour: '2-digit', minute: '2-digit' }) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-CO', { ...options, timeZone: COLOMBIA_TZ });
}

/**
 * Format a date to Colombia timezone
 * @param {string} dateString - ISO date string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatColombiaDate(dateString, options = {}) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', { ...options, timeZone: COLOMBIA_TZ });
}

/**
 * Get today's date in Colombia timezone in YYYY-MM-DD format
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getTodayInColombia() {
  const now = new Date();
  const colombiaDateStr = now.toLocaleString('en-US', {
    timeZone: COLOMBIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Parse from "MM/DD/YYYY" to "YYYY-MM-DD"
  const [month, day, year] = colombiaDateStr.split('/');
  return `${year}-${month}-${day}`;
}
