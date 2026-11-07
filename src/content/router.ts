// location.pathname から、どの機能を動かすかを決める。

export type Route = "timetable" | "assignments" | null;

export function routeFor(pathname: string): Route {
  const m = /^\/ct\/([^/?#]+)$/.exec(pathname);
  if (!m) return null;
  const page = m[1]!;
  if (page === "home_library_query") return "assignments";
  // home、home_、home__past、home__upcoming、home__all*、home___y*
  if (/^home(?:_|__past|__upcoming|__all.*|___y\d{4}.*)?$/.test(page)) return "timetable";
  return null;
}
