// ----------------------------------------------------------------
// trabajador.js: Lógica del Dashboard del Trabajador (CORREGIDO)
// ----------------------------------------------------------------

import {
  checkAuthAndRedirect,
  getUserRole,
  API_BASE_URL,
  getAccessToken,
} from "./auth.js";
import { fetchWithAuth } from "./api.js";
import {
  getById,
  toggleModal,
  showFeedback,
  hideFeedback,
} from "../utils/dom.js";

// CAMBIO: Se eliminan los datos mock.
let currentTaskToComplete = null;
const TASKS_PER_PAGE = 10;
let currentPage = 0; // CAMBIO: Paginación 0-indexada.
let totalPages = 1;

/**
 * Formatea la fecha para mostrar solo día/mes/año.
 * @param {string} input - Fecha en formato ISO.
 */
function formatDate(input) {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d)) return String(input);
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1
  )}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds()
  )}`;
}

/**
 * Dibuja la tabla de tareas asignadas en el DOM.
 * @param {Array<Object>} tasks - Lista de tareas de la página actual.
 */
function renderTasks(tasks) {
  const tableBody = getById("tasks-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = ""; // Limpiar antes de renderizar.

  tasks.forEach((task) => {
    // Asumimos que la API devuelve la tarea con el reporte anidado.
    const reporte = task.report || {};
    const location = reporte.location?.address || "Ubicación no disponible";
    const photoUrl =
      reporte.photos && reporte.photos.length > 0
        ? reporte.photos[0]
        : "https://placehold.co/150x150?text=Sin+Imagen";
    const type =
      reporte.type === "RESIDUOS_SOLIDOS"
        ? "Residuos Sólidos"
        : reporte.type === "BARRIDO"
        ? "Barrido"
        : "Maleza" || "No especificado";

    const row = tableBody.insertRow();
    row.innerHTML = `
      <td>${formatDate(task.assignedAt)}</td>
      <td>${type}</td>
      <td>${location}</td>
      <td><a href="${photoUrl}" target="_blank"><img src="${photoUrl}" alt="Foto del reporte" style="width:150px; height:150px; border-radius:4px; object-fit: cover;"></a></td>
      <td>
        <button class="btn-success btn-sm complete-btn">
          Completar Tarea
        </button>
      </td>
    `;
    // Guardar el objeto de tarea completo en el botón para fácil acceso.
    row
      .querySelector(".complete-btn")
      .addEventListener("click", () => handleCompleteButtonClick(task));
  });

  // Actualizar controles de paginación.
  getById("page-info").textContent = `Página ${
    currentPage + 1
  } de ${totalPages}`;
  getById("prev-page").disabled = currentPage === 0;
  getById("next-page").disabled = currentPage >= totalPages - 1;
}

/**
 * Carga las tareas asignadas al trabajador desde la API.
 */
async function loadAssignedTasks() {
  try {
    // CAMBIO: Llamada real a la API para obtener las tareas del trabajador logueado.
    const response = await fetchWithAuth(
      `${API_BASE_URL}/tareas/me?page=${currentPage}&size=${TASKS_PER_PAGE}&sort=assignedAt,desc`
    );
    const pageData = await response.json();

    if (pageData && pageData.content) {
      totalPages = pageData.totalPages;
      renderTasks(pageData.content);
    } else {
      totalPages = 1;
      renderTasks([]);
    }
  } catch (error) {
    console.error("Error al cargar tareas:", error);
    showFeedback(
      "dashboard-feedback",
      "Error al cargar las tareas asignadas.",
      "error"
    );
  }
}

/**
 * Maneja el click en el botón "Completar Tarea".
 * @param {Object} task - La tarea seleccionada.
 */
function handleCompleteButtonClick(task) {
  currentTaskToComplete = task;
  // Abrir modal y limpiar.
  getById(
    "task-id-display"
  ).textContent = `Tarea #${task.id} (Reporte #${task.report.id})`;
  getById("completion-form").reset();
  hideFeedback("completion-modal-feedback");
  toggleModal("complete-task-modal", true);
}

/**
 * Sube un archivo al endpoint del backend que actúa como proxy a Cloudinary.
 * @param {File} file - El archivo a subir.
 * @returns {Promise<string>} La URL del archivo subido.
 */
async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const token = getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const res = await fetch(`${API_BASE_URL}/tarea/cargar`, {
    // Reutilizamos el endpoint de carga
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error subiendo la imagen: ${errorText}`);
  }

  const resultUrl = await res.text(); // Asumimos que la API devuelve la URL como texto plano.
  return resultUrl.trim();
}

/**
 * Maneja el envío del formulario de finalización de tarea.
 * @param {Event} event
 */
async function handleCompletionFormSubmit(event) {
  event.preventDefault();
  const feedbackId = "completion-modal-feedback";

  const evidenceFiles = Array.from(getById("evidence-photo").files); // <-- cambio: tomar todos los archivos
  const comment = getById("completion-comment").value.trim();

  if (!evidenceFiles.length) {
    showFeedback(
      feedbackId,
      "Debe subir al menos una foto de evidencia.",
      "error"
    );
    return;
  }

  try {
    showFeedback(feedbackId, "Subiendo evidencias...", "info");

    // Subir todas las imágenes en paralelo
    const uploadPromises = evidenceFiles.map((file) => uploadFile(file));
    const evidenceUrls = await Promise.all(uploadPromises);

    showFeedback(feedbackId, "Registrando finalización...", "info");

    const payload = {
      evidences: evidenceUrls, // <-- ahora un array de URLs
      notes: comment,
    };

    const response = await fetchWithAuth(
      `${API_BASE_URL}/tarea/${currentTaskToComplete.id}/completar`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Fallo al completar la tarea");
    }

    showFeedback(feedbackId, "¡Tarea completada con éxito!", "success");

    setTimeout(() => {
      toggleModal("complete-task-modal", false);
      loadAssignedTasks();
    }, 1500);
  } catch (error) {
    showFeedback(feedbackId, `Error: ${error.message}`, "error");
  }
}

// Inicialización del dashboard
document.addEventListener("DOMContentLoaded", () => {
  checkAuthAndRedirect("TRABAJADOR");

  if (getUserRole() === "TRABAJADOR") {
    loadAssignedTasks();
  }

  // Agregar listener para el botón de refrescar
  const refreshBtn = getById("refresh-tasks-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      currentPage = 0; // opcional: volver a primera página
      loadAssignedTasks();
    });
  }

  getById("close-complete-modal").addEventListener("click", () =>
    toggleModal("complete-task-modal", false)
  );
  getById("completion-form").addEventListener(
    "submit",
    handleCompletionFormSubmit
  );

  // Configurar paginación.
  getById("prev-page").addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      loadAssignedTasks();
    }
  });

  getById("next-page").addEventListener("click", () => {
    if (currentPage < totalPages - 1) {
      currentPage++;
      loadAssignedTasks();
    }
  });
});
