import { useState } from "react";
import type { TierRow as TierRowType, PlacedItem as PlacedItemType } from "../types";

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
}

export function TierRow({
  tier,
  placedItems,
  onDrop,
  onTapTier,
  onTapPlacedItem,
  selectedTouchItemId,
}: TierRowProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  type DropData =
    | { type: "current"; itemId: string; name: string; imageUrl: string }
    | { type: "move"; sourceTierId: string; itemId: string; name: string; imageUrl: string };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
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
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

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
        className={`flex-1 min-h-[72px] bg-[#333] flex flex-wrap items-center justify-start gap-2 p-2 ${isDragOver ? "ring-2 ring-pink-400 ring-inset bg-[#3d3d3d]" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={onTapTier}
      >
        {placedItems.length > 0 ? (
          placedItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handlePlacedItemDragStart(e, item)}
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
                src={item.imageUrl}
                alt=""
                className="w-full aspect-square object-cover pointer-events-none"
                draggable={false}
              />
            </div>
          ))
        ) : null}
      </div>
    </div>
  );
}
