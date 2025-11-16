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
    const id = report.id || "N/A"; // CAMBIO: Mostrar ID del reporte
    // Suponiendo que el backend devuelve un objeto 'location' con 'address'
    const locationAddress = report.location?.address || "No especificada";
    const description = report.description || "No especificada";
    const status = report.status || "Desconocido";
    const assignedTo = report.assignedTo
      ? `${report.assignedTo}`
      : "No asignado";
    // Suponiendo que el backend devuelve 'photos' como un array de URLs
    const photoUrl =
      report.photos && report.photos.length > 0
        ? report.photos[0]
        : "https://placehold.co/150x150?text=Sin+Imagen";
    const evidencePhotoUrl =
      report.evidence && report.evidence.length > 0
        ? report.evidence[0]
        : "https://placehold.co/150x150?text=Sin+Evidencia";

    row.innerHTML = `
      <td>${id}</td>
      <td>${formatDateTimeWithSeconds(report.createdAt)}</td>
      <td>${
        report.type === "RESIDUOS_SOLIDOS"
          ? "Residuos Sólidos"
          : report.type === "BARRIDO"
          ? "Barrido"
          : "Maleza"
      }</td>
      <td>${locationAddress}</td>
      <td>${description}</td>
      <td>${status}</td>
      <td>${assignedTo}</td>
      <td><img src="${photoUrl}" alt="Foto del reporte" style="width:150px; height:150px; border-radius:4px; object-fit: cover;"></td>
      <td><img src="${evidencePhotoUrl}" alt="Foto de evidencia" style="width:150px; height:150px; border-radius:4px; object-fit: cover;"></td>
      <td>
        <button class="btn-primary btn-sm assign-btn" ${
          report.assignedTo ? "disabled" : ""
        }>
          Asignar Reporte
        </button>
      </td>
    `;

    // CAMBIO: Guardar el objeto de reporte completo en el botón para fácil acceso
    row
      .querySelector(".assign-btn")
      .addEventListener("click", () => handleAssignButtonClick(report));
  });
}

/**
 * Carga los reportes desde la API.
 */
async function loadHistoryReports() {
  const tableBody = getById("reports-table-body");
  tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">Cargando reportes...</td></tr>`;

  // 1. Construir los parámetros base de la URL
  const params = new URLSearchParams();
  params.append("page", currentPage);
  params.append("size", REPORTS_PER_PAGE);
  params.append("sort", "createdAt,desc");

  // 2. Recolectar valores de checkboxes de ESTADO
  const checkedStates = document.querySelectorAll(
    'input[name="estados"]:checked'
  );
  checkedStates.forEach((checkbox) => {
    // 'estados' debe coincidir con el @RequestParam del backend
    params.append("estados", checkbox.value);
  });

  // 3. Recolectar valores de checkboxes de TIPO
  const checkedTypes = document.querySelectorAll('input[name="tipos"]:checked');
  checkedTypes.forEach((checkbox) => {
    // 'tipos' debe coincidir con el @RequestParam del backend
    params.append("tipos", checkbox.value);
  });

  // 4. Recolectar valores de las FECHAS
  const startDate = getById("filter-date-start").value;
  const endDate = getById("filter-date-end").value;
  if (startDate) {
    // 'fechaInicio' debe coincidir con el @RequestParam del backend
    params.append("fechaInicio", startDate);
  }
  if (endDate) {
    // 'fechaFin' debe coincidir con el @RequestParam del backend
    params.append("fechaFin", endDate);
  }

  try {
    const response = await fetchWithAuth(
      `${API_BASE_URL}/reportes/supervisor/me?${params.toString()}`
    );
    const pageData = await response.json();

    if (pageData && pageData.content && pageData.content.length > 0) {
      totalPages = pageData.totalPages;
      renderReports(pageData.content);
    } else {
      totalPages = 1;
      currentPage = 0;
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">No se encontraron reportes con los criterios aplicados.</td></tr>`;
    }
  } catch (error) {
    console.error("Error al cargar reportes:", error);
    showFeedback(
      "dashboard-feedback",
      "Error al cargar los reportes.",
      "error"
    );
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">Error al cargar los reportes.</td></tr>`;
  }

  // Actualizar controles de paginación
  const pageInfoEl = getById("page-info");
  if (pageInfoEl) {
    pageInfoEl.textContent = `Página ${currentPage + 1} de ${totalPages}`;
  }
  getById("prev-page").disabled = currentPage === 0;
  getById("next-page").disabled = currentPage >= totalPages - 1;
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

async function exportPdf() {
  // 1. Crear un objeto URLSearchParams con los filtros actuales
  const params = new URLSearchParams();

  const checkedStates = document.querySelectorAll(
    'input[name="estados"]:checked'
  );
  checkedStates.forEach((cb) => params.append("estados", cb.value));

  const checkedTypes = document.querySelectorAll('input[name="tipos"]:checked');
  checkedTypes.forEach((cb) => params.append("tipos", cb.value));

  const startDate = getById("filter-date-start").value;
  if (startDate) params.append("fechaInicio", startDate);

  const endDate = getById("filter-date-end").value;
  if (endDate) params.append("fechaFin", endDate); // 2. Construir la URL completa como un string

  const exportUrl = `${API_BASE_URL}/reportes/supervisor/export/pdf?${params.toString()}`; // 3. Abrir la URL en una nueva pestaña. El navegador hará el resto.

  // Opcional: Mostrar un mensaje de "Cargando..." al usuario
  showFeedback(
    "dashboard-feedback",
    "Generando PDF, por favor espera...",
    "info"
  );

  try {
    // 3. Llamar a la API usando fetchWithAuth para enviar el token
    const response = await fetchWithAuth(exportUrl);

    if (!response.ok) {
      throw new Error(
        "No se pudo generar el PDF. El servidor respondió con un error."
      );
    }

    // 4. Convertir la respuesta en un "blob" (un tipo de archivo)
    const pdfBlob = await response.blob();

    // 5. Crear una URL temporal en el navegador para este archivo
    const blobUrl = URL.createObjectURL(pdfBlob);

    // 6. Crear un enlace <a> fantasma para iniciar la descarga
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "historial_reportes.pdf"; // El nombre del archivo que verá el usuario

    // 7. Añadir el enlace al cuerpo, hacer clic en él y luego removerlo
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 8. Liberar la URL temporal de la memoria
    URL.revokeObjectURL(blobUrl);

    hideFeedback("dashboard-feedback");
  } catch (error) {
    console.error("Error al exportar PDF:", error);
    showFeedback("dashboard-feedback", "Error al generar el PDF.", "error");
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
    option.textContent = worker.name + " " + "(" + worker.lastname + ")"; // Asumimos 'name' y 'lastname'
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
  const safe = (v) => (v !== null && v !== undefined ? v : "—");
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
  // 1. Crear un objeto URLSearchParams, igual que en loadIncomingReports
  const params = new URLSearchParams();

  // 2. Recolectar valores de los checkboxes de ESTADO
  const checkedStates = document.querySelectorAll(
    'input[name="estados"]:checked'
  );
  checkedStates.forEach((checkbox) => {
    params.append("estados", checkbox.value);
  });

  // 3. Recolectar valores de los checkboxes de TIPO
  const checkedTypes = document.querySelectorAll('input[name="tipos"]:checked');
  checkedTypes.forEach((checkbox) => {
    params.append("tipos", checkbox.value);
  });

  // 4. Recolectar valores de las FECHAS
  const startDate = getById("filter-date-start").value;
  const endDate = getById("filter-date-end").value;
  if (startDate) {
    params.append("fechaInicio", startDate);
  }
  if (endDate) {
    params.append("fechaFin", endDate);
  }

  try {
    // 5. Llamar al nuevo endpoint de resumen con los filtros
    const response = await fetchWithAuth(
      `${API_BASE_URL}/reportes/supervisor/summary?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error(
        "La respuesta del servidor para los indicadores no fue exitosa."
      );
    }
    const summaryData = await response.json();

    // 6. Usar la función existente para renderizar los datos
    renderIndicators(summaryData);
  } catch (error) {
    console.error("Error al cargar indicadores:", error);
    // En caso de error, resetea los indicadores a un estado neutral
    renderIndicators({ total: "—", pending: "—", resolved: "—", byType: {} });
  }
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
      loadHistoryReports();
      loadIndicators(); // Actualizar indicadores
    }, 1500);
  } catch (error) {
    showFeedback("assign-modal-feedback", `Error: ${error.message}`, "error");
  }
}

// Inicialización del dashboard
document.addEventListener("DOMContentLoaded", () => {
  checkAuthAndRedirect("SUPERVISOR");

  if (getUserRole() === "SUPERVISOR") {
    loadHistoryReports(); // Cargar los reportes al iniciar
    loadIndicators(); // Cargar los indicadores al iniciar
    loadWorkers(); // Cargar los trabajadores al iniciar
  }

  // Agregar listener para el botón de refrescar
  const refreshBtn = getById("refresh-reports-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      currentPage = 0; // opcional: volver a primera página
      loadHistoryReports();
      loadIndicators();
    });
  }

  // Configurar listeners del modal de Asignación
  getById("close-assign-modal").addEventListener("click", () =>
    toggleModal("assign-report-modal", false)
  );
  getById("assign-form").addEventListener("submit", handleAssignFormSubmit);

  // 🚀 NUEVO: Agregar listeners para el formulario de filtros
  const filterForm = getById("filter-form");
  if (filterForm) {
    // Acción para el botón "Aplicar Filtros" (type="submit")
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Evita que la página se recargue
      currentPage = 0; // Siempre volver a la primera página al filtrar
      loadHistoryReports();
      loadIndicators(); // <-- AÑADIR AQUÍ
    });

    // Acción para el botón "Limpiar" (type="reset")
    filterForm.addEventListener("reset", () => {
      // Usamos un pequeño delay para asegurar que la recarga se pida
      // después de que el formulario se haya limpiado visualmente.
      setTimeout(() => {
        currentPage = 0;
        loadHistoryReports();
        loadIndicators(); // <-- AÑADIR AQUÍ
      }, 0);
    });
  }

  const exportPdfBtn = getById("export-pdf-btn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => {
      exportPdf();
    });
  }

  // Configurar paginación
  getById("prev-page").addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      loadHistoryReports();
    }
  });

  getById("next-page").addEventListener("click", () => {
    if (currentPage < totalPages - 1) {
      currentPage++;
      loadHistoryReports();
    }
  });
});
