package com.popupready.server.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 모든 예외를 {@link ApiResponse} 봉투로 변환한다. Spring 기본 동작(ProblemDetail)이 나가면
 * 봉투 규약이 깨지므로, 새 예외 유형이 생길 때마다 여기에 핸들러를 추가한다.
 *
 * <p>클라이언트는 message가 아니라 {@link ErrorCode}로 분기한다 — message는 표시·디버깅용이다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** @Valid 본문 검증 실패. 어느 필드가 왜 틀렸는지 message에 모아준다. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleBodyValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(GlobalExceptionHandler::describe)
                .reduce((a, b) -> a + ", " + b)
                .orElse("요청 값이 올바르지 않습니다");
        return toResponse(ErrorCode.VALIDATION_FAILED, message);
    }

    /** @RequestParam·@PathVariable 등 메서드 파라미터 검증 실패(Spring 6+ 경로). */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleParameterValidation(HandlerMethodValidationException e) {
        return toResponse(ErrorCode.VALIDATION_FAILED, "요청 파라미터가 올바르지 않습니다");
    }

    /** 필수 쿼리 파라미터 누락(예: GET /spaces의 lat·lng). */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParameter(MissingServletRequestParameterException e) {
        return toResponse(ErrorCode.VALIDATION_FAILED, e.getParameterName() + "은(는) 필수입니다");
    }

    /** 타입이 맞지 않는 파라미터(예: category=NOPE, radius=abc). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return toResponse(ErrorCode.VALIDATION_FAILED, e.getName() + " 값이 올바르지 않습니다");
    }

    /** 본문 자체를 못 읽는 경우 — 빈 본문, 깨진 JSON, 정의되지 않은 enum 값. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableBody(HttpMessageNotReadableException e) {
        return toResponse(ErrorCode.VALIDATION_FAILED, "요청 본문을 해석할 수 없습니다");
    }

    /**
     * 예상하지 못한 예외. 내부 메시지를 그대로 내보내면 구현 정보가 새므로 고정 문구만 응답하고,
     * 원인은 서버 로그로만 남긴다.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
        log.error("처리되지 않은 예외", e);
        return toResponse(ErrorCode.INTERNAL_ERROR, "서버 오류가 발생했습니다");
    }

    private static String describe(FieldError fieldError) {
        return fieldError.getField() + ": " + fieldError.getDefaultMessage();
    }

    private static ResponseEntity<ApiResponse<Void>> toResponse(ErrorCode errorCode, String message) {
        return ResponseEntity.status(errorCode.status()).body(ApiResponse.error(errorCode, message));
    }
}
