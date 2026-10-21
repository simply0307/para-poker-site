import Link from "next/link";
import { Avatar } from "@/components/rooms/RoomPresentation";
import { avatars, themes } from "@/lib/rooms/registry.mjs";

function peopleUrl(query, after) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (after) params.set("after", after);
  return "/people" + (params.size ? "?" + params.toString() : "");
}

export function PeopleDirectory({
  people,
  next_cursor,
  unavailable,
  query,
  after,
}) {
  return (
    <main className="studio-main people-directory">
      <header className="people-heading">
        <div>
          <p className="studio-kicker">A SMALL WEB, WITH PEOPLE IN IT</p>
          <h1>Meet the good eggs.</h1>
          <p>Find a familiar handle or explore someone’s corner of EGGS.</p>
        </div>
        <Link
          className="people-page-invitation"
          href="/profile"
          prefetch={false}
        >
          <span aria-hidden="true">✳</span>
          <b>A page that feels like you.</b>
          <span>Make your own corner ↗</span>
        </Link>
      </header>

      <form
        action="/people"
        method="get"
        className="people-search"
        role="search"
      >
        <label htmlFor="people-query">Find a name or handle</label>
        <div>
          <input
            id="people-query"
            name="q"
            type="search"
            maxLength={60}
            defaultValue={query}
            placeholder="Try a name or @handle"
          />
          <button type="submit">Find people</button>
        </div>
        {query ? <Link href="/people">Clear search</Link> : null}
      </form>

      <div className="people-results-heading">
        <h2>{query ? "People matching your search" : "Public pages"}</h2>
        <p>Only pages their owners have made public appear here.</p>
      </div>

      {unavailable ? (
        <div className="people-empty" role="status">
          <h3>A little quiet right now.</h3>
          <p>
            We couldn’t load the directory. Give it another try in a moment.
          </p>
          <Link href={peopleUrl(query, after)}>Try the directory again ↗</Link>
        </div>
      ) : people.length ? (
        <ul className="people-grid" aria-label="Public EGGS pages">
          {people.map((person) => {
            const avatar = Object.hasOwn(avatars, person.avatar)
              ? person.avatar
              : "egg";
            const theme = Object.hasOwn(themes, person.theme)
              ? person.theme
              : "carton";
            return (
              <li key={person.id}>
                <Link
                  className="people-card"
                  href={"/profile/" + person.handle}
                  data-room-theme={theme}
                >
                  <span className="people-card-trim" aria-hidden="true" />
                  <span className="people-avatar">
                    <Avatar id={avatar} />
                  </span>
                  <span className="people-card-copy">
                    <strong>{person.display_name || person.handle}</strong>
                    <span className="people-handle">@{person.handle}</span>
                    <span className="people-room-theme">{themes[theme]}</span>
                  </span>
                  <span className="people-visit">
                    Visit their page <span aria-hidden="true">↗</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="people-empty" role="status">
          <span className="people-empty-mark" aria-hidden="true">
            ✳
          </span>
          <h3>{query ? "No page found this time." : "Room for new faces."}</h3>
          <p>
            {query
              ? "Try another spelling, a shorter name, or a handle without the @."
              : "Public pages will appear here as people make themselves at home."}
          </p>
          <Link href={query ? "/people" : "/profile"} prefetch={false}>
            {query
              ? "Explore all public pages ↗"
              : "Start with your own page ↗"}
          </Link>
        </div>
      )}

      {!unavailable && (next_cursor || after) ? (
        <nav className="people-pagination" aria-label="People directory pages">
          {after ? (
            <Link href={peopleUrl(query)}>Back to the beginning</Link>
          ) : (
            <span />
          )}
          {next_cursor ? (
            <Link href={peopleUrl(query, next_cursor)}>More people →</Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
