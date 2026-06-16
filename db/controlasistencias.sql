-- Base de datos: `controlasistencias`
-- Crear la base de datos
CREATE DATABASE `controlasistencias` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `controlasistencias`;
-- --------------------------------------------------------

--
-- Tabla `tutores`
--

CREATE TABLE `tutores` (
  `id_tutor` int(11) NOT NULL AUTO_INCREMENT,
  `nombreT` varchar(50) NOT NULL,
  `apellidoP_Tutor` varchar(50) NOT NULL,
  `apellidoM_Tutor` varchar(50) NOT NULL,
  `telefono` varchar(15) NOT NULL,
  `chat_id_telegram` varchar(15) DEFAULT NULL,
  `parentesco` varchar(20) NOT NULL,
  PRIMARY KEY (`id_tutor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `matriculaU` int(11) NOT NULL AUTO_INCREMENT,
  `nombreU` varchar(50) NOT NULL,
  `apellidoP_Usuario` varchar(50) NOT NULL,
  `apellidoM_Usuario` varchar(50) NOT NULL,
  `contraseña` varchar(255) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`matriculaU`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabla `alumno`
--

CREATE TABLE `alumno` (
  `matriculaA` int(11) NOT NULL,
  `nombreA` varchar(50) NOT NULL,
  `apellidoP_Alumno` varchar(50) NOT NULL,
  `apellidoM_Alumno` varchar(50) NOT NULL,
  `grupo` varchar(10) NOT NULL,
  `huella_digital` text DEFAULT NULL,
  `id_tutor` int(11) NOT NULL,
  PRIMARY KEY (`matriculaA`),
  KEY `fk_alumno_tutor` (`id_tutor`),
  CONSTRAINT `fk_alumno_tutor` FOREIGN KEY (`id_tutor`) REFERENCES `tutores` (`id_tutor`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabla `asistencias`
--

CREATE TABLE `asistencias` (
  `id_asistencia` int(11) NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `hora_entrada` time DEFAULT NULL,
  `hora_salida` time DEFAULT NULL,
  `estado` enum('presente','retardo','falta') NOT NULL,
  `motivoFalta` varchar(30) DEFAULT NULL,
  `matriculaA` int(11) NOT NULL,
  `matriculaU` int(11) NOT NULL,
  PRIMARY KEY (`id_asistencia`),
  UNIQUE KEY `uc_alumno_fecha` (`matriculaA`,`fecha`),
  KEY `fk_asistencia_usuario` (`matriculaU`),
  CONSTRAINT `fk_asistencia_alumno` FOREIGN KEY (`matriculaA`) REFERENCES `alumno` (`matriculaA`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_asistencia_usuario` FOREIGN KEY (`matriculaU`) REFERENCES `usuarios` (`matriculaU`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Volcado de datos iniciales (opcional, para probar login)
--

INSERT INTO `usuarios` (`matriculaU`, `nombreU`, `apellidoP_Usuario`, `apellidoM_Usuario`, `contraseña`, `activo`) VALUES
(1, 'admin', 'Admin', 'Principal', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrIuT3lQ.3bM.vqKOQC8V6kFqJ8NnN6', 1);
-- La contraseña es "123456" hasheada

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;