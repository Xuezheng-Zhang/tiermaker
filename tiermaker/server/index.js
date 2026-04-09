import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const PORT = Number(process.env.PORT || 3001);

const FETCH_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DOUBAN_REFERER = "https://movie.douban.com/";

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

function applyMoveItem(state, payload) {
  let removed = null;
  const nextPlacedItems = {};
  for (const [tid, items] of Object.entries(state.placedItems || {})) {
    nextPlacedItems[tid] = [];
    for (const i of items) {
      if (i.id === payload.itemId) {
        removed = i;
        continue;
      }
      nextPlacedItems[tid].push(i);
    }
  }
  if (!removed) {
    removed = {
      id: payload.itemId,
      name: payload.name,
      imageUrl: payload.imageUrl,
    };
  }

  const list = [...(nextPlacedItems[payload.targetTierId] || [])];
  const anchor = payload.anchorItemId;
  const placement = payload.placement === "after" ? "after" : "before";

  if (anchor == null || anchor === "") {
    list.push(removed);
  } else {
    const idx = list.findIndex((i) => i.id === anchor);
    if (idx < 0) list.push(removed);
    else {
      const pos = placement === "after" ? idx + 1 : idx;
      list.splice(pos, 0, removed);
    }
  }
  nextPlacedItems[payload.targetTierId] = list;
  return {
    selectedBankId: state.selectedBankId,
    currentIndex: state.currentIndex,
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

    if (operation.type === "place_item") {
      const tierId = String(operation.tierId || "").trim();
      const itemId = String(operation.itemId || "").trim();
      const name = String(operation.name || "").trim();
      const imageUrl = String(operation.imageUrl || "").trim();
      if (!tierId || !itemId || !name || !imageUrl) return;
      room.state = applyPlaceItem(room.state, { tierId, itemId, name, imageUrl });
      emitRoomState(room);
      return;
    }

    if (operation.type === "move_item") {
      const tierId = String(operation.tierId || "").trim();
      const itemId = String(operation.itemId || "").trim();
      const name = String(operation.name || "").trim();
      const imageUrl = String(operation.imageUrl || "").trim();
      if (!tierId || !itemId || !name || !imageUrl) return;
      const anchorRaw = operation.anchorItemId;
      const anchorItemId =
        anchorRaw != null && String(anchorRaw).trim() !== ""
          ? String(anchorRaw).trim()
          : null;
      const placement = operation.placement === "after" ? "after" : "before";
      room.state = applyMoveItem(room.state, {
        itemId,
        name,
        imageUrl,
        targetTierId: tierId,
        anchorItemId,
        placement,
      });
      emitRoomState(room);
      return;
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

app.get("/poster-proxy", async (req, res) => {
  const raw = req.query.u;
  const target = typeof raw === "string" ? raw.trim() : "";
  if (!target) {
    res.status(400).send("missing u");
    return;
  }
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    res.status(400).send("invalid url");
    return;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    res.status(400).send("invalid protocol");
    return;
  }
  if (!/^img\d+\.doubanio\.com$/i.test(parsed.hostname)) {
    res.status(400).send("host not allowed");
    return;
  }
  if (!parsed.pathname.includes("/view/photo/")) {
    res.status(400).send("path not allowed");
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": FETCH_UA,
        Referer: DOUBAN_REFERER,
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!upstream.ok) {
      res.status(upstream.status).send("upstream error");
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  } catch (err) {
    console.error("poster-proxy", err);
    res.status(502).send("proxy failed");
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on http://localhost:${PORT}`);
});
