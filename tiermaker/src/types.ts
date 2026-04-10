import { DOUBAN_TOP250_ITEMS } from "./data/doubanTop250.generated";
import { RYM_TOP100_ITEMS } from "./data/rymTop100.generated";
import { COUNTRY_FLAGS_100_ITEMS } from "./data/countryFlags100.generated";
import { CHINA_PROVINCES_34_ITEMS } from "./data/chinaProvinces34.generated";
import { CHINA_ATTRACTIONS_40_ITEMS } from "./data/chinaAttractions40.generated";
import { CHINA_HOME_COOKING_69_ITEMS } from "./data/chinaHomeCooking69.generated";

export interface TierRow {
  id: string;
  label: string;
  color: string;
}

/** 已放入某一等级的项目（带唯一 id 便于在等级间移动） */
export interface PlacedItem {
  id: string;
  name: string;
  imageUrl: string;
}

export interface BoardState {
  selectedBankId: string | null;
  currentIndex: number;
  placedItems: Record<string, PlacedItem[]>;
}

/** 从等级行内拖出时传递的数据 */
export interface MovePayload {
  type: "move";
  sourceTierId: string;
  itemId: string;
  name: string;
  imageUrl: string;
}

export interface RoomMember {
  id: string;
  nickname: string;
}

export const DEFAULT_TIERS: TierRow[] = [
  { id: "1", label: "夯", color: "#FF0000" },
  { id: "2", label: "顶级", color: "#FFA500" },
  { id: "3", label: "人上人", color: "#FFFF00" },
  { id: "4", label: "NPC", color: "#F5DEB3" },
  { id: "5", label: "拉", color: "#F8F8F8" },
];

/** 题库中的单道题目（名称 + 图片） */
export interface QuestionBankItem {
  name: string;
  imageUrl: string;
}

/** 题库 */
export interface QuestionBank {
  id: string;
  name: string;
  items: QuestionBankItem[];
}

export const QUESTION_BANKS: QuestionBank[] = [
  {
    id: "breakfast-rank",
    name: "早餐排名",
    items: [
      { name: "肠粉", imageUrl: "/posters/breakfast-rank/001.png" },
      { name: "牛肉面", imageUrl: "/posters/breakfast-rank/002.png" },
      { name: "胡辣汤", imageUrl: "/posters/breakfast-rank/003.png" },
      { name: "螺蛳粉", imageUrl: "/posters/breakfast-rank/004.png" },
      { name: "馒头", imageUrl: "/posters/breakfast-rank/005.png" },
      { name: "糯米饭", imageUrl: "/posters/breakfast-rank/006.png" },
      { name: "小笼包", imageUrl: "/posters/breakfast-rank/007.png" },
      { name: "炒粉", imageUrl: "/posters/breakfast-rank/008.png" },
      { name: "豆汁", imageUrl: "/posters/breakfast-rank/009.png" },
      { name: "咸豆浆", imageUrl: "/posters/breakfast-rank/010.png" },
      { name: "麦当劳猪柳蛋", imageUrl: "/posters/breakfast-rank/011.png" },
      { name: "鸡蛋饼", imageUrl: "/posters/breakfast-rank/012.png" },
      { name: "煎饼果子", imageUrl: "/posters/breakfast-rank/013.png" },
      { name: "馄饨", imageUrl: "/posters/breakfast-rank/014.png" },
      { name: "英式早餐", imageUrl: "/posters/breakfast-rank/015.png" },
      { name: "安徽正宗牛肉板面", imageUrl: "/posters/breakfast-rank/016.png" },
      { name: "甜豆花", imageUrl: "/posters/breakfast-rank/017.png" },
      { name: "千张卷油条", imageUrl: "/posters/breakfast-rank/018.png" },
      { name: "驴肉火烧", imageUrl: "/posters/breakfast-rank/019.png" },
    ],
  },
  {
    id: "douban-top250",
    name: "豆瓣Top250",
    items: DOUBAN_TOP250_ITEMS,
  },
  {
    id: "rym-top100",
    name: "RYM 史上专辑 Top100",
    items: RYM_TOP100_ITEMS,
  },
  {
    id: "country-flags-100",
    name: "知名国家",
    items: COUNTRY_FLAGS_100_ITEMS,
  },
  {
    id: "china-provinces-34",
    name: "中国省份",
    items: CHINA_PROVINCES_34_ITEMS,
  },
  {
    id: "china-attractions-40",
    name: "中国著名旅游景点",
    items: CHINA_ATTRACTIONS_40_ITEMS,
  },
  {
    id: "china-home-cooking-69",
    name: "中国家常菜",
    items: CHINA_HOME_COOKING_69_ITEMS,
  },
];

/** 根据背景色亮度返回白字或黑字 */
export function getTextColorForBg(hex: string): "#fff" | "#1a1a1a" {
  const n = hex.slice(1);
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1a1a1a" : "#fff";
}
