// content script の入口。ページを判定して、各機能を呼ぶ。
import { warn } from "../lib/log";
import { routeFor } from "./router";
import { initTimetable } from "./timetable";

function run(): void {
  const route = routeFor(location.pathname);
  const task = route === "timetable" ? initTimetable(document) : null;
  task?.catch((e) => warn("想定外のエラーが起きたため、処理を止めました", e));
}

run();
