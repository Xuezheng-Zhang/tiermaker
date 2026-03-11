import { TierList } from "./components/TierList";

function App() {
  return (
    <div className="min-h-screen bg-[#e8e8e8]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-800">
            等级排名生成器
          </h1>
          <p className="mt-1 text-zinc-500 text-sm">
            自定义等级名称与颜色
          </p>
        </header>

        <main>
          <TierList />
        </main>

        <footer className="mt-10 text-center text-zinc-400 text-xs">
          点击等级文字可编辑 · 点击色块旁图标可更换颜色
        </footer>
      </div>
    </div>
  );
}

export default App;
