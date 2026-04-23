const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const divipoleRoutes = require('./routes/divipole.routes');
const testigosRoutes = require('./routes/testigos.routes');
const alertasRoutes = require('./routes/alertas.routes');

const app = express();

const path = require('path');

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../public')));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Electoral API is running' });
});

const comisionRoutes = require('./routes/comision.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const reportesRoutes = require('./routes/reportes.routes');

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/divipole', divipoleRoutes);
app.use('/api/testigos', testigosRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/comisiones', comisionRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/reportes', reportesRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
