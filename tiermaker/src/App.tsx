import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { TierList } from "./components/TierList";
import type { BoardState, RoomMember } from "./types";

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

function App() {
  const [nickname, setNickname] = useState("");
  const [boardState, setBoardState] = useState<BoardState>(createEmptyBoardState);
  const [roomCode, setRoomCode] = useState("");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [selfId, setSelfId] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [loadingAction, setLoadingAction] = useState<"create" | "join" | "leave" | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const applyingRemoteRef = useRef(false);

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
      applyingRemoteRef.current = true;
      setBoardState(state);
      window.setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 0);
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

  const handleBoardStateChange = (next: BoardState) => {
    setBoardState(next);
    if (!inRoom || applyingRemoteRef.current) return;
    socketRef.current?.emit("update_room_state", { state: next });
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
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-center text-2xl font-bold text-zinc-800">
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

        <main>
          <div className="relative">
            <div className="absolute right-0 top-0 z-10 rounded-lg border border-zinc-300 bg-white/95 px-3 py-2 text-xs shadow-sm">
              <div className="mb-1 font-semibold text-zinc-700">
                房间成员{members.length > 0 ? `（${members.length}）` : ""}
              </div>
              {members.length > 0 ? (
                <div className="flex flex-col gap-1 text-zinc-600">
                  {members.map((member) => (
                    <span key={member.id}>
                      {member.nickname}
                      {member.id === selfId ? "（你）" : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-zinc-400">未加入房间</div>
              )}
            </div>
            <TierList boardState={boardState} onBoardStateChange={handleBoardStateChange} />
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
