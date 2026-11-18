// La página solo hace fetch a la API. El navegador manda la cookie solo (misma página, mismo servidor).
const $ = (selector) => document.querySelector(selector);

window.addEventListener('load', () => {

// Centralizo peticiones
async function llamar(metodo, url, cuerpo) {
  const opciones = { method: metodo };

  if (cuerpo !== undefined) {
    opciones.headers = { 'Content-Type': 'application/json' };
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(url, opciones);
  let datos = null;

  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  return { status: respuesta.status, datos };
}

// Mantengo visibles las respuestas para comparar lo que devuelve cada ruta
function anotar(metodo, url, status, datos) {
  const li = document.createElement('li');
  const codigo = document.createElement('span');
  const pre = document.createElement('pre');

  let clase = 'error';
  if (status >= 200 && status < 300) clase = 'ok';
  if (status === 401) clase = 'e401';
  if (status === 403) clase = 'e403';

  codigo.className = `codigo ${clase}`;
  codigo.textContent = String(status);
  pre.textContent = JSON.stringify(datos, null, 2) ?? 'null';

  li.append(codigo, document.createTextNode(` ${metodo} ${url}`), pre);
  $('#bitacora').prepend(li);
}

// Distingo la sesion que reconoce el servidor de la cookie que lee js
async function actualizarEstado() {
  const estado = $('#estado');

  try {
    const { status, datos } = await llamar('GET', '/api/sesion');

    if (status === 200 && datos) {
      estado.className = 'estado con-sesion';
      estado.textContent =
        `${datos.usuario.nombre} (${datos.usuario.rol}) · ` +
        `sesión ${datos.sesion} · vence en ${datos.expiraEnSegundos} s`;
    } else {
      estado.className = 'estado sin-sesion';
      estado.textContent = status === 401
        ? 'Sin sesión (el servidor responde 401)'
        : `No se pudo consultar el estado (${status})`;
    }
  } catch {
    estado.className = 'estado sin-sesion';
    estado.textContent = 'No se pudo conectar con el servidor';
  }

  $('#cookie-js').textContent = document.cookie || '(vacío)';
}

// Creo las celdas como texto para no interpretar respuestas del servidor como html
function agregarCelda(fila, texto) {
  const celda = document.createElement('td');
  celda.textContent = texto;
  fila.appendChild(celda);
}

// Reconstruye la tabla desde cero para evitar que las filas se dupliquen al actualizar
async function actualizarTabla() {
  const tabla = $('#tabla-sesiones');
  const donde = $('#donde');
  tabla.replaceChildren();

  try {
    const { status, datos } = await llamar('GET', '/api/diagnostico/sesiones');

    if (status !== 200 || !datos) {
      donde.textContent = 'No se pudo consultar el almacén de sesiones';
      return;
    }

    donde.textContent = datos.almacen === 'mysql'
      ? 'En MySQL, tabla sessions'
      : 'En memoria del servidor';

    const sesiones = Array.isArray(datos.sesiones) ? datos.sesiones : [];

    if (sesiones.length === 0) {
      const fila = document.createElement('tr');
      const celda = document.createElement('td');
      celda.colSpan = 4;
      celda.textContent = '(sin sesiones)';
      fila.appendChild(celda);
      tabla.appendChild(fila);
      return;
    }

    sesiones.forEach((sesion) => {
      const fila = document.createElement('tr');
      if (sesion.esLaTuya) fila.classList.add('tuya');

      agregarCelda(
        fila,
        `${sesion.sesion || ''}${sesion.esLaTuya ? ' (la tuya)' : ''}`
      );
      agregarCelda(fila, sesion.usuario || '(sin iniciar sesión)');
      agregarCelda(fila, String(sesion.visitas || 0));

      let hora = '—';
      if (sesion.expira) {
        const fecha = new Date(sesion.expira);
        if (!Number.isNaN(fecha.getTime())) hora = fecha.toLocaleTimeString();
      }
      agregarCelda(fila, hora);
      tabla.appendChild(fila);
    });
  } catch {
    donde.textContent = 'No se pudo conectar con el servidor';
  }
}

// Consulto estado y tabla en paralelo 
async function refrescarTodo() {
  await Promise.all([actualizarEstado(), actualizarTabla()]);
}

//  se Registra cada acción y se vuelve a consultar el estado despues de un log in o un logout
async function ejecutar(metodo, url, cuerpo) {
  try {
    const { status, datos } = await llamar(metodo, url, cuerpo);
    anotar(metodo, url, status, datos);
  } catch (error) {
    anotar(metodo, url, 'Error', { error: error.message });
  }

  await refrescarTodo();
}

// Presento la configuración activa para que las pruebas puedan relacionarla con sus resultados.
async function iniciarDemo() {
  const bloqueConfig = $('#config');

  try {
    const { status, datos } = await llamar('GET', '/api/config');
    if (bloqueConfig) {
      bloqueConfig.textContent = status === 200
        ? JSON.stringify(datos, null, 2)
        : `Error HTTP ${status}`;
    }
  } catch {
    if (bloqueConfig) bloqueConfig.textContent = 'No se pudo conectar con el servidor';
  }

  await refrescarTodo();
}

// Evito que el formulario recargue la página y envío sus valores como JSON.
document.addEventListener('submit', async (evento) => {
  if (evento.target.id !== 'form-login') return;

  evento.preventDefault();
  await ejecutar('POST', '/api/login', {
    usuario: evento.target.querySelector('#usuario').value,
    contrasena: evento.target.querySelector('#contrasena').value,
  });
});

// Reutilizo los atributos data-* para conectar todos los botones con el mismo manejador.
document.addEventListener('click', (evento) => {
  const botonApi = evento.target.closest('[data-metodo][data-url]');
  if (botonApi) {
    ejecutar(botonApi.dataset.metodo, botonApi.dataset.url);
    return;
  }

  if (evento.target.closest('#btn-refrescar')) refrescarTodo();
  if (evento.target.closest('#btn-sesiones')) actualizarTabla();
});

// Mantengo la contraseña de ejemplo sincronizada con el usuario seleccionado.
document.addEventListener('change', (evento) => {
  if (evento.target.id !== 'usuario') return;
  evento.target.form.querySelector('#contrasena').value = `${evento.target.value}12345`;
});

iniciarDemo();
});
