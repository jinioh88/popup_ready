import { Link } from "react-router";

export function meta() {
  return [{ title: "About · PopupReady" }];
}

export default function About() {
  return (
    <main>
      <h1>About</h1>
      <p>클라이언트 사이드 라우팅 동작 확인용 페이지입니다.</p>
      <Link to="/">home</Link>
    </main>
  );
}
