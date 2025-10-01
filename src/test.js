// test.js

// Mensaje inmediato para saber si el archivo se está leyendo
console.log("Archivo test.js cargado y leyéndose...");

// Esperamos a que el HTML esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM listo. Se intentará cambiar el H1.");

    const heading = document.getElementById('test-heading');

    if (heading) {
        heading.textContent = '¡ÉXITO! JavaScript se está ejecutando correctamente.';
        heading.style.color = 'green';
        console.log("El H1 fue encontrado y modificado con éxito.");
    } else {
        console.error("ERROR CRÍTICO: No se pudo encontrar el elemento con id 'test-heading'.");
    }
});