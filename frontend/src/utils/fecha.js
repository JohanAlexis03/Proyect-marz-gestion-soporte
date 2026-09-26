/**
 * Utilidades de fecha para la Plataforma de Soporte Interno - MAR-Z.
 *
 * Dos trampas de zona horaria que este módulo resuelve:
 *
 * 1. `solicitud.fecha` llega como timestamp UTC SIN sufijo de zona
 *    ("2026-09-26T03:37:54"). La spec de ECMAScript dice que una fecha sin
 *    offset se interpreta como HORA LOCAL, así que en un equipo UTC-5 se leía
 *    5 horas adelantada. Se marca explícitamente con "Z".
 *
 * 2. `historial[].fecha` llega SOLO con fecha ("2026-09-24"). Las formas de
 *    fecha pura se interpretan como MEDIANOCA UTC, así que en UTC-5 caía un
 *    día antes (mostraba 23 en vez de 24). Se construye como fecha local.
 */

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_SIN_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sept', 'oct', 'nov', 'dic',
];

const pad = (valor) => String(valor).padStart(2, '0');

/** Marca explícitamente como UTC un timestamp que viene sin offset. */
export function aUTC(value) {
  return typeof value === 'string' && FECHA_SIN_OFFSET.test(value) ? `${value}Z` : value;
}

/** Convierte cualquier fecha recibida a un objeto Date correcto en hora local. */
function aFechaLocal(value) {
  if (typeof value !== 'string') return new Date(NaN);

  if (SOLO_FECHA.test(value)) {
    const [anio, mes, dia] = value.split('-').map(Number);
    return new Date(anio, mes - 1, dia);
  }

  return new Date(aUTC(value));
}

/** Formatea una fecha con hora como "25 sept 2026, 09:30 PM" (hora local). */
export function formatFecha(value) {
  const date = aFechaLocal(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  const hora24 = date.getHours();
  const hora12 = pad(hora24 % 12 === 0 ? 12 : hora24 % 12);

  return `${pad(date.getDate())} ${MESES[date.getMonth()]} ${date.getFullYear()}, ${hora12}:${pad(
    date.getMinutes()
  )} ${hora24 >= 12 ? 'PM' : 'AM'}`;
}

/** Formatea solo la fecha como "24 sept 2026" (hora local). */
export function formatFechaCorta(value) {
  const date = aFechaLocal(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  return `${pad(date.getDate())} ${MESES[date.getMonth()]} ${date.getFullYear()}`;
}
