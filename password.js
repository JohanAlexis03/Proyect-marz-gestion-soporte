// ============================================================================
// Contraseñas con scrypt
// La contraseña nunca se guarda en texto plano ni se compara como texto plano.
// crypto viene con Node: no se agrega ninguna dependencia.
//
// Formato guardado en usuarios.contrasena:
//   scrypt$<sal en hex>$<hash en hex>
//
// Uso:
//   node password.js "MiClave"   -> imprime el hash para una fila nueva
//   node password.js --migrar     -> convierte a hash las filas en texto plano
// ============================================================================
const crypto = require('crypto');

const SAL_BYTES = 16;
const HASH_BYTES = 64;
const PREFIJO = 'scrypt$';

const scrypt = (contrasena, sal) =>
  new Promise((resolver, rechazar) => {
    crypto.scrypt(contrasena, sal, HASH_BYTES, (err, derived) => {
      if (err) return rechazar(err);
      resolver(derived.toString('hex'));
    });
  });

// Devuelve la cadena lista para guardar en la base.
async function hashContrasena(contrasena) {
  const sal = crypto.randomBytes(SAL_BYTES).toString('hex');
  const hash = await scrypt(String(contrasena), sal);
  return `${PREFIJO}${sal}$${hash}`;
}

// Comparacion en tiempo constante. Devuelve false si el valor guardado
// no tiene formato de hash (es decir: esta en texto plano o esta corrupto).
async function verificarContrasena(contrasena, guardado) {
  if (typeof guardado !== 'string' || !guardado.startsWith(PREFIJO)) return false;

  const [, sal, hash] = guardado.split('$');
  if (!sal || !hash) return false;

  try {
    const derivado = await scrypt(String(contrasena), sal);
    const a = Buffer.from(derivado, 'utf8');
    const b = Buffer.from(hash, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// CLI utilitario
// ----------------------------------------------------------------------------
if (require.main === module) {
  const [, , ...args] = process.argv;
  const orden = args[0];

  const salir = (codigo) => process.exit(codigo);

  if (orden === '--migrar') {
    require('dotenv').config();
    const { createClient } = require('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    (async () => {
      const { data, error } = await supa.from('usuarios').select('id, email, contrasena');
      if (error) {
        console.error('No se pudo leer usuarios:', error.message);
        return salir(1);
      }

      const pendientes = (data || []).filter(
        (u) => typeof u.contrasena !== 'string' || !u.contrasena.startsWith(PREFIJO),
      );

      if (pendientes.length === 0) {
        console.log('Nada que migrar: todas las contraseñas ya son un hash.');
        return salir(0);
      }

      for (const u of pendientes) {
        const hash = await hashContrasena(u.contrasena);
        const { error: errUpd } = await supa
          .from('usuarios')
          .update({ contrasena: hash })
          .eq('id', u.id);
        if (errUpd) {
          console.error(`  x ${u.email}: ${errUpd.message}`);
          continue;
        }
        console.log(`  + ${u.email} migrada a scrypt`);
      }
      console.log(`Migradas: ${pendientes.length}`);
      salir(0);
    })().catch((err) => {
      console.error('Fallo la migracion:', err.message);
      salir(1);
    });
    return;
  }

  if (orden === '-h' || orden === '--help' || !orden) {
    console.log('Uso:');
    console.log('  node password.js "<contrasena>"   imprime el hash');
    console.log('  node password.js --migrar         convierte filas en texto plano');
    salir(0);
    return;
  }

  hashContrasena(orden)
    .then((hash) => {
      console.log(hash);
      salir(0);
    })
    .catch((err) => {
      console.error('No se pudo generar el hash:', err.message);
      salir(1);
    });
  return;
}

module.exports = { hashContrasena, verificarContrasena };
