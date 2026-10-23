import { expect, test } from "vitest";
import {
  bookingTopics,
  bookingIssues,
  bookingText,
  type BookingRequest,
} from "./booking";
import { filterArticles } from "./domain";
import { articles } from "./fixtures";
const request: BookingRequest = {
  name: "Persona di prova",
  email: "test@example.invalid",
  topic: bookingTopics[0],
  date: "2026-10-24",
  time: "Da concordare",
  mode: "Da concordare",
};
test("availability requests validate calendar dates and do not claim an appointment is confirmed", () => {
  expect(bookingIssues(request, "2026-10-23")).toEqual([]);
  for (const date of ["2026-10-22", "2026-02-30", "not a date"])
    expect(bookingIssues({ ...request, date }, "2026-10-23")).not.toEqual([]);
  expect(bookingIssues({ ...request, date: "" }, "2026-10-23")).toEqual([]);
  expect(bookingText(request)).toContain(
    "sarà confermato solo dopo una risposta",
  );
});
test("booking requests reject unsupported choices and invalid contact addresses", () => {
  expect(
    bookingIssues(
      {
        ...request,
        email: "not-email",
        topic: "Invented service",
        time: "Unknown",
      },
      "2026-10-23",
    ).length,
  ).toBe(3);
});
test("birth and reading-time filters compose with existing content filters", () => {
  const results = filterArticles(articles, { birth: true, maxMinutes: 5 });
  expect(results.length).toBeGreaterThan(0);
  expect(
    results.every(
      (a) =>
        ["birth", "preparation"].includes(a.categoryId) &&
        a.readingMinutes <= 5,
    ),
  ).toBe(true);
  expect(
    filterArticles(articles, { birth: true, categoryId: "recovery" }),
  ).toEqual([]);
});
