import { expect, test } from "vitest";
import {
  callInvitationLink,
  invitationId,
  prepareHostpointLink,
} from "../apps/mobile/src/video-call-links";

test("email links carry an invitation identity without room URL or user data", () => {
  const id = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
  expect(callInvitationLink(id)).toBe(
    "https://metimaia.com/videochiamate?invito=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  for (const value of [
    "https://evil.example",
    "../account",
    "bad?x=y",
    [id],
    null,
  ])
    expect(invitationId(value)).toBeNull();
  expect(() => callInvitationLink("bad")).toThrow();
});

test("room links use 128 random bits without patient identifiers", () => {
  let size = 0;
  const link = prepareHostpointLink((bytes) => {
    size = bytes.length;
    return bytes.fill(255);
  });
  expect(size).toBe(16);
  expect(link).toBe("https://meet.hostpoint.ch/maia-" + "ff".repeat(16));
  expect(prepareHostpointLink()).not.toBe(prepareHostpointLink());
});
