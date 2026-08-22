import { Link } from "react-router";

export function meta() {
  return [{ title: "PopupReady" }];
}

export default function Home() {
  return (
    <main>
      <h1 className="text-2xl font-bold text-red-500">PopupReady</h1>
      <p>React Router 프레임워크 모드(SPA) 배선 확인용 페이지입니다.</p>
      <Link to="/about">about</Link>
    </main>
  );
}
