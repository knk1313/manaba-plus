import { describe, expect, it } from "vitest";
import { routeFor } from "../src/content/router";

describe("routeFor", () => {
  it.each(["/ct/home", "/ct/home_", "/ct/home__past", "/ct/home__upcoming", "/ct/home__all", "/ct/home__all_y2026", "/ct/home___y2025"])(
    "%s は時間割",
    (p) => expect(routeFor(p)).toBe("timetable"),
  );
  it("home_library_query は課題", () => expect(routeFor("/ct/home_library_query")).toBe("assignments"));
  it.each(["/ct/home_course", "/ct/home_coursetable", "/ct/home_library_reminder", "/ct/course_123", "/ct/home_lang_en"])(
    "%s では何もしない",
    (p) => expect(routeFor(p)).toBeNull(),
  );
});
