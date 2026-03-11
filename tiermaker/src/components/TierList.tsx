import { useState } from "react";
import { TierRow } from "./TierRow";
import type { TierRow as TierRowType, PlacedItem, QuestionBankItem } from "../types";
import { DEFAULT_TIERS, QUESTION_BANKS } from "../types";

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

export function TierList() {
  const [tiers, setTiers] = useState<TierRowType[]>(() => DEFAULT_TIERS);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [placedItems, setPlacedItems] = useState<Record<string, PlacedItem[]>>({});

  const selectedBank = selectedBankId
    ? QUESTION_BANKS.find((b) => b.id === selectedBankId)
    : null;
  const currentItem: QuestionBankItem | null =
    selectedBank && currentIndex < selectedBank.items.length
      ? selectedBank.items[currentIndex]
      : null;
  const hasMore = selectedBank && currentIndex < selectedBank.items.length;

  const updateTier = (id: string, updates: Partial<TierRowType>) => {
    setTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const removeTier = (id: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== id));
    setPlacedItems((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const resetToDefault = () => {
    setTiers(DEFAULT_TIERS);
  };

  const handleSelectBank = (bankId: string) => {
    setSelectedBankId(bankId);
    setCurrentIndex(0);
    setPlacedItems({});
  };

  type DropData =
    | { type: "current"; name: string; imageUrl: string }
    | { type: "move"; sourceTierId: string; itemId: string; name: string; imageUrl: string };

  const handleDrop = (tierId: string, data: DropData) => {
    if (data.type === "current") {
      setPlacedItems((prev) => ({
        ...prev,
        [tierId]: [
          ...(prev[tierId] || []),
          { id: generateId(), name: data.name, imageUrl: data.imageUrl },
        ],
      }));
      if (selectedBank && currentItem && currentItem.name === data.name) {
        setCurrentIndex((i) => i + 1);
      }
    } else {
      const { sourceTierId, itemId, name, imageUrl } = data;
      if (sourceTierId === tierId) return;
      setPlacedItems((prev) => {
        const next = { ...prev };
        next[sourceTierId] = (next[sourceTierId] || []).filter((p) => p.id !== itemId);
        next[tierId] = [...(next[tierId] || []), { id: generateId(), name, imageUrl }];
        return next;
      });
    }
  };

  const handleCurrentItemDragStart = (e: React.DragEvent, item: QuestionBankItem) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ type: "current" as const, name: item.name, imageUrl: item.imageUrl })
    );
    e.dataTransfer.effectAllowed = "move";
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing((e) => !e)}
            className="px-2.5 py-1 text-sm rounded bg-zinc-200 text-zinc-700 hover:bg-zinc-300 transition-colors"
          >
            {isEditing ? "完成" : "编辑"}
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            className="px-2.5 py-1 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            恢复默认
          </button>
        </div>
      </div>

      <div className="border border-[#333] rounded overflow-hidden bg-[#333]">
        {tiers.map((tier) => (
          <TierRow
            key={tier.id}
            tier={tier}
            placedItems={placedItems[tier.id] || []}
            onUpdate={updateTier}
            onRemove={removeTier}
            onDrop={(data) => handleDrop(tier.id, data)}
            isEditing={isEditing}
          />
        ))}
      </div>

      {/* 当前题目：拖到对应等级后显示下一个 */}
      {selectedBank && (
        <div className="mt-4">
          {hasMore && currentItem ? (
            <div
              draggable
              onDragStart={(e) => handleCurrentItemDragStart(e, currentItem)}
              className="inline-flex items-center justify-center w-[160px] rounded-lg bg-white border-2 border-dashed border-zinc-300 overflow-hidden cursor-grab active:cursor-grabbing hover:border-pink-400 hover:bg-pink-50/50 transition-colors"
            >
              <img
                src={currentItem.imageUrl}
                alt=""
                className="w-full aspect-square object-cover pointer-events-none"
                draggable={false}
              />
            </div>
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
