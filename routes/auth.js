const express = require('express');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Función para validar formato de nombre de usuario (solo letras, números y guión bajo, de 3 a 20 caracteres)
function validarNombreUsuario(username) {
return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/.test(nombre);}

router.get('/login', (req, res) => {
  if (req.session.usuario) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  // VALIDACIÓN DE FORMATO
  const { username, password } = req.body;
  if (!validarNombreUsuario(username)) {
    return res.render('login', { error: 'Usuario inválido (solo letras, números y guión bajo, de 3 a 20 caracteres)' });
  }
  if (!username || !password) {
    return res.render('login', { error: 'Usuario y contraseña son requeridos' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM usuarios WHERE nombreU = ? AND activo = 1',
      [username]
    );
    if (rows.length === 0) {
      return res.render('login', { error: 'Usuario o contraseña incorrectos' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.contraseña);
    if (!match) {
      return res.render('login', { error: 'Usuario o contraseña incorrectos' });
    }
    req.session.usuario = {
      matriculaU: user.matriculaU,
      nombreU: user.nombreU,
      rol: user.rol || 'usuario'
    };
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.render('login', { error: 'Error en el servidor' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;