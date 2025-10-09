import { registerUser } from "/assets/js/api.js";  // Importar la función para registrar

document.getElementById('register-form').addEventListener('submit', async function(e) {
    e.preventDefault();  // Prevenir la recarga de la página al enviar el formulario

    // Obtener valores del formulario
    const nombreCompleto = document.getElementById('nombreCompleto').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const telefono = document.getElementById('telefono').value;
    const fechaNacimiento = document.getElementById('fechaNacimiento').value;

    // Validación del Nombre Completo
    if (!nombreCompleto) {
        showMessage('El nombre completo es obligatorio.', 'error');
        return;
    }

    // Validación del Correo Electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showMessage('Por favor ingresa un correo electrónico válido.', 'error');
        return;
    }

    // Validación de la Contraseña
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,12}$/;
    if (!password || !passwordRegex.test(password)) {
        showMessage('La contraseña debe tener entre 8 y 12 caracteres, incluyendo al menos una mayúscula, una minúscula y un número.', 'error');
        return;
    }

    // Validación del Teléfono (opcional)
    if (telefono && !/^\+51 \d{9}$/.test(telefono)) {
        showMessage('El teléfono debe ser válido (Ej: +51 999888777).', 'error');
        return;
    }

    // Validación de la Fecha de Nacimiento
    if (!fechaNacimiento) {
        showMessage('La fecha de nacimiento es obligatoria.', 'error');
        return;
    }

    // Si todos los campos son válidos, intentar registrar al usuario
    const success = await registerUser(nombreCompleto, email, password, telefono, fechaNacimiento);

    if (success) {
        showMessage('Registro exitoso. Redirigiendo...', 'success');
        // Redirigir al usuario a una página de éxito o al login
        setTimeout(() => {
            window.location.href = 'login.html';  // Redirigir al login (ajustar según sea necesario)
        }, 2000);
    } else {
        showMessage('Hubo un error en el registro. Intenta nuevamente.', 'error');
    }
});

// Función para mostrar mensajes de error o éxito
function showMessage(message, type) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.className = 'message ' + type;
}
