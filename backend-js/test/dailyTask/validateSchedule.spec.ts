import { describe, expect, it } from "vitest";
import { validateSchedule } from "@/dailyTask/domain/Services/validateSchedule.js";

describe("validateSchedule", () => {
  it("accepts a valid 15-minute-aligned schedule", () => {
    const result = validateSchedule("2026-05-25", "09:00", "09:30");
    expect(result.ok).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = validateSchedule("25-05-2026", "09:00", "09:30");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation");
      expect(result.message).toBe("Invalid date '25-05-2026'. Expected YYYY-MM-DD.");
    }
  });

  it("rejects start_time not on 15-minute boundary", () => {
    const result = validateSchedule("2026-05-25", "09:07", "09:30");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("start_time '09:07' must align to 15-minute boundaries.");
    }
  });

  it("rejects end_time not on 15-minute boundary", () => {
    const result = validateSchedule("2026-05-25", "09:00", "09:22");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("end_time '09:22' must align to 15-minute boundaries.");
    }
  });

  it("rejects end_time before or equal to start_time", () => {
    const result = validateSchedule("2026-05-25", "10:00", "09:00");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("end_time must be after start_time on the same day.");
    }
  });

  it("rejects duration less than 15 minutes", () => {
    const result = validateSchedule("2026-05-25", "09:00", "09:00");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("end_time must be after start_time on the same day.");
    }
  });

  it("rejects invalid time format", () => {
    const result = validateSchedule("2026-05-25", "9:00", "09:30");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Invalid start_time '9:00'. Expected HH:mm.");
    }
  });
});
