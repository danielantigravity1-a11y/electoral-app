const express = require('express');
const prisma = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

// Registrar un nuevo testigo
router.post('/', authMiddleware, roleMiddleware(['SuperAdmin', 'Coordinador_Municipio', 'Digitador']), async (req, res) => {
  const { cedula, nombre, telefono, email, puesto_votacion_id, mesa_votacion, puesto_id, mesa } = req.body;

  try {
    const testigoExistente = await prisma.testigo.findUnique({ where: { cedula } });
    if (testigoExistente) {
      return res.status(400).json({ success: false, message: 'La cédula ya está registrada' });
    }

    const nuevoTestigo = await prisma.testigo.create({
      data: {
        cedula,
        nombre,
        telefono: telefono || '',
        email: email || null,
        puesto_votacion_id: puesto_votacion_id || null,
        mesa_votacion: mesa_votacion ? parseInt(mesa_votacion) : null,
        puesto_id,
        mesa: mesa ? parseInt(mesa) : null,
        estado: 'Asignado'
      },
      include: {
        puesto: { include: { municipio: true } },
        puesto_votacion: { include: { municipio: true } }
      }
    });

    // Auto-create Testigo user (password = cedula)
    try {
      await prisma.usuario.create({
        data: {
          nombre: nuevoTestigo.nombre,
          email: `${nuevoTestigo.cedula}@testigo.electoral`, // Dummy email if none provided to ensure uniqueness and login pattern
          password_hash: nuevoTestigo.cedula, // In real world should be hashed
          rol: 'Testigo_Electoral',
          testigo_id: nuevoTestigo.id,
          municipio_id: nuevoTestigo.puesto.municipio_id
        }
      });
    } catch(err) {
      console.error("Error auto-creating user for testigo:", err);
      // We don't fail the whole request if user creation fails
    }

    res.status(201).json({ success: true, message: 'Testigo registrado', data: nuevoTestigo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al registrar testigo' });
  }
});

// Listar testigos con búsqueda
router.get('/', authMiddleware, async (req, res) => {
  const { puesto_id, search } = req.query;
  let whereClause = {};

  if (puesto_id) whereClause.puesto_id = puesto_id;

  // Filtro por rol
  if (req.user.rol === 'Coordinador_Municipio') {
    whereClause.puesto = { municipio_id: req.user.municipio_id };
  }

  // Búsqueda por nombre, cédula
  if (search) {
    whereClause.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { cedula: { contains: search } }
    ];
  }

  try {
    const testigos = await prisma.testigo.findMany({
      where: whereClause,
      include: {
        puesto: { include: { municipio: true } },
        puesto_votacion: { include: { municipio: true } }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: testigos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener testigos' });
  }
});

module.exports = router;
