import { useRef, useState } from "react";
import type { TierRow as TierRowType, PlacedItem as PlacedItemType } from "../types";
import {
  imageReferrerPolicyForUrl,
  isProxiedTierImage,
  resolvePosterImageUrl,
} from "../utils/posterUrl";

interface TierRowProps {
  tier: TierRowType;
  placedItems: PlacedItemType[];
  onDrop: (
    data:
      | { type: "current"; itemId: string; name: string; imageUrl: string }
      | { type: "move"; sourceTierId: string; itemId: string; name: string; imageUrl: string }
  ) => void;
  onTapTier?: () => void;
  onTapPlacedItem?: (item: PlacedItemType) => void;
  selectedTouchItemId?: string | null;
  onMoveWithAnchor?: (payload: {
    sourceTierId: string;
    targetTierId: string;
    itemId: string;
    name: string;
    imageUrl: string;
    anchorItemId: string;
    placement: "before" | "after";
  }) => void;
}

export function TierRow({
  tier,
  placedItems,
  onDrop,
  onTapTier,
  onTapPlacedItem,
  selectedTouchItemId,
  onMoveWithAnchor,
}: TierRowProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  /** 避免 dragOver 每秒触发数百次导致整行反复 setState（图多时会明显卡顿） */
  const dragOverRowRef = useRef(false);

  type DropData =
    | { type: "current"; itemId: string; name: string; imageUrl: string }
    | { type: "move"; sourceTierId: string; itemId: string; name: string; imageUrl: string };

  const clearRowDragOver = () => {
    dragOverRowRef.current = false;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    clearRowDragOver();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let data: DropData;
    try {
      const parsed = JSON.parse(raw) as {
        type?: string;
        sourceTierId?: string;
        itemId?: string;
        name?: string;
        imageUrl?: string;
      };
      if (
        parsed?.type === "current" &&
        parsed.itemId != null &&
        parsed.name != null &&
        parsed.imageUrl != null
      ) {
        data = {
          type: "current",
          itemId: parsed.itemId,
          name: parsed.name,
          imageUrl: parsed.imageUrl,
        };
      } else if (
        parsed?.type === "move" &&
        parsed.sourceTierId != null &&
        parsed.itemId != null &&
        parsed.name != null &&
        parsed.imageUrl != null
      ) {
        data = {
          type: "move",
          sourceTierId: parsed.sourceTierId,
          itemId: parsed.itemId,
          name: parsed.name,
          imageUrl: parsed.imageUrl,
        };
      } else {
        return;
      }
    } catch {
      return;
    }
    onDrop(data);
  };

  const handlePlacedItemDragStart = (e: React.DragEvent, item: PlacedItemType) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "move" as const,
        sourceTierId: tier.id,
        itemId: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragOverRowRef.current) {
      dragOverRowRef.current = true;
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    const pad = 6;
    if (x > rect.left + pad && x < rect.right - pad && y > rect.top + pad && y < rect.bottom - pad) {
      return;
    }
    clearRowDragOver();
  };

  const parseMovePayload = (raw: string): DropData | null => {
    try {
      const parsed = JSON.parse(raw) as {
        type?: string;
        sourceTierId?: string;
        itemId?: string;
        name?: string;
        imageUrl?: string;
      };
      if (
        parsed?.type === "move" &&
        parsed.sourceTierId != null &&
        parsed.itemId != null &&
        parsed.name != null &&
        parsed.imageUrl != null
      ) {
        return {
          type: "move",
          sourceTierId: parsed.sourceTierId,
          itemId: parsed.itemId,
          name: parsed.name,
          imageUrl: parsed.imageUrl,
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  const handlePlacedItemDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handlePlacedItemDrop = (e: React.DragEvent, targetItem: PlacedItemType) => {
    e.preventDefault();
    e.stopPropagation();
    clearRowDragOver();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        type?: string;
        itemId?: string;
        name?: string;
        imageUrl?: string;
      };
      if (
        parsed?.type === "current" &&
        parsed.itemId != null &&
        parsed.name != null &&
        parsed.imageUrl != null
      ) {
        onDrop({
          type: "current",
          itemId: parsed.itemId,
          name: parsed.name,
          imageUrl: parsed.imageUrl,
        });
        return;
      }
    } catch {
      return;
    }
    const data = parseMovePayload(raw);
    if (!data || data.type !== "move") return;
    if (data.itemId === targetItem.id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientX < rect.left + rect.width / 2;
    onMoveWithAnchor?.({
      sourceTierId: data.sourceTierId,
      targetTierId: tier.id,
      itemId: data.itemId,
      name: data.name,
      imageUrl: data.imageUrl,
      anchorItemId: targetItem.id,
      placement: before ? "before" : "after",
    });
  };

  return (
    <div className="flex border-b-2 border-[#111] last:border-b-0">
      {/* 左侧：彩色方块 + 等级文字（居中） */}
      <div
        className="relative flex-shrink-0 w-[20%] min-w-[100px] max-w-[140px] flex items-center justify-center py-4 px-3 border-r-2 border-[#111]"
        style={{ backgroundColor: tier.color }}
      >
        <div className="relative flex items-center justify-center">
          <span className="text-2xl font-bold text-black select-none">
            {tier.label}
          </span>
        </div>
      </div>

      {/* 右侧：可放置区域，显示已拖入的项目 */}
      <div
        style={{ contain: "layout paint" }}
        className={`flex-1 min-h-[72px] bg-[#333] flex flex-wrap content-start items-center justify-start gap-2 p-2 ${isDragOver ? "ring-2 ring-pink-400 ring-inset bg-[#3d3d3d]" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={onTapTier}
      >
        {placedItems.length > 0 ? (
          placedItems.map((item) => {
            const displaySrc = resolvePosterImageUrl(item.imageUrl);
            const proxied = isProxiedTierImage(displaySrc);
            const refPolicy = imageReferrerPolicyForUrl(displaySrc);
            return (
            <div
              key={item.id}
              draggable
              title={item.name}
              onDragStart={(e) => handlePlacedItemDragStart(e, item)}
              onDragOver={handlePlacedItemDragOver}
              onDrop={(e) => handlePlacedItemDrop(e, item)}
              onClick={(e) => {
                e.stopPropagation();
                onTapPlacedItem?.(item);
              }}
              className={`flex-shrink-0 w-[96px] rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${
                selectedTouchItemId === item.id
                  ? "ring-2 ring-pink-400 bg-white/25"
                  : "bg-white/10 hover:bg-white/20"
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
                className="w-full aspect-square object-cover pointer-events-none"
                draggable={false}
              />
            </div>
            );
          })
        ) : null}
      </div>
    </div>
  );
}
