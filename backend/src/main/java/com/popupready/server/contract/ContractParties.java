package com.popupready.server.contract;

/**
 * 계약 당사자와 공간 정보. 생성 시점에 한 번 확정해 스냅샷으로 남긴다 — 공간의 소유자가 나중에
 * 바뀌어도 서명할 사람은 계약 당시의 건물주다.
 */
public record ContractParties(
        Long brandUserId,
        Long landlordUserId,
        String brandName,
        String landlordName,
        String spaceName,
        String spaceAddress) {}
