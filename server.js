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
  const periodo = req.query.periodo;
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
      const role = result.rows[0][0];
      const usuario = username;
      console.log('Usuario autenticado:', { role });

      console.log(periodo);

      res.send(`
        <script>
          localStorage.setItem('rol', '${role}');
          localStorage.setItem('usuario', '${usuario}');
          if (${role} === 1) {
            window.location.href = '/html/configuracion.html';
          } else if (${role} === 2) {
            // Redirigir a votacionADUFA.html con el parámetro 'periodo'
            window.location.href = '/html/votacionADUFA.html?periodo=${periodo}';
          } else {
            alert("Rol desconocido");
            window.location.href = '/';
          }
        </script>
        `);
    } else {
      res.send('<script>alert("Credenciales incorrectas"); window.location.href="/";</script>');
    }

    await connection.close();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

app.post('/guardar-candidatos', async (req, res) => {
  const formData = req.body;

  try {
    const connection = await oracledb.getConnection(dbConfig);
    
    const insertQuery = `INSERT INTO CANDIDATOS (ID_US, PERIODO_POSTULACION, DIGNIDAD_CAND, ESTADO_CAND) 
                         VALUES (:id_us, :periodo_postulacion, :dignidad_cand, :estado_cand)`;
    
    const NuloQuery = `INSERT INTO CANDIDATOS (ID_US, PERIODO_POSTULACION, DIGNIDAD_CAND, ESTADO_CAND) 
                         VALUES ('nulo', :periodo_postulacion, 'nula', 1)`;
    
    const period = formData.periodo;
    const estado = 1; // Asumimos que el estado es siempre 1 según tu descripción

    console.log("Voy a guardar Nulo");
    await connection.execute(NuloQuery, [period]);
    console.log("Guarde Nulo");

    const dignidades = ['presidente', 'vicepresidente', 'secretario', 'subsecretario'];

    for (const dignidad of dignidades) {
      const candidatos = formData[dignidad];
      for (const candidato of candidatos) {
        // Separar el nombre y apellido del candidato
        const [nombre, apellido] = candidato.split(', '); // Separar por coma

        // Limpiar espacios alrededor de los nombres
        const cleanNombre = nombre.trim();
        const cleanApellido = apellido.trim();

        // Consulta para obtener el ID_US del candidato
        const result = await connection.execute(
          `SELECT ID_US FROM USUARIOS WHERE NOMBRE_US = :nombre AND APELLIDO_US = :apellido`,
          [cleanNombre, cleanApellido]
        );
        
        if (result.rows.length > 0) {
          const id_us = result.rows[0][0];
          // console.log(`Hola insertar final`);
          // console.log(`nombre ${cleanNombre} y apellido ${cleanApellido}`);
          // console.log(`El id es ${id_us}`);
          // console.log(`El periodo es ${period}`);
          // console.log(`El dignidad es ${dignidad}`);
          // console.log(`El estado es ${estado}`);
          // console.log(`${insertQuery}`);
          // Insertar en la tabla CANDIDATOS
          await connection.execute(insertQuery, [id_us, period, dignidad, estado]);
          //console.log(`Se Inserto disque`);
        } else {
          console.log(`No se encontró el usuario con nombre ${cleanNombre} y apellido ${cleanApellido}`);
          // Puedes manejar aquí lo que deseas hacer si no se encuentra el usuario
        }
      }
    }

    await connection.commit();
    await connection.close();

    res.status(200).send('Datos guardados correctamente');
    console.log("Candidatos guardados en la Base de Datos");
  } catch (err) {
    console.error('Error al guardar los datos en la base de datos:', err);
    res.status(500).send('Error en el servidor');
  }
});

app.post('/guardar-votos', async (req, res) => {
  try {
    const { usuario, formData } = req.body;
    //console.log('Usuario obtenido:', usuario);
    //console.log('Datos del formulario recibidos:', formData);

    const connection = await oracledb.getConnection(dbConfig);

    // Verificar si el votante ya existe en la tabla VOTANTES
    const checkVotanteQuery = `SELECT ID_US FROM VOTANTES WHERE ID_US = :usuario`;
    const result = await connection.execute(checkVotanteQuery, [usuario]);

    //console.log(result.rows.length);

    if (result.rows.length == 0) {
      // Si el votante no existe, insertar el votante en la tabla VOTANTES
      await connection.execute(
        `INSERT INTO VOTANTES (ID_US, ESTADO_VOT) VALUES (:usuario, 1)`,
        [usuario]
      );
      console.log('Se ha insertado el votante en la tabla VOTANTES.');
    } else {
      console.log('El votante ya existe en la tabla VOTANTES.');
    }

    const insertQuery = `INSERT INTO VOTOS (VOT_ID_US, ID_US, PERIODO_POSTULACION, FECHA_VOTACION) 
                         VALUES (:vot_id_us, :id_us, :periodo_postulacion, CURRENT_TIMESTAMP)`;
    
    const insertNuloQuery = `INSERT INTO VOTOS (VOT_ID_US, ID_US, PERIODO_POSTULACION, FECHA_VOTACION) 
                         VALUES (:vot_id_us, 'nulo', :periodo_postulacion, CURRENT_TIMESTAMP)`;

    const vot_id_us = usuario; // Variable Usuario de local storage
    const period = formData.periodo;

    const dignidades = ['presidente', 'vicepresidente', 'secretario', 'subsecretario'];

    for (const dignidad of dignidades) {
      const candidatos = formData[dignidad];
      for (const candidato of candidatos) {
        if (candidato.toLowerCase() === 'nulo') {
          // Insertar voto nulo
          console.log("Se considero voto nulo");
          await connection.execute(insertNuloQuery, [vot_id_us, period]);
          //console.log(`Se insertó un voto nulo para la dignidad de ${dignidad}`);
        } else {
          // Separar el nombre y apellido del candidato
          const [nombre, apellido] = candidato.split(', '); // Separar por coma

          // Limpiar espacios alrededor de los nombres
          const cleanNombre = nombre.trim();
          const cleanApellido = apellido.trim();

          // Consulta para obtener el ID_US del candidato
          const result = await connection.execute(
            `SELECT ID_US FROM USUARIOS WHERE NOMBRE_US = :nombre AND APELLIDO_US = :apellido`,
            [cleanNombre, cleanApellido]
          );
          
          if (result.rows.length > 0) {
            const id_us = result.rows[0][0];
            //console.log(`Votante: ${vot_id_us}, Candidato: ${id_us}, Período: ${period}`);
            // Insertar en la tabla VOTOS
            await connection.execute(insertQuery, [vot_id_us, id_us, period]);
            //console.log(`Se insertó el voto para ${cleanNombre} ${cleanApellido}`);
          } else {
            console.log(`No se encontró el usuario con nombre ${cleanNombre} y apellido ${cleanApellido}`);
            // Puedes manejar aquí lo que deseas hacer si no se encuentra el usuario
          }
        }
      }
    }

    // Confirmar la transacción
    await connection.commit();
    await connection.close();
    res.status(200).json({ message: 'Su voto fue guardado correctamente' });

  } catch (err) {
    console.error('Error al guardar los votos en la base de datos:', err);
    res.status(500).send('Error en el servidor');
  }
});



// Ruta para obtener candidatos por período
app.get('/obtener-candidatos', async (req, res) => {
  const periodo = req.query.periodo;
  //console.log(`Solicitud para obtener candidatos del período: ${periodo}`);

  try {
    // Establecer conexión a la base de datos
    //console.log('Estableciendo conexión a Oracle...');
    const connection = await oracledb.getConnection(dbConfig);
    //console.log('Conexión establecida con éxito.');

    // Consulta SQL para obtener candidatos por período con nombres completos
    const query = `
      SELECT u.NOMBRE_US || ', ' || u.APELLIDO_US AS NOMBRE_COMPLETO, c.DIGNIDAD_CAND
      FROM CANDIDATOS c
      JOIN USUARIOS u ON c.ID_US = u.ID_US
      WHERE c.PERIODO_POSTULACION = :periodo AND u.ID_US <> 'nulo'
    `;
    //console.log('Ejecutando consulta SQL...');
    
    // Ejecutar la consulta con el período proporcionado
    const result = await connection.execute(query, { periodo });
    //console.log('Consulta SQL ejecutada con éxito.');

    // Imprimir los resultados de la consulta
    //console.log('Resultados de la consulta:', result);

    // Transformar resultados a formato JSON
    const candidatos = {
      presidente: [],
      vicepresidente: [],
      secretario: [],
      subsecretario: []
    };

    // Organizar los resultados por título (DIGNIDAD_CAND)
    result.rows.forEach(row => {
      const idUs = row[0];
      const dignidad = row[1];

      switch (dignidad) {
        case 'presidente':
          candidatos.presidente.push({ ID_US: idUs });
          break;
        case 'vicepresidente':
          candidatos.vicepresidente.push({ ID_US: idUs });
          break;
        case 'secretario':
          candidatos.secretario.push({ ID_US: idUs });
          break;
        case 'subsecretario':
          candidatos.subsecretario.push({ ID_US: idUs });
          break;
        default:
          break;
      }
    });

    // Cerrar la conexión después de obtener los resultados
    await connection.close();
    //console.log('Conexión cerrada.');

    // Enviar respuesta con los candidatos encontrados
    res.status(200).json(candidatos);
    //console.log('Respuesta enviada:', candidatos);
  } catch (error) {
    console.error('Error al obtener candidatos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para verificar si un usuario ha votado para un período específico
app.get('/verificar-voto', async (req, res) => {
  const { usuario, periodo } = req.query;

  try {
    const connection = await oracledb.getConnection(dbConfig);

    // Consulta para verificar si el usuario ya ha votado para el período especificado
    const query = `
      SELECT COUNT(*) AS VOTO_REALIZADO
      FROM VOTOS
      WHERE VOT_ID_US = :usuario
        AND PERIODO_POSTULACION = :periodo
    `;

    const result = await connection.execute(query, [usuario, periodo]);

    // Extraer el resultado de la consulta
    const votoRealizado = result.rows[0][0] > 0;

    await connection.close();

    // Enviar respuesta con el resultado
    res.status(200).json({ votoRealizado });

  } catch (error) {
    console.error('Error al verificar voto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// Ruta para obtener los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT NOMBRE_US, APELLIDO_US FROM USUARIOS WHERE ID_US <> 'nulo'`
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
