import { fetchReportes } from "../utils/api/apiService.js";
import {
  renderLoading,
  renderError,
  renderTable,
  renderPagination,
} from "../components/reportesView.js";

const FILAS_POR_PAGINA = 10;
let paginaActual = 0;

const tableBody = document.getElementById("report-table-body");
const paginationWrapper = document.getElementById("pagination-wrapper");

async function cargarYMostrarReportes(page) {
  paginaActual = page;
  renderLoading();
  try {
    const data = await fetchReportes(page, FILAS_POR_PAGINA);
    console.log("Datos recibidos:", data.content);
    console.log(
      "Página actual:",
      data.currentPage,
      "Total páginas:",
      data.totalPages
    );

    renderTable(data.content);
    renderPagination(
      data.totalPages,
      data.currentPage, // Este viene de la API (base 0)
      cargarYMostrarReportes
    );
  } catch (error) {
    console.error("Error al cargar reportes:", error);
    renderError();
  }
}

function init() {
  document.addEventListener("DOMContentLoaded", () => {
    if (tableBody) {
      cargarYMostrarReportes(paginaActual);
    }
  });
}

init();
