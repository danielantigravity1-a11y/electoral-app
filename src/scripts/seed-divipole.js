const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, '../../temp/divipole_sucre.json');
  const fileData = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(fileData);

  console.log(`Processing ${data.length} records from divipole_sucre.json...`);

  const municipiosMap = new Map();
  for (const item of data) {
    const raw = item.raw;
    const codMun = raw[1];
    const nomMun = raw[5];
    if (!municipiosMap.has(codMun)) {
      municipiosMap.set(codMun, nomMun);
    }
  }

  for (const [codigo_municipio, nombre] of municipiosMap.entries()) {
    await prisma.municipio.upsert({
      where: { codigo_municipio },
      update: {},
      create: { codigo_municipio, nombre }
    });
  }
  console.log('Municipios inserted/verified.');

  const municipiosDB = await prisma.municipio.findMany();
  const munIdMap = new Map();
  for (const m of municipiosDB) {
    munIdMap.set(m.codigo_municipio, m.id);
  }

  let insertedPuestos = 0;
  for (const item of data) {
    const raw = item.raw;
    const codMun = raw[1];
    const zona = raw[2];
    const codPuesto = raw[3];
    const nomPuesto = raw[6];

    const municipio_id = munIdMap.get(codMun);
    if (!municipio_id) continue;

    try {
      await prisma.divipole.upsert({
        where: {
          municipio_id_zona_codigo_puesto: {
            municipio_id,
            zona,
            codigo_puesto: codPuesto
          }
        },
        update: {},
        create: {
          municipio_id,
          zona,
          codigo_puesto: codPuesto,
          nombre_puesto: nomPuesto
        }
      });
      insertedPuestos++;
    } catch (error) {
      console.error(`Error inserting puesto ${nomPuesto}:`, error);
    }
  }

  console.log(`Puestos de votación procesados: ${insertedPuestos}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
