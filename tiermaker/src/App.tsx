import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { TierList } from "./components/TierList";
import { useDragAutoScroll } from "./hooks/useDragAutoScroll";
import type { BoardState, PlacedItem, RoomMember } from "./types";

const STORAGE_KEY_NICKNAME = "tiermaker_nickname";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

function randomNickname() {
  const left = ["闪电", "奶茶", "咕噜", "小熊", "猫猫", "火箭", "橘子", "阿福", "云朵", "柠檬"];
  const right = ["同学", "骑士", "队长", "选手", "大师", "博士", "勇者", "玩家", "朋友", "达人"];
  const n = Math.floor(Math.random() * 900 + 100);
  return `${left[Math.floor(Math.random() * left.length)]}${right[Math.floor(Math.random() * right.length)]}${n}`;
}

function getInitialNickname() {
  const saved = localStorage.getItem(STORAGE_KEY_NICKNAME);
  if (saved) return saved;
  const generated = randomNickname();
  localStorage.setItem(STORAGE_KEY_NICKNAME, generated);
  return generated;
}

function createEmptyBoardState(): BoardState {
  return {
    selectedBankId: null,
    currentIndex: 0,
    placedItems: {},
  };
}

function applyPlaceItem(
  state: BoardState,
  payload: { tierId: string; itemId: string; name: string; imageUrl: string }
): BoardState {
  const nextPlacedItems: BoardState["placedItems"] = {};
  for (const [tierId, items] of Object.entries(state.placedItems)) {
    nextPlacedItems[tierId] = items.filter((item) => item.id !== payload.itemId);
  }
  nextPlacedItems[payload.tierId] = [
    ...(nextPlacedItems[payload.tierId] || []),
    { id: payload.itemId, name: payload.name, imageUrl: payload.imageUrl },
  ];

  let nextIndex = state.currentIndex;
  const [bankId, indexRaw] = payload.itemId.split(":");
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

function applyMoveItem(
  state: BoardState,
  payload: {
    itemId: string;
    name: string;
    imageUrl: string;
    targetTierId: string;
    anchorItemId?: string | null;
    placement?: "before" | "after";
  }
): BoardState {
  let removed: PlacedItem | null = null;
  const nextPlacedItems: BoardState["placedItems"] = {};
  for (const [tid, items] of Object.entries(state.placedItems)) {
    nextPlacedItems[tid] = [];
    for (const i of items) {
      if (i.id === payload.itemId) {
        removed = i;
        continue;
      }
      nextPlacedItems[tid].push(i);
    }
  }
  if (!removed) removed = { id: payload.itemId, name: payload.name, imageUrl: payload.imageUrl };

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

function App() {
  useDragAutoScroll();

  const [nickname, setNickname] = useState("");
  const [boardState, setBoardState] = useState<BoardState>(createEmptyBoardState);
  const [roomCode, setRoomCode] = useState("");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [selfId, setSelfId] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [loadingAction, setLoadingAction] = useState<"create" | "join" | "leave" | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setNickname(getInitialNickname());
  }, []);

  useEffect(() => {
    if (!nickname) return;
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("room_members", ({ members: nextMembers }: { members: RoomMember[] }) => {
      setMembers(nextMembers);
    });

    socket.on("room_state", ({ state }: { state: BoardState }) => {
      setBoardState(state);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [nickname]);

  const inRoom = roomCode.length > 0;
  const currentUserLabel = useMemo(() => {
    const me = members.find((m) => m.id === selfId);
    return me?.nickname || nickname;
  }, [members, nickname, selfId]);

  const emitRoomOperation = (operation: unknown) => {
    if (!inRoom) return;
    socketRef.current?.emit("room_operation", operation);
  };

  const handleSelectBank = (bankId: string) => {
    if (inRoom) {
      emitRoomOperation({ type: "select_bank", bankId });
      return;
    }
    setBoardState({
      selectedBankId: bankId,
      currentIndex: 0,
      placedItems: {},
    });
  };

  const handlePlaceCurrentItem = (payload: {
    tierId: string;
    itemId: string;
    name: string;
    imageUrl: string;
  }) => {
    if (inRoom) {
      emitRoomOperation({ type: "place_item", ...payload });
      return;
    }
    setBoardState((prev) => applyPlaceItem(prev, payload));
  };

  const handleMovePlacedItem = (payload: {
    sourceTierId: string;
    targetTierId: string;
    itemId: string;
    name: string;
    imageUrl: string;
    anchorItemId?: string | null;
    placement?: "before" | "after";
  }) => {
    if (inRoom) {
      emitRoomOperation({
        type: "move_item",
        tierId: payload.targetTierId,
        itemId: payload.itemId,
        name: payload.name,
        imageUrl: payload.imageUrl,
        anchorItemId: payload.anchorItemId ?? null,
        placement: payload.placement,
      });
      return;
    }
    setBoardState((prev) =>
      applyMoveItem(prev, {
        itemId: payload.itemId,
        name: payload.name,
        imageUrl: payload.imageUrl,
        targetTierId: payload.targetTierId,
        anchorItemId: payload.anchorItemId,
        placement: payload.placement,
      })
    );
  };

  const handleCreateRoom = () => {
    if (!socketRef.current || !nickname) return;
    setLoadingAction("create");
    socketRef.current.emit("create_room", { nickname }, (res: {
      ok: boolean;
      roomCode?: string;
      state?: BoardState;
      members?: RoomMember[];
      selfId?: string;
      message?: string;
    }) => {
      setLoadingAction(null);
      if (!res.ok || !res.roomCode || !res.state || !res.members || !res.selfId) {
        alert(res.message || "创建房间失败");
        return;
      }
      setRoomCode(res.roomCode);
      setBoardState(res.state);
      setMembers(res.members);
      setSelfId(res.selfId);
    });
  };

  const handleJoinRoom = () => {
    const normalizedCode = joinCodeInput.trim();
    if (!socketRef.current || !nickname || !normalizedCode) return;
    setLoadingAction("join");
    socketRef.current.emit("join_room", { roomCode: normalizedCode, nickname }, (res: {
      ok: boolean;
      roomCode?: string;
      state?: BoardState;
      members?: RoomMember[];
      selfId?: string;
      message?: string;
    }) => {
      setLoadingAction(null);
      if (!res.ok || !res.roomCode || !res.state || !res.members || !res.selfId) {
        alert(res.message || "加入房间失败");
        return;
      }
      setShowJoinModal(false);
      setJoinCodeInput("");
      setRoomCode(res.roomCode);
      setBoardState(res.state);
      setMembers(res.members);
      setSelfId(res.selfId);
    });
  };

  const handleLeaveRoom = () => {
    if (!socketRef.current || !inRoom) return;
    setLoadingAction("leave");
    socketRef.current.emit("leave_room", {}, () => {
      setLoadingAction(null);
      setRoomCode("");
      setMembers([]);
      setSelfId("");
      setBoardState(createEmptyBoardState());
    });
  };

  return (
    <div className="min-h-screen bg-[#e8e8e8]">
      <div className="mx-auto w-full max-w-[min(100%,1680px)] px-4 py-6 sm:px-6 lg:px-10 xl:px-14 lg:py-10">
        <header className="mb-6 lg:mb-10">
          <h1 className="text-center text-2xl font-bold text-zinc-800 sm:text-3xl lg:text-[1.75rem]">
            从夯到拉生成器
          </h1>
          <div className="mt-4 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-medium">昵称：{currentUserLabel}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={inRoom || loadingAction !== null}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-40"
                >
                  {loadingAction === "create" ? "创建中..." : "创建房间"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(true)}
                  disabled={inRoom || loadingAction !== null}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-700 disabled:opacity-40"
                >
                  加入房间
                </button>
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  disabled={!inRoom || loadingAction !== null}
                  className="rounded-md bg-rose-500 px-3 py-1.5 text-white disabled:opacity-40"
                >
                  {loadingAction === "leave" ? "退出中..." : "退出房间"}
                </button>
              </div>
            </div>
            <div className="mt-2 text-zinc-500">
              {inRoom ? `房间号：${roomCode}` : "当前未在房间中（单机模式）"}
            </div>
          </div>
        </header>

        <main className="relative">
          {inRoom && members.length > 0 && (
            <div className="pointer-events-none absolute right-0 top-0 z-20 m-3 hidden items-center gap-1.5 sm:flex">
              {members.map((member) => {
                const firstChar = member.nickname?.[0] ?? "?";
                const isSelf = member.id === selfId;
                return (
                  <div
                    key={member.id}
                    className={`pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold shadow-sm ${
                      isSelf ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 border border-zinc-300"
                    }`}
                    title={member.nickname}
                  >
                    {firstChar}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 sm:mt-0">
            <TierList
              boardState={boardState}
              onSelectBank={handleSelectBank}
              onPlaceCurrentItem={handlePlaceCurrentItem}
              onMovePlacedItem={handleMovePlacedItem}
            />
          </div>
        </main>

        <footer className="mt-10 text-center text-zinc-400 text-xs">
        </footer>
      </div>

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-800">输入 5 位房间码</h3>
            <input
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-800 outline-none focus:border-zinc-500"
              placeholder="例如：58231"
              inputMode="numeric"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700"
                onClick={() => setShowJoinModal(false)}
                disabled={loadingAction === "join"}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-40"
                onClick={handleJoinRoom}
                disabled={joinCodeInput.trim().length !== 5 || loadingAction === "join"}
              >
                {loadingAction === "join" ? "加入中..." : "确认加入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
