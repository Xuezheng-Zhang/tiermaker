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

/** 生成 LoremFlickr 图片 URL（按关键词，lock 保证同一项始终同一张图） */
function flickrImg(keyword: string, lock: number) {
  return `https://loremflickr.com/256/256/${encodeURIComponent(keyword)}?lock=${lock}`;
}

export const QUESTION_BANKS: QuestionBank[] = [
  {
    id: "fruits",
    name: "水果",
    items: Array.from({ length: 10 }, (_, i) => ({
      name: `水果${i + 1}`,
      imageUrl: `https://loremflickr.com/256/256/fruit?lock=${i + 1}`,
    })),
  },
  {
    id: "drinks",
    name: "饮料",
    items: [
      { name: "可乐", imageUrl: flickrImg("cola", 11) },
      { name: "雪碧", imageUrl: flickrImg("sprite", 12) },
      { name: "奶茶", imageUrl: flickrImg("bubble tea", 13) },
      { name: "咖啡", imageUrl: flickrImg("coffee", 14) },
      { name: "橙汁", imageUrl: flickrImg("orange juice", 15) },
      { name: "柠檬水", imageUrl: flickrImg("lemonade", 16) },
      { name: "豆浆", imageUrl: flickrImg("soy milk", 17) },
      { name: "酸奶", imageUrl: flickrImg("yogurt", 18) },
      { name: "矿泉水", imageUrl: flickrImg("mineral water", 19) },
      { name: "红茶", imageUrl: flickrImg("black tea", 20) },
    ],
  },
  {
    id: "food",
    name: "美食",
    items: [
      { name: "火锅", imageUrl: flickrImg("hot pot", 21) },
      { name: "烧烤", imageUrl: flickrImg("barbecue", 22) },
      { name: "炸鸡", imageUrl: flickrImg("fried chicken", 23) },
      { name: "披萨", imageUrl: flickrImg("pizza", 24) },
      { name: "寿司", imageUrl: flickrImg("sushi", 25) },
      { name: "拉面", imageUrl: flickrImg("ramen", 26) },
      { name: "包子", imageUrl: flickrImg("steamed bun", 27) },
      { name: "煎饼", imageUrl: flickrImg("pancake", 28) },
      { name: "汉堡", imageUrl: flickrImg("hamburger", 29) },
      { name: "薯条", imageUrl: flickrImg("french fries", 30) },
    ],
  },
  {
    id: "animals",
    name: "动物",
    items: [
      { name: "猫", imageUrl: flickrImg("cat", 31) },
      { name: "狗", imageUrl: flickrImg("dog", 32) },
      { name: "兔子", imageUrl: flickrImg("rabbit", 33) },
      { name: "熊猫", imageUrl: flickrImg("panda", 34) },
      { name: "老虎", imageUrl: flickrImg("tiger", 35) },
      { name: "狮子", imageUrl: flickrImg("lion", 36) },
      { name: "大象", imageUrl: flickrImg("elephant", 37) },
      { name: "企鹅", imageUrl: flickrImg("penguin", 38) },
      { name: "考拉", imageUrl: flickrImg("koala", 39) },
      { name: "狐狸", imageUrl: flickrImg("fox", 40) },
    ],
  },
  {
    id: "sports",
    name: "运动",
    items: [
      { name: "篮球", imageUrl: flickrImg("basketball", 41) },
      { name: "足球", imageUrl: flickrImg("soccer", 42) },
      { name: "游泳", imageUrl: flickrImg("swimming", 43) },
      { name: "跑步", imageUrl: flickrImg("running", 44) },
      { name: "羽毛球", imageUrl: flickrImg("badminton", 45) },
      { name: "乒乓球", imageUrl: flickrImg("table tennis", 46) },
      { name: "滑雪", imageUrl: flickrImg("skiing", 47) },
      { name: "骑行", imageUrl: flickrImg("cycling", 48) },
      { name: "瑜伽", imageUrl: flickrImg("yoga", 49) },
      { name: "健身", imageUrl: flickrImg("gym", 50) },
    ],
  },
  {
    id: "breakfast",
    name: "早餐",
    items: [
      { name: "小笼包/点心", imageUrl: "https://images.pexels.com/photos/3754988/pexels-photo-3754988.jpeg?auto=compress&cs=tinysrgb&w=300" },
      { name: "面条 (热干面/牛肉面)", imageUrl: "https://images.pexels.com/photos/2664216/pexels-photo-2664216.jpeg?auto=compress&cs=tinysrgb&w=300" },
      { name: "煎饼/馅饼 (肉夹馍感)", imageUrl: "https://images.pexels.com/photos/12916860/pexels-photo-12916860.jpeg?auto=compress&cs=tinysrgb&w=300" },
      { name: "粥/豆浆类", imageUrl: "https://images.pexels.com/photos/6646359/pexels-photo-6646359.jpeg?auto=compress&cs=tinysrgb&w=300" },
      { name: "馄饨/水饺", imageUrl: "https://images.pexels.com/photos/955137/pexels-photo-955137.jpeg?auto=compress&cs=tinysrgb&w=300" },
      { name: "炸油条/碳水类", imageUrl: "https://images.pexels.com/photos/12836274/pexels-photo-12836274.jpeg?auto=compress&cs=tinysrgb&w=300" },
    ],
  },
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
