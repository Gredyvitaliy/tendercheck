export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-10">
      <h1 className="text-5xl font-bold mb-6 text-gray-800">
        TenderCheck
      </h1>

      <p className="text-xl text-gray-600 mb-10">
        AI-проверка коммерческих предложений подрядчиков
      </p>

      <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-lg">
        Загрузить спецификацию
      </button>
    </main>
  );
}