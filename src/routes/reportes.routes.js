const express = require('express');
const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/testigos', async (req, res) => {
    try {
        const formato = req.query.formato || 'xlsx';
        
        const testigos = await prisma.testigo.findMany({
            include: {
                puesto: {
                    include: { municipio: true }
                },
                puesto_votacion: {
                    include: { municipio: true }
                }
            }
        });

        // Formatear datos para el reporte
        const data = testigos.map(t => ({
            'Nombre Completo': t.nombre,
            'Cédula': t.cedula,
            'Celular': t.telefono,
            'Correo Electrónico': t.email || 'N/A',
            'Municipio Votación': t.puesto_votacion?.municipio?.nombre || 'N/A',
            'Puesto Votación': t.puesto_votacion?.nombre_puesto || 'N/A',
            'Mesa Votación': t.mesa_votacion || 'N/A',
            'Municipio Asignado': t.puesto?.municipio?.nombre || 'N/A',
            'Puesto Asignado': t.puesto?.nombre_puesto || 'N/A',
            'Mesa Asignada': t.mesa || 'N/A',
            'Estado': t.estado
        }));

        if (formato === 'xlsx') {
            const worksheet = xlsx.utils.json_to_sheet(data);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Testigos");
            
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            
            res.setHeader('Content-Disposition', 'attachment; filename="testigos_electorales.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buffer);
        } 
        else if (formato === 'pdf') {
            const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
            
            res.setHeader('Content-Disposition', 'attachment; filename="testigos_electorales.pdf"');
            res.setHeader('Content-Type', 'application/pdf');
            doc.pipe(res);
            
            doc.fontSize(16).text('Reporte de Testigos Electorales Asignados', { align: 'center' });
            doc.moveDown();
            
            // Un PDF básico (para tablas en pdfkit normalmente se usa una librería externa o se dibuja a mano, 
            // aquí hacemos un listado simple por página para asegurar que la info salga)
            doc.fontSize(10);
            
            data.forEach((t, i) => {
                doc.text(`${i+1}. ${t['Nombre Completo']} - CC: ${t['Cédula']} - Cel: ${t['Celular']}`);
                doc.text(`   Vota en: ${t['Municipio Votación']} > ${t['Puesto Votación']} > Mesa ${t['Mesa Votación']}`);
                doc.text(`   Asignado a: ${t['Municipio Asignado']} > ${t['Puesto Asignado']} > Mesa ${t['Mesa Asignada']}`);
                doc.moveDown(0.5);
            });
            
            doc.end();
        } else {
            res.status(400).json({ success: false, message: "Formato no soportado" });
        }
    } catch (error) {
        console.error("Error generando reporte:", error);
        res.status(500).json({ success: false, message: "Error interno" });
    }
});

module.exports = router;
