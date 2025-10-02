import { fetchReportes } from './utils/api/apiService.js';
import { renderLoading, renderError, renderTable, renderPagination } from './components/reportesView.js';

const FILAS_POR_PAGINA = 5;
let paginaActual = 1;

async function cargarYMostrarReportes(page) {
    paginaActual = page;
    renderLoading();

    try {
        const data = await fetchReportes(page, FILAS_POR_PAGINA);
        renderTable(data.content);
        renderPagination(data.totalPages, data.currentPage, cargarYMostrarReportes);
    } catch (error) {
        renderError();
    }
}

function init() {
    document.addEventListener('DOMContentLoaded', () => {
        cargarYMostrarReportes(paginaActual);
    });
}

init();