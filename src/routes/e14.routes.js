const express = require('express');
const prisma = require('../config/db');
const { authMiddleware } = require('../middleware/auth.middleware');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const router = express.Router();

// Configurar cliente S3 compatible con Cloudflare R2
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

// Subir foto del E-14
// Recibe la imagen como base64 en el body (para evitar dependencia de multer)
router.post('/upload', authMiddleware, async (req, res) => {
  const { imagen_base64, mesa } = req.body;

  if (!imagen_base64) {
    return res.status(400).json({ success: false, message: 'No se recibió ninguna imagen' });
  }

  try {
    // Buscar testigo asociado al usuario
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      include: { testigo: true }
    });

    if (!usuario || !usuario.testigo) {
      return res.status(400).json({ success: false, message: 'No se encontró un testigo asociado a su cuenta' });
    }

    const testigo = usuario.testigo;

    if (!testigo.puesto_id) {
      return res.status(400).json({ success: false, message: 'No tiene un puesto asignado' });
    }

    const mesaNum = mesa ? parseInt(mesa) : (testigo.mesa || 1);

    // Convertir base64 a buffer
    const base64Data = imagen_base64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Detectar tipo de imagen
    let contentType = 'image/jpeg';
    if (imagen_base64.startsWith('data:image/png')) contentType = 'image/png';
    else if (imagen_base64.startsWith('data:image/webp')) contentType = 'image/webp';

    const ext = contentType.split('/')[1];

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `e14_${testigo.cedula}_mesa${mesaNum}_${timestamp}.${ext}`;

    // Subir a Cloudflare R2
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: imageBuffer,
      ContentType: contentType,
    }));

    const imagenUrl = `${PUBLIC_URL}/${fileName}`;

    // Guardar registro en la base de datos
    const acta = await prisma.actaE14.create({
      data: {
        testigo_id: testigo.id,
        puesto_id: testigo.puesto_id,
        mesa: mesaNum,
        imagen_url: imagenUrl,
        estado: 'Recibida'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Foto del E-14 subida correctamente',
      data: {
        id: acta.id,
        imagen_url: acta.imagen_url,
        mesa: acta.mesa,
        estado: acta.estado
      }
    });

  } catch (error) {
    console.error('Error al subir E-14:', error);
    res.status(500).json({ success: false, message: 'Error al subir la foto del E-14' });
  }
});

// Listar actas E-14 de un testigo
router.get('/mis-actas', authMiddleware, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      include: { testigo: true }
    });

    if (!usuario || !usuario.testigo) {
      return res.json({ success: true, data: [] });
    }

    const actas = await prisma.actaE14.findMany({
      where: { testigo_id: usuario.testigo.id },
      orderBy: { created_at: 'desc' },
      include: {
        puesto: { include: { municipio: true } }
      }
    });

    res.json({ success: true, data: actas });
  } catch (error) {
    console.error('Error al listar actas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener actas' });
  }
});

// Listar TODAS las actas (para admin/coordinadores)
router.get('/todas', authMiddleware, async (req, res) => {
  try {
    if (!['SuperAdmin', 'Coordinador_Municipio', 'Abogado_Juridico'].includes(req.user.rol)) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const actas = await prisma.actaE14.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        testigo: true,
        puesto: { include: { municipio: true } }
      }
    });

    res.json({ success: true, data: actas });
  } catch (error) {
    console.error('Error al listar todas las actas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener actas' });
  }
});

module.exports = router;
