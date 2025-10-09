// ----------------------------------------------------------------
// trabajador.js: Lógica del Dashboard del Trabajador
// ----------------------------------------------------------------

import { checkAuthAndRedirect, getUserRole } from "./auth.js";
import { fetchWithAuth } from "./api.js";
import {
  getById,
  toggleModal,
  showFeedback,
  hideFeedback,
} from "../utils/dom.js";

// Mock Data
let mockAssignedTasks = [
  {
    id: 201,
    type: "MALEZA",
    location: "Av. Las Palmas 123",
    photoUrl: "https://placehold.co/100x100/123/fff?text=Maleza+Original",
    assignedDate: "2024-10-10",
  },
  {
    id: 202,
    type: "RESIDUOS SOLIDOS",
    location: "Calle Central 456",
    photoUrl: "https://placehold.co/100x100/333/fff?text=Residuos+Original",
    assignedDate: "2024-10-10",
  },
  {
    id: 203,
    type: "BARRIDO",
    location: "Jr. Los Andes 789",
    photoUrl: "https://placehold.co/100x100/666/fff?text=Barrido+Original",
    assignedDate: "2024-10-11",
  },
];

let currentTaskToComplete = null;
const REPORTS_PER_PAGE = 10;
let currentPage = 1;

/**
 * Dibuja la tabla de tareas asignadas en el DOM.
 * @param {Array<Object>} tasks - Lista de tareas.
 */
function renderTasks(tasks) {
  const tableBody = getById("tasks-table-body");
  if (!tableBody) return;

  const start = (currentPage - 1) * REPORTS_PER_PAGE;
  const end = start + REPORTS_PER_PAGE;
  const paginatedTasks = tasks.slice(start, end);

  tableBody.innerHTML = "";

  paginatedTasks.forEach((task) => {
    const row = tableBody.insertRow();
    row.innerHTML = `
            <td>${task.assignedDate}</td>
            <td>${task.type}</td>
            <td>${task.location}</td>
            <td><img src="${task.photoUrl}" alt="Ubicación" style="width:50px; height:50px; border-radius:4px;"></td>
            <td>
                <button class="btn-success btn-sm complete-btn" data-task-id="${task.id}">
                    Completar Tarea
                </button>
            </td>
        `;
  });

  // Agregar listeners a los nuevos botones
  document.querySelectorAll(".complete-btn").forEach((button) => {
    button.addEventListener("click", handleCompleteButtonClick);
  });

  // Actualizar controles de paginación
  getById("page-info").textContent = `Página ${currentPage} de ${Math.ceil(
    tasks.length / REPORTS_PER_PAGE
  )}`;
  getById("prev-page").disabled = currentPage === 1;
  getById("next-page").disabled =
    currentPage * REPORTS_PER_PAGE >= tasks.length;
}

/**
 * Función que simula la obtención de tareas asignadas.
 */
async function loadAssignedTasks() {
  try {
    // En un proyecto real, usaríamos:
    // const response = await fetchWithAuth(`${API_BASE_URL}/trabajador/assigned-tasks?page=${currentPage}`);
    // const data = await response.json();

    renderTasks(mockAssignedTasks);
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
 * @param {Event} event
 */
function handleCompleteButtonClick(event) {
  const taskId = parseInt(event.target.dataset.taskId);
  currentTaskToComplete = mockAssignedTasks.find((t) => t.id === taskId);

  if (!currentTaskToComplete) {
    showFeedback("dashboard-feedback", "Tarea no encontrada.", "error");
    return;
  }

  // Abrir modal y limpiar
  getById("task-id-display").textContent = currentTaskToComplete.id;
  getById("completion-form").reset();
  hideFeedback("completion-modal-feedback");
  toggleModal("complete-task-modal", true);
}

/**
 * Maneja el envío del formulario de finalización de tarea.
 * @param {Event} event
 */
async function handleCompletionFormSubmit(event) {
  event.preventDefault();

  const evidenceFile = getById("evidence-photo").files[0];
  const comment = getById("completion-comment").value;

  if (!evidenceFile) {
    showFeedback(
      "completion-modal-feedback",
      "Debe subir al menos una foto de evidencia.",
      "error"
    );
    return;
  }

  // En un proyecto real, aquí se usaría FormData para enviar el archivo
  // junto con el ID de la tarea y el comentario al API.

  try {
    // Simulación de llamada al API
    // const formData = new FormData();
    // formData.append('taskId', currentTaskToComplete.id);
    // formData.append('evidence', evidenceFile);
    // formData.append('comment', comment);

    // const response = await fetchWithAuth(`${API_BASE_URL}/trabajador/complete-task`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': undefined }, // Dejar que fetch lo maneje con FormData
    //     body: formData
    // });

    // if (!response.ok) throw new Error('Fallo al completar la tarea');

    // Simulación: remover la tarea de la lista local
    mockAssignedTasks = mockAssignedTasks.filter(
      (t) => t.id !== currentTaskToComplete.id
    );

    console.log("Tarea completada exitosamente:", currentTaskToComplete.id);
    showFeedback(
      "completion-modal-feedback",
      "Tarea marcada como resuelta. ¡Buen trabajo!",
      "success"
    );

    setTimeout(() => {
      toggleModal("complete-task-modal", false);
      loadAssignedTasks(); // Recargar la lista
    }, 1500);
  } catch (error) {
    showFeedback(
      "completion-modal-feedback",
      "Error al completar la tarea. Intente de nuevo.",
      "error"
    );
  }
}

// Inicialización del dashboard
document.addEventListener("DOMContentLoaded", () => {
  checkAuthAndRedirect("TRABAJADOR");

  if (getUserRole() === "TRABAJADOR") {
    loadAssignedTasks();
  }

  // Configurar listeners del modal de Completar Tarea
  getById("close-complete-modal").addEventListener("click", () =>
    toggleModal("complete-task-modal", false)
  );
  getById("completion-form").addEventListener(
    "submit",
    handleCompletionFormSubmit
  );

  // Configurar paginación
  getById("prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadAssignedTasks();
    }
  });

  getById("next-page").addEventListener("click", () => {
    if (currentPage * REPORTS_PER_PAGE < mockAssignedTasks.length) {
      currentPage++;
      loadAssignedTasks();
    }
  });
});
