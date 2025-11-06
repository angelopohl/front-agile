// ----------------------------------------------------------------
// api.js: Wrapper de fetch con inyección de token y lógica de reintento
// ----------------------------------------------------------------

import { getAccessToken, refreshTokenIfNeeded, logout } from "./auth.js";

/**
 * Wrapper de fetch que maneja automáticamente la inyección del token de acceso
 * y la renovación del token si expira.
 * @param {string} url - URL de la petición.
 * @param {Object} options - Opciones estándar de fetch.
 * @returns {Promise<Response>} La respuesta del fetch.
 */
export async function fetchWithAuth(url, options = {}) {
  let accessToken = getAccessToken();
  if (!accessToken) {
    console.error("No hay Access Token disponible. Forzando logout.");
    logout();
    // Devolvemos una promesa que nunca se resuelve para detener la ejecución
    return new Promise(() => {});
  }

  // 1. Clonar opciones e insertar Access Token
  const authOptions = { ...options };
  authOptions.headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": options.headers?.["Content-Type"] || "application/json",
  };

  // 2. Ejecutar la petición inicial
  let response = await fetch(url, authOptions);

  // 3. Manejar Access Token Expirado (código 401)
  if (response.status === 401) {
    console.warn("Access Token expirado (401). Intentando renovar...");

    const refreshSuccess = await refreshTokenIfNeeded();

    if (refreshSuccess) {
      // El token fue renovado, obtener el nuevo Access Token
      accessToken = getAccessToken();

      // 4. Reintentar la petición original con el nuevo token
      authOptions.headers["Authorization"] = `Bearer ${accessToken}`;

      console.log("Reintentando petición con nuevo Access Token...");
      response = await fetch(url, authOptions);

      // Si el reintento falla, es un error del API, no de auth.
      if (!response.ok) {
        console.error("Reintento de petición fallido:", response.statusText);
      }
    } else {
      // Si refreshSuccess es false, refreshTokenIfNeeded ya llamó a logout()
      // Retornamos un objeto que simula un error de fetch
      return new Response(
        JSON.stringify({ message: "Refresh token fallido" }),
        { status: 401, statusText: "Unauthorized" }
      );
    }
  }

  // 5. Devolver la respuesta (inicial o reintentada)
  return response;
}

// ... (al final de tu archivo api.js, después de fetchWithAuth) ...

/**
 * Actualiza el perfil del usuario (teléfono y contraseña).
 * Esta función es genérica y la usará el supervisor.
 * @param {string} telefono
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function updateUserProfile(telefono, password) {
  // NOTA: Ajusta esta URL al endpoint correcto de tu backend.
  // Basado en tu auth.js, la URL base ya está en auth.js.
  const { API_BASE_URL } = await import("./auth.js");
  const endpoint = `${API_BASE_URL}/usuarios/perfil/me`; // (Asumiendo endpoint)

  const payload = {
    telefono: telefono,
    password: password,
  };

  try {
    // Usamos tu fetchWithAuth que ya maneja tokens y refresh
    const response = await fetchWithAuth(endpoint, {
      method: "PATCH", // O 'PUT', según tu backend
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Intenta leer un mensaje de error del backend
      const errorData = await response.json().catch(() => ({}));
      const mensaje = errorData.message || "No se pudo actualizar el perfil.";
      throw new Error(mensaje);
    }

    // Si el backend responde 204 (No Content) o 200 sin cuerpo
    if (response.status === 204) {
      return { success: true };
    }

    return response.json(); // O { success: true } si no devuelve cuerpo
  } catch (error) {
    console.error("Error en updateUserProfile:", error);
    throw error; // Propaga el error para que la página lo maneje
  }
}
