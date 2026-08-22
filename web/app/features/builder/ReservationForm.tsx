import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { estimateReservation } from "../../lib/builder/estimate";
import { reservationPeriodSchema, type ReservationPeriod } from "../../lib/schemas/reservation";
import { useBuilderStore } from "../../stores/builder";
import type { FixtureCatalog } from "./queries";

/**
 * 예약 기간 선택 + 예약 요청 제출 (F-1).
 *
 * 화면에 띄우는 견적은 **표시용 미리보기**다 — 금액의 원장은 서버 응답(`estimate`)이다.
 * 두 값이 다르면 계산식이 어긋난 것이므로 통합 단계에서 잡아야 한다.
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
    formState: { errors },
  } = useForm<ReservationPeriod>({
    resolver: zodResolver(reservationPeriodSchema),
    defaultValues: { startDate: "", endDate: "" },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");

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
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="text-heading">예약 기간</h2>

      <div className="flex gap-3">
        <DateField
          id="reservation-start"
          label="시작일"
          error={errors.startDate?.message}
          {...register("startDate")}
        />
        <DateField
          id="reservation-end"
          label="종료일"
          error={errors.endDate?.message}
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

      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-lg bg-primary text-body-strong text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {isPending ? "예약 요청 중…" : "예약 요청하기"}
      </button>
    </form>
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
  id,
  ...inputProps
}: React.ComponentPropsWithRef<"input"> & { label: string; error?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <label htmlFor={id} className="text-caption text-text-muted">
        {label}
      </label>
      <input
        id={id}
        type="date"
        aria-invalid={error ? true : undefined}
        className={`h-10 rounded-lg border bg-surface px-3 text-body ${
          error ? "border-error" : "border-border"
        }`}
        {...inputProps}
      />
      {error ? (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function won(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
