"use client";

import { useSite } from "@/components/Content";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { TLink } from "./Transition";

// "Currently in …", with the time there, kept up to date.
export function Here({ brief = false, to = "/travel" }: { brief?: boolean; to?: string }) {
  const site = useSite();
  const place = site.location;
  const [time, setTime] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!place) return;
    const tick = () => (setNow(Date.now()), setTime(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: place.timeZone }).format(new Date())));
    tick();
    const t = window.setInterval(tick, 20000);
    return () => window.clearInterval(t);
  }, [place]);
  if (!place) return null;
  const Tag = (to.startsWith("#") ? "a" : TLink) as typeof TLink;
  // A message of my own only shows while it is in force.
  const live = !place.until || new Date(place.until).getTime() > now;
  const note = place.message && live && !brief ? place.message : "";
  const away = !!place.away && live;
  return (
    <Tag href={to} className={away ? "here glass here-away" : "here glass"}>
      <i className="here-dot" aria-hidden="true" />
      <span>
        <small>{away ? "Away · in " : "Currently in "}</small>
        <b>{place.name}</b>
        {time && <small> · {time}</small>}
        {note && <em className="here-note">{note}</em>}
      </span>
    </Tag>
  );
}
