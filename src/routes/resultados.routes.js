const express = require('express');
const prisma = require('../config/db');
const { authMiddleware } = require('../middleware/auth.middleware');
const router = express.Router();

const CANDIDATOS = [
  { key: 'votos_espriella', nombre: 'Abelardo de la Espriella' },
  { key: 'votos_paloma', nombre: 'Paloma Valencia' },
  { key: 'votos_cepeda', nombre: 'Iván Cepeda' },
  { key: 'votos_lizcano', nombre: 'Mauricio Lizcano' },
  { key: 'votos_murillo', nombre: 'Luis Gilberto Murillo' },
  { key: 'votos_caicedo', nombre: 'Carlos Caicedo' },
  { key: 'votos_macollins', nombre: 'Sondra Macollins' },
  { key: 'votos_botero', nombre: 'Santiago Botero' },
];

// POST /api/resultados — Upsert resultado por puesto+mesa+fuente
router.post('/', authMiddleware, async (req, res) => {
  const { puesto_id, mesa, fuente, votos_espriella, votos_paloma, votos_cepeda,
    votos_lizcano, votos_murillo, votos_caicedo, votos_macollins, votos_botero,
    votos_blanco, votos_nulos, votos_total } = req.body;

  if (!puesto_id || !mesa || !fuente) {
    return res.status(400).json({ success: false, message: 'Faltan puesto_id, mesa o fuente' });
  }
  if (!['TESTIGO', 'PRECONTEO', 'TRANSMISION'].includes(fuente)) {
    return res.status(400).json({ success: false, message: 'Fuente inválida' });
  }

  try {
    const data = {
      votos_espriella: parseInt(votos_espriella) || 0,
      votos_paloma: parseInt(votos_paloma) || 0,
      votos_cepeda: parseInt(votos_cepeda) || 0,
      votos_lizcano: parseInt(votos_lizcano) || 0,
      votos_murillo: parseInt(votos_murillo) || 0,
      votos_caicedo: parseInt(votos_caicedo) || 0,
      votos_macollins: parseInt(votos_macollins) || 0,
      votos_botero: parseInt(votos_botero) || 0,
      votos_blanco: parseInt(votos_blanco) || 0,
      votos_nulos: parseInt(votos_nulos) || 0,
      votos_total: parseInt(votos_total) || 0,
      registrado_por: req.user.id
    };

    const resultado = await prisma.resultadosMesa.upsert({
      where: { puesto_id_mesa_fuente: { puesto_id, mesa: parseInt(mesa), fuente } },
      update: data,
      create: { puesto_id, mesa: parseInt(mesa), fuente, ...data }
    });

    // === ALERTA AUTOMÁTICA POR DISCREPANCIA ===
    await verificarDiscrepancias(puesto_id, parseInt(mesa), req.user.id);

    res.json({ success: true, data: resultado });
  } catch (error) {
    console.error('Error guardando resultado:', error);
    res.status(500).json({ success: false, message: 'Error al guardar resultado' });
  }
});

// GET /api/resultados?puesto_id=X&mesa=Y
router.get('/', authMiddleware, async (req, res) => {
  const { puesto_id, mesa } = req.query;
  const where = {};
  if (puesto_id) where.puesto_id = puesto_id;
  if (mesa) where.mesa = parseInt(mesa);

  try {
    const resultados = await prisma.resultadosMesa.findMany({
      where,
      include: { puesto: { include: { municipio: true } } },
      orderBy: [{ mesa: 'asc' }, { fuente: 'asc' }]
    });
    res.json({ success: true, data: resultados });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener resultados' });
  }
});

// GET /api/resultados/comparar?puesto_id=X — Todas las mesas de un puesto con sus 3 fuentes
router.get('/comparar', authMiddleware, async (req, res) => {
  const { puesto_id } = req.query;
  if (!puesto_id) return res.status(400).json({ success: false, message: 'puesto_id requerido' });

  try {
    const resultados = await prisma.resultadosMesa.findMany({
      where: { puesto_id },
      orderBy: [{ mesa: 'asc' }, { fuente: 'asc' }]
    });

    // Group by mesa
    const mesas = {};
    resultados.forEach(r => {
      if (!mesas[r.mesa]) mesas[r.mesa] = {};
      mesas[r.mesa][r.fuente] = r;
    });

    // Detect discrepancies
    const comparacion = Object.keys(mesas).sort((a, b) => a - b).map(mesa => {
      const fuentes = mesas[mesa];
      const keys = Object.keys(fuentes);
      let discrepancia = false;

      if (keys.length >= 2) {
        const first = fuentes[keys[0]];
        for (let i = 1; i < keys.length; i++) {
          const other = fuentes[keys[i]];
          for (const c of CANDIDATOS) {
            if (first[c.key] !== other[c.key]) { discrepancia = true; break; }
          }
          if (first.votos_blanco !== other.votos_blanco) discrepancia = true;
          if (first.votos_nulos !== other.votos_nulos) discrepancia = true;
          if (first.votos_total !== other.votos_total) discrepancia = true;
        }
      }

      return { mesa: parseInt(mesa), fuentes, discrepancia, fuentesCount: keys.length };
    });

    res.json({ success: true, data: comparacion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al comparar' });
  }
});

// GET /api/resultados/resumen?municipio_id=X — Totales por municipio
router.get('/resumen', authMiddleware, async (req, res) => {
  const { municipio_id } = req.query;
  try {
    const where = {};
    if (municipio_id) where.puesto = { municipio_id };

    const resultados = await prisma.resultadosMesa.findMany({
      where,
      include: { puesto: { include: { municipio: true } } }
    });

    // Aggregate by fuente
    const resumen = {};
    resultados.forEach(r => {
      if (!resumen[r.fuente]) {
        resumen[r.fuente] = { mesas: 0 };
        CANDIDATOS.forEach(c => resumen[r.fuente][c.key] = 0);
        resumen[r.fuente].votos_blanco = 0;
        resumen[r.fuente].votos_nulos = 0;
        resumen[r.fuente].votos_total = 0;
      }
      resumen[r.fuente].mesas++;
      CANDIDATOS.forEach(c => resumen[r.fuente][c.key] += r[c.key]);
      resumen[r.fuente].votos_blanco += r.votos_blanco;
      resumen[r.fuente].votos_nulos += r.votos_nulos;
      resumen[r.fuente].votos_total += r.votos_total;
    });

    res.json({ success: true, data: resumen });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al generar resumen' });
  }
});

// === Helper: Verificar discrepancias y crear alerta ===
async function verificarDiscrepancias(puesto_id, mesa, userId) {
  try {
    const resultados = await prisma.resultadosMesa.findMany({
      where: { puesto_id, mesa }
    });

    if (resultados.length < 2) return; // Need at least 2 sources to compare

    const first = resultados[0];
    let discrepancia = false;
    let detalles = [];

    for (let i = 1; i < resultados.length; i++) {
      const other = resultados[i];
      for (const c of CANDIDATOS) {
        if (first[c.key] !== other[c.key]) {
          discrepancia = true;
          detalles.push(`${c.nombre}: ${first.fuente}=${first[c.key]} vs ${other.fuente}=${other[c.key]}`);
        }
      }
      if (first.votos_total !== other.votos_total) {
        discrepancia = true;
        detalles.push(`Total: ${first.fuente}=${first.votos_total} vs ${other.fuente}=${other.votos_total}`);
      }
    }

    if (discrepancia) {
      // Check if alert already exists for this mesa
      const existing = await prisma.alertasMesa.findFirst({
        where: { puesto_id, mesa, tipo_alerta: 'Discrepancia en resultados' }
      });

      if (!existing) {
        const puesto = await prisma.divipole.findUnique({ where: { id: puesto_id } });
        await prisma.alertasMesa.create({
          data: {
            tipo_alerta: 'Discrepancia en resultados',
            descripcion: `Diferencias detectadas automáticamente entre fuentes: ${detalles.slice(0, 5).join('; ')}`,
            municipio_id: puesto.municipio_id,
            puesto_id,
            mesa,
            reportado_por: userId,
          }
        });
      }
    }
  } catch (err) {
    console.error('Error verificando discrepancias:', err);
  }
}

module.exports = router;
