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

// api.js

// Función para registrar a un usuario
export const registerUser = async (nombreCompleto, email, password, telefono, fechaNacimiento) => {
    const response = await fetch('/api/register', {  // Ruta de la API de backend (ajustar según sea necesario)
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',  // Tipo de contenido para JSON
        },
        body: JSON.stringify({
            nombreCompleto,
            email,
            password,
            telefono,
            fechaNacimiento,
        }),
    });

    const data = await response.json();  // Procesar la respuesta de la API (json)
    
    if (data.success) {
        return true;  // Registro exitoso
    } else {
        return false;  // Error en el registro
    }
};