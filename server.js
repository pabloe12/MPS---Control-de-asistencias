require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

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
