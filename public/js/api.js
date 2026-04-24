// public/js/api.js — Puente entre Frontend y Backend
const API_BASE_URL = '/api';

async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        if (response.status === 401 && endpoint !== '/auth/login') {
            api.auth.logout();
            window.location.href = '/';
            return { success: false, message: 'Sesión expirada' };
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Error de conexión' };
    }
}

const api = {
    auth: {
        login: async (email, password) => {
            const data = await fetchAPI('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            if (data && data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            return data;
        },
        isAuthenticated: () => !!localStorage.getItem('token') && !!localStorage.getItem('user'),
        getUser: () => {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u) : null;
        },
        logout: () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    },
    divipole: {
        getMunicipios: () => fetchAPI('/divipole/municipios'),
        getPuestos: (municipioId) => fetchAPI(`/divipole/puestos/${municipioId}`)
    },
    testigos: {
        list: (search) => fetchAPI(`/testigos${search ? '?search=' + encodeURIComponent(search) : ''}`),
        create: (data) => fetchAPI('/testigos', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => fetchAPI(`/testigos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => fetchAPI(`/testigos/${id}`, { method: 'DELETE' })
    },
    alertas: {
        list: () => fetchAPI('/alertas'),
        create: (data) => fetchAPI('/alertas', { method: 'POST', body: JSON.stringify(data) })
    },
    comisiones: {
        list: () => fetchAPI('/comisiones'),
        create: (data) => fetchAPI('/comisiones', { method: 'POST', body: JSON.stringify(data) })
    },
    usuarios: {
        list: () => fetchAPI('/usuarios'),
        create: (data) => fetchAPI('/usuarios', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id) => fetchAPI(`/usuarios/${id}`, { method: 'DELETE' })
    },
    reportes: {
        testigos: (formato) => `${API_BASE_URL}/reportes/testigos?formato=${formato}`
    },
    e14: {
        upload: (data) => fetchAPI('/e14/upload', { method: 'POST', body: JSON.stringify(data) }),
        misActas: () => fetchAPI('/e14/mis-actas'),
        todas: () => fetchAPI('/e14/todas')
    }
};

window.api = api;
