const express = require('express');
const router = express.Router();
const pool = require('../config/db');

function auth(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/auth/login');
  }
  next();
}

router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

router.get('/dashboard', auth, (req, res) => {
  res.render('dashboard');
});

router.get('/registro', auth, (req, res) => {
  res.render('registro');
});

router.get('/registro-usuario', auth, (req, res) => {
  res.render('registro-usuario');
});

router.get('/asistencia', auth, (req, res) => {
  res.render('asistencia', { asistencias: [] });
});

router.get('/estudiante', auth, async (req, res) => {
  try {
    const [estudiantes] = await pool.execute(
      `SELECT matriculaA, nombreA, apellidoP_Alumno, apellidoM_Alumno, grupo FROM alumno`
    );
    res.render('estudiante', { estudiantes });
  } catch (error) {
    console.error(error);
    res.render('estudiante', { estudiantes: [] });
  }
});

router.get('/reporte', auth, (req, res) => {
  res.render('reporte');
});

router.get('/usuarios', auth, async (req, res) => {
  try {
    const [usuarios] = await pool.execute(
      'SELECT matriculaU, nombreU, apellidoP_Usuario, apellidoM_Usuario FROM usuarios'
    );
    res.render('usuario', { usuarios });
  } catch (error) {
    console.error(error);
    res.render('usuario', { usuarios: [] });
  }
});

// Nueva ruta para marcar asistencia (simulación huella)
router.get('/marcar', auth, (req, res) => {
  res.render('marcar');
});

module.exports = router;