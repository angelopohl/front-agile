const tableBody = document.getElementById("report-table-body");
const paginationWrapper = document.getElementById("pagination-wrapper");

export function renderLoading() {
  tableBody.innerHTML = `<tr><td colspan="3">Cargando reportes...</td></tr>`;
  paginationWrapper.innerHTML = "";
}

export function renderError() {
  tableBody.innerHTML = `<tr><td colspan="3">No se pudieron cargar los reportes. Inténtalo de nuevo.</td></tr>`;
}

export function renderTable(items) {
  tableBody.innerHTML = "";

  console.log("Renderizando tabla con items:", items.length);

  if (items.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3">No hay reportes para mostrar.</td></tr>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("tr");
    const estadoClass = item.status === "PENDIENTE" ? "pendiente" : "resuelto";
    const fechaFormateada = new Date(item.createdAt).toLocaleDateString(
      "es-ES",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
    row.innerHTML = `
            <td>${fechaFormateada}</td>
            <td>${
              item.type === "RESIDUOS_SOLIDOS"
                ? "Residuos Solidos"
                : item.type === "BARRIDO"
                ? "Barrido"
                : "Maleza"
            }</td>
            <td><span class="status ${estadoClass}">${item.status}</span></td>
        `;
    tableBody.appendChild(row);
  });
}

export function renderPagination(totalPages, currentPage, onPageClick) {
  paginationWrapper.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement("a");
    button.href = "#";
    button.innerText = i;
    button.classList.add("page-number");

    // Comparar con currentPage + 1 porque currentPage viene de la API (base 0)
    if (currentPage + 1 === i) {
      button.classList.add("active");
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      // Enviar i - 1 para que la API reciba páginas base 0
      onPageClick(i - 1);
    });

    paginationWrapper.appendChild(button);
  }
}
