package com.codesentinel;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ApiTest {
  @Autowired MockMvc mvc;

  @Test
  void deepExpressionsReturnStructuredInputErrorsAndRecover() throws Exception {
    for (String expr : new String[] {String.join("+", java.util.Collections.nCopies(600, "1")),
        "!".repeat(600) + "1"}) {
      mvc.perform(post("/api/analyze").contentType("application/json")
          .content("{\"source\":\"int f(void){return " + expr + ";}\"}"))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.success").value(false))
          .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }
    realAnalysisContract();
  }

  @Test
  void methodAndContentTypeErrorsKeepTheApiEnvelope() throws Exception {
    mvc.perform(get("/api/analyze")).andExpect(status().isMethodNotAllowed())
        .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    mvc.perform(post("/api/analyze").contentType("text/plain").content("int f(void){return 1;}"))
        .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.success").value(false));
  }

  @Test
  void healthAndSamples() throws Exception {
    mvc.perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.antlrVersion").value("4.13.2"));
    mvc.perform(get("/api/samples"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(12));
  }

  @Test
  void realAnalysisContract() throws Exception {
    mvc.perform(
            post("/api/analyze")
                .contentType("application/json")
                .content("{\"source\":\"int f(void){return 2*8+1;}\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.summary.functionCount").value(1))
        .andExpect(jsonPath("$.data.modules.tac.status").value("COMPLETED"));
  }

  @Test
  void invalidAndOversizedRequests() throws Exception {
    mvc.perform(post("/api/analyze").contentType("application/json").content("oops"))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/api/analyze").contentType("application/json").content("{\"source\":\"\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/analyze")
                .contentType("application/json")
                .content("{\"source\":\"" + " ".repeat(65537) + "x\"}"))
        .andExpect(status().isPayloadTooLarge());
  }
}
