// ----------------------------------------------------------------
// dom.js: Funciones auxiliares para el manejo del DOM
// ----------------------------------------------------------------

/**
 * Obtiene un elemento del DOM por su ID.
 * @param {string} id - El ID del elemento.
 * @returns {HTMLElement|null} El elemento encontrado.
 */
export function getById(id) {
  return document.getElementById(id);
}

/**
 * Muestra u oculta un mensaje de feedback en un elemento específico.
 * @param {string} elementId - El ID del elemento donde mostrar el mensaje.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - Tipo de mensaje ('success', 'error', etc.).
 */
export function showFeedback(elementId, message, type = "error") {
  const element = getById(elementId);
  if (element) {
    element.textContent = message;
    element.className = `feedback-message ${type}`;
    element.style.display = "block";
  }
}

/**
 * Oculta el mensaje de feedback.
 * @param {string} elementId - El ID del elemento a ocultar.
 */
export function hideFeedback(elementId) {
  const element = getById(elementId);
  if (element) {
    element.style.display = "none";
    element.textContent = "";
  }
}

/**
 * Controla la visibilidad de un modal.
 * @param {string} modalId - El ID del contenedor del modal.
 * @param {boolean} show - Si es true, muestra el modal; si es false, lo oculta.
 */
export function toggleModal(modalId, show) {
  const modal = getById(modalId);
  if (modal) {
    modal.classList.toggle("open", show);
  }
}
