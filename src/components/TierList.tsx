import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { TierRow } from "./TierRow";
import type { TierRow as TierRowType, BoardState, QuestionBankItem } from "../types";
import { DEFAULT_TIERS, QUESTION_BANKS } from "../types";
import {
  imageReferrerPolicyForUrl,
  isProxiedTierImage,
  resolvePosterImageUrl,
} from "../utils/posterUrl";

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
    anchorItemId?: string | null;
    placement?: "before" | "after";
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
  const { selectedBankId, placedItems } = boardState;

  const totalPlacedCount = useMemo(
    () => Object.values(placedItems).reduce((n, arr) => n + (arr?.length ?? 0), 0),
    [placedItems]
  );

  const selectedBank = selectedBankId
    ? QUESTION_BANKS.find((b) => b.id === selectedBankId)
    : null;

  const placedIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const arr of Object.values(placedItems)) {
      for (const p of arr || []) s.add(p.id);
    }
    return s;
  }, [placedItems]);

  const allBankItemsPlaced = useMemo(() => {
    if (!selectedBank) return false;
    return selectedBank.items.every((_, index) => placedIdSet.has(`${selectedBank.id}:${index}`));
  }, [selectedBank, placedIdSet]);

  /** 本题库尚未拖入等级的条目（已拖入的从下方移除） */
  const bankItemsStillInPool = useMemo(() => {
    if (!selectedBank) return [];
    return selectedBank.items
      .map((item, index) => ({
        item,
        index,
        itemId: `${selectedBank.id}:${index}` as const,
      }))
      .filter(({ itemId }) => !placedIdSet.has(itemId));
  }, [selectedBank, placedIdSet]);

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
      // html2canvas 无法解析 Tailwind v4 的 oklab()/oklch()，改用浏览器侧 SVG 渲染
      const dataUrl = await toPng(tableRef.current, {
        cacheBust: true,
        pixelRatio: totalPlacedCount > 48 ? 1 : 2,
        backgroundColor: "#333333",
      });
      const link = document.createElement("a");
      link.download = `从夯到拉-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("导出图片失败:", err);
      const msg =
        err instanceof Error && /taint|insecure|SecurityError/i.test(err.message)
          ? "导出失败：外链图片受浏览器跨域限制。请用 npm run dev 同时启动前端与联机服务（端口 3001），以便经代理加载图片后再导出。"
          : `导出失败：${err instanceof Error ? err.message : String(err)}`;
      window.alert(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleTapBankItem = (item: QuestionBankItem, itemId: string) => {
    setPendingTouchDrop({
      type: "current",
      itemId,
      name: item.name,
      imageUrl: item.imageUrl,
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
            onMoveWithAnchor={(payload) => {
              onMovePlacedItem({
                sourceTierId: payload.sourceTierId,
                targetTierId: payload.targetTierId,
                itemId: payload.itemId,
                name: payload.name,
                imageUrl: payload.imageUrl,
                anchorItemId: payload.anchorItemId,
                placement: payload.placement,
              });
              playDropSound();
              setPendingTouchDrop(null);
            }}
          />
        ))}
      </div>

      {/* 选题库后：等级行下方展示本题库全部图片 */}
      {selectedBank && (
        <div className="mt-5">
          <h3 className="text-sm font-medium text-zinc-700 mb-2">
            本题库图片
            <span className="ml-2 font-normal text-zinc-500">
              （剩余 {bankItemsStillInPool.length} / {selectedBank.items.length} 张，拖到上方等级行）
            </span>
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 min-h-[4.5rem]">
            {bankItemsStillInPool.map(({ item, itemId }) => {
              const displaySrc = resolvePosterImageUrl(item.imageUrl);
              const proxied = isProxiedTierImage(displaySrc);
              const refPolicy = imageReferrerPolicyForUrl(displaySrc);
              const isSelectedTouch =
                pendingTouchDrop?.type === "current" && pendingTouchDrop.itemId === itemId;
              return (
                <div
                  key={itemId}
                  draggable
                  title={item.name}
                  onDragStart={(e) => handleCurrentItemDragStart(e, item, itemId)}
                  onClick={() => handleTapBankItem(item, itemId)}
                  className={`rounded-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing transition-colors aspect-square ${
                    isSelectedTouch
                      ? "border-pink-500 bg-pink-50/90 ring-2 ring-pink-300"
                      : "border-zinc-300 border-dashed bg-white hover:border-pink-400 hover:bg-pink-50/50"
                  }`}
                >
                  <img
                    src={displaySrc}
                    alt={item.name}
                    title={item.name}
                    referrerPolicy={refPolicy}
                    loading="lazy"
                    decoding="async"
                    crossOrigin={proxied ? "anonymous" : undefined}
                    className="h-full w-full object-cover pointer-events-none"
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
          {isTouchDevice && (
            <div className="mt-2 text-xs text-zinc-500">
              触屏：先点一张图，再点上方等级行即可放置；拖入等级后该图会从下方消失，可在等级行内拖动调整。
            </div>
          )}
          {allBankItemsPlaced && (
            <div className="mt-3 rounded-lg bg-zinc-100 py-2.5 px-4 text-center text-sm text-zinc-500">
              本题库已全部拖入等级，可切换其他题库或继续调整等级内顺序
            </div>
          )}
        </div>
      )}
    </div>
  );
}
