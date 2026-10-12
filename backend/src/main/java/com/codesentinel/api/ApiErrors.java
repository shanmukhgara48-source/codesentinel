package com.codesentinel.api;

import java.util.*;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<?> invalid(IllegalArgumentException e) {
    return error(400, "INVALID_INPUT", e.getMessage());
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<?> json() {
    return error(
        400, "INVALID_JSON", "Send a JSON object containing source and optional filename.");
  }

  @ExceptionHandler(ApiController.OversizedInput.class)
  public ResponseEntity<?> size() {
    return error(413, "SOURCE_TOO_LARGE", "Source must be at most 64 KiB.");
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<?> internal() {
    return error(
        500, "INTERNAL_ERROR", "Analysis could not complete. Try a smaller supported C program.");
  }

  private ResponseEntity<?> error(int status, String code, String message) {
    return ResponseEntity.status(status)
        .body(Map.of("success", false, "code", code, "error", message));
  }
}
