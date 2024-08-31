// Importar las librerías necesarias
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const morgan = require("morgan");
const cors = require("cors");
const cron = require("node-cron"); // Importar node-cron

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
  io.emit("roomsReset", "Las salas han sido reiniciadas a las 1 a.m."); // Notificar a todos los usuarios
});

// Configurar el Socket.IO
io.on("connection", (socket) => {
  console.log("Usuario conectado");

  // Manejar la unión a una sala específica con nombre e ID
  socket.on("joinRoom", ({ room, name, userId }) => {
    socket.join(room);
    console.log(`${name} se unió a la sala: ${room}`);

    // Agregar el usuario a la sala
    roomUsers[room].push({ userId, name });

    // Emitir la lista de usuarios actualizada a todos en la sala
    io.to(room).emit("roomUsers", roomUsers[room]);

    // Cargar los mensajes anteriores de la sala
    socket.emit("loadMessages", roomMessages[room]);
  });

  // Escuchar por eventos de mensaje con nombre y mensaje
  socket.on("mensaje", (data) => {
    const { room, name, message } = data;
    const newMessage = { name, message };
    roomMessages[room].push(newMessage); // Guardar el mensaje en la sala correspondiente
    io.to(room).emit("mensaje", newMessage); // Reenviar el mensaje solo a la sala correspondiente
  });

  // Manejar cuando el usuario abandona la sala
  socket.on("leaveRoom", ({ room, userId }) => {
    roomUsers[room] = roomUsers[room].filter((user) => user.userId !== userId);
    io.to(room).emit("roomUsers", roomUsers[room]);
    socket.leave(room);
    socket.emit("userLeft", `Has abandonado la sala ${room}`);
    console.log(`Usuario con ID ${userId} ha abandonado la sala ${room}`);
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
    }
  });
});

// Configurar el servidor para que escuche en un puerto
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
