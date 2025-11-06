// js/perfil-supervisor.js

// Importamos los módulos de tu arquitectura
import { checkAuthAndRedirect, getCurrentUser } from "./auth.js";
import { updateUserProfile } from "./api.js";
import { getById, showFeedback, hideFeedback } from "../utils/dom.js";

// --- GUARDIA DE RUTA Y DATOS INICIALES ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Protegemos la página y activamos el botón de logout
  checkAuthAndRedirect("SUPERVISOR");

  // 2. Cargamos los datos actuales del usuario (si existen)
  loadProfileData();

  // 3. Activamos el formulario
  setupFormListener();
});

/**
 * Carga los datos actuales del usuario (ej. teléfono) en el formulario.
 */
function loadProfileData() {
  const user = getCurrentUser(); // Función de tu auth.js
  if (user && user.phone) {
    const telefonoInput = getById("telefono");
    if (telefonoInput) {
      telefonoInput.value = user.phone;
    }
  }
}

/**
 * Configura el listener principal del formulario.
 */
function setupFormListener() {
  const perfilForm = getById("perfil-form");
  if (!perfilForm) return;

  const feedbackElementId = "perfil-feedback"; // El <div> para mensajes

  perfilForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFeedback(feedbackElementId);

    // Obtenemos los elementos y sus valores
    const telefonoInput = getById("telefono");
    const passwordInput = getById("password");
    const confirmPasswordInput = getById("confirm-password");

    const telefono = telefonoInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // --- VALIDACIONES (Criterios de Aceptación) ---

    // 1. Campos obligatorios
    if (!telefono || !password || !confirmPassword) {
      showFeedback(
        feedbackElementId,
        "Todos los campos son obligatorios.",
        "error"
      );
      return;
    }

    // 2. Formato de teléfono (9 dígitos)
    const telefonoRegex = /^\d{9}$/;
    if (!telefonoRegex.test(telefono)) {
      showFeedback(
        feedbackElementId,
        "El número de teléfono debe tener 9 dígitos.",
        "error"
      );
      return;
    }

    // 3. Contraseñas coinciden
    if (password !== confirmPassword) {
      showFeedback(feedbackElementId, "Las contraseñas no coinciden.", "error");
      return;
    }

    // 4. Formato de contraseña (Según tu HU)
    const passValidation = validarPassword(password);
    if (!passValidation.valida) {
      showFeedback(feedbackElementId, passValidation.mensaje, "error");
      return;
    }

    // --- FIN DE VALIDACIONES ---

    const saveButton = getById("save-button");
    try {
      // Deshabilitar el botón mientras se guarda
      saveButton.disabled = true;
      saveButton.textContent = "Guardando...";

      // Llamamos a la API que creamos en el Paso 1
      await updateUserProfile(telefono, password);

      // 5. Mensaje de éxito
      showFeedback(
        feedbackElementId,
        "Datos actualizados correctamente.",
        "success"
      );

      // Limpiamos los campos de contraseña por seguridad
      passwordInput.value = "";
      confirmPasswordInput.value = "";
    } catch (error) {
      // 6. Mensaje de error (si la API falla)
      console.error("Error al actualizar perfil:", error);
      showFeedback(
        feedbackElementId,
        `Error: ${error.message || "No se pudo actualizar el perfil."}`,
        "error"
      );
    } finally {
      // Restaurar el botón
      saveButton.disabled = false;
      saveButton.textContent = "Guardar cambios";
    }
  });
}

/**
 * Valida la contraseña según los Criterios de Aceptación.
 * @param {string} pass
 * @returns {{valida: boolean, mensaje: string}}
 */
function validarPassword(pass) {
  if (pass.length < 8) {
    return {
      valida: false,
      mensaje: "La contraseña debe tener al menos 8 caracteres.",
    };
  }
  if (!/[A-Z]/.test(pass)) {
    return {
      valida: false,
      mensaje: "La contraseña debe tener al menos una letra mayúscula.",
    };
  }
  if (!/\d/.test(pass)) {
    return {
      valida: false,
      mensaje: "La contraseña debe tener al menos un número.",
    };
  }
  // Esta Regex busca cualquier cosa que NO sea letra o número (caracteres especiales)
  const specialCharsRegex = /[^a-zA-Z0-9]/;
  if (specialCharsRegex.test(pass)) {
    return {
      valida: false,
      mensaje: "La contraseña no debe contener caracteres especiales.",
    };
  }
  return { valida: true, mensaje: "" };
}
