const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// GET /api/comisiones
router.get('/', async (req, res) => {
    try {
        const comisiones = await prisma.comisionEscrutadora.findMany({
            include: {
                municipio: true,
                titular: {
                    include: { puesto: true }
                },
                suplente: {
                    include: { puesto: true }
                }
            }
        });
        res.json({ success: true, data: comisiones });
    } catch (error) {
        console.error("Error al obtener comisiones:", error);
        res.status(500).json({ success: false, message: "Error interno" });
    }
});

// POST /api/comisiones
router.post('/', async (req, res) => {
    const { municipio_id, nombre, titular_id, suplente_id } = req.body;
    try {
        // Validar que el titular y suplente no estén ya asignados a otra comisión u otra cosa de comision
        
        const comision = await prisma.comisionEscrutadora.create({
            data: {
                municipio_id,
                nombre,
                titular_id: titular_id || null,
                suplente_id: suplente_id || null
            }
        });

        // Actualizar el estado de los testigos
        if (titular_id) {
            await prisma.testigo.update({
                where: { id: titular_id },
                data: { tipo: 'COMISION_TITULAR', estado: 'Asignado' }
            });
        }
        if (suplente_id) {
            await prisma.testigo.update({
                where: { id: suplente_id },
                data: { tipo: 'COMISION_SUPLENTE', estado: 'Asignado' }
            });
        }

        res.json({ success: true, data: comision });
    } catch (error) {
        console.error("Error al crear comisión:", error);
        res.status(500).json({ success: false, message: "Error al crear la comisión" });
    }
});

// GET /api/comisiones/municipio/:municipio_id
router.get('/municipio/:municipio_id', async (req, res) => {
    try {
        const comisiones = await prisma.comisionEscrutadora.findMany({
            where: { municipio_id: req.params.municipio_id },
            include: {
                titular: true,
                suplente: true
            }
        });
        res.json({ success: true, data: comisiones });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
