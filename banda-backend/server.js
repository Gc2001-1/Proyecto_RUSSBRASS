const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./src/config/db');

// Importar Rutas
const authRoutes = require('./src/routes/authRoutes');
const alumnoRoutes = require('./src/routes/alumnoRoutes');
const asistenciaRoutes = require('./src/routes/asistenciaRoutes');
const bandaRoutes = require('./src/routes/bandaRoutes');
const profesorRoutes = require('./src/routes/profesorRoutes');
const reporteRoutes = require('./src/routes/reporteRoutes');
const blogRoutes = require('./src/routes/blogRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Fotos subidas con multer (src/config/upload.js las guarda en frontend/uploads)
app.use('/uploads', express.static(path.join(__dirname, 'frontend', 'uploads')));

// Registrar Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/alumnos', alumnoRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/bandas', bandaRoutes);
app.use('/api/profesores', profesorRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/blog', blogRoutes);

app.get('/', (req, res) => {
    res.json({ mensaje: 'API de Control de Bandas funcionando correctamente 🚀' });
});

app.use((req, res) => {
    res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`\n=================================`);
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`=================================\n`);

    try {
        const res = await db.query('SELECT NOW()');
        console.log('⏰ Conexión a BD exitosa. Hora actual:', res.rows[0].now);
    } catch (error) {
        console.error('⚠️ Error al conectar con PostgreSQL:', error.message);
    }
});