import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { estimateReservation } from "../../lib/builder/estimate";
import {
  MAX_RESERVATION_DAYS,
  maxEndDate,
  minStartDate,
  reservationPeriodSchema,
  type ReservationPeriod,
} from "../../lib/schemas/reservation";
import { useBuilderStore } from "../../stores/builder";
import type { FixtureCatalog } from "./queries";

/**
 * 예약 기간 선택 + 예약 요청 제출 (F-1).
 *
 * 화면에 띄우는 견적은 **표시용 미리보기**다 — 금액의 원장은 서버 응답(`estimate`)이다.
 * 두 값이 다르면 계산식이 어긋난 것이므로 통합 단계에서 잡아야 한다.
 *
 * 사용 기간 상한(30일)은 **법률 세이프가드**다(일시사용 임대차 요건). 달력에서 아예 고를 수 없게
 * 막고, 직접 입력·붙여넣기로 넘어오는 경로는 Zod 스키마가 잡는다 — 최종 판정은 서버다.
 *
 * 달력 제약은 **양방향**이다. 시작일에만 `max`를 걸면 종료일을 먼저 찍고 시작일을 앞으로
 * 당기는 순서로 상한이 뚫린다(2026-08-23 사용자 인수 테스트에서 발견). 두 필드가 서로의
 * `min`/`max`가 되어야 선택 순서와 무관하게 막힌다.
 */

type ReservationFormProps = {
  space: { dailyRent: number; depositRate: number };
  fixtures: FixtureCatalog;
  onSubmit: (period: ReservationPeriod) => void;
  isPending?: boolean;
  errorMessage?: string;
};

export function ReservationForm({
  space,
  fixtures,
  onSubmit,
  isPending,
  errorMessage,
}: ReservationFormProps) {
  const items = useBuilderStore((state) => state.items);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitted },
  } = useForm<ReservationPeriod>({
    resolver: zodResolver(reservationPeriodSchema),
    defaultValues: { startDate: "", endDate: "" },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");

  // 달력 제약을 우회해 들어온 조합(직접 입력·붙여넣기)은 한쪽을 고치는 순간 다시 판정한다 —
  // 제출 버튼을 눌러야 알게 되면 이미 다 채운 뒤다. 첫 제출 전에는 조용히 둔다.
  useEffect(() => {
    if (isSubmitted && startDate && endDate) {
      void trigger("endDate");
    }
  }, [startDate, endDate, isSubmitted, trigger]);

  const placedFixtures = items.flatMap((item) => {
    const fixture = fixtures[item.fixtureId];
    return fixture ? [fixture] : [];
  });

  const estimate =
    startDate && endDate && startDate <= endDate
      ? estimateReservation({
          startDate,
          endDate,
          dailyRent: space.dailyRent,
          depositRate: space.depositRate,
          fixtures: placedFixtures,
        })
      : null;

  return (
    <Card as="form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <h2 className="text-heading">예약 기간</h2>
        <p className="mt-1 text-caption text-text-muted">
          일시사용 계약이라 최대 {MAX_RESERVATION_DAYS}일까지 예약할 수 있습니다.
        </p>
      </div>

      <div className="flex gap-3">
        <DateField
          label="시작일"
          error={errors.startDate?.message}
          min={endDate ? minStartDate(endDate) : undefined}
          max={endDate || undefined}
          {...register("startDate")}
        />
        <DateField
          label="종료일"
          error={errors.endDate?.message}
          min={startDate || undefined}
          max={startDate ? maxEndDate(startDate) : undefined}
          {...register("endDate")}
        />
      </div>

      <dl className="flex flex-col gap-1 text-caption">
        <Row label="배치 집기" value={`${items.length}개`} />
        {estimate ? (
          <>
            <Row label="대여 일수" value={`${estimate.days}일`} />
            <Row label="공간 대여료" value={won(estimate.spaceRentTotal)} />
            <Row label="집기 렌털료" value={won(estimate.fixtureRentalTotal)} />
            <Row label="보증금" value={won(estimate.deposit)} />
            <Row label="예상 합계" value={won(estimate.totalAmount)} strong />
          </>
        ) : (
          <p className="text-text-muted">기간을 선택하면 예상 견적이 표시됩니다.</p>
        )}
      </dl>

      {estimate ? (
        <p className="text-caption text-text-muted">
          예상 금액입니다. 최종 금액은 예약 요청 결과로 확정됩니다.
        </p>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="text-caption text-error">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "예약 요청 중…" : "예약 요청하기"}
      </Button>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className={strong ? "text-body-strong" : undefined}>{value}</dd>
    </div>
  );
}

function DateField({
  label,
  error,
  ...inputProps
}: React.ComponentPropsWithRef<"input"> & { label: string; error?: string }) {
  // `min-w-0`이 없으면 flex 항목이 date 입력의 고유 폭(약 160px) 아래로 줄지 않아
  // 두 칸이 카드 밖으로 삐져나온다(2026-08-23 사용자 인수 테스트).
  // `w-full`도 같은 버그의 짝이다 — 둘 다 레이아웃이라 Field의 시각 규격이 아니라 여기서 준다.
  return (
    <Field label={label} error={error} className="min-w-0 flex-1" controlClassName="w-full">
      {(control) => <input {...control} type="date" {...inputProps} />}
    </Field>
  );
}

function won(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
