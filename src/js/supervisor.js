// ----------------------------------------------------------------
// supervisor.js: Lógica del Dashboard del Supervisor
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
let mockIncomingReports = [
  {
    id: 101,
    date: "2024-10-08 14:00",
    type: "MALEZA",
    location: "Av. Las Palmas 123",
    status: "NUEVO",
  },
  {
    id: 102,
    date: "2024-10-09 09:30",
    type: "RESIDUOS SOLIDOS",
    location: "Calle Central 456",
    status: "NUEVO",
  },
  {
    id: 103,
    date: "2024-10-09 16:15",
    type: "BARRIDO",
    location: "Jr. Los Andes 789",
    status: "NUEVO",
  },
  {
    id: 104,
    date: "2024-10-10 11:00",
    type: "RESIDUOS SOLIDOS",
    location: "Av. Sol 101",
    status: "NUEVO",
  },
];

const mockWorkers = [
  { id: "w001", name: "Juan Pérez (Recojo)" },
  { id: "w002", name: "María López" },
  { id: "w003", name: "Carlos Ruiz (Recojo)" },
  { id: "w004", name: "Ana Torres" },
];

let currentReportToAssign = null;
const REPORTS_PER_PAGE = 10;
let currentPage = 1;

/**
 * Dibuja la tabla de reportes en el DOM.
 * @param {Array<Object>} reports - Lista de reportes.
 */
function renderReports(reports) {
  const tableBody = getById("reports-table-body");
  if (!tableBody) return;

  const start = (currentPage - 1) * REPORTS_PER_PAGE;
  const end = start + REPORTS_PER_PAGE;
  const paginatedReports = reports.slice(start, end);

  tableBody.innerHTML = "";

  paginatedReports.forEach((report) => {
    const row = tableBody.insertRow();
    row.innerHTML = `
            <td>${report.date}</td>
            <td>${report.type}</td>
            <td>${report.location}</td>
            <td>
                <button class="btn-primary btn-sm assign-btn" data-report-id="${report.id}">
                    Asignar Reporte
                </button>
            </td>
        `;
  });

  // Agregar listeners a los nuevos botones
  document.querySelectorAll(".assign-btn").forEach((button) => {
    button.addEventListener("click", handleAssignButtonClick);
  });

  // Actualizar controles de paginación
  getById("page-info").textContent = `Página ${currentPage} de ${Math.ceil(
    reports.length / REPORTS_PER_PAGE
  )}`;
  getById("prev-page").disabled = currentPage === 1;
  getById("next-page").disabled =
    currentPage * REPORTS_PER_PAGE >= reports.length;
}

/**
 * Función que simula la obtención de datos de reportes.
 */
async function loadIncomingReports() {
  try {
    // En un proyecto real, usaríamos:
    // const response = await fetchWithAuth(`${API_BASE_URL}/supervisor/incoming-reports?page=${currentPage}`);
    // const data = await response.json();

    renderReports(mockIncomingReports);
  } catch (error) {
    console.error("Error al cargar reportes:", error);
    showFeedback(
      "dashboard-feedback",
      "Error al cargar los reportes pendientes.",
      "error"
    );
  }
}

/**
 * Maneja el click en el botón "Asignar Reporte".
 * @param {Event} event
 */
function handleAssignButtonClick(event) {
  const reportId = parseInt(event.target.dataset.reportId);
  currentReportToAssign = mockIncomingReports.find((r) => r.id === reportId);

  if (!currentReportToAssign) {
    showFeedback("dashboard-feedback", "Reporte no encontrado.", "error");
    return;
  }

  // Rellenar el modal
  getById("modal-report-type").value = currentReportToAssign.type;

  const workerSelect = getById("worker-select");
  workerSelect.innerHTML = '<option value="">Seleccione un Trabajador</option>';

  // Filtrar trabajadores para "Recojo" si el reporte es Residuos Sólidos
  const isRecojoNeeded = currentReportToAssign.type === "RESIDUOS SOLIDOS";
  const workersToDisplay = isRecojoNeeded
    ? mockWorkers.filter((w) => w.name.includes("(Recojo)"))
    : mockWorkers;

  workersToDisplay.forEach((worker) => {
    const option = document.createElement("option");
    option.value = worker.id;
    option.textContent = worker.name;
    workerSelect.appendChild(option);
  });

  hideFeedback("assign-modal-feedback");
  toggleModal("assign-report-modal", true);
}

/**
 * Maneja el envío del formulario de asignación.
 * @param {Event} event
 */
async function handleAssignFormSubmit(event) {
  event.preventDefault();

  const assignedWorkerId = getById("worker-select").value;
  const newReportType = getById("modal-report-type").value;
  const comment = getById("assignment-comment").value;

  if (!assignedWorkerId) {
    showFeedback(
      "assign-modal-feedback",
      "Debe seleccionar un trabajador.",
      "error"
    );
    return;
  }

  try {
    // Simulación de llamada al API
    // const response = await fetchWithAuth(`${API_BASE_URL}/supervisor/assign`, {
    //     method: 'POST',
    //     body: JSON.stringify({
    //         reportId: currentReportToAssign.id,
    //         workerId: assignedWorkerId,
    //         newReportType,
    //         comment
    //     })
    // });

    // if (!response.ok) throw new Error('Fallo al asignar reporte');

    // Simulación: remover el reporte de la lista local
    mockIncomingReports = mockIncomingReports.filter(
      (r) => r.id !== currentReportToAssign.id
    );

    console.log("Reporte asignado exitosamente:", currentReportToAssign.id);
    showFeedback(
      "assign-modal-feedback",
      "Reporte asignado y tarea creada exitosamente.",
      "success"
    );

    setTimeout(() => {
      toggleModal("assign-report-modal", false);
      loadIncomingReports();
    }, 1500);
  } catch (error) {
    showFeedback(
      "assign-modal-feedback",
      "Error al asignar la tarea. Intente de nuevo.",
      "error"
    );
  }
}

// Inicialización del dashboard
document.addEventListener("DOMContentLoaded", () => {
  checkAuthAndRedirect("SUPERVISOR");

  if (getUserRole() === "SUPERVISOR") {
    loadIncomingReports();
  }

  // Configurar listeners del modal de Asignación
  getById("close-assign-modal").addEventListener("click", () =>
    toggleModal("assign-report-modal", false)
  );
  getById("assign-form").addEventListener("submit", handleAssignFormSubmit);

  // Configurar paginación
  getById("prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadIncomingReports();
    }
  });

  getById("next-page").addEventListener("click", () => {
    if (currentPage * REPORTS_PER_PAGE < mockIncomingReports.length) {
      currentPage++;
      loadIncomingReports();
    }
  });
});
