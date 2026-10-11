import { useEffect, useState } from "react";

export type PageId = "play" | "focus";

export function readPage(): PageId {
  const raw = window.location.hash.replace(/^#/, "").replace(/^\//, "").split(/[/?#]/)[0];
  return raw === "focus" || raw === "counter" ? "focus" : "play";
}

function writePage(page: PageId) {
  const next = page === "focus" ? "#/focus" : "#/";
  if (window.location.hash === next) return;
  if (page === "play" && (window.location.hash === "" || window.location.hash === "#")) return;
  window.location.hash = next;
}

export function usePage() {
  const [page, setPage] = useState<PageId>(readPage);

  useEffect(() => {
    const sync = () => setPage(readPage());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const go = (next: PageId) => {
    writePage(next);
    setPage(next);
  };

  return [page, go] as const;
}
