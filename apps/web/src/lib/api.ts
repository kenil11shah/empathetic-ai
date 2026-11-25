import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ZodError, type ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export type Ctx = { supabase: SupabaseClient; user: User; requestId: string };
type Params = Record<string, string>;
type RouteCtx = { params: Promise<Params> };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, requestId?: string) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...(requestId ? { "X-Request-Id": requestId } : {}) },
  });
}

export function errorResponse(status: number, code: string, message: string, requestId: string) {
  return json({ error: { code, message, request_id: requestId } }, status, requestId);
}

function handleError(e: unknown, requestId: string) {
  if (e instanceof ApiError) return errorResponse(e.status, e.code, e.message, requestId);
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return errorResponse(400, "invalid_input", first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid input", requestId);
  }
  // Never leak stack traces or content. Log only the error class and request id.
  console.error(`[api] ${requestId} unhandled ${(e as Error)?.name ?? "error"}`);
  return errorResponse(500, "internal_error", "Something went wrong on our side. Please try again.", requestId);
}

/** Wraps a route handler with authentication, a request id and safe error handling. */
export function withAuth(fn: (ctx: Ctx, req: NextRequest, params: Params) => Promise<Response>) {
  return async (req: NextRequest, routeCtx: RouteCtx) => {
    const requestId = crypto.randomUUID();
    try {
      if (!publicEnv.supabaseUrl || !publicEnv.supabaseKey) {
        throw new ApiError(503, "not_configured", "The database is not configured yet. See the setup handbook.");
      }
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new ApiError(401, "unauthenticated", "Please sign in.");
      const params = routeCtx?.params ? await routeCtx.params : {};
      return await fn({ supabase, user, requestId }, req, params);
    } catch (e) {
      return handleError(e, requestId);
    }
  };
}

/** Public routes (no auth) with the same error envelope. */
export function withPublic(fn: (req: NextRequest, requestId: string) => Promise<Response>) {
  return async (req: NextRequest) => {
    const requestId = crypto.randomUUID();
    try {
      return await fn(req, requestId);
    } catch (e) {
      return handleError(e, requestId);
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON.");
  }
  return schema.parse(raw);
}

export function dbError(error: { code?: string; message?: string } | null, what = "record") {
  if (!error) return;
  if (error.code === "PGRST116") throw new ApiError(404, "not_found", `That ${what} was not found.`);
  if (error.code === "23514" || error.code === "22P02" || error.code === "22007")
    throw new ApiError(400, "invalid_input", `That ${what} has an invalid value.`);
  if (error.code === "23505") throw new ApiError(409, "conflict", `That ${what} already exists.`);
  // Missing grants, tables or columns mean the database setup SQL has not been fully run.
  if (error.code === "42501" || error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205") {
    console.error(`[db] ${error.code} while handling ${what}: database setup incomplete`);
    throw new ApiError(503, "db_setup_incomplete", "The app's database isn't fully set up yet. Please try again later.");
  }
  console.error(`[db] ${error.code ?? "unknown"} while handling ${what}`);
  throw new ApiError(500, "db_error", "We couldn't save that just now. Please try again.");
}

export async function audit(ctx: Ctx, action: string, entity: string, entityId?: string) {
  await ctx.supabase.from("audit_log").insert({ user_id: ctx.user.id, action, entity, entity_id: entityId ?? null });
}
