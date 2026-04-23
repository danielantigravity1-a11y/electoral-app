// Script para actualizar el número de mesas de cada puesto desde DIVIPOLE 2026
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function updateMesas() {
    const jsonPath = path.join(__dirname, 'temp', 'divipole_sucre.json');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`Leyendo ${data.length} registros del DIVIPOLE...`);

    // Get all municipios from DB to map codigo_municipio -> id
    const municipios = await prisma.municipio.findMany();
    const muniMap = {};
    municipios.forEach(m => { muniMap[m.codigo_municipio] = m.id; });

    let updated = 0;
    let notFound = 0;

    for (const entry of data) {
        const mesas = parseInt(entry.raw[12]);
        if (!mesas || isNaN(mesas)) continue;

        const codigoMuni = entry.cod_municipio;
        const municipioId = muniMap[codigoMuni];
        if (!municipioId) { notFound++; continue; }

        // The zona in DB corresponds to entry.nombre_municipio from JSON
        // The codigo_puesto in DB corresponds to entry.zona from JSON
        // (The JSON field names are misleading - they were parsed from raw PDF columns)
        const zona = entry.nombre_municipio;
        const codigoPuesto = entry.zona;

        try {
            const result = await prisma.divipole.updateMany({
                where: {
                    municipio_id: municipioId,
                    zona: zona,
                    codigo_puesto: codigoPuesto
                },
                data: { mesas: mesas }
            });
            if (result.count > 0) updated++;
            else notFound++;
        } catch (err) {
            // Try alternate mapping if first doesn't work
            notFound++;
        }
    }

    console.log(`✅ Actualizados: ${updated} puestos con datos de mesas`);
    console.log(`⚠️  No encontrados: ${notFound}`);

    // Verify some results
    const sample = await prisma.divipole.findMany({ take: 5, where: { mesas: { not: null } } });
    console.log('\nMuestra de puestos actualizados:');
    sample.forEach(p => console.log(`  - ${p.nombre_puesto} (Zona ${p.zona}): ${p.mesas} mesas`));

    await prisma.$disconnect();
}

updateMesas().catch(e => { console.error(e); process.exit(1); });
