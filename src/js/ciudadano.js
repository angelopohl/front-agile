// ----------------------------------------------------------------
// ciudadano.js: Lógica del Dashboard del Ciudadano
// ----------------------------------------------------------------

import {
  checkAuthAndRedirect,
  getUserRole,
  API_BASE_URL,
  getAccessToken,
  getCurrentUser,
} from "./auth.js";
import { fetchWithAuth } from "./api.js";
import {
  getById,
  toggleModal,
  showFeedback,
  hideFeedback,
} from "../utils/dom.js";

const reportForm = getById("report-form");
const detectBtn = getById("detect-location-btn");
const locationInput = getById("report-location");
const descriptionInput = getById("report-description");
const photosInput = getById("report-photos");
const reportFeedbackId = "report-modal-feedback";
const cancelBtn = getById("cancel-report-btn");

const REPORTS_PER_PAGE = 10;
let currentPage = 0;
let totalPages = 1;
let currentRating = 0;

// Función visual para pintar estrellas
function updateStarsUI(value) {
  const stars = document.querySelectorAll(".star-rating .star");
  stars.forEach((s) => {
    if (parseInt(s.dataset.value) <= value) {
      s.classList.add("active");
    } else {
      s.classList.remove("active");
    }
  });
}

// Util: contar palabras
function wordCount(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

// Formatear fecha y hora con segundos: DD/MM/YYYY HH:mm:ss
function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatDateTimeWithSeconds(input) {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d)) return String(input);
  return `${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1
  )}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds()
  )}`;
}

// Reverse geocoding para obtener address desde lat/lng
async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    return data.display_name || `Lat: ${lat}, Lng: ${lng}`;
  } catch (err) {
    return `Lat: ${lat}, Lng: ${lng}`;
  }
}

function openRateModal(reportId) {
  getById("rate-report-id").value = reportId;
  getById("selected-rating").value = "";
  getById("rate-comment").value = "";
  currentRating = 0;
  updateStarsUI(0);
  hideFeedback("rate-feedback");
  toggleModal("rate-modal", true);
}

async function handleRateSubmit(e) {
  e.preventDefault();
  const reportId = getById("rate-report-id").value;
  const rating = getById("selected-rating").value;
  const comment = getById("rate-comment").value;
  const feedbackId = "rate-feedback";

  // AC #4: Calificación obligatoria
  if (!rating) {
    showFeedback(
      feedbackId,
      "Debe seleccionar una calificación (estrellas).",
      "error"
    );
    return;
  }

  try {
    const payload = {
      rating: parseInt(rating),
      comment: comment,
    };

    const resp = await fetchWithAuth(
      `${API_BASE_URL}/reporte/${reportId}/rate`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!resp.ok) throw new Error("Error al enviar calificación");

    // AC #5: Mensaje de confirmación
    showFeedback(feedbackId, "Gracias por su retroalimentación", "success");

    setTimeout(() => {
      toggleModal("rate-modal", false);
      loadReports(); // Recargar para ver el cambio a "solo lectura"
    }, 2000);
  } catch (err) {
    showFeedback(feedbackId, err.message, "error");
  }
}

// Detección de ubicación (autocompletar con coords)
if (detectBtn) {
  detectBtn.addEventListener("click", () => {
    hideFeedback(reportFeedbackId);
    if (!navigator.geolocation) {
      showFeedback(
        reportFeedbackId,
        "Geolocalización no soportada por este navegador.",
        "error"
      );
      return;
    }
    detectBtn.disabled = true;
    detectBtn.textContent = "Detectando...";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        try {
          const address = await reverseGeocode(lat, lon);
          locationInput.value = address;
          locationInput.dataset.lat = lat;
          locationInput.dataset.lng = lon;
          locationInput.dataset.address = address;
        } catch (error) {
          locationInput.value = `${lat}, ${lon}`;
        } finally {
          detectBtn.disabled = false;
          detectBtn.textContent = "Detectar ubicación";
        }
      },
      (err) => {
        detectBtn.disabled = false;
        detectBtn.textContent = "Detectar ubicación";
        showFeedback(
          reportFeedbackId,
          "No se pudo obtener la ubicación: " + err.message,
          "error"
        );
      },
      {
        enableHighAccuracy: true, // <-- ¡Esta es la línea clave! Pide la máxima precisión (GPS).
        timeout: 10000, // Tiempo máximo de espera para una respuesta.
        maximumAge: 0,
      }
    );
  });
}

// Cancelar / cerrar modal (si aplica)
if (cancelBtn) {
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    // cerrar modal: suponer toggleModal existe o simplemente limpiar form
    const modal = document.getElementById("new-report-modal");
    if (modal) modal.classList.remove("open");
    reportForm.reset();
    hideFeedback(reportFeedbackId);
  });
}

/**
 * Dibuja la tabla de reportes en el DOM.
 * @param {Array<Object>} reports - Lista de reportes.
 * @param {number} totalPagesFromServer - Total de páginas desde el servidor.
 * @param {string} [customEmptyMessage] - Mensaje a mostrar si no hay reportes.
 */
function renderReports(
  reports,
  totalPagesFromServer = 1,
  customEmptyMessage = "No hay reportes disponibles."
) {
  const tableBody = getById("reports-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!reports || reports.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="4" style="text-align:center;">${customEmptyMessage}</td></tr>
    `;
  } else {
    reports.forEach((report) => {
      const row = tableBody.insertRow();
      const statusClass =
        report.status === "RESUELTO" ? "status-resolved" : "status-pending";

      const createdAtRaw = report.createdAt ?? report.date ?? report.created;
      const createdAtFormatted = formatDateTimeWithSeconds(createdAtRaw);

      let actionCellHTML = "-";

      if (report.status === "RESUELTO") {
        if (report.rating) {
          actionCellHTML = `<span style="color:#f39c12">★ ${report.rating}/5</span>`;
        } else {
          actionCellHTML = `<button class="btn-primary btn-sm rate-btn" data-report-id="${report.id}">Calificar Servicio</button>`;
        }
      }

      row.innerHTML = `
        <td>${createdAtFormatted}</td>
        <td>${
          report.type === "RESIDUOS_SOLIDOS"
            ? "Residuos Sólidos"
            : report.type === "BARRIDO"
            ? "Barrido"
            : "Maleza"
        }</td>
        <td class="${statusClass}">${report.status}</td>
        <td>${actionCellHTML}</td>
      `;

      // Listener para el botón "Calificar"
      const rateBtn = row.querySelector(".rate-btn");
      if (rateBtn) {
        rateBtn.addEventListener("click", () => {
          const reportId = rateBtn.dataset.reportId;
          openRateModal(reportId);
        });
      }
    });
  }

  // Actualizar UI de paginación
  const pageInfoEl = getById("page-info");
  if (pageInfoEl) {
    pageInfoEl.textContent = `Página ${
      currentPage + 1
    } de ${totalPagesFromServer}`;
  }

  const prevBtn = getById("prev-page");
  const nextBtn = getById("next-page");
  if (prevBtn) prevBtn.disabled = currentPage === 0;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPagesFromServer - 1;
}

/**
 * Carga los reportes del ciudadano, aplicando los filtros de estado.
 */
async function loadReports() {
  const tableBody = getById("reports-table-body");
  if (tableBody) {
    tableBody.innerHTML = `
      <tr><td colspan="3" style="text-align:center;">Cargando reportes...</td></tr>
    `;
  }

  // 1. Obtener el valor del filtro seleccionado
  // Usamos .value, que será "PENDIENTE", "RESUELTO" o "" (para "Todos")
  const filterValue =
    document.querySelector('input[name="estado"]:checked')?.value || "";

  // 2. Construir los parámetros de la URL
  const params = new URLSearchParams();
  params.append("page", currentPage);
  params.append("size", REPORTS_PER_PAGE);
  params.append("sort", "createdAt,desc"); // AC 4: Ordenados del más reciente al más antiguo
  if (filterValue) {
    // Si el valor no es "", lo añadimos al query
    params.append("estado", filterValue);
  }

  try {
    // 3. Llamar a la API con los parámetros (ej: .../me?page=0&estado=PENDIENTE)
    const resp = await fetchWithAuth(
      `${API_BASE_URL}/reportes/me?${params.toString()}`
    );

    const pageData = await resp.json();

    // 4. Renderizar los datos o el mensaje de "no encontrado"
    if (pageData && pageData.content && pageData.content.length > 0) {
      totalPages = pageData.totalPages || 1;
      renderReports(pageData.content, pageData.totalPages);
    } else {
      // AC 8: Mostrar mensaje específico si no hay reportes para ese filtro
      totalPages = 1;
      currentPage = 0;
      const message = filterValue
        ? "No se encontraron reportes en este estado." // Mensaje con filtro
        : "No hay reportes disponibles."; // Mensaje sin filtro
      renderReports([], 1, message); // Pasamos el mensaje a renderReports
    }
  } catch (error) {
    console.error("Error al cargar reportes:", error);
    showFeedback(
      "dashboard-feedback",
      "Error al cargar el historial de reportes.",
      "error"
    );
    // Asegurarse de que renderReports limpie la tabla en caso de error
    renderReports([], 1, "Error al cargar reportes.");
  }
}

/**
 * Maneja el envío del formulario de nuevo reporte.
 * @param {Event} event
 */
if (reportForm) {
  reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFeedback(reportFeedbackId);

    const submitBtn = reportForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const type = (getById("report-type") || {}).value || "";
      const location = (locationInput || {}).value.trim();
      const description = (descriptionInput || {}).value.trim();
      const files = (photosInput || {}).files || [];

      // Validaciones
      const missing = [];
      if (!type) missing.push("Tipo de reporte");
      if (!location) missing.push("Ubicación");
      if (!files || files.length === 0)
        missing.push("Foto del problema (al menos 1)");

      if (missing.length > 0) {
        showFeedback(reportFeedbackId, "Falta: " + missing.join(", "), "error");
        submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
        return;
      }

      // Descripción: máximo 15 palabras
      const descWords = wordCount(description);
      if (descWords > 15) {
        showFeedback(
          reportFeedbackId,
          `La descripción no puede superar 15 palabras (actual: ${descWords}).`,
          "error"
        );
        submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
        return;
      }

      // Validar tipos de archivo
      const allowed = ["image/jpeg", "image/png"];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!allowed.includes(f.type)) {
          showFeedback(
            reportFeedbackId,
            `Formato de archivo no válido: ${f.name}. Solo jpg/png permitidos.`,
            "error"
          );
          submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
          return;
        }
      }

      // Verificar token antes de enviar
      const token = getAccessToken && getAccessToken();
      if (!token) {
        showFeedback(
          reportFeedbackId,
          "No hay token de acceso. Inicie sesión nuevamente.",
          "error"
        );
        submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
        return;
      }

      showFeedback(reportFeedbackId, "Subiendo imagen...", "info");

      // Si solo se permite 1 imagen: usar la primera
      const filesArray = Array.from(files);
      if (filesArray.length > 1) {
        showFeedback(
          reportFeedbackId,
          "Solo se permite una imagen. Se usará la primera.",
          "info"
        );
      }

      const fileToUpload = filesArray[0];
      let photoUrl;

      try {
        photoUrl = await uploadFileToCloudinary(fileToUpload);
      } catch (err) {
        showFeedback(
          reportFeedbackId,
          "Error subiendo la imagen: " + err.message,
          "error"
        );
        submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
        return;
      }

      if (!photoUrl) {
        showFeedback(
          reportFeedbackId,
          "Error subiendo la imagen: no se obtuvo URL.",
          "error"
        );
        submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
        return;
      }

      // Parsear location -> lat/lng
      const latStr = locationInput?.dataset?.lat;
      const lngStr = locationInput?.dataset?.lng;
      const address = locationInput?.dataset?.address || location;
      const lat = latStr ? parseFloat(latStr) : null;
      const lng = lngStr ? parseFloat(lngStr) : null;

      const user = getCurrentUser();
      const payload = {
        type,
        description: description || null, // ⚠️ Enviar null si está vacío
        location: {
          lat: isFinite(lat) ? lat : null,
          lng: isFinite(lng) ? lng : null,
          address: address,
        },
        photos: [photoUrl],
        zone: "Zona centro", // El backend asigna la zona según la ubicación
        status: "PENDIENTE",
        citizenId: user?.id,
        citizenName: user?.name,
        citizenPhone: user?.phone,
        citizenEmail: user?.email,
      };

      // Enviar JSON al backend
      showFeedback(reportFeedbackId, "Registrando reporte...", "info");

      const resp = await fetchWithAuth(`${API_BASE_URL}/reporte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        let errText = `Error al registrar: ${resp.status}`;
        try {
          const errJson = await resp.json();
          if (errJson?.message) {
            errText = errJson.message;
          }
        } catch (_) {
          const txt = await resp.text().catch(() => "");
          if (txt) errText += ` — ${txt}`;
        }
        showFeedback(reportFeedbackId, errText, "error");
        submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
        return;
      }

      // Éxito
      showFeedback(reportFeedbackId, "Reporte registrado con éxito", "success");
      reportForm.reset();

      // Cerrar modal después de 1.5 segundos
      const modal = document.getElementById("new-report-modal");
      setTimeout(() => {
        if (modal) modal.classList.remove("open");
        hideFeedback(reportFeedbackId);
        submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
      }, 1500);

      // Recargar reportes
      if (typeof loadReports === "function") {
        loadReports();
      }
    } catch (error) {
      // Error de red o inesperado
      console.error("Error en submit de reporte:", error);
      showFeedback(
        reportFeedbackId,
        "Error al registrar: " + error.message,
        "error"
      );
      submitBtn.disabled = false; // ⚠️ REACTIVAR BOTÓN
    }
  });

  // ========================================
  // FUNCIÓN PARA SUBIR ARCHIVO A CLOUDINARY
  // ========================================
  async function uploadFileToCloudinary(file) {
    const fd = new FormData();
    fd.append("file", file);

    const token = getAccessToken && getAccessToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${API_BASE_URL}/reporte/cargar`, {
        method: "POST",
        headers, // NO incluir Content-Type para FormData
        body: fd,
      });
    } catch (err) {
      throw new Error("Error de red al subir imagen: " + err.message);
    }

    // Leer respuesta una sola vez
    const rawText = await res.text().catch(() => null);

    if (!res.ok) {
      throw new Error(
        `Error subiendo imagen: ${res.status}${rawText ? " — " + rawText : ""}`
      );
    }

    // Intentar parsear JSON
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      data = rawText;
    }

    // Si la API devuelve directamente una URL en texto
    if (typeof data === "string" && data.trim()) {
      return data.trim();
    }

    // Buscar URL en diferentes ubicaciones del JSON
    const candidates = [
      data?.secure_url,
      data?.url,
      data?.data?.secure_url,
      data?.data?.url,
      data?.result?.secure_url,
      data?.result?.url,
      data?.files?.[0]?.url,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) {
        return c.trim();
      }
    }

    // Si es un array, buscar la primera URL
    if (Array.isArray(data)) {
      const firstUrl = data.find(
        (d) => typeof d === "string" && /^https?:\/\//.test(d)
      );
      if (firstUrl) return firstUrl;
    }

    console.error(
      "uploadFileToCloudinary: respuesta inesperada:",
      data,
      "rawText:",
      rawText
    );
    throw new Error("No se pudo obtener la URL de la imagen subida");
  }
}

// Inicialización del dashboard
document.addEventListener("DOMContentLoaded", () => {
  // 1. Verificar autenticación y rol
  checkAuthAndRedirect("CIUDADANO");

  // 2. Cargar datos
  if (getUserRole() === "CIUDADANO") {
    loadReports();
  }

  // 3. Configurar listeners del modal de Reporte
  getById("create-report-btn").addEventListener("click", () => {
    toggleModal("new-report-modal", true);
    getById("report-form").reset();
    getById("report-modal-feedback").style.display = "none";
  });

  getById("close-report-modal").addEventListener("click", () =>
    toggleModal("new-report-modal", false)
  );

  // 4. Configurar listeners del formulario de filtros
  const filterForm = getById("filter-form");
  if (filterForm) {
    // Listener para el botón "Aplicar Filtro"
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Evitar recarga de página
      currentPage = 0; // Al filtrar, volver a la página 1
      loadReports();
    });

    // Listener para el botón "Limpiar" (AC 6)
    filterForm.addEventListener("reset", () => {
      // Usar setTimeout para ejecutar loadReports DESPUÉS de que el form se resetee
      setTimeout(() => {
        currentPage = 0;
        loadReports();
      }, 0);
    });
  }

  // 5. Configurar paginación
  const prevEl = getById("prev-page");
  const nextEl = getById("next-page");

  if (prevEl) {
    prevEl.addEventListener("click", () => {
      if (currentPage > 0) {
        currentPage--;
        loadReports();
      }
    });
  }

  if (nextEl) {
    nextEl.addEventListener("click", () => {
      if (currentPage < totalPages - 1) {
        currentPage++;
        loadReports();
      }
    });
  }

  // Configurar estrellas
  const stars = document.querySelectorAll(".star-rating .star");
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      const val = parseInt(star.dataset.value);
      currentRating = val;
      document.getElementById("selected-rating").value = val;
      updateStarsUI(val);
    });
  });

  // Configurar Formulario de Calificación
  const rateForm = getById("rate-form");
  if (rateForm) {
    rateForm.addEventListener("submit", handleRateSubmit);
  }

  getById("close-rate-modal")?.addEventListener("click", () =>
    toggleModal("rate-modal", false)
  );
});
