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

const PRESET_COLORS = [
  "#FF0000", "#FFA500", "#FFFF00", "#F5DEB3", "#F8F8F8",
  "#fb7299", "#00d4aa", "#94a3b8", "#a78bfa", "#34d399",
];

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
  const [showColorPicker, setShowColorPicker] = useState(false);
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
      {/* 左侧：彩色方块 + 等级文字（居中），点击色块可换色 */}
      <div
        className="relative flex-shrink-0 w-[20%] min-w-[100px] max-w-[140px] flex items-center justify-center py-4 px-3 border-r border-[#333] cursor-pointer"
        style={{ backgroundColor: tier.color }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-color-picker]")) return;
          setShowColorPicker((v) => !v);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setShowColorPicker((v) => !v)}
        title="点击更换颜色"
      >
        <div className="relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
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
              onClick={(e) => { e.stopPropagation(); setEditingLabel(true); }}
              className="text-xl font-medium text-center transition-opacity hover:opacity-80 focus:outline-none"
              style={{ color: textColor }}
            >
              {tier.label || "点击编辑"}
            </button>
          )}
        </div>
        {showColorPicker && (
          <div data-color-picker className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 p-2 rounded-lg bg-white shadow-xl border border-[#333] grid grid-cols-5 gap-1" onClick={(e) => e.stopPropagation()}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="w-7 h-7 rounded border border-[#333]/30 hover:ring-2 hover:ring-[#333] focus:outline-none"
                style={{ backgroundColor: c }}
                onClick={() => {
                  onUpdate(tier.id, { color: c });
                  setShowColorPicker(false);
                }}
              />
            ))}
            <div className="col-span-5 pt-1 mt-1 border-t border-[#333]/20">
              <input
                type="color"
                value={tier.color}
                onChange={(e) => onUpdate(tier.id, { color: e.target.value })}
                className="w-full h-6 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
          </div>
        )}
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
              className="flex flex-col items-center w-[64px] flex-shrink-0 rounded-lg overflow-hidden bg-white/10 cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors"
            >
              <div className="w-full aspect-square bg-white/5 overflow-hidden flex items-center justify-center">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
              </div>
              <span className="text-xs text-zinc-200 py-0.5 truncate w-full text-center">
                {item.name}
              </span>
            </div>
          ))
        ) : (
          <span className="text-zinc-500 text-sm">拖放至此</span>
        )}
      </div>
    </div>
  );
}
