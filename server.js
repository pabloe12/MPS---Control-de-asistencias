require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cron = require('node-cron');
const helmet = require('helmet');
const moment = require('moment-timezone');
const pool = require('./config/db');

// Importar rutas
const authRoutes = require('./routes/auth');
const pagesRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');
const app = express();

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Seguridad: Headers y protección básica
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar si usas CDNs externos para Chart.js/Bootstrap sin configurar
}));

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/media', express.static(path.join(__dirname, 'media')));

// Configuración de sesión para producción
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'super_secreto_123',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // true en producción (HTTPS)
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
};

// En Render, confía en el proxy (porque Render usa proxies)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// Middleware para pasar variables a todas las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.currentPath = req.path;
  next();
});

// Rutas
app.use('/auth', authRoutes);
app.use('/', pagesRoutes);
app.use('/api', apiRoutes);

// Programar tarea diaria a las 8:00 a.m. (hora México) para asignar faltas
cron.schedule('0 8 * * *', async () => {
  console.log('Ejecutando asignación de faltas automática...');
  try {
    const hoy = moment().tz('America/Mexico_City').format('YYYY-MM-DD');

    // Buscar alumnos que no tengan registro de asistencia el día de hoy
    const [alumnos] = await pool.execute(
      `SELECT matriculaA FROM alumno 
       WHERE matriculaA NOT IN (
         SELECT matriculaA FROM asistencias WHERE fecha = ?
       )`,
      [hoy]
    );

    if (alumnos.length === 0) {
      console.log('Todos los alumnos ya tienen asistencia registrada hoy.');
      return;
    }

    // Obtener el primer usuario administrador activo para asociar el registro de la falta
    const [admin] = await pool.execute('SELECT matriculaU FROM usuarios WHERE activo = 1 LIMIT 1');
    const matriculaU = admin.length ? admin[0].matriculaU : 1;

    for (const alumno of alumnos) {
      await pool.execute(
        'INSERT INTO asistencias (fecha, hora_entrada, estado, matriculaA, matriculaU) VALUES (?, ?, ?, ?, ?)',
        [hoy, null, 'falta', alumno.matriculaA, matriculaU]
      );
    }
    console.log(`Faltas asignadas correctamente a ${alumnos.length} alumnos.`);
  } catch (error) {
    console.error('Error en tarea programada de faltas:', error);
  }
}, {
  scheduled: true,
  timezone: "America/Mexico_City"
});

console.log('Servicio de cron para faltas automáticas inicializado.');

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).render('404', { message: 'Página no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
});
