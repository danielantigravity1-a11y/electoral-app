const express = require('express');
const prisma = require('../config/db');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

// Listar todos los municipios
router.get('/municipios', authMiddleware, async (req, res) => {
  try {
    const municipios = await prisma.municipio.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json({ success: true, data: municipios });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener municipios' });
  }
});

// Listar todos los puestos de un municipio específico
router.get('/puestos/:municipioId', authMiddleware, async (req, res) => {
  const { municipioId } = req.params;
  
  try {
    const puestos = await prisma.divipole.findMany({
      where: { municipio_id: municipioId },
      orderBy: { nombre_puesto: 'asc' }
    });
    res.json({ success: true, data: puestos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener puestos de votación' });
  }
});

module.exports = router;
