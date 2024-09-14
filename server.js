// Importar las librerías necesarias
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const morgan = require("morgan");
const cors = require("cors");
const cron = require("node-cron");
const jwt = require("jsonwebtoken"); // Para verificar el JWT

// Claves y configuraciones para JWT
const secretKey = "clave_de_prueba_super_secreta_12345"; //misma que en .net
const issuer = "https://[2806:2f0:6020:d4f8::656]:7152";
const audience = "https://[2806:2f0:6020:d4f8::656]:7152";

// Crear la aplicación Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:4200", // Permitir solicitudes desde localhost:4200
    methods: ["GET", "POST"],
  },
});

// Objeto para almacenar los mensajes por sala
const roomMessages = {
  sala1: [],
  sala2: [],
  sala3: [],
  sala4: [],
  sala5: [],
  sala6: [],
  sala7: [],
  sala8: [],
  sala9: [],
  sala10: [],
};

// Objeto para almacenar usuarios conectados por sala
const roomUsers = {
  sala1: [],
  sala2: [],
  sala3: [],
  sala4: [],
  sala5: [],
  sala6: [],
  sala7: [],
  sala8: [],
  sala9: [],
  sala10: [],
};

// Middleware para registrar las solicitudes HTTP
app.use(morgan("dev"));

// Habilitar CORS para todas las rutas
app.use(
  cors({
    origin: "http://localhost:4200", // Permitir solicitudes desde localhost:4200
  })
);

// Servir archivos estáticos (si tienes alguno, como HTML, CSS, JS)
app.use(express.static("public"));

// Función para reiniciar todas las salas (limpiar mensajes)
function resetRooms() {
  for (const room in roomMessages) {
    roomMessages[room] = []; // Limpiar los mensajes de la sala
  }
  console.log("Todas las salas han sido reiniciadas (mensajes eliminados).");
}

// Configurar una tarea cron para reiniciar las salas a la 1 a.m. todos los días
cron.schedule("0 1 * * *", () => {
  resetRooms();
  io.emit("roomsReset", "Las salas han sido reiniciadas a la 1 a.m."); // Notificar a todos los usuarios
});

// Middleware para verificar el JWT en las conexiones Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token; // Obtener el token del handshake
  if (!token) {
    console.error("No se proporcionó token en la conexión de Socket.IO");
    return next(new Error("Autenticación requerida")); // Si no hay token, rechazar
  }

  console.log("Token recibido:", token); // Log del token recibido

  // Verificar el token JWT
  jwt.verify(
    token,
    secretKey,
    {
      algorithms: ["HS256"], // Asegurar que el algoritmo sea HS256
      issuer: issuer, // Especificar el issuer
      audience: audience, // Especificar el audience
    },
    (err, decoded) => {
      if (err) {
        console.error("Error al verificar el token:", err);
        return next(new Error("Token inválido")); // Si el token es inválido, rechazar
      }
      // Si el token es válido, añadimos la info del usuario al socket
      console.log(
        "Token verificado correctamente. Datos decodificados:",
        decoded
      );
      socket.user = decoded;
      next();
    }
  );
});

// Configurar el Socket.IO
io.on("connection", (socket) => {
  console.log(
    `Usuario autenticado: ${
      socket.user.email || socket.user.name || "Desconocido"
    }`
  ); // Usar el claim adecuado

  // Manejar la unión a una sala específica con nombre e ID
  socket.on("joinRoom", ({ room, name, userId }) => {
    socket.join(room);
    console.log(`Usuario ${name} (ID: ${userId}) se unió a la sala: ${room}`);

    // Agregar el usuario a la sala
    roomUsers[room].push({ userId, name });

    // Emitir la lista de usuarios actualizada a todos en la sala
    io.to(room).emit("roomUsers", roomUsers[room]);
    console.log(`Usuarios en la sala ${room}:`, roomUsers[room]);

    // Cargar los mensajes anteriores de la sala
    socket.emit("loadMessages", roomMessages[room]);
    console.log(`Mensajes cargados para el usuario ${name} en la sala ${room}`);
  });

  // Escuchar por eventos de mensaje con nombre y mensaje
  socket.on("mensaje", (data) => {
    const { room, name, message } = data;
    const newMessage = { name, message };
    roomMessages[room].push(newMessage); // Guardar el mensaje en la sala correspondiente
    io.to(room).emit("mensaje", newMessage); // Reenviar el mensaje solo a la sala correspondiente
    console.log(`Mensaje enviado en la sala ${room} por ${name}: ${message}`);
  });

  // Manejar cuando el usuario abandona la sala
  socket.on("leaveRoom", ({ room, userId }) => {
    roomUsers[room] = roomUsers[room].filter((user) => user.userId !== userId);
    io.to(room).emit("roomUsers", roomUsers[room]);
    socket.leave(room);
    socket.emit("userLeft", `Has abandonado la sala ${room}`);
    console.log(`Usuario con ID ${userId} ha abandonado la sala ${room}`);
    console.log(`Usuarios restantes en la sala ${room}:`, roomUsers[room]);
  });

  // Manejar la desconexión
  socket.on("disconnect", () => {
    let userRoom = "";
    let userName = "";

    // Buscar en qué sala estaba el usuario
    for (const room in roomUsers) {
      const index = roomUsers[room].findIndex(
        (user) => user.userId === socket.id
      );
      if (index !== -1) {
        userRoom = room;
        userName = roomUsers[room][index].name;
        roomUsers[room].splice(index, 1);
        break;
      }
    }

    if (userRoom) {
      console.log(`${userName} se ha desconectado de la sala: ${userRoom}`);
      // Emitir la lista de usuarios actualizada a todos en la sala
      io.to(userRoom).emit("roomUsers", roomUsers[userRoom]);
      console.log(
        `Usuarios restantes en la sala ${userRoom}:`,
        roomUsers[userRoom]
      );
    } else {
      console.log(
        `Un usuario se ha desconectado sin estar en una sala activa.`
      );
    }
  });
});

// Configurar el servidor para que escuche en un puerto
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});
