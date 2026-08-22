/** 도어락 모킹 토픽 규약. 실제 IoT 하드웨어가 아니라 MQTT 모킹이다(US-301). */
export function doorLockTopic(reservationId: string): string {
  return `popupready/reservations/${reservationId}/door`;
}

export type DoorLockCommand = {
  action: "unlock";
  reservationId: string;
  requestedAt: string;
};

export function buildUnlockCommand(reservationId: string, now: Date): DoorLockCommand {
  return {
    action: "unlock",
    reservationId,
    requestedAt: now.toISOString(),
  };
}
