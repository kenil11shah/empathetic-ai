import { json, withPublic } from "@/lib/api";
import { RESOURCES, resourcesFor } from "@/lib/safety/resources";

// Public: help must never sit behind sign-in.
export const GET = withPublic(async (req) => {
  const country = req.nextUrl.searchParams.get("country");
  return json(country ? resourcesFor(country) : { regions: Object.values(RESOURCES) });
});
