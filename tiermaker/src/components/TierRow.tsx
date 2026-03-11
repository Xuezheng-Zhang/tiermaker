import { useState } from "react";
import type { TierRow as TierRowType, PlacedItem as PlacedItemType } from "../types";
import { getTextColorForBg } from "../types";

interface TierRowProps {
  tier: TierRowType;
  placedItems: PlacedItemType[];
  onUpdate: (id: string, updates: Partial<TierRowType>) => void;
  onRemove: (id: string) => void;
  onDrop: (
    data:
      | { type: "current"; name: string; imageUrl: string }
      | { type: "move"; sourceTierId: string; itemId: string; name: string; imageUrl: string }
  ) => void;
  isEditing?: boolean;
}

export function TierRow({
  tier,
  placedItems,
  onUpdate,
  onRemove,
  onDrop,
  isEditing = false,
}: TierRowProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [localLabel, setLocalLabel] = useState(tier.label);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleLabelBlur = () => {
    setEditingLabel(false);
    const trimmed = localLabel.trim();
    if (trimmed && trimmed !== tier.label) {
      onUpdate(tier.id, { label: trimmed });
    } else {
      setLocalLabel(tier.label);
    }
  };

  type DropData =
    | { type: "current"; name: string; imageUrl: string }
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
        parsed.name != null &&
        parsed.imageUrl != null
      ) {
        data = { type: "current", name: parsed.name, imageUrl: parsed.imageUrl };
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

  const textColor = getTextColorForBg(tier.color);

  return (
    <div className="flex border-b border-[#333] last:border-b-0">
      {/* 左侧：彩色方块 + 等级文字（居中） */}
      <div
        className="relative flex-shrink-0 w-[20%] min-w-[100px] max-w-[140px] flex items-center justify-center py-4 px-3 border-r border-[#333]"
        style={{ backgroundColor: tier.color }}
      >
        <div className="relative flex items-center justify-center">
          {editingLabel ? (
            <input
              type="text"
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-24 text-center text-xl font-medium bg-white/90 rounded border border-[#333] focus:outline-none focus:ring-1 focus:ring-[#333] text-[#1a1a1a]"
              style={{ color: "#1a1a1a" }}
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingLabel(true)}
              className="text-xl font-medium text-center transition-opacity hover:opacity-80 focus:outline-none"
              style={{ color: textColor }}
            >
              {tier.label || "点击编辑"}
            </button>
          )}
        </div>
      </div>

      {/* 右侧：可放置区域，显示已拖入的项目 */}
      <div
        className={`flex-1 min-h-[72px] bg-[#333] flex flex-wrap items-center justify-start gap-2 p-2 ${isDragOver ? "ring-2 ring-pink-400 ring-inset bg-[#3d3d3d]" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isEditing ? (
          <button
            type="button"
            onClick={() => onRemove(tier.id)}
            className="p-2 text-zinc-400 hover:text-red-400 rounded transition-colors text-sm"
            title="删除此等级"
          >
            删除
          </button>
        ) : placedItems.length > 0 ? (
          placedItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handlePlacedItemDragStart(e, item)}
              className="flex-shrink-0 w-[96px] rounded-lg overflow-hidden bg-white/10 cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors"
            >
              <img
                src={item.imageUrl}
                alt=""
                className="w-full aspect-square object-cover pointer-events-none"
                draggable={false}
              />
            </div>
          ))
        ) : (
          <span className="text-zinc-500 text-sm">拖放至此</span>
        )}
      </div>
    </div>
  );
}
