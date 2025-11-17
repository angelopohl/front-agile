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
 * @param {Array<Object>} tasks - Lista de tareas.
 * @param {number} totalPagesFromServer - Total de páginas.
 * @param {string} [customEmptyMessage] - Mensaje si no hay tareas.
 */
function renderTasks(
  tasks,
  totalPagesFromServer = 1,
  customEmptyMessage = "No tienes tareas asignadas."
) {
  const tableBody = getById("tasks-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = ""; // Limpiar antes de renderizar.

  if (!tasks || tasks.length === 0) {
    // AC #7: Mostrar el mensaje personalizado
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${customEmptyMessage}</td></tr>`;
  } else {
    // AC #6: Mostrar campos requeridos
    tasks.forEach((task) => {
      const reporte = task.report || {};
      const description =
        task.description || reporte.description || "Sin descripción"; // AC #6: nota del supervisor
      const location = reporte.location?.address || "Ubicación no disponible"; // AC #6: ubicación
      const photoUrl =
        reporte.photos && reporte.photos.length > 0
          ? reporte.photos[0]
          : "https://placehold.co/150x150?text=Sin+Imagen"; // AC #6: foto
      const type =
        reporte.type === "RESIDUOS_SOLIDOS"
          ? "Residuos Sólidos"
          : reporte.type === "BARRIDO"
          ? "Barrido"
          : "Maleza" || "No especificado"; // AC #6: tipo

      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${formatDate(task.assignedAt)}</td> <td>${type}</td>
        <td>${description}</td>
        <td>${location}</td>
        <td><a href="${photoUrl}" target="_blank"><img src="${photoUrl}" alt="Foto del reporte" style="width:150px; height:150px; border-radius:4px; object-fit: cover;"></a></td>
        <td>
          <button class="btn-success btn-sm complete-btn" ${
            task.status === "RESUELTO" ? "disabled" : "" // "RESUELTO" o "FINALIZADA"
          }>
            Completar Tarea
          </button>
        </td>
      `;
      row
        .querySelector(".complete-btn")
        .addEventListener("click", () => handleCompleteButtonClick(task));
    });
  }

  // Actualizar controles de paginación.
  getById("page-info").textContent = `Página ${
    currentPage + 1
  } de ${totalPagesFromServer}`;
  getById("prev-page").disabled = currentPage === 0;
  getById("next-page").disabled = currentPage >= totalPagesFromServer - 1;
}

/**
 * Carga las tareas asignadas al trabajador desde la API (CON FILTROS).
 */
async function loadAssignedTasks() {
  const tableBody = getById("tasks-table-body");
  if (tableBody) {
    // Actualiza el colspan a 6 para que coincida con tu tabla
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Cargando tareas...</td></tr>`;
  }

  // 1. Leer el valor del filtro (será "", "PENDIENTE" o "RESUELTO")
  const filterValue =
    document.querySelector('input[name="estado"]:checked')?.value || "";

  // 2. Construir los parámetros
  const params = new URLSearchParams();
  params.append("page", currentPage);
  params.append("size", TASKS_PER_PAGE);
  params.append("sort", "assignedAt,desc"); // AC #5: Ordenados del más reciente

  if (filterValue) {
    params.append("estado", filterValue); // Añadir el filtro si existe
  }

  try {
    // 3. Llamar a la API con los parámetros
    const response = await fetchWithAuth(
      `${API_BASE_URL}/tareas/me?${params.toString()}`
    );
    const pageData = await response.json();

    if (pageData && pageData.content && pageData.content.length > 0) {
      totalPages = pageData.totalPages;
      renderTasks(pageData.content, totalPages);
    } else {
      // 4. Manejar el estado vacío (AC #7)
      totalPages = 1;
      currentPage = 0;
      const message = filterValue
        ? "No se encontraron tareas en este estado."
        : "No tienes tareas asignadas.";
      renderTasks([], 1, message);
    }
  } catch (error) {
    console.error("Error al cargar tareas:", error);
    const message = "Error al cargar las tareas asignadas.";
    showFeedback("dashboard-feedback", message, "error");
    renderTasks([], 1, message);
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

  const filterForm = getById("filter-form");
  if (filterForm) {
    // Listener para "Aplicar Filtro"
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      currentPage = 0; // Volver a la página 1 al filtrar
      loadAssignedTasks();
    });

    // Listener para "Limpiar" (AC #4)
    filterForm.addEventListener("reset", () => {
      // Esperar un instante a que el form se resetee
      setTimeout(() => {
        currentPage = 0;
        loadAssignedTasks();
      }, 0);
    });
  }

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
