import { ApiRequestError } from "../../lib/api/client";

/**
 * 계약 화면의 실패 안내.
 *
 * 계약은 사용자가 "왜 안 되는지"를 정확히 알아야 하는 화면이다 — 서명이 막힌 이유가
 * '이미 서명함'인지 '당사자가 아님'인지에 따라 사용자가 할 일이 완전히 다르다.
 */

export function contractLoadMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  switch (error.code) {
    case "RESERVATION_REQUEST_NOT_FOUND":
      return "예약 요청을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.";
    case "CONTRACT_NOT_FOUND":
      return "계약서를 찾을 수 없습니다.";
    case "FORBIDDEN":
      return "이 예약 요청의 당사자가 아닙니다.";
    default:
      return error.message;
  }
}

export function signMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  switch (error.code) {
    case "CONTRACT_ALREADY_SIGNED":
      return "이미 서명한 계약입니다.";
    case "NOT_CONTRACT_PARTY":
      return "이 계약의 당사자가 아니라 서명할 수 없습니다.";
    case "CONTRACT_NOT_FOUND":
      return "계약서를 찾을 수 없습니다. 화면을 새로고침해 주세요.";
    default:
      return error.message;
  }
}
