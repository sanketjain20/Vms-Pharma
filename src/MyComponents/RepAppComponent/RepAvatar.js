import React from "react";

export const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

/** The rep's photo, or their initials on the accent colour when there isn't one. */
export default function RepAvatar({ photo, name, size = 40 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  return photo ? (
    <img className="ra-avatar ra-avatar--img" src={photo} alt="" style={style} />
  ) : (
    <span className="ra-avatar" aria-hidden="true" style={style}>{initialsOf(name)}</span>
  );
}
