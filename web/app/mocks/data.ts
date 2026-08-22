import type { Schemas } from "../lib/api/client";
import type { Fixture, SpaceSummary } from "../lib/schemas/api";

/**
 * 목업 데이터 — 백엔드 시드(`data.sql`)와 같은 결로 맞춘 성수·명동·홍대 상가와 집기 카탈로그.
 *
 * **타입을 손으로 정의하지 않는다.** 계약에서 파생된 스키마 타입(`SpaceSummary`·`Fixture`)과
 * 생성 타입(`Schemas[...]`)을 그대로 쓰므로, 백엔드가 필드명을 바꾸면 목업이 먼저 컴파일에서 깨진다.
 */

/** 상세 응답은 요약 + grid·보증금·상태. 요약은 여기서 파생시켜 두 응답이 갈라지지 않게 한다. */
export type MockSpace = Schemas["SpaceDetailResponse"];

export const MOCK_SPACES: MockSpace[] = [
  {
    id: 1,
    name: "성수 연무장길 코너 공실",
    address: "서울 성동구 연무장길 25",
    location: { lat: 37.5445, lng: 127.0557 },
    dailyRent: 320_000,
    depositRate: 0.1,
    floorAreaM2: 42.5,
    maxPowerWatt: 5000,
    gridCols: 20,
    gridRows: 12,
    cellSizeMm: 500,
    status: "ACTIVE",
  },
  {
    id: 2,
    name: "성수 서울숲길 1층",
    address: "서울 성동구 서울숲2길 18",
    location: { lat: 37.5471, lng: 127.0442 },
    dailyRent: 280_000,
    depositRate: 0.1,
    floorAreaM2: 33.1,
    maxPowerWatt: 3500,
    gridCols: 16,
    gridRows: 10,
    cellSizeMm: 500,
    status: "ACTIVE",
  },
  {
    id: 3,
    name: "성수 아틀리에길 소형 공실",
    address: "서울 성동구 아차산로 96",
    location: { lat: 37.5433, lng: 127.0604 },
    dailyRent: 190_000,
    depositRate: 0.1,
    floorAreaM2: 21.8,
    maxPowerWatt: 2200,
    gridCols: 12,
    gridRows: 8,
    cellSizeMm: 500,
    status: "ACTIVE",
  },
  {
    id: 4,
    name: "명동 중앙로 대로변",
    address: "서울 중구 명동길 14",
    location: { lat: 37.5636, lng: 126.9826 },
    dailyRent: 520_000,
    depositRate: 0.1,
    floorAreaM2: 58.0,
    maxPowerWatt: 7000,
    gridCols: 24,
    gridRows: 14,
    cellSizeMm: 500,
    status: "ACTIVE",
  },
  {
    id: 5,
    name: "명동 눈스퀘어 뒤편",
    address: "서울 중구 명동8나길 27",
    location: { lat: 37.5615, lng: 126.9852 },
    dailyRent: 410_000,
    depositRate: 0.1,
    floorAreaM2: 39.4,
    maxPowerWatt: 4500,
    gridCols: 18,
    gridRows: 12,
    cellSizeMm: 500,
    status: "ACTIVE",
  },
  {
    id: 6,
    name: "홍대 걷고싶은거리 코너",
    address: "서울 마포구 어울마당로 65",
    location: { lat: 37.5551, lng: 126.9236 },
    dailyRent: 360_000,
    depositRate: 0.1,
    floorAreaM2: 46.2,
    maxPowerWatt: 5500,
    gridCols: 20,
    gridRows: 14,
    cellSizeMm: 500,
    status: "ACTIVE",
  },
  {
    id: 7,
    name: "홍대 연남동 골목 공실",
    address: "서울 마포구 성미산로 161",
    location: { lat: 37.5626, lng: 126.9256 },
    dailyRent: 240_000,
    depositRate: 0.1,
    floorAreaM2: 27.6,
    maxPowerWatt: 3000,
    gridCols: 14,
    gridRows: 10,
    cellSizeMm: 500,
    status: "ACTIVE",
  },
  {
    id: 8,
    name: "홍대 상수역 1번 출구",
    address: "서울 마포구 독막로 7",
    location: { lat: 37.5477, lng: 126.9223 },
    dailyRent: 300_000,
    depositRate: 0.1,
    floorAreaM2: 35.9,
    maxPowerWatt: 4000,
    gridCols: 18,
    gridRows: 10,
    cellSizeMm: 500,
    status: "ACTIVE",
  },
];

/** 지도 마커용 요약 — 상세에서 필드를 골라내므로 두 응답이 어긋날 수 없다. */
export function toSummary(space: MockSpace): SpaceSummary {
  return {
    id: space.id,
    name: space.name,
    address: space.address,
    location: space.location,
    dailyRent: space.dailyRent,
    floorAreaM2: space.floorAreaM2,
    maxPowerWatt: space.maxPowerWatt,
  };
}

export const MOCK_FIXTURES: Fixture[] = [
  // 규격은 mm, 소비전력은 W. 비전기 집기는 0이다.
  { id: 1, name: "이동식 행거 (소)", category: "HANGER", widthMm: 900, depthMm: 500, powerWatt: 0, dailyRentalFee: 15_000, stockQty: 24 }, // prettier-ignore
  { id: 2, name: "이동식 행거 (대)", category: "HANGER", widthMm: 1500, depthMm: 550, powerWatt: 0, dailyRentalFee: 22_000, stockQty: 18 }, // prettier-ignore
  { id: 3, name: "벽면 행거 바", category: "HANGER", widthMm: 1200, depthMm: 350, powerWatt: 0, dailyRentalFee: 18_000, stockQty: 20 }, // prettier-ignore
  { id: 4, name: "POS 카운터", category: "POS", widthMm: 1200, depthMm: 600, powerWatt: 250, dailyRentalFee: 45_000, stockQty: 8 }, // prettier-ignore
  { id: 5, name: "태블릿 POS 스탠드", category: "POS", widthMm: 400, depthMm: 400, powerWatt: 40, dailyRentalFee: 20_000, stockQty: 12 }, // prettier-ignore
  { id: 6, name: "유리 쇼케이스 (중)", category: "SHOWCASE", widthMm: 1200, depthMm: 600, powerWatt: 60, dailyRentalFee: 38_000, stockQty: 10 }, // prettier-ignore
  { id: 7, name: "냉장 쇼케이스", category: "SHOWCASE", widthMm: 900, depthMm: 700, powerWatt: 450, dailyRentalFee: 65_000, stockQty: 4 }, // prettier-ignore
  { id: 8, name: "아일랜드 진열대", category: "SHELF", widthMm: 1600, depthMm: 800, powerWatt: 0, dailyRentalFee: 30_000, stockQty: 9 }, // prettier-ignore
  { id: 9, name: "3단 우드 선반", category: "SHELF", widthMm: 1000, depthMm: 400, powerWatt: 0, dailyRentalFee: 17_000, stockQty: 22 }, // prettier-ignore
  { id: 10, name: "코너 진열 큐브", category: "SHELF", widthMm: 500, depthMm: 500, powerWatt: 0, dailyRentalFee: 9_000, stockQty: 30 }, // prettier-ignore
  { id: 11, name: "스폿 조명 스탠드", category: "LIGHTING", widthMm: 350, depthMm: 350, powerWatt: 120, dailyRentalFee: 12_000, stockQty: 26 }, // prettier-ignore
  { id: 12, name: "LED 라인 조명 바", category: "LIGHTING", widthMm: 1200, depthMm: 150, powerWatt: 80, dailyRentalFee: 10_000, stockQty: 28 }, // prettier-ignore
  { id: 13, name: "피팅룸 부스", category: "ETC", widthMm: 1000, depthMm: 1000, powerWatt: 60, dailyRentalFee: 40_000, stockQty: 6 }, // prettier-ignore
  { id: 14, name: "브랜드 사이니지", category: "ETC", widthMm: 800, depthMm: 200, powerWatt: 90, dailyRentalFee: 14_000, stockQty: 15 }, // prettier-ignore
];

export const MOCK_USER: Schemas["UserSummary"] = {
  id: 1,
  email: "brand@popupready.kr",
  name: "김브랜드",
  role: "BRAND",
};
