import { HttpResponse, http } from "msw";

import type { Schemas } from "../lib/api/client";
import type { ErrorCode } from "../lib/api/error-codes";
import { canPlace } from "../lib/builder/collision";
import { estimateReservation } from "../lib/builder/estimate";
import { toPlacement } from "../lib/builder/occupancy";
import type { Placement } from "../lib/builder/types";
import type { Layout } from "../lib/schemas/layout";
import { MOCK_FIXTURES, MOCK_SPACES, MOCK_USER, toSummary } from "./data";

/**
 * MSW 목업 핸들러 — 개발 중에만 동작한다.
 *
 * 통합 시점에는 `app/mocks/`와 `app/entry.client.tsx`의 워커 시작 블록만 걷어내면 실 API로
 * 전환된다(핸들러가 네트워크 레이어에서 가로채므로 화면 코드는 손댈 게 없다).
 *
 * 응답 타입은 전부 **생성 타입**(`Schemas[...]`)이다 — 손으로 타입을 정의하지 않는다.
 *
 * 계약 화면 핸들러 3종(`POST /reservation-requests/{id}/contract` · `POST /contracts/{id}/sign` ·
 * `GET /contracts/{id}`)은 F-2에서 추가한다 — 조항 전문 템플릿은 백엔드가 소유한다.
 * 셋 다 보호 오퍼레이션이므로 추가할 때 `unauthorized()` 검사를 함께 붙일 것.
 *
 * ⚠️ 레이아웃 검증·견적 계산은 `app/lib`의 웹 구현을 그대로 재사용한다. 목업이 웹과 항상
 *    일치한다는 뜻이므로 **계약 검증용이 아니다** — UI의 400 에러 경로를 실제로 태워보기 위한
 *    장치다. 백엔드와의 계산식 일치는 통합(Phase G)에서 확인한다.
 */

const BASE = "/api/v1";

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ data, error: null }, { status });
}

function fail(status: number, code: ErrorCode, message: string) {
  return HttpResponse.json({ data: null, error: { code, message } }, { status });
}

/**
 * 보호 오퍼레이션의 인증 검사.
 *
 * 계약(sprint1.md §2.2)이 예약 요청 생성·계약 생성/열람/서명 4개에 bearer를 요구하므로
 * 목업도 같은 규칙을 지킨다 — 목업만 무인증으로 통과시키면 통합 시점에야 401이 드러난다.
 */
function unauthorized(request: Request) {
  const header = request.headers.get("Authorization");

  return header?.startsWith("Bearer ") ? null : fail(401, "UNAUTHORIZED", "인증이 필요합니다.");
}

/** 지도 반경 검색용 근사 거리(m). 목업이므로 위경도를 평면으로 근사한다. */
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const latMeters = (a.lat - b.lat) * 111_320;
  const lngMeters = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(latMeters, lngMeters);
}

function numberParam(url: URL, key: string): number | null {
  const raw = url.searchParams.get(key);

  if (raw === null || raw.trim() === "") {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export const handlers = [
  http.post(`${BASE}/auth/signup`, async ({ request }) => {
    const body = (await request.json()) as Schemas["SignupRequest"];

    if (body.email === "taken@popupready.kr") {
      return fail(409, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다.");
    }

    const response: Schemas["AuthResponse"] = {
      accessToken: "mock.access.token",
      user: { ...MOCK_USER, email: body.email, name: body.name, role: body.role },
    };

    return ok(response, 201);
  }),

  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as Schemas["LoginRequest"];

    if (body.password === "wrong-password") {
      return fail(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    const response: Schemas["AuthResponse"] = {
      accessToken: "mock.access.token",
      user: { ...MOCK_USER, email: body.email },
    };

    return ok(response);
  }),

  http.get(`${BASE}/spaces`, ({ request }) => {
    const url = new URL(request.url);
    const lat = numberParam(url, "lat");
    const lng = numberParam(url, "lng");

    if (lat === null || lng === null) {
      return fail(400, "VALIDATION_FAILED", "lat·lng는 필수입니다.");
    }

    const radius = numberParam(url, "radius") ?? 1000;
    const minArea = numberParam(url, "minArea");
    const maxRent = numberParam(url, "maxRent");
    const minPower = numberParam(url, "minPower");

    const spaces = MOCK_SPACES.filter((space) => {
      if (space.status !== "ACTIVE") return false;
      if (distanceMeters(space.location, { lat, lng }) > radius) return false;
      if (minArea !== null && space.floorAreaM2 < minArea) return false;
      if (maxRent !== null && space.dailyRent > maxRent) return false;
      if (minPower !== null && space.maxPowerWatt < minPower) return false;
      return true;
    });

    return ok(spaces.map(toSummary));
  }),

  http.get(`${BASE}/spaces/:id`, ({ params }) => {
    const space = MOCK_SPACES.find((candidate) => candidate.id === Number(params.id));

    return space ? ok(space) : fail(404, "SPACE_NOT_FOUND", "상가를 찾을 수 없습니다.");
  }),

  http.get(`${BASE}/fixtures`, ({ request }) => {
    const category = new URL(request.url).searchParams.get("category");
    const fixtures = category
      ? MOCK_FIXTURES.filter((fixture) => fixture.category === category)
      : MOCK_FIXTURES;

    return ok(fixtures);
  }),

  http.post(`${BASE}/reservation-requests`, async ({ request }) => {
    const denied = unauthorized(request);

    if (denied) {
      return denied;
    }

    const body = (await request.json()) as Schemas["CreateReservationRequest"];
    const space = MOCK_SPACES.find((candidate) => candidate.id === body.spaceId);

    if (!space) {
      return fail(404, "SPACE_NOT_FOUND", "상가를 찾을 수 없습니다.");
    }

    const layout = body.layout as Layout;
    const placed: Placement[] = [];

    for (const item of layout.items) {
      const fixture = MOCK_FIXTURES.find((candidate) => candidate.id === item.fixtureId);

      if (!fixture) {
        return fail(404, "FIXTURE_NOT_FOUND", `집기 ${item.fixtureId}을(를) 찾을 수 없습니다.`);
      }

      const placement = toPlacement(item, fixture, layout.cellSizeMm, item.rotation);
      const check = canPlace(placement, placed, layout);

      if (!check.ok) {
        return check.reason === "OUT_OF_BOUNDS"
          ? fail(400, "LAYOUT_OUT_OF_BOUNDS", "집기가 도면 범위를 벗어났습니다.")
          : fail(400, "LAYOUT_OVERLAP", "집기 배치가 서로 겹칩니다.");
      }

      placed.push(placement);
    }

    const fixtures = layout.items.flatMap((item) => {
      const fixture = MOCK_FIXTURES.find((candidate) => candidate.id === item.fixtureId);
      return fixture ? [fixture] : [];
    });

    const estimate = estimateReservation({
      startDate: body.startDate,
      endDate: body.endDate,
      dailyRent: space.dailyRent,
      depositRate: space.depositRate,
      fixtures,
    });

    const response: Schemas["ReservationRequestResponse"] = {
      id: 1001,
      spaceId: space.id,
      brandUserId: MOCK_USER.id,
      startDate: body.startDate,
      endDate: body.endDate,
      status: "DRAFT",
      layout: body.layout,
      estimate,
    };

    return ok(response, 201);
  }),
];
