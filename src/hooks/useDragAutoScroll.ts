import { useEffect } from "react";

/** 距离视口上下边缘（px）内开始自动滚动 */
const EDGE_ZONE = 88;
/** 单次最大滚动量（px），越贴边越快 */
const MAX_STEP = 36;

/**
 * 拖拽过程中鼠标靠近窗口上/下边缘时自动滚动页面，便于拖到更远的等级行。
 */
export function useDragAutoScroll() {
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.length) return;

      const y = e.clientY;
      const vh = window.innerHeight;
      let delta = 0;

      if (y < EDGE_ZONE) {
        const t = (EDGE_ZONE - y) / EDGE_ZONE;
        delta = -Math.max(6, Math.round(t * MAX_STEP));
      } else if (y > vh - EDGE_ZONE) {
        const t = (y - (vh - EDGE_ZONE)) / EDGE_ZONE;
        delta = Math.max(6, Math.round(t * MAX_STEP));
      }

      if (delta !== 0) {
        window.scrollBy({ top: delta, left: 0, behavior: "auto" });
      }
    };

    document.addEventListener("dragover", onDragOver);
    return () => document.removeEventListener("dragover", onDragOver);
  }, []);
}
