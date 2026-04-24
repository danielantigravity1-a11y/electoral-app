const express = require('express');
const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const prisma = new PrismaClient();
const router = express.Router();

// ===== REPORTE DE TESTIGOS ORGANIZADO POR MUNICIPIO > ZONA > PUESTO =====
router.get('/testigos', async (req, res) => {
    try {
        const formato = req.query.formato || 'xlsx';
        
        const testigos = await prisma.testigo.findMany({
            include: {
                puesto: { include: { municipio: true } },
                puesto_votacion: { include: { municipio: true } }
            },
            orderBy: [
                { puesto: { municipio: { nombre: 'asc' } } },
                { puesto: { zona: 'asc' } },
                { puesto: { nombre_puesto: 'asc' } },
                { mesa: 'asc' }
            ]
        });

        if (formato === 'xlsx') {
            // Hoja 1: Listado plano
            const data = testigos.map(t => ({
                'Municipio': t.puesto?.municipio?.nombre || 'N/A',
                'Zona': t.puesto?.zona || 'N/A',
                'Puesto Asignado': t.puesto?.nombre_puesto || 'N/A',
                'Mesa Asignada': t.mesa || 'N/A',
                'Nombre Completo': t.nombre,
                'Cédula': t.cedula,
                'Celular': t.telefono,
                'Correo': t.email || 'N/A',
                'Puesto Votación': t.puesto_votacion?.nombre_puesto || 'N/A',
                'Mesa Votación': t.mesa_votacion || 'N/A',
                'Tipo': t.tipo,
                'Estado': t.estado
            }));

            const worksheet = xlsx.utils.json_to_sheet(data);
            
            // Set column widths
            worksheet['!cols'] = [
                {wch:20}, {wch:12}, {wch:30}, {wch:8}, {wch:30}, 
                {wch:15}, {wch:15}, {wch:25}, {wch:30}, {wch:8}, {wch:18}, {wch:12}
            ];

            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Testigos por Zona");
            
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Disposition', 'attachment; filename="testigos_por_zona.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buffer);
        } 
        else if (formato === 'pdf') {
            const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
            res.setHeader('Content-Disposition', 'attachment; filename="testigos_por_zona.pdf"');
            res.setHeader('Content-Type', 'application/pdf');
            doc.pipe(res);
            
            // Title
            doc.fontSize(18).font('Helvetica-Bold').text('LISTADO DE TESTIGOS ELECTORALES', { align: 'center' });
            doc.fontSize(10).font('Helvetica').text('Organizado por Municipio / Zona / Puesto de Votación', { align: 'center' });
            doc.moveDown();

            // Group by municipio > zona > puesto
            const grouped = {};
            testigos.forEach(t => {
                const muni = t.puesto?.municipio?.nombre || 'Sin Municipio';
                const zona = t.puesto?.zona || 'Sin Zona';
                const puesto = t.puesto?.nombre_puesto || 'Sin Puesto';
                if (!grouped[muni]) grouped[muni] = {};
                if (!grouped[muni][zona]) grouped[muni][zona] = {};
                if (!grouped[muni][zona][puesto]) grouped[muni][zona][puesto] = [];
                grouped[muni][zona][puesto].push(t);
            });

            let count = 0;
            Object.keys(grouped).sort().forEach(muni => {
                // Check if we need a new page
                if (doc.y > 450) doc.addPage();
                
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#0A192F').text(`📍 ${muni.toUpperCase()}`);
                doc.moveDown(0.3);

                Object.keys(grouped[muni]).sort().forEach(zona => {
                    if (doc.y > 460) doc.addPage();
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#444').text(`   Zona: ${zona}`);
                    doc.moveDown(0.2);

                    Object.keys(grouped[muni][zona]).sort().forEach(puesto => {
                        if (doc.y > 470) doc.addPage();
                        doc.fontSize(10).font('Helvetica-Bold').fillColor('#666').text(`      🏫 ${puesto}`);
                        doc.moveDown(0.1);

                        grouped[muni][zona][puesto].forEach(t => {
                            count++;
                            if (doc.y > 480) doc.addPage();
                            doc.fontSize(9).font('Helvetica').fillColor('#333');
                            doc.text(`         ${count}. ${t.nombre}  |  CC: ${t.cedula}  |  Cel: ${t.telefono || 'N/A'}  |  Mesa: ${t.mesa || 'N/A'}  |  ${t.estado}`);
                        });
                        doc.moveDown(0.3);
                    });
                });
                doc.moveDown(0.5);
                doc.moveTo(40, doc.y).lineTo(800, doc.y).strokeColor('#ddd').stroke();
                doc.moveDown(0.5);
            });

            // Footer
            doc.moveDown();
            doc.fontSize(8).font('Helvetica').fillColor('#999').text(`Total de testigos: ${testigos.length}  |  Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
            
            doc.end();
        } else {
            res.status(400).json({ success: false, message: "Formato no soportado" });
        }
    } catch (error) {
        console.error("Error generando reporte:", error);
        res.status(500).json({ success: false, message: "Error interno" });
    }
});

// ===== REPORTE DE COMISIONES ESCRUTADORAS =====
router.get('/comisiones', async (req, res) => {
    try {
        const formato = req.query.formato || 'xlsx';

        const comisiones = await prisma.comisionEscrutadora.findMany({
            include: {
                municipio: true,
                titular: { include: { puesto: true } },
                suplente: { include: { puesto: true } }
            },
            orderBy: { municipio: { nombre: 'asc' } }
        });

        if (formato === 'xlsx') {
            const data = comisiones.map(c => ({
                'Municipio': c.municipio?.nombre || 'N/A',
                'Nombre Comisión': c.nombre,
                'Titular - Nombre': c.titular?.nombre || 'Vacante',
                'Titular - Cédula': c.titular?.cedula || '',
                'Titular - Celular': c.titular?.telefono || '',
                'Titular - Puesto': c.titular?.puesto?.nombre_puesto || '',
                'Suplente - Nombre': c.suplente?.nombre || 'Vacante',
                'Suplente - Cédula': c.suplente?.cedula || '',
                'Suplente - Celular': c.suplente?.telefono || '',
                'Suplente - Puesto': c.suplente?.puesto?.nombre_puesto || ''
            }));

            const worksheet = xlsx.utils.json_to_sheet(data);
            worksheet['!cols'] = [
                {wch:20}, {wch:25}, {wch:28}, {wch:15}, {wch:15}, {wch:25},
                {wch:28}, {wch:15}, {wch:15}, {wch:25}
            ];
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Comisiones Escrutadoras");
            
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Disposition', 'attachment; filename="comisiones_escrutadoras.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buffer);
        }
        else if (formato === 'pdf') {
            const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
            res.setHeader('Content-Disposition', 'attachment; filename="comisiones_escrutadoras.pdf"');
            res.setHeader('Content-Type', 'application/pdf');
            doc.pipe(res);

            doc.fontSize(18).font('Helvetica-Bold').text('LISTADO DE COMISIONES ESCRUTADORAS', { align: 'center' });
            doc.fontSize(10).font('Helvetica').text('Testigos asignados a Comisiones por Municipio', { align: 'center' });
            doc.moveDown(1.5);

            // Group by municipio
            const grouped = {};
            comisiones.forEach(c => {
                const muni = c.municipio?.nombre || 'Sin Municipio';
                if (!grouped[muni]) grouped[muni] = [];
                grouped[muni].push(c);
            });

            Object.keys(grouped).sort().forEach(muni => {
                if (doc.y > 420) doc.addPage();
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#0A192F').text(`📍 ${muni.toUpperCase()}`);
                doc.moveDown(0.5);

                grouped[muni].forEach((c, i) => {
                    if (doc.y > 440) doc.addPage();
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333').text(`   ${i+1}. ${c.nombre}`);
                    doc.fontSize(9).font('Helvetica').fillColor('#555');
                    doc.text(`      Titular:   ${c.titular?.nombre || 'VACANTE'}  |  CC: ${c.titular?.cedula || '--'}  |  Cel: ${c.titular?.telefono || '--'}`);
                    doc.text(`      Suplente:  ${c.suplente?.nombre || 'VACANTE'}  |  CC: ${c.suplente?.cedula || '--'}  |  Cel: ${c.suplente?.telefono || '--'}`);
                    doc.moveDown(0.5);
                });

                doc.moveTo(40, doc.y).lineTo(800, doc.y).strokeColor('#ddd').stroke();
                doc.moveDown(0.5);
            });

            doc.moveDown();
            doc.fontSize(8).font('Helvetica').fillColor('#999').text(`Total comisiones: ${comisiones.length}  |  Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
            doc.end();
        } else {
            res.status(400).json({ success: false, message: "Formato no soportado" });
        }
    } catch (error) {
        console.error("Error generando reporte comisiones:", error);
        res.status(500).json({ success: false, message: "Error interno" });
    }
});

module.exports = router;
