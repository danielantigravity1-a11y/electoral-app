const express = require('express');
const prisma = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const router = express.Router();

// Cliente R2 para subir fotos de evidencia
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME || 'e14-sucre';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Crear una nueva alerta (con foto opcional)
router.post('/', authMiddleware, async (req, res) => {
  const { tipo_alerta, descripcion, puesto_id, mesa, foto_base64 } = req.body;

  if (!tipo_alerta || !puesto_id) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos (tipo_alerta o puesto)' });
  }

  try {
    const puesto = await prisma.divipole.findUnique({ where: { id: puesto_id } });
    if (!puesto) return res.status(404).json({ success: false, message: 'Puesto no encontrado' });

    let foto_url = null;

    // Si viene una foto, subirla a Cloudflare R2
    if (foto_base64) {
      try {
        const base64Data = foto_base64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        let contentType = 'image/jpeg';
        if (foto_base64.startsWith('data:image/png')) contentType = 'image/png';
        const ext = contentType.split('/')[1];
        const fileName = `alerta_${Date.now()}_${req.user.id.slice(0,8)}.${ext}`;

        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: fileName,
          Body: imageBuffer,
          ContentType: contentType,
        }));

        foto_url = `${PUBLIC_URL}/${fileName}`;
      } catch (uploadErr) {
        console.error("Error subiendo foto de alerta:", uploadErr);
        // No bloqueamos la alerta si falla la foto
      }
    }

    const nuevaAlerta = await prisma.alertasMesa.create({
      data: {
        tipo_alerta,
        descripcion,
        municipio_id: puesto.municipio_id,
        puesto_id,
        mesa: parseInt(mesa) || 0,
        reportado_por: req.user.id,
        foto_url
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

  if (municipio_id) whereClause.municipio_id = municipio_id;

  if (req.user.rol === 'Coordinador_Municipio') {
    whereClause.municipio_id = req.user.municipio_id;
  }

  try {
    const alertas = await prisma.alertasMesa.findMany({
      where: whereClause,
      include: {
        puesto: { include: { municipio: true } },
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
