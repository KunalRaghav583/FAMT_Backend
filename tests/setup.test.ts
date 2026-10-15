import { APP_NAME, API_VERSION } from "../src/server";

describe("Stage 1 Tooling and Setup Verification", () => {
  it("should load configuration constants without error", () => {
    expect(APP_NAME).toBe("Field Asset Maintenance Tracker");
    expect(API_VERSION).toBe("1.0.0");
  });
});
