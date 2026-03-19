import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const PORT = Number(process.env.PORT || 3001);

/**
 * @typedef {{ selectedBankId: string | null, currentIndex: number, placedItems: Record<string, {id:string,name:string,imageUrl:string}[]> }} RoomBoardState
 * @typedef {{ id: string, nickname: string }} RoomMember
 * @typedef {{ code: string, members: Map<string, RoomMember>, state: RoomBoardState }} Room
 */

/** @type {Map<string, Room>} */
const rooms = new Map();
/** @type {Map<string, string>} */
const socketRoomMap = new Map();

function createDefaultState() {
  return {
    selectedBankId: null,
    currentIndex: 0,
    placedItems: {},
  };
}

function generateRoomCode() {
  let code = "";
  do {
    code = Math.floor(10000 + Math.random() * 90000).toString();
  } while (rooms.has(code));
  return code;
}

function toMembersArray(room) {
  return Array.from(room.members.values());
}

function emitRoomInfo(room) {
  io.to(room.code).emit("room_members", { members: toMembersArray(room) });
}

function emitRoomState(room) {
  io.to(room.code).emit("room_state", { state: room.state });
}

function applyPlaceItem(state, payload) {
  const nextPlacedItems = {};
  for (const [tierId, items] of Object.entries(state.placedItems || {})) {
    nextPlacedItems[tierId] = items.filter((item) => item.id !== payload.itemId);
  }
  nextPlacedItems[payload.tierId] = [
    ...(nextPlacedItems[payload.tierId] || []),
    {
      id: payload.itemId,
      name: payload.name,
      imageUrl: payload.imageUrl,
    },
  ];

  let nextIndex = state.currentIndex;
  const [bankId, indexRaw] = String(payload.itemId || "").split(":");
  const parsedIndex = Number(indexRaw);
  if (
    state.selectedBankId &&
    bankId === state.selectedBankId &&
    Number.isInteger(parsedIndex) &&
    parsedIndex === state.currentIndex
  ) {
    nextIndex = state.currentIndex + 1;
  }

  return {
    selectedBankId: state.selectedBankId,
    currentIndex: nextIndex,
    placedItems: nextPlacedItems,
  };
}

io.on("connection", (socket) => {
  socket.on("create_room", ({ nickname }, ack) => {
    const code = generateRoomCode();
    const room = {
      code,
      members: new Map(),
      state: createDefaultState(),
    };
    rooms.set(code, room);

    const member = { id: socket.id, nickname: String(nickname || "匿名玩家") };
    room.members.set(socket.id, member);
    socket.join(code);
    socketRoomMap.set(socket.id, code);

    ack?.({
      ok: true,
      roomCode: code,
      members: toMembersArray(room),
      state: room.state,
      selfId: socket.id,
    });
  });

  socket.on("join_room", ({ roomCode, nickname }, ack) => {
    const code = String(roomCode || "").trim();
    const room = rooms.get(code);
    if (!room) {
      ack?.({ ok: false, message: "房间不存在" });
      return;
    }
    const member = { id: socket.id, nickname: String(nickname || "匿名玩家") };
    room.members.set(socket.id, member);
    socket.join(code);
    socketRoomMap.set(socket.id, code);
    emitRoomInfo(room);

    ack?.({
      ok: true,
      roomCode: code,
      members: toMembersArray(room),
      state: room.state,
      selfId: socket.id,
    });
  });

  socket.on("leave_room", (_, ack) => {
    const code = socketRoomMap.get(socket.id);
    if (!code) {
      ack?.({ ok: false });
      return;
    }
    const room = rooms.get(code);
    socket.leave(code);
    socketRoomMap.delete(socket.id);
    if (room) {
      room.members.delete(socket.id);
      if (room.members.size === 0) {
        rooms.delete(code);
      } else {
        emitRoomInfo(room);
      }
    }
    ack?.({ ok: true });
  });

  socket.on("room_operation", (operation) => {
    const code = socketRoomMap.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!operation || typeof operation !== "object") return;

    if (operation.type === "select_bank") {
      const bankId = String(operation.bankId || "").trim();
      if (!bankId) return;
      room.state = {
        selectedBankId: bankId,
        currentIndex: 0,
        placedItems: {},
      };
      emitRoomState(room);
      return;
    }

    if (operation.type === "place_item" || operation.type === "move_item") {
      const tierId = String(operation.tierId || "").trim();
      const itemId = String(operation.itemId || "").trim();
      const name = String(operation.name || "").trim();
      const imageUrl = String(operation.imageUrl || "").trim();
      if (!tierId || !itemId || !name || !imageUrl) return;
      room.state = applyPlaceItem(room.state, { tierId, itemId, name, imageUrl });
      emitRoomState(room);
    }
  });

  socket.on("disconnect", () => {
    const code = socketRoomMap.get(socket.id);
    if (!code) return;
    socketRoomMap.delete(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    room.members.delete(socket.id);
    if (room.members.size === 0) {
      rooms.delete(code);
    } else {
      emitRoomInfo(room);
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on http://localhost:${PORT}`);
});
