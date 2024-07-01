const express = require('express');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser'); hola
// const session = require('express-session');
const oracledb = require('oracledb');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(cookieParser()); // Usa cookie-parser
// app.use(session({
//   secret: 'supersecret', // Clave secreta para firmar la cookie
//   resave: true,
//   saveUninitialized: true
// }));

// Configurar Express para servir archivos estáticos desde el directorio raíz
app.use(express.static(path.join(__dirname, '/')));

// Configuración de la base de datos
const dbConfig = {
  user: 'C##emilioadmin',
  password: 'xXsCzXQjS39',
  connectString: 'localhost/XE'
};

// Ruta para el inicio de sesión
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`Usuario: ${username}, Contraseña: ${password}`);
  if (!username || !password) {
    res.send('<script>alert("Usuario y contraseña son requeridos"); window.location.href="/";</script>');
    return;
  }

  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT ID_ROL FROM USUARIOS WHERE ID_US = :username AND CONTRASENA_US = :password`,
      [username, password]
    );

    if (result.rows.length > 0) {
      // Autenticación exitosa
      const role = result.rows[0][0];
      console.log('Usuario autenticado:', { role });

      // Guardar rol en localStorage mediante la respuesta
      res.send(`
        <script>
          localStorage.setItem('rol', '${role}');
          window.location.href = '${role === '1' ? '/html/configuracion.html' : '/html/votacion.html'}';
        </script>
      `);
    } else {
      res.send('<script>alert("Credenciales incorrectas"); window.location.href="/";</script>');
    }

    await connection.close();
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Error en el servidor');
  }
});

// Ruta para obtener los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT NOMBRE_US, APELLIDO_US FROM USUARIOS`
    );
    await connection.close();

    const usuarios = result.rows.map(row => ({
      nombres: row[0],
      apellidos: row[1]
    }));

    res.json(usuarios);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Error al obtener los usuarios');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
