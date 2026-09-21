import Link from 'next/link';

export default function Page() {
  const items = [
    { q: 'Что такое RC?', a: 'RC (Research Coins) — внутренняя игровая валюта прототипа. Её нельзя купить, продать или вывести.' },
    { q: 'Как играть в рулетку?', a: 'Зайди в European Roulette, выбери чип, кликни на ячейку стола, нажми SPIN.' },
    { q: 'Что такое provably fair?', a: 'Схема commit-reveal с HMAC-SHA256. Ты видишь хэш серверного seed до спина и можешь проверить результат после раскрытия.' },
    { q: 'Платежи и вывод?', a: 'Отключены полностью. Прототип создан для исследований UX и безопасности.' },
    { q: 'Ответственная игра?', a: 'См. раздел Responsible Gaming. Все механики — только виртуальные.' },
  ];
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Help</h1>
      {items.map((it) => (
        <details key={it.q} className="rounded-xl border border-border bg-panel p-4">
          <summary className="font-semibold cursor-pointer">{it.q}</summary>
          <p className="text-sm text-gray-400 mt-2">{it.a}</p>
        </details>
      ))}
      <div className="text-xs text-gray-500 mt-6">
        Need more? See <Link href="/responsible" className="text-accent underline">Responsible Gaming</Link>.
      </div>
    </div>
  );
}
