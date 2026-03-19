import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { TierRow } from "./TierRow";
import type { TierRow as TierRowType, BoardState, QuestionBankItem } from "../types";
import { DEFAULT_TIERS, QUESTION_BANKS } from "../types";

interface TierListProps {
  boardState: BoardState;
  onSelectBank: (bankId: string) => void;
  onPlaceCurrentItem: (payload: { tierId: string; itemId: string; name: string; imageUrl: string }) => void;
  onMovePlacedItem: (payload: {
    sourceTierId: string;
    targetTierId: string;
    itemId: string;
    name: string;
    imageUrl: string;
  }) => void;
}

type DropData =
  | { type: "current"; itemId: string; name: string; imageUrl: string }
  | { type: "move"; sourceTierId: string; itemId: string; name: string; imageUrl: string };

export function TierList({
  boardState,
  onSelectBank,
  onPlaceCurrentItem,
  onMovePlacedItem,
}: TierListProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [tiers] = useState<TierRowType[]>(() => DEFAULT_TIERS);
  const [exporting, setExporting] = useState(false);
  const [pendingTouchDrop, setPendingTouchDrop] = useState<DropData | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { selectedBankId, currentIndex, placedItems } = boardState;

  const selectedBank = selectedBankId
    ? QUESTION_BANKS.find((b) => b.id === selectedBankId)
    : null;
  const currentItem: QuestionBankItem | null =
    selectedBank && currentIndex < selectedBank.items.length
      ? selectedBank.items[currentIndex]
      : null;
  const hasMore = selectedBank && currentIndex < selectedBank.items.length;
  const currentItemId =
    selectedBank && currentIndex < selectedBank.items.length
      ? `${selectedBank.id}:${currentIndex}`
      : null;

  const handleSelectBank = (bankId: string) => {
    onSelectBank(bankId);
  };

  const isTouchDevice =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);

  const playDropSound = () => {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    const ctx = audioCtxRef.current;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(720, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  const handleDrop = (tierId: string, data: DropData) => {
    if (data.type === "current") {
      onPlaceCurrentItem({
        tierId,
        itemId: data.itemId,
        name: data.name,
        imageUrl: data.imageUrl,
      });
      playDropSound();
    } else {
      const { sourceTierId, itemId, name, imageUrl } = data;
      if (sourceTierId === tierId) return;
      onMovePlacedItem({
        sourceTierId,
        targetTierId: tierId,
        itemId,
        name,
        imageUrl,
      });
      playDropSound();
    }
    setPendingTouchDrop(null);
  };

  const handleCurrentItemDragStart = (
    e: React.DragEvent,
    item: QuestionBankItem,
    itemId: string
  ) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "current" as const,
        itemId,
        name: item.name,
        imageUrl: item.imageUrl,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleExportImage = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#333",
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `从夯到拉-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("导出图片失败:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleTapCurrentItem = () => {
    if (!currentItem || !currentItemId) return;
    setPendingTouchDrop({
      type: "current",
      itemId: currentItemId,
      name: currentItem.name,
      imageUrl: currentItem.imageUrl,
    });
  };

  const handleTapPlacedItem = (tierId: string, item: { id: string; name: string; imageUrl: string }) => {
    setPendingTouchDrop({
      type: "move",
      sourceTierId: tierId,
      itemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
    });
  };

  const handleTapTier = (tierId: string) => {
    if (!pendingTouchDrop) return;
    handleDrop(tierId, pendingTouchDrop);
  };

  return (
    <div className="w-full">
      {/* 选择题库 */}
      <div className="mb-4">
        <h2 className="text-base font-medium text-zinc-700 mb-2">选择题库</h2>
        <div className="flex flex-wrap gap-2">
          {QUESTION_BANKS.map((bank) => (
            <button
              key={bank.id}
              type="button"
              onClick={() => handleSelectBank(bank.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                selectedBankId === bank.id
                  ? "bg-[#333] text-white"
                  : "bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <span>{bank.name}</span>
              <span className="opacity-70 text-xs">（{bank.items.length} 题）</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium text-zinc-700">等级列表</h2>
        <button
          type="button"
          onClick={handleExportImage}
          disabled={exporting}
          className="px-2.5 py-1 text-sm rounded bg-zinc-200 text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 transition-colors"
        >
          {exporting ? "导出中…" : "导出图片"}
        </button>
      </div>

      <div ref={tableRef} className="border-2 border-[#111] rounded overflow-hidden bg-[#333]">
        {tiers.map((tier) => (
          <TierRow
            key={tier.id}
            tier={tier}
            placedItems={placedItems[tier.id] || []}
            onDrop={(data) => handleDrop(tier.id, data)}
            onTapTier={() => handleTapTier(tier.id)}
            onTapPlacedItem={(item) => handleTapPlacedItem(tier.id, item)}
            selectedTouchItemId={pendingTouchDrop?.itemId ?? null}
          />
        ))}
      </div>

      {/* 当前题目：拖到对应等级后显示下一个 */}
      {selectedBank && (
        <div className="mt-4">
          {hasMore && currentItem ? (
            <>
              <div
                draggable
                onDragStart={(e) => handleCurrentItemDragStart(e, currentItem, currentItemId!)}
                onClick={handleTapCurrentItem}
                className={`inline-flex items-center justify-center w-[160px] rounded-lg bg-white border-2 border-dashed overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${
                  pendingTouchDrop?.type === "current"
                    ? "border-pink-500 bg-pink-50/70"
                    : "border-zinc-300 hover:border-pink-400 hover:bg-pink-50/50"
                }`}
              >
                <img
                  src={currentItem.imageUrl}
                  alt=""
                  className="w-full aspect-square object-cover pointer-events-none"
                  draggable={false}
                />
              </div>
              {isTouchDevice && (
                <div className="mt-2 text-xs text-zinc-500">
                  触屏操作：先点图片，再点目标等级行即可放置/移动
                </div>
              )}
            </>
          ) : hasMore ? null : (
            <div className="py-3 px-5 rounded-lg bg-zinc-100 text-zinc-500 text-sm">
              本题库已排完，可重新选择题库或切换其他题库继续
            </div>
          )}
        </div>
      )}
    </div>
  );
}
