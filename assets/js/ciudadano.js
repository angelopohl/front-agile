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
      { timeout: 10000 }
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
 */
function renderReports(reports, totalPagesFromServer = 1) {
  const tableBody = getById("reports-table-body");
  if (!tableBody) return;

  // Si el backend ya devuelve solo la página actual, no es necesario slice aquí.
  tableBody.innerHTML = ""; // Limpiar contenido anterior

  reports.forEach((report) => {
    const row = tableBody.insertRow();
    const statusClass =
      report.status === "RESUELTO" ? "status-resolved" : "status-pending";

    // Formatear createdAt con segundos (fallback si la propiedad tiene otro nombre)
    const createdAtRaw = report.createdAt ?? report.date ?? report.created;
    const createdAtFormatted = formatDateTimeWithSeconds(createdAtRaw);

    row.innerHTML = `
            <td>${createdAtFormatted}</td>
            <td>${report.type}</td>
            <td class="${statusClass}">${report.status}</td>
        `;
  });

  // Mostrar número de página (usuario espera 1-based en la UI)
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
 * Función que simula la obtención de datos (debería usar fetchWithAuth en la realidad).
 */
async function loadReports() {
  try {
    const resp = await fetchWithAuth(
      `${API_BASE_URL}/reportes?page=${currentPage}&size=${REPORTS_PER_PAGE}&sort=createdAt,desc`
    );
    const data = await resp.json();
    console.log("Datos de reportes:", data);

    // data.content suele contener la página actual
    const reports = Array.isArray(data.content)
      ? data.content
      : Array.isArray(data)
      ? data
      : [];
    // Obtener usuario actual
    const user = getCurrentUser();
    const userId = user?.id ?? user?.sub ?? null;

    // Filtrar por citizenId / owner / campo que use tu API
    let myReports = reports;
    if (userId != null) {
      myReports = reports.filter((r) => {
        // soporta varios formatos: r.citizenId, r.citizen?.id, r.userId, etc.
        return (
          String(
            r.citizenId ?? r.userId ?? r.citizen?.id ?? r.ownerId ?? ""
          ) === String(userId)
        );
      });
    }

    // Si el backend ya devolvía paginado y filtrado correctamente, myReports === reports.
    // Calcular totalPages desde la longitud filtrada si el backend no lo hizo.
    const totalElementsFromServer =
      typeof data.totalElements === "number" ? data.totalElements : null;
    const serverTotalPages =
      typeof data.totalPages === "number" ? data.totalPages : null;

    // Si el backend devolvió totalPages y supones que ya vino filtrado, úsalos.
    // Si no, recalcula a partir de myReports (paginación en cliente).
    if (serverTotalPages && (reports.length === myReports.length || !userId)) {
      totalPages = serverTotalPages;
      // renderizar directamente los reports recibidos (asume backend ya paginó)
      renderReports(myReports, totalPages);
    } else {
      // paginación en cliente: recalcular totalPages y tomar slice para la página actual
      const filteredTotalElements = myReports.length;
      totalPages = Math.max(
        1,
        Math.ceil(filteredTotalElements / REPORTS_PER_PAGE)
      );

      // ajustar currentPage si quedó fuera de rango
      if (currentPage > totalPages - 1)
        currentPage = Math.max(0, totalPages - 1);

      const start = currentPage * REPORTS_PER_PAGE;
      const pageReports = myReports.slice(start, start + REPORTS_PER_PAGE);

      renderReports(pageReports, totalPages);
    }
  } catch (error) {
    console.error("Error al cargar reportes:", error);
    showFeedback(
      "dashboard-feedback",
      "Error al cargar el historial de reportes.",
      "error"
    );
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
        return;
      }
    }
    // Subir archivos a Cloudinary (o a tu endpoint que haga proxy a Cloudinary),
    // obtener URLs y luego enviar JSON al backend que espera ReporteDto.
    async function uploadFileToCloudinary(file) {
      const fd = new FormData();
      fd.append("file", file);
      // si tu endpoint necesita otros campos (upload_preset, api_key...), añádelos aquí
      const token = getAccessToken && getAccessToken();
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let res;
      try {
        res = await fetch(`${API_BASE_URL}/reporte/cargar`, {
          method: "POST",
          headers, // NO Content-Type aquí
          body: fd,
        });
      } catch (err) {
        throw new Error("Error de red al subir imagen: " + err.message);
      }
      // Leer el body una sola vez como texto (evita bodyUsed issues)
      const rawText = await res.text().catch(() => null);
      console.log("Respuesta de upload:", res, "rawText:", rawText);

      if (!res.ok) {
        throw new Error(
          `Error subiendo imagen: ${res.status}${
            rawText ? " — " + rawText : ""
          }`
        );
      }

      // Intentar parsear JSON; si falla usar el texto crudo
      let data;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (_) {
        data = rawText;
      }

      // Si la API devuelve directamente una URL en texto
      if (typeof data === "string" && data.trim()) return data.trim();
      if (!data && rawText) return rawText;

      // Buscar posibles ubicaciones de la URL en la respuesta JSON
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
        if (typeof c === "string" && c.trim()) return c.trim();
      }

      if (Array.isArray(data)) {
        const firstUrl = data.find(
          (d) => typeof d === "string" && /^https?:\/\//.test(d)
        );
        if (firstUrl) return firstUrl;
      }

      console.warn(
        "uploadFileToCloudinary: respuesta inesperada:",
        data,
        "rawText:",
        rawText
      );
      return null;
    }

    try {
      // Verificar token antes de enviar
      const token = getAccessToken && getAccessToken();
      if (!token) {
        showFeedback(
          reportFeedbackId,
          "No hay token de acceso. Inicie sesión nuevamente.",
          "error"
        );
        return;
      }

      showFeedback(reportFeedbackId, "Subiendo imágen...", "info");
      // Si solo se permite 1 imagen: usar la primera (avisar si enviaron más)
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
        return;
      }

      if (!photoUrl) {
        showFeedback(
          reportFeedbackId,
          "Error subiendo la imagen: no se obtuvo URL.",
          "error"
        );
        return;
      }

      // parsear location -> lat/lng
      const latStr = locationInput?.dataset?.lat;
      const lngStr = locationInput?.dataset?.lng;
      const address = locationInput?.dataset?.address || location;
      const lat = latStr ? parseFloat(latStr) : null;
      const lng = lngStr ? parseFloat(lngStr) : null;

      const user = getCurrentUser();
      console.log("Usuario actual:", user);
      const payload = {
        type,
        description,
        location: {
          lat: isFinite(lat) ? lat : null,
          lng: isFinite(lng) ? lng : null,
          address: address,
        },
        photos: [photoUrl],
        zone: "Zona centro", // el backend asigna la zona según la ubicación
        status: "PENDIENTE", // estado inicial
        citizenId: user?.id,
        citizenName: user?.name,
        citizenPhone: user?.phone,
        citizenEmail: user?.email,
      };

      // enviar JSON al backend (ReporteDto espera JSON)
      const resp = await fetchWithAuth(`${API_BASE_URL}/reporte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        // intentar leer mensaje de error del backend
        let errText = `Error al registrar: ${resp.status}`;
        try {
          const errJson = await resp.json();
          if (errJson && errJson.message) errText = errJson.message;
          else {
            // si no viene JSON, obtener texto para pistas
            const txt = await resp.text().catch(() => null);
            if (txt) errText += ` — ${txt}`;
          }
        } catch (_) {}
        showFeedback(reportFeedbackId, errText, "error");
        return;
      }

      // éxito
      showFeedback(reportFeedbackId, "Reporte registrado con éxito", "success");
      reportForm.reset();
      // opcional: recargar tabla/actualizar UI
      const modal = document.getElementById("new-report-modal");
      setTimeout(() => {
        if (modal) modal.classList.remove("open");
        hideFeedback(reportFeedbackId);
      }, 1500);
      loadReports();
    } catch (error) {
      // error de red
      showFeedback(
        reportFeedbackId,
        "Error al registrar (problema de red): " + error.message,
        "error"
      );
    }
  });
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

  // 4. Configurar paginación
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
});
