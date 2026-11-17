// Consultas a la tabla usuarios. Siempre con ? (consulta parametrizada), nunca pegando texto en el SQL.
const bcrypt = require('bcryptjs');

function crearModeloUsuarios(pool) {
  // Comparo contra el hash y devuelvo solo los datos públicos para no exponer la contraseña.
  async function verificar(usuario, contrasena) {
    if (typeof usuario !== 'string' || typeof contrasena !== 'string') {
      return null;
    }

    const [filas] = await pool.execute(
      'SELECT id, usuario, nombre, rol, contrasena_hash FROM usuarios WHERE usuario = ?',
      [usuario]
    );

    if (filas.length === 0) return null;

    const registro = filas[0];
    const esCorrecta = await bcrypt.compare(contrasena, registro.contrasena_hash);
    if (!esCorrecta) return null;

    return {
      id: registro.id,
      usuario: registro.usuario,
      nombre: registro.nombre,
      rol: registro.rol,
    };
  }

  return { verificar };
}

module.exports = { crearModeloUsuarios };
