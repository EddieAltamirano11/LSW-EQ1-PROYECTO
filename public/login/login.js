const apiBase = document.body.dataset.apiBase.replace(/\/$/, '');
const form = document.querySelector('#login-form');
const fields = document.querySelector('#login-fields');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const submitLabel = document.querySelector('#submit-label');
const status = document.querySelector('#login-status');
const errorMessage = document.querySelector('#login-error');
const confirmation = document.querySelector('#session-confirmation');
const title = document.querySelector('#access-title');
const backButton = document.querySelector('#back-button');
const databaseLabels = { mongodb: 'MongoDB', supabase: 'Supabase' };
let token = null;
let pending = false;

function clearError(input) {
  input.removeAttribute('aria-invalid');
  const message = document.querySelector(`#${input.id}-error`);
  message.textContent = '';
  message.hidden = true;
}

function fieldError(input, text) {
  input.setAttribute('aria-invalid', 'true');
  const message = document.querySelector(`#${input.id}-error`);
  message.textContent = text;
  message.hidden = false;
}

function showError(text) {
  errorMessage.textContent = text;
  errorMessage.hidden = false;
}

function clearMessages() {
  status.textContent = '';
  errorMessage.hidden = true;
  errorMessage.textContent = '';
}

async function requestJson(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options, signal: controller.signal, credentials: 'omit', cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(response.status === 401
        ? 'La sesión no pudo validarse. Intenta iniciar sesión de nuevo.'
        : 'No se pudo completar el acceso. Intenta de nuevo.');
    }
    try {
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('El servidor devolvió una respuesta no válida. Intenta de nuevo.');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('El servidor tardó demasiado en responder. Intenta de nuevo.');
    }
    if (error instanceof TypeError) {
      throw new Error('No se pudo contactar al servidor. Revisa la conexión e intenta de nuevo.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function matchesUser(data, expectedUsername) {
  return typeof data?.user?.userId === 'string' && data.user.userId.length > 0
    && data.user.username === expectedUsername;
}

// Una recarga siempre comienza una visita nueva, incluso si el navegador restaura campos.
form.reset();
username.value = '';
password.value = '';

for (const input of [username, password]) {
  input.addEventListener('input', () => clearError(input));
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending) return;
  clearMessages();
  clearError(username);
  clearError(password);
  const selectedUsername = username.value.trim();
  if (!selectedUsername) fieldError(username, 'Escribe tu usuario.');
  if (!password.value) fieldError(password, 'Escribe tu contraseña.');
  if (!selectedUsername || !password.value) {
    showError('Completa los campos indicados para continuar.');
    (!selectedUsername ? username : password).focus();
    return;
  }

  const databaseTarget = form.elements.databaseTarget.value;
  token = null;
  pending = true;
  fields.disabled = true;
  form.setAttribute('aria-busy', 'true');
  submitLabel.textContent = 'Iniciando sesión…';
  status.textContent = 'Iniciando sesión de demostración…';
  try {
    const login = await requestJson('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selectedUsername, password: password.value, databaseTarget }),
    });
    if (typeof login?.token !== 'string' || !login.token.trim()
      || !matchesUser(login, selectedUsername) || login.activeDatabase !== databaseTarget) {
      throw new Error('La respuesta de acceso no coincide con la sesión solicitada. Intenta de nuevo.');
    }
    token = login.token;
    status.textContent = 'Confirmando la sesión y la base seleccionada…';
    const session = await requestJson('/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!matchesUser(session, selectedUsername) || session.user.userId !== login.user.userId
      || session.activeDatabase !== databaseTarget || session.status !== 'AUTHENTICATED') {
      throw new Error('No se pudo confirmar el usuario y la base seleccionada. Intenta de nuevo.');
    }
    password.value = '';
    document.querySelector('#session-username').textContent = session.user.username;
    document.querySelector('#session-database').textContent = databaseLabels[session.activeDatabase];
    form.hidden = true;
    confirmation.hidden = false;
    title.textContent = 'Sesión iniciada';
    status.textContent = 'Sesión de demostración confirmada.';
    backButton.focus();
  } catch (error) {
    token = null;
    status.textContent = '';
    showError(error.message);
  } finally {
    pending = false;
    fields.disabled = false;
    form.removeAttribute('aria-busy');
    submitLabel.textContent = 'Iniciar sesión';
  }
});

backButton.addEventListener('click', () => {
  token = null;
  password.value = '';
  document.querySelector('#session-username').textContent = '';
  document.querySelector('#session-database').textContent = '';
  confirmation.hidden = true;
  form.hidden = false;
  title.textContent = 'Iniciar sesión';
  clearMessages();
  username.focus();
});
