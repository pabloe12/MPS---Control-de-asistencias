const express = require('express');
const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Middleware de autenticación para API
function authAPI(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ==================== GRUPOS (para filtros dinámicos) ====================
router.get('/grupos', authAPI, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT DISTINCT grupo FROM alumno ORDER BY grupo');
    const grupos = rows.map(r => r.grupo);
    const grados = [...new Set(grupos.map(g => g.split(' ')[0]))];
    res.json({ grados, grupos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
});

// ==================== ESTUDIANTES ====================
router.get('/estudiante', authAPI, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT matriculaA, nombreA, apellidoP_Alumno, apellidoM_Alumno, grupo FROM alumno'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

router.post('/estudiante', authAPI, async (req, res) => {
  const {
    nombreA, apellidoPA, apellidoMA, grupo, matricula,
    tutor_nombre, tutor_apellidoP, tutor_apellidoM, tutor_telefono, tutor_telegram, tutor_parentesco
  } = req.body;

  if (!nombreA || !apellidoPA || !apellidoMA || !grupo || !matricula ||
      !tutor_nombre || !tutor_apellidoP || !tutor_apellidoM || !tutor_telefono || !tutor_parentesco) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!/^\d{7,}$/.test(tutor_telefono.replace(/\D/g, ''))) {
    return res.status(400).json({ error: 'Teléfono inválido' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [tutorResult] = await connection.execute(
      `INSERT INTO tutores (nombreT, apellidoP_Tutor, apellidoM_Tutor, telefono, chat_id_telegram, parentesco)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tutor_nombre, tutor_apellidoP, tutor_apellidoM, tutor_telefono, tutor_telegram || null, tutor_parentesco]
    );
    const id_tutor = tutorResult.insertId;
    await connection.execute(
      `INSERT INTO alumno (matriculaA, nombreA, apellidoP_Alumno, apellidoM_Alumno, grupo, id_tutor)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [matricula, nombreA, apellidoPA, apellidoMA, grupo, id_tutor]
    );
    await connection.commit();
    res.status(201).json({ message: 'Estudiante y tutor registrados correctamente', matriculaA: matricula });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'La matrícula ya existe' });
    }
    res.status(500).json({ error: 'Error al registrar estudiante' });
  } finally {
    connection.release();
  }
});

router.put('/estudiante/:matricula', authAPI, async (req, res) => {
  const { matricula } = req.params;
  const { nombreA, apellidoPA, apellidoMA, grupo } = req.body;
  try {
    await pool.execute(
      'UPDATE alumno SET nombreA=?, apellidoP_Alumno=?, apellidoM_Alumno=?, grupo=? WHERE matriculaA=?',
      [nombreA, apellidoPA, apellidoMA, grupo, matricula]
    );
    res.json({ message: 'Estudiante actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

router.delete('/estudiante/:matricula', authAPI, async (req, res) => {
  const { matricula } = req.params;
  try {
    await pool.execute('DELETE FROM asistencias WHERE matriculaA = ?', [matricula]);
    await pool.execute('DELETE FROM alumno WHERE matriculaA = ?', [matricula]);
    res.json({ message: 'Estudiante eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ==================== ASISTENCIAS ====================
router.get('/asistencia', authAPI, async (req, res) => {
  const { grado, grupo, fecha, hora, timeComparison } = req.query;
  let query = `SELECT a.id_asistencia, a.fecha, a.hora_entrada, a.estado, 
               al.nombreA, al.apellidoP_Alumno, al.apellidoM_Alumno, al.grupo, al.matriculaA
               FROM asistencias a
               JOIN alumno al ON a.matriculaA = al.matriculaA
               WHERE 1=1`;
  const params = [];

  if (fecha) {
    query += ' AND a.fecha = ?';
    params.push(fecha);
  }
  if (grado && grado !== 'all') {
    query += ' AND al.grupo LIKE ?';
    params.push(`${grado}%`);
  }
  if (grupo && grupo !== 'all') {
    query += ' AND al.grupo LIKE ?';
    params.push(`%${grupo}`);
  }
  if (hora && hora !== '') {
    if (timeComparison === 'before') {
      query += ' AND a.hora_entrada < ?';
    } else if (timeComparison === 'after') {
      query += ' AND a.hora_entrada > ?';
    } else if (timeComparison === 'at') {
      query += ' AND a.hora_entrada = ?';
    }
    params.push(hora);
  }

  query += ' ORDER BY a.hora_entrada ASC';
  try {
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener asistencias' });
  }
});

router.post('/asistencia', authAPI, async (req, res) => {
  const { matriculaA, estado } = req.body;
  if (!matriculaA || !estado) {
    return res.status(400).json({ error: 'Matrícula y estado requeridos' });
  }
  const estadosValidos = ['presente', 'falta', 'retardo'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const hora_entrada = now.toTimeString().slice(0, 8);
    await pool.execute(
      'INSERT INTO asistencias (fecha, hora_entrada, estado, matriculaA, matriculaU) VALUES (?, ?, ?, ?, ?)',
      [fecha, hora_entrada, estado, matriculaA, req.session.usuario.matriculaU]
    );
    res.status(201).json({ message: 'Asistencia registrada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar asistencia' });
  }
});

// Editar asistencia (PUT)
router.put('/asistencia/:id', authAPI, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const estadosValidos = ['presente', 'falta', 'retardo'];
  if (!estado || !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    await pool.execute('UPDATE asistencias SET estado = ? WHERE id_asistencia = ?', [estado, id]);
    res.json({ message: 'Asistencia actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// ==================== REPORTES ====================
router.get('/reporte/semanal', authAPI, async (req, res) => {
  const { grupo, fechaInicio, fechaFin } = req.query;
  if (!grupo || !fechaInicio || !fechaFin) {
    return res.status(400).json({ error: 'Grupo y fechas requeridas' });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT al.matriculaA, al.nombreA, al.apellidoP_Alumno, al.apellidoM_Alumno,
              a.fecha, a.estado
       FROM alumno al
       LEFT JOIN asistencias a ON al.matriculaA = a.matriculaA AND a.fecha BETWEEN ? AND ?
       WHERE al.grupo = ?
       ORDER BY al.apellidoP_Alumno, al.apellidoM_Alumno, a.fecha`,
      [fechaInicio, fechaFin, grupo]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
});

router.get('/reporte/semanal/pdf', authAPI, async (req, res) => {
  const { grupo, fechaInicio, fechaFin } = req.query;
  if (!grupo || !fechaInicio || !fechaFin) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT al.matriculaA, al.nombreA, al.apellidoP_Alumno, al.apellidoM_Alumno,
              a.fecha, a.estado
       FROM alumno al
       LEFT JOIN asistencias a ON al.matriculaA = a.matriculaA AND a.fecha BETWEEN ? AND ?
       WHERE al.grupo = ?
       ORDER BY al.apellidoP_Alumno, al.apellidoM_Alumno, a.fecha`,
      [fechaInicio, fechaFin, grupo]
    );

    const alumnos = {};
    rows.forEach(row => {
      const key = row.matriculaA;
      if (!alumnos[key]) {
        alumnos[key] = {
          nombre: `${row.nombreA} ${row.apellidoP_Alumno} ${row.apellidoM_Alumno}`,
          asistencias: {}
        };
      }
      if (row.fecha) {
        alumnos[key].asistencias[row.fecha] = row.estado;
      }
    });

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_${grupo}_${fechaInicio}_${fechaFin}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).text(`Reporte de Asistencia - Grupo ${grupo}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Período: ${fechaInicio} al ${fechaFin}`, { align: 'center' });
    doc.moveDown(2);

    const startX = 50;
    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Alumno', startX, y);
    doc.text('Asistencias', startX + 200, y);
    doc.text('Porcentaje', startX + 350, y);
    doc.moveDown();
    doc.font('Helvetica').fontSize(10);

    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }

    for (const alumno of Object.values(alumnos)) {
      let presentes = 0;
      days.forEach(fecha => {
        if (alumno.asistencias[fecha] === 'presente') presentes++;
      });
      const porcentaje = ((presentes / days.length) * 100).toFixed(1);
      doc.text(alumno.nombre, startX, doc.y);
      doc.text(`${presentes}/${days.length}`, startX + 200, doc.y);
      doc.text(`${porcentaje}%`, startX + 350, doc.y);
      doc.moveDown(0.5);
      if (doc.y > 700) {
        doc.addPage();
        y = 50;
      }
    }
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
});

// ==================== DASHBOARD ====================
router.get('/dashboard', authAPI, async (req, res) => {
  try {
    const [totalRows] = await pool.execute('SELECT COUNT(*) AS total FROM alumno');
    const totalEstudiantes = totalRows[0].total;
    const [presentesRows] = await pool.execute(
      "SELECT COUNT(*) AS total FROM asistencias WHERE fecha = CURDATE() AND estado = 'presente'"
    );
    const presentesHoy = presentesRows[0].total;
    // Los ausentes = total de estudiantes - presentes
    const ausentesHoy = totalEstudiantes - presentesHoy;
    const [semanalRows] = await pool.execute(
      `SELECT COALESCE(ROUND(AVG(CASE WHEN estado='presente' THEN 100 ELSE 0 END)), 0) AS porcentaje 
       FROM asistencias 
       WHERE fecha BETWEEN DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND CURDATE()`
    );
    const asistenciaSemanal = semanalRows[0].porcentaje;
    res.json({ totalEstudiantes, presentesHoy, ausentesHoy, asistenciaSemanal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

router.get('/dashboard/semanal', authAPI, async (req, res) => {
  try {
    const [totalRows] = await pool.execute('SELECT COUNT(*) AS total FROM alumno');
    const totalEstudiantes = totalRows[0].total;
    
    const [rows] = await pool.execute(`
      SELECT fecha, 
        SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as presentes
      FROM asistencias
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY fecha
      ORDER BY fecha ASC
    `);
    const fechas = rows.map(r => r.fecha);
    const presentes = rows.map(r => r.presentes);
    // Los ausentes = total de estudiantes - presentes
    const ausentes = rows.map(r => totalEstudiantes - r.presentes);
    res.json({ fechas, presentes, ausentes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos semanales' });
  }
});

// ==================== USUARIOS ====================
router.get('/usuario', authAPI, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT matriculaU, nombreU, apellidoP_Usuario, apellidoM_Usuario FROM usuarios');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/usuario', authAPI, async (req, res) => {
  const { nombre, apellidoP, apellidoM, contrasena } = req.body;
  if (!nombre || !apellidoP || !apellidoM || !contrasena) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  if (contrasena.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    const [result] = await pool.execute(
      `INSERT INTO usuarios (nombreU, apellidoP_Usuario, apellidoM_Usuario, contraseña, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [nombre, apellidoP, apellidoM, hashedPassword]
    );
    res.status(201).json({ message: 'Usuario creado', matriculaU: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put('/usuario/:id', authAPI, async (req, res) => {
  const { id } = req.params;
  const { nombre, apellidoP, apellidoM, contrasena } = req.body;
  try {
    let query = 'UPDATE usuarios SET nombreU = ?, apellidoP_Usuario = ?, apellidoM_Usuario = ?';
    const params = [nombre, apellidoP, apellidoM];
    if (contrasena && contrasena.length >= 6) {
      const hashed = await bcrypt.hash(contrasena, 10);
      query += ', contraseña = ?';
      params.push(hashed);
    }
    query += ' WHERE matriculaU = ?';
    params.push(id);
    await pool.execute(query, params);
    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.delete('/usuario/:id', authAPI, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('DELETE FROM usuarios WHERE matriculaU = ?', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;

// Endpoint de prueba de conexión a BD (sin autenticación para pruebas)
router.get('/test-db', async (req, res) => {
  try {
    const [result] = await pool.execute('SELECT 1 as connected, NOW() as time');
    res.json({ success: true, message: 'Conexión exitosa', data: result });
  } catch (error) {
    console.error('Error de conexión a BD:', error);
    res.status(500).json({ success: false, error: error.message, code: error.code });
  }
});