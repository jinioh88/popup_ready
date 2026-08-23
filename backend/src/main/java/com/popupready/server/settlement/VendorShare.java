package com.popupready.server.settlement;

/**
 * 공급사 한 곳의 집기 렌털료 합계. <b>공급사별로 Row가 나뉘므로</b> 같은 공급사의 집기가 여러
 * 종이면 여기서 이미 합산돼 들어온다.
 */
public record VendorShare(Long vendorId, long rentalTotal) {}
