const API_BASE_URL =
  "https://trujillo-informado-backend-3b3a9e8b54ac.herokuapp.com/api/v1";
/**
 @param {string} email 
 @param {string} password 
 @returns {Promise<Object>} 
**/

export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Credenciales incorrectas");
  }

  return response.json();
}

export async function fetchReportes(page, size) {
  const url = `${API_BASE_URL}/reportes?page=${page}&size=${size}&sort=createdAt,desc`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Error HTTP: ${response.status} - ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error en fetchReportes:", error);
    throw error;
  }
}
