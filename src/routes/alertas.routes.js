const express = require('express');
const prisma = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

// Crear una nueva alerta
router.post('/', authMiddleware, async (req, res) => {
  const { tipo_alerta, descripcion, puesto_id, mesa } = req.body;

  if (!tipo_alerta || !puesto_id) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos (tipo_alerta o puesto)' });
  }

  try {
    // Buscar a qué municipio pertenece el puesto
    const puesto = await prisma.divipole.findUnique({
        where: { id: puesto_id }
    });

    if (!puesto) {
        return res.status(404).json({ success: false, message: 'Puesto no encontrado' });
    }

    const nuevaAlerta = await prisma.alertasMesa.create({
      data: {
        tipo_alerta,
        descripcion,
        municipio_id: puesto.municipio_id,
        puesto_id,
        mesa: parseInt(mesa) || 0,
        reportado_por: req.user.id
      }
    });

    res.status(201).json({ success: true, message: 'Alerta registrada', data: nuevaAlerta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al registrar alerta' });
  }
});

// Listar alertas (todos, o filtrado por municipio_id)
router.get('/', authMiddleware, async (req, res) => {
  const { municipio_id } = req.query;
  const whereClause = {};

  if (municipio_id) {
    whereClause.municipio_id = municipio_id;
  }

  // Restringir la vista a los coordinadores a su propio municipio
  if (req.user.rol === 'Coordinador_Municipio') {
    whereClause.municipio_id = req.user.municipio_id;
  }

  try {
    const alertas = await prisma.alertasMesa.findMany({
      where: whereClause,
      include: {
        puesto: true,
        usuario: { select: { nombre: true, rol: true } }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: alertas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener alertas' });
  }
});

// Actualizar estado de una alerta (Solo Abogado y SuperAdmin)
router.patch('/:id/estado', authMiddleware, roleMiddleware(['SuperAdmin', 'Abogado_Juridico']), async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!['Pendiente', 'En_Revision', 'Resuelta'].includes(estado)) {
    return res.status(400).json({ success: false, message: 'Estado inválido' });
  }

  try {
    const alertaActualizada = await prisma.alertasMesa.update({
      where: { id },
      data: { estado }
    });
    res.json({ success: true, message: 'Estado actualizado', data: alertaActualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar alerta' });
  }
});

module.exports = router;
