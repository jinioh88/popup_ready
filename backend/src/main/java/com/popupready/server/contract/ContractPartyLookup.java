package com.popupready.server.contract;

import com.popupready.server.auth.UserService;
import com.popupready.server.reservation.ReservationParties;
import com.popupready.server.space.SpaceDetailResponse;
import com.popupready.server.space.SpaceService;
import org.springframework.stereotype.Component;

/**
 * 예약 정보를 당사자·공간 이름으로 채운다. 세 도메인(space·auth·reservation)에서 값을 긁어오는
 * 일만 하며, 계약 규칙은 하나도 모른다.
 *
 * <p>{@link ContractService}에서 이 조회를 떼어낸 이유는 협력자 수 때문이다 — 함께 두면 서비스
 * 하나가 리포지토리·예약·공간·사용자 넷을 들고 있게 되고, 그러면 유스케이스 테스트가 스텁 넷을
 * 세워야 흐름 하나를 볼 수 있다(설계 신호 규칙).
 *
 * <p>이름을 못 찾으면 빈 문자열이 아니라 명시적인 대체 문구를 넣는다 — 계약서 전문에
 * "(이하 '사용자')"만 덩그러니 남는 것보다 낫다.
 */
@Component
public class ContractPartyLookup {

    private static final String UNKNOWN_PARTY = "(이름 미상)";

    private final SpaceService spaceService;

    private final UserService userService;

    public ContractPartyLookup(SpaceService spaceService, UserService userService) {
        this.spaceService = spaceService;
        this.userService = userService;
    }

    public ContractParties of(ReservationParties reservation) {
        SpaceDetailResponse space = spaceService.detail(reservation.spaceId());
        Long landlordUserId = spaceService.ownerIdOf(reservation.spaceId());
        return new ContractParties(
                reservation.brandUserId(),
                landlordUserId,
                nameOf(reservation.brandUserId()),
                nameOf(landlordUserId),
                space.name(),
                space.address());
    }

    private String nameOf(Long userId) {
        return userService.findNameById(userId).orElse(UNKNOWN_PARTY);
    }
}
