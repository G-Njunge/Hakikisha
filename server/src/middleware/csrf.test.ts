import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import csrfProtection from "./csrf";
import { ACCESS_COOKIE, CSRF_COOKIE } from "../lib/cookies";

function mockReq(overrides: Partial<Request>): Request {
  return { method: "POST", path: "/api/reports", cookies: {}, headers: {}, ...overrides } as Request;
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("csrfProtection", () => {
  it("passes through non-mutating methods regardless of tokens", () => {
    const req = mockReq({ method: "GET" });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("passes through exempt paths (e.g. login) without a token", () => {
    const req = mockReq({ method: "POST", path: "/api/auth/login" });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("passes through an anonymous mutating request (no access-token cookie) without a CSRF token", () => {
    // e.g. POST /api/scans, which intentionally allows anonymous barcode
    // scanning — with no session cookie, there's nothing for a cross-site
    // request to ride on, so there's nothing for the double-submit check to
    // protect.
    const req = mockReq({ cookies: {} });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects an authenticated mutating request with no CSRF cookie", () => {
    const req = mockReq({ cookies: { [ACCESS_COOKIE]: "valid-access-token" } });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects an authenticated mutating request where the header doesn't match the cookie", () => {
    const req = mockReq({
      cookies: { [ACCESS_COOKIE]: "valid-access-token", [CSRF_COOKIE]: "cookie-value" },
      headers: { "x-csrf-token": "different-value" },
    });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows an authenticated mutating request where the header matches the cookie", () => {
    const req = mockReq({
      cookies: { [ACCESS_COOKIE]: "valid-access-token", [CSRF_COOKIE]: "matching-value" },
      headers: { "x-csrf-token": "matching-value" },
    });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
