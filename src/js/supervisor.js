// ----------------------------------------------------------------
// supervisor.js: Lógica del Dashboard del Supervisor (CORREGIDO Y CON FILTROS)
// ----------------------------------------------------------------

import { checkAuthAndRedirect, API_BASE_URL, getUserRole } from "./auth.js";
import { fetchWithAuth } from "./api.js";
import {
  getById,
  toggleModal,
  showFeedback,
  hideFeedback,
} from "../utils/dom.js";

let currentReportToAssign = null;
let allWorkers = [];

const REPORTS_PER_PAGE = 10;
let currentPage = 0;
let totalPages = 1;

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

// NUEVO: Función para leer los filtros del formulario
/**
 * Obtiene los parámetros de filtro del formulario y los convierte en un query string.
 * @returns {string} Un string de parámetros de URL (ej. "state=PENDIENTE&type=BARRIDO")
 */
function getFilterParams() {
  const params = new URLSearchParams();

  // 1. Filtro por Estado (AC 2)
  const stateCheckboxes = document.querySelectorAll(
    'input[name="state"]:checked'
  );
  stateCheckboxes.forEach((cb) => {
    params.append("state", cb.value); // API recibirá state=PENDIENTE, state=RESUELTO, etc.
  });

  // 2. Filtro por Tipo (AC 3)
  const typeCheckboxes = document.querySelectorAll(
    'input[name="type"]:checked'
  );
  typeCheckboxes.forEach((cb) => {
    params.append("type", cb.value); // API recibirá type=BARRIDO, type=MALEZA, etc.
  });

  // 3. Filtro por Fecha (AC 4)
  const dateStart = getById("filter-date-start").value;
  const dateEnd = getById("filter-date-end").value;

  if (dateStart) {
    // Asumimos que la API espera 'YYYY-MM-DD'.
    // Si la API requiere un timestamp T00:00:00, se ajusta aquí.
    params.append("date_start", dateStart);
  }
  if (dateEnd) {
    params.append("date_end", dateEnd);
  }

  return params.toString();
}

/**
 * Dibuja la tabla de reportes en el DOM.
 * @param {Array<Object>} reports - Lista de reportes de la página actual.
 */
function renderReports(reports) {
  const tableBody = getById("reports-table-body");
  // MODIFICADO: Referencias para el mensaje de "no encontrados" (AC 7)
  const noReportsMessage = getById("no-reports-message");
  const dataTable = document.querySelector(".data-table"); // La tabla <table>

  if (!tableBody || !noReportsMessage || !dataTable) return;

  // MODIFICADO: Lógica para mostrar/ocultar tabla vs mensaje (AC 7)
  if (reports.length === 0) {
    tableBody.innerHTML = ""; // Limpiar por si acaso
    dataTable.style.display = "none"; // Ocultar la tabla
    noReportsMessage.style.display = "block"; // Mostrar el mensaje
  } else {
    dataTable.style.display = ""; // Restaurar display (table)
    noReportsMessage.style.display = "none"; // Ocultar el mensaje
    tableBody.innerHTML = ""; // Limpiar la tabla antes de rellenar
  }

  reports.forEach((report) => {
    const row = tableBody.insertRow();
    const locationAddress = report.location?.address || "No especificada";
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

    row
      .querySelector(".assign-btn")
      .addEventListener("click", () => handleAssignButtonClick(report));
  });

  // Actualizar controles de paginación
  const pageInfoEl = getById("page-info");
  if (pageInfoEl) {
    pageInfoEl.textContent = `Página ${currentPage + 1} de ${totalPages}`;
  }
  getById("prev-page").disabled = currentPage === 0;
  getById("next-page").disabled = currentPage >= totalPages - 1;
}

/**
 * Carga los reportes desde la API, AHORA CON FILTROS.
 */
async function loadIncomingReports() {
  // NUEVO: Obtener los parámetros de filtro
  const filterQuery = getFilterParams();

  try {
    // MODIFICADO: Se añaden los filtros a la URL. El '&' al final une los params.
    const url = `${API_BASE_URL}/reportes/supervisor/me?page=${currentPage}&size=${REPORTS_PER_PAGE}&sort=createdAt,desc&${filterQuery}`;

    const response = await fetchWithAuth(url);
    const pageData = await response.json();

    if (pageData && pageData.content) {
      totalPages = pageData.totalPages;
      renderReports(pageData.content);
    } else {
      renderReports([]);
      totalPages = 1;
    }
  } catch (error) {
    console.error("Error al cargar reportes:", error);
    showFeedback(
      "dashboard-feedback",
      "Error al cargar los reportes.",
      "error"
    );
    renderReports([]); // MODIFICADO: Mostrar "no reportes" en caso de error
  }
}

/**
 * Carga la lista de trabajadores desde la API.
 */
async function loadWorkers() {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/trabajadores`);
    allWorkers = await response.json();
  } catch (error) {
    console.error("Error al cargar trabajadores:", error);
    showFeedback(
      "dashboard-feedback",
      "No se pudo cargar la lista de trabajadores.",
      "error"
    );
    allWorkers = [];
  }
}

/**
 * Maneja el click en el botón "Asignar Reporte".
 * @param {Object} report - El objeto completo del reporte a asignar.
 */
function handleAssignButtonClick(report) {
  currentReportToAssign = report;

  getById("modal-report-type").value = currentReportToAssign.type;
  const workerSelect = getById("worker-select");
  workerSelect.innerHTML = '<option value="">Seleccione un Trabajador</option>';

  allWorkers.forEach((worker) => {
    const option = document.createElement("option");
    option.value = worker.id;
    option.textContent = worker.name + " " + worker.lastname;
    workerSelect.appendChild(option);
  });

  hideFeedback("assign-modal-feedback");
  toggleModal("assign-report-modal", true);
}

/**
 * Renderiza los indicadores en el DOM.
 * @param {Object} stats - { total, pending, resolved, byType: {BARRIDO, MALEZA, RESIDUOS_SOLIDOS} }
 */
function renderIndicators(stats) {
  const safe = (v) => (typeof v === "number" ? v : 0);
  getById("total-count").textContent = safe(stats.total);
  getById("pending-count").textContent = safe(stats.pending);
  getById("resolved-count").textContent = safe(stats.resolved);
  getById("type-barrido-count").textContent = safe(stats.byType?.BARRIDO);
  getById("type-maleza-count").textContent = safe(stats.byType?.MALEZA);
  getById("type-residuos-count").textContent = safe(
    stats.byType?.RESIDUOS_SOLIDOS
  );
}

/**
 * Carga los indicadores: intenta endpoint de resumen y si falla calcula a partir de todos los reportes.
 */
async function loadIndicators() {
  // NOTA: Esta función de indicadores también se podría beneficiar de los filtros,
  // pero la HU dice "filtrar los indicadores por fecha, tipo y estado."
  // Por ahora, esta función sigue cargando el total general.
  // Se podría modificar para que getFilterParams() también afecte la URL de aquí.

  try {
    // NUEVO: Usamos los mismos filtros para los indicadores
    const filterQuery = getFilterParams();
    const url = `${API_BASE_URL}/reportes/supervisor/me?page=0&size=10000&sort=createdAt,desc&${filterQuery}`;

    const resp = await fetchWithAuth(url);
    if (!resp.ok)
      throw new Error(
        "No se pudieron obtener reportes del supervisor para cálculo de indicadores"
      );
    const page = await resp.json();
    const list = page.content || [];

    const stats = {
      total: list.length, // OJO: page.totalElements sería mejor si la API lo devuelve
      pending: 0,
      resolved: 0,
      byType: { BARRIDO: 0, MALEZA: 0, RESIDUOS_SOLIDOS: 0 },
    };

    list.forEach((r) => {
      const status = (r.status || r.state || "").toString().toUpperCase();
      if (status === "RESUELTO" || status === "RESOLVED") stats.resolved++;
      else stats.pending++;

      const t = (r.type || "").toString().toUpperCase();
      if (t === "BARRIDO") stats.byType.BARRIDO++;
      else if (t === "MALEZA") stats.byType.MALEZA++;
      else if (t === "RESIDUOS_SOLIDOS") stats.byType.RESIDUOS_SOLIDOS++;
    });

    renderIndicators(stats);
  } catch (error) {
    console.error("Error calculando indicadores:", error);
    renderIndicators({ total: 0, pending: 0, resolved: 0, byType: {} });
  }
}

/**
 * Maneja el envío del formulario de asignación.
 * @param {Event} event
 */
async function handleAssignFormSubmit(event) {
  event.preventDefault();

  const workerId = getById("worker-select").value;
  const newType = getById("modal-report-type").value;
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

    setTimeout(() => {
      toggleModal("assign-report-modal", false);
      loadIncomingReports(); // Recargar reportes (ya filtrados)
      loadIndicators(); // Recargar indicadores (ya filtrados)
    }, 1500);
  } catch (error) {
    showFeedback("assign-modal-feedback", `Error: ${error.message}`, "error");
  }
}

// Inicialización del dashboard
document.addEventListener("DOMContentLoaded", () => {
  checkAuthAndRedirect("SUPERVISOR");

  if (getUserRole() === "SUPERVISOR") {
    // Las llamadas se hacen al inicio. loadIncomingReports usará los filtros
    // por defecto (Pendiente=checked)
    loadIncomingReports();
    loadIndicators();
    loadWorkers();
  }

  // Listener para el botón de refrescar
  const refreshBtn = getById("refresh-reports-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      // Refrescar CON los filtros actuales
      loadIncomingReports();
      loadIndicators();
    });
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
      loadIncomingReports(); // Carga la pág anterior CON filtros
    }
  });

  getById("next-page").addEventListener("click", () => {
    if (currentPage < totalPages - 1) {
      currentPage++;
      loadIncomingReports(); // Carga la pág siguiente CON filtros
    }
  });

  // --- NUEVO: Listeners para el Formulario de Filtros ---
  const filterForm = getById("filter-form");
  if (filterForm) {
    // Al hacer click en "Aplicar" (submit)
    filterForm.addEventListener("submit", (event) => {
      event.preventDefault(); // Evitar que la página se recargue
      currentPage = 0; // Al aplicar filtros, volvemos a la página 1
      loadIncomingReports();
      loadIndicators(); // Actualizar indicadores con los filtros
    });

    // Al hacer click en "Limpiar" (reset)
    filterForm.addEventListener("reset", () => {
      // El reset del HTML restaura los valores por defecto (Pendiente=checked)
      // Esperamos un instante para que el DOM se actualice
      // antes de leer los valores (ahora por defecto) y recargar.
      setTimeout(() => {
        currentPage = 0;
        loadIncomingReports();
        loadIndicators();
      }, 0);
    });
  }
});
