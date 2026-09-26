/** Mapea los valores de la BD a la variante visual de badge. */

export const ESTADO_STYLE = {
  Nuevo: 'nuevo',
  'En Progreso': 'en-progreso',
  Resuelto: 'resuelto',
  Cerrado: 'cerrado',
};

export const CATEGORIA_STYLE = {
  Hardware: 'hardware',
  Software: 'software',
  Redes: 'redes',
  Accesos: 'accesos',
  Plataforma: 'plataforma',
};

export const estadoClase = (estado) => `badge badge--estado-${ESTADO_STYLE[estado] || 'default'}`;

export const categoriaClase = (categoria) =>
  `badge badge--categoria-${CATEGORIA_STYLE[categoria] || 'default'}`;
