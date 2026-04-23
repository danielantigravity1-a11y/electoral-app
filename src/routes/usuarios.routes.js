const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// GET /api/usuarios
router.get('/', async (req, res) => {
    try {
        const usuarios = await prisma.usuario.findMany({
            include: { municipio: true, testigo: true }
        });
        // Filtrar password_hash
        const safeUsuarios = usuarios.map(u => {
            const { password_hash, ...rest } = u;
            return rest;
        });
        res.json({ success: true, data: safeUsuarios });
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ success: false, message: "Error interno" });
    }
});

// POST /api/usuarios
router.post('/', async (req, res) => {
    const { nombre, email, password, rol, municipio_id } = req.body;
    try {
        // En un entorno real se debe hacer bcrypt a la contraseña
        // Por ahora se guarda plana para pruebas como se hacía en auth
        const usuario = await prisma.usuario.create({
            data: {
                nombre,
                email,
                password_hash: password, // TODO: Hash
                rol,
                municipio_id: municipio_id || null
            }
        });
        res.json({ success: true, data: { id: usuario.id, nombre: usuario.nombre } });
    } catch (error) {
        console.error("Error al crear usuario:", error);
        res.status(500).json({ success: false, message: "Error al crear usuario o email duplicado" });
    }
});

// DELETE /api/usuarios/:id
router.delete('/:id', async (req, res) => {
    try {
        await prisma.usuario.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar usuario:", error);
        res.status(500).json({ success: false, message: "Error al eliminar" });
    }
});

module.exports = router;
