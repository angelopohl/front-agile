// ----------------------------------------------------------------
// supervisor.js: Lógica del Dashboard del Supervisor (CORREGIDO)
// ----------------------------------------------------------------

import { checkAuthAndRedirect, API_BASE_URL, getUserRole } from "./auth.js";
import { fetchWithAuth } from "./api.js";
import {
  getById,
  toggleModal,
  showFeedback,
  hideFeedback,
} from "../utils/dom.js";

// CAMBIO: Eliminamos los datos mock. La información vendrá de la API.
// let mockIncomingReports = [...];
// const mockWorkers = [...];

let currentReportToAssign = null; // Guardará el reporte seleccionado para asignar
let allWorkers = []; // Guardará la lista de trabajadores obtenida de la API

const REPORTS_PER_PAGE = 10;
let currentPage = 0; // CAMBIO: La paginación ahora es 0-indexada como en ciudadano.js
let totalPages = 1; // CAMBIO: Se actualizará desde la API

/**
 * Formatea la fecha y hora.
 * @param {string} input - Fecha en formato ISO.
 */
function formatDateTimeWithSeconds(input) {
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
 * Dibuja la tabla de reportes en el DOM.
 * @param {Array<Object>} reports - Lista de reportes de la página actual.
 */
function renderReports(reports) {
  const tableBody = getById("reports-table-body");
  if (!tableBody) return;

  // CAMBIO: Ya no se usa slice. El backend ya nos da la página correcta.
  tableBody.innerHTML = "";

  reports.forEach((report) => {
    const row = tableBody.insertRow();
    // Suponiendo que el backend devuelve un objeto 'location' con 'address'
    const locationAddress = report.location?.address || "No especificada";
    // Suponiendo que el backend devuelve 'photos' como un array de URLs
    const photoUrl =
      report.photos && report.photos.length > 0
        ? report.photos[0]
        : "https://placehold.co/150x150?text=Sin+Imagen";

    row.innerHTML = `
      <td>${formatDateTimeWithSeconds(report.createdAt)}</td>
      <td>${
        report.type === "RESIDUOS_SOLIDOS"
          ? "Residuos Sólidos"
          : report.type === "BARRIDO"
          ? "Barrido"
          : "Maleza"
      }</td>
      <td>${locationAddress}</td>
      <td><img src="${photoUrl}" alt="Foto del reporte" style="width:150px; height:150px; border-radius:4px; object-fit: cover;"></td>
      <td>
        <button class="btn-primary btn-sm assign-btn">
          Asignar Reporte
        </button>
      </td>
    `;

    // CAMBIO: Guardar el objeto de reporte completo en el botón para fácil acceso
    row
      .querySelector(".assign-btn")
      .addEventListener("click", () => handleAssignButtonClick(report));
  });

  // CAMBIO: Actualizar controles de paginación con datos de la API
  const pageInfoEl = getById("page-info");
  if (pageInfoEl) {
    pageInfoEl.textContent = `Página ${currentPage + 1} de ${totalPages}`;
  }
  getById("prev-page").disabled = currentPage === 0;
  getById("next-page").disabled = currentPage >= totalPages - 1;
}

/**
 * Carga los reportes desde la API.
 */
async function loadIncomingReports() {
  try {
    // CAMBIO: Se llama a la API real. Asumimos que el endpoint para el supervisor es este.
    const response = await fetchWithAuth(
      `${API_BASE_URL}/reportes/supervisor/me?page=${currentPage}&size=${REPORTS_PER_PAGE}&sort=createdAt,desc`
    );
    const pageData = await response.json();

    if (pageData && pageData.content) {
      totalPages = pageData.totalPages; // Actualizamos el total de páginas
      renderReports(pageData.content);
    } else {
      renderReports([]);
      totalPages = 1;
    }
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
 * Carga la lista de trabajadores desde la API.
 */
async function loadWorkers() {
  try {
    // CAMBIO: Endpoint real para obtener trabajadores. Ajustar si es diferente.
    const response = await fetchWithAuth(`${API_BASE_URL}/trabajadores`);
    allWorkers = await response.json();
  } catch (error) {
    console.error("Error al cargar trabajadores:", error);
    showFeedback(
      "dashboard-feedback",
      "No se pudo cargar la lista de trabajadores.",
      "error"
    );
    allWorkers = []; // Asegurarse que está vacío en caso de error
  }
}

/**
 * Maneja el click en el botón "Asignar Reporte".
 * @param {Object} report - El objeto completo del reporte a asignar.
 */
function handleAssignButtonClick(report) {
  currentReportToAssign = report; // Guardamos el reporte actual

  // Rellenar el modal
  getById("modal-report-type").value = currentReportToAssign.type;
  const workerSelect = getById("worker-select");
  workerSelect.innerHTML = '<option value="">Seleccione un Trabajador</option>';

  // CAMBIO: Usar la lista de trabajadores real (`allWorkers`)
  allWorkers.forEach((worker) => {
    const option = document.createElement("option");
    option.value = worker.id; // Asumimos que cada trabajador tiene un 'id'
    option.textContent = worker.name + " " + worker.lastname; // Asumimos 'name' y 'lastname'
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

  const workerId = getById("worker-select").value;
  const newType = getById("modal-report-type").value; // Supervisor puede corregir el tipo
  const supervisorComment = getById("assignment-comment").value;

  if (!workerId) {
    showFeedback(
      "assign-modal-feedback",
      "Debe seleccionar un trabajador.",
      "error"
    );
    return;
  }

  const payload = {
    reportId: currentReportToAssign.id,
    workerId: workerId,
    description: supervisorComment,
    type: newType,
  };

  try {
    // CAMBIO: Llamada real a la API para asignar la tarea
    const response = await fetchWithAuth(`${API_BASE_URL}/tarea`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Fallo al asignar reporte");
    }

    showFeedback(
      "assign-modal-feedback",
      "Reporte asignado y tarea creada exitosamente.",
      "success"
    );

    // CAMBIO: Recargar la lista de reportes para que el asignado desaparezca
    setTimeout(() => {
      toggleModal("assign-report-modal", false);
      loadIncomingReports();
    }, 1500);
  } catch (error) {
    showFeedback("assign-modal-feedback", `Error: ${error.message}`, "error");
  }
}

// Inicialización del dashboard
document.addEventListener("DOMContentLoaded", () => {
  checkAuthAndRedirect("SUPERVISOR");

  if (getUserRole() === "SUPERVISOR") {
    loadIncomingReports(); // Cargar los reportes al iniciar
    loadWorkers(); // Cargar los trabajadores al iniciar
  }

  // Configurar listeners del modal de Asignación
  getById("close-assign-modal").addEventListener("click", () =>
    toggleModal("assign-report-modal", false)
  );
  getById("assign-form").addEventListener("submit", handleAssignFormSubmit);

  // Configurar paginación
  getById("prev-page").addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      loadIncomingReports();
    }
  });

  getById("next-page").addEventListener("click", () => {
    if (currentPage < totalPages - 1) {
      currentPage++;
      loadIncomingReports();
    }
  });
});
