// Real PostgreSQL 17 + real native PostgREST. Only Auth issuance is simulated.
import { communityDatabase } from "./communityDatabase.mjs";
import { localPostgrest } from "./localPostgrest.mjs";
import { hubIds } from "./hubDatabase.mjs";
import {
  consumerFixture,
  fixturePublishableKey,
  fixtureServiceKey,
} from "./consumerHttpFixture.mjs";

export async function communityHttpFixture(t, { database = communityDatabase } = {}) {
  const db = await database(t);
  const rest = await localPostgrest(t, db);
  const seen = new Set();
  // Simulated Auth signups are mirrored once into this disposable database.
  // Never recreate a previously provisioned identity after an account deletion.
  const provisioned = new Set(Object.values(hubIds));
  const fixture = await consumerFixture({
    restHandler: async ({ url, body, request, user, active, token, send }) => {
      let signed;
      if (user) {
        const claims = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString(),
        );
        if (active && !seen.has(token)) {
          if (!provisioned.has(user.id)) {
            await db.admin.query(
              "insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,$3,$4) on conflict(id) do nothing",
              [user.id, user.email, user.email_confirmed_at || null, user.is_anonymous === true],
            );
            provisioned.add(user.id);
          }
          await db.admin.query(
            "insert into auth.sessions(id,user_id) values($1,$2)",
            [claims.session_id, user.id],
          );
          seen.add(token);
        }
        if (!active)
          await db.admin.query("delete from auth.sessions where id=$1", [
            claims.session_id,
          ]);
        signed = rest.sign(claims);
      }
      const headers = { "Content-Type": "application/json" };
      for (const key of ["accept", "prefer", "range", "range-unit"])
        if (request.headers[key]) headers[key] = request.headers[key];
      if (signed) headers.Authorization = "Bearer " + signed;
      const response = await fetch(
        rest.url + url.pathname.replace("/rest/v1", "") + url.search,
        {
          method: request.method,
          headers,
          ...(["GET", "HEAD"].includes(request.method)
            ? {}
            : { body: JSON.stringify(body) }),
        },
      );
      const text = await response.text();
      send(text ? JSON.parse(text) : null, response.status);
      return true;
    },
  });
  for (const [name, id] of Object.entries(hubIds))
    fixture.users.set(name + "@fixture.invalid", {
      id,
      email: name + "@fixture.invalid",
      email_confirmed_at: "2026-09-01T00:00:00Z",
      is_anonymous: false,
      // Deliberately untrusted: DB editor membership is the authority.
      user_metadata: { role: "publisher" },
    });
  t.after(() => fixture.close());
  return {
    ...fixture,
    db,
    rest,
    env: {
      EGGS_HUB_ENABLED: "true",
      EGGS_ROOMS_ENABLED: "true",
      EGGS_COMMUNITY_ENABLED: "true",
      SUPABASE_URL: fixture.url,
      SUPABASE_PUBLISHABLE_KEY: fixturePublishableKey,
      SUPABASE_SERVICE_ROLE_KEY: fixtureServiceKey,
    },
  };
}
