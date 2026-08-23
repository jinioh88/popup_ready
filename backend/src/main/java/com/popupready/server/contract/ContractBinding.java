package com.popupready.server.contract;

import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 템플릿에 꽂을 값 묶음. <b>여기 없는 이름은 템플릿에서 쓸 수 없다</b> — 변수 목록의 단일 진실이며,
 * {@code ContractTemplateTest}가 리소스의 변수를 이 목록과 대조해 오타를 미리 잡는다.
 *
 * <p>금액은 사람이 읽는 계약서에 들어가므로 천 단위 구분 기호를 붙인다. 날짜는 {@code yyyy-MM-dd}로,
 * API 표기 규약(§2.2)과 같은 형식이다.
 */
public record ContractBinding(
        String spaceName,
        String spaceAddress,
        String brandName,
        String landlordName,
        LocalDate startDate,
        LocalDate endDate,
        int days,
        long spaceRentTotal,
        long deposit,
        long totalAmount) {

    /** 템플릿이 쓸 수 있는 변수 이름 전체. */
    public static final Set<String> VARIABLE_NAMES = Set.of(
            "spaceName",
            "spaceAddress",
            "brandName",
            "landlordName",
            "startDate",
            "endDate",
            "days",
            "spaceRentTotal",
            "deposit",
            "totalAmount");

    /** 변수 이름 → 치환될 문자열. */
    public Map<String, String> values() {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("spaceName", spaceName);
        values.put("spaceAddress", spaceAddress);
        values.put("brandName", brandName);
        values.put("landlordName", landlordName);
        values.put("startDate", startDate.toString());
        values.put("endDate", endDate.toString());
        values.put("days", String.valueOf(days));
        values.put("spaceRentTotal", money(spaceRentTotal));
        values.put("deposit", money(deposit));
        values.put("totalAmount", money(totalAmount));
        return values;
    }

    private static String money(long amount) {
        return NumberFormat.getIntegerInstance(Locale.KOREA).format(amount);
    }
}
