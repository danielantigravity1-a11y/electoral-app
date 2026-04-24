const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const router = express.Router();

// Endpoint para login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let searchEmail = email;
    // Si el input no tiene '@' y parece una cédula (solo números), le agregamos el dominio dummy
    if (!email.includes('@') && /^[0-9]+$/.test(email)) {
      searchEmail = `${email}@testigo.electoral`;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: searchEmail },
      include: {
        municipio: true
      }
    });

    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    let isMatch = false;
    // Check if it's a bcrypt hash or plain text
    if (usuario.password_hash.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, usuario.password_hash);
    } else {
        isMatch = (password === usuario.password_hash);
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const payload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre,
      municipio_id: usuario.municipio_id
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'supersecret_jwt_key_2026_sucre_electoral', { expiresIn: '12h' });

    res.json({
      success: true,
      token,
      user: payload
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al procesar el login' });
  }
});

// Endpoint temporal para sembrar el primer SuperAdmin
router.post('/seed-admin', async (req, res) => {
  try {
    const adminExists = await prisma.usuario.findFirst({
      where: { rol: 'SuperAdmin' }
    });

    if (adminExists) {
      return res.status(400).json({ success: false, message: 'Ya existe un SuperAdmin en el sistema' });
    }

    const passwordHash = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.usuario.create({
      data: {
        nombre: 'Administrador Principal',
        email: 'admin@electoral.sucre',
        password_hash: passwordHash,
        rol: 'SuperAdmin'
      }
    });

    res.json({ success: true, message: 'SuperAdmin creado con éxito', admin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear SuperAdmin' });
  }
});

module.exports = router;
