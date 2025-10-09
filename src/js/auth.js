// ----------------------------------------------------------------
// auth.js: Manejo de Tokens, Login, Logout y Redirecciones
// ----------------------------------------------------------------

export const API_BASE_URL = "http://localhost:8080/api/v1"; // URL de la API de Spring Boot

const TOKEN_KEY_ACCESS = "accessToken";
const TOKEN_KEY_REFRESH = "refreshToken";
const ROLE_KEY = "userRole";

/**
 * Guarda los tokens y el rol en localStorage.
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {string} role
 */
export function saveTokens({ accessToken, refreshToken, role }) {
  localStorage.setItem(TOKEN_KEY_ACCESS, accessToken);
  localStorage.setItem(TOKEN_KEY_REFRESH, refreshToken);
  localStorage.setItem(ROLE_KEY, role);
}

/**
 * Limpia los tokens y el rol del localStorage.
 */
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY_ACCESS);
  localStorage.removeItem(TOKEN_KEY_REFRESH);
  localStorage.removeItem(ROLE_KEY);
}

/**
 * Obtiene el token de acceso.
 * @returns {string|null}
 */
export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY_ACCESS);
}

/**
 * Obtiene el token de refresco.
 * @returns {string|null}
 */
export function getRefreshToken() {
  return localStorage.getItem(TOKEN_KEY_REFRESH);
}

/**
 * Obtiene el rol del usuario.
 * @returns {string|null}
 */
export function getUserRole() {
  return localStorage.getItem(ROLE_KEY);
}

/**
 * Redirige al dashboard según el rol o a la página de login.
 * @param {string} role - Rol del usuario ('CIUDADANO', 'SUPERVISOR', 'TRABAJADOR').
 */
export function redirectToDashboard(role) {
  let url = "login.html";
  switch (role.toUpperCase()) {
    case "CIUDADANO":
      url = "dashboard-ciudadano.html";
      break;
    case "SUPERVISOR":
      url = "dashboard-supervisor.html";
      break;
    case "TRABAJADOR":
      url = "dashboard-trabajador.html";
      break;
  }
  window.location.href = url;
}

/**
 * Inicia sesión con el backend.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>} True si el login fue exitoso.
 */
export async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/autenticar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Credenciales inválidas.");
    }

    const data = await response.json();
    // data esperada: { accessToken: '...', refreshToken: '...', role: 'CIUDADANO' }

    saveTokens(data);
    redirectToDashboard(data.role);
    return true;
  } catch (error) {
    console.error("Error en el login:", error.message);

    // Si la petición falla por red/DNS (p.ej. 'Failed to fetch'), habilitar
    // un fallback de desarrollo que permite autenticar usuarios de prueba
    // localmente sin backend. Esto facilita el desarrollo de la UI.
    try {
      const isNetworkError =
        (error && error.message && error.message.includes("Failed to fetch")) ||
        error.name === "TypeError";

      if (isNetworkError) {
        // Sólo permitir fallback en entornos de desarrollo locales
        const host = window && window.location && window.location.hostname;
        if (host !== "localhost" && host !== "127.0.0.1") {
          // No activar fallback fuera de localhost
          console.warn(
            "Fallback de desarrollo deshabilitado fuera de localhost."
          );
        } else {
          // Usuarios de prueba y sus roles (usar claves simples)
          const devUsers = {
            ciudadano: "CIUDADANO",
            supervisor: "SUPERVISOR",
            trabajador: "TRABAJADOR",
          };

          // Aceptar tanto 'ciudadano' como 'ciudadano@dominio' -> extraer parte local
          const localPart =
            typeof email === "string" && email.includes("@")
              ? email.split("@")[0]
              : email;
          const lookupKey = localPart || email;

          // Si las credenciales coinciden con un usuario de desarrollo, simular login
          if (password === "pass" && devUsers[lookupKey]) {
            const fakeData = {
              accessToken: "dev-access-token",
              refreshToken: "dev-refresh-token",
              role: devUsers[lookupKey],
            };

            console.warn(
              "Usando fallback de desarrollo: sesión simulada para",
              email
            );
            saveTokens(fakeData);
            redirectToDashboard(fakeData.role);
            return true;
          }
        }
      }
    } catch (fallbackError) {
      console.error("Error en fallback de login:", fallbackError);
    }

    clearTokens();
    return false;
  }
}

/**
 * Cierra la sesión, limpia los tokens y redirige a login.
 */
export function logout() {
  clearTokens();
  console.log("Sesión cerrada. Redirigiendo a login...");
  window.location.href = "login.html";
}

/**
 * Intenta renovar el token de acceso usando el token de refresco.
 * Si falla, asume que el refresh token caducó y redirige a login.
 * @returns {Promise<boolean>} True si la renovación fue exitosa.
 */
export async function refreshTokenIfNeeded() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.warn("No hay refresh token. Redirigiendo a login.");
    logout();
    return false;
  }

  try {
    console.log("Intentando renovar Access Token...");
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Si el refresh token falla (ej. caducado), redirigir a login
      console.error(
        "Renovación de token fallida. Refresh token expirado o inválido."
      );
      throw new Error("Refresh token fallido");
    }

    const data = await response.json();
    // data esperada: { accessToken: '...', refreshToken: '...' }
    const role = getUserRole(); // El rol no cambia, lo mantenemos.

    saveTokens({ ...data, role });
    console.log("Access Token renovado exitosamente.");
    return true;
  } catch (error) {
    // En caso de cualquier error (red, API, etc.), forzar logout.
    console.error("Error crítico en la renovación:", error.message);
    logout();
    return false;
  }
}

/**
 * Verifica el estado de autenticación al cargar una página de dashboard.
 * Si no hay tokens o el rol no coincide con la página, redirige.
 * @param {string} expectedRole - Rol esperado para la página actual.
 */
export function checkAuthAndRedirect(expectedRole) {
  const accessToken = getAccessToken();
  const role = getUserRole();

  if (!accessToken || !role) {
    console.warn("No autenticado. Redirigiendo a login.");
    logout();
    return;
  }

  if (role.toUpperCase() !== expectedRole.toUpperCase()) {
    console.warn(`Rol incorrecto. Redirigiendo a dashboard de ${role}.`);
    redirectToDashboard(role);
    return;
  }

  // Si la autenticación es correcta, establecer el evento de logout
  const logoutButton = document.getElementById("logout-btn");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
}

/**
 * Decodifica el payload de un JWT (sin verificar firma).
 * @param {string} token
 * @returns {object|null}
 */
export function decodeJwt(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // Base64URL -> Base64
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // atob produce una cadena; convertimos a UTF-8
    const json = decodeURIComponent(
      Array.prototype.map
        .call(
          atob(b64),
          (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
        )
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    console.error("decodeJwt error:", e);
    return null;
  }
}

/**
 * Devuelve el usuario actual a partir del accessToken (si es JWT) o del localStorage.
 * @returns {{id: string|null, email: string|null, role: string|null, raw: object|null}}
 */
export function getCurrentUser() {
  const token = getAccessToken();
  const payload = decodeJwt(token);

  if (payload) {
    return {
      id: payload.id || null,
      name: payload.name || null,
      phone: payload.phone || null,
      email: payload.sub || null,
      role: payload.role || getUserRole() || null,
      raw: payload,
    };
  }

  // Fallback: solo role conocido en localStorage
  return {
    id: null,
    name: null,
    phone: null,
    email: null,
    role: getUserRole(),
    raw: null,
  };
}
