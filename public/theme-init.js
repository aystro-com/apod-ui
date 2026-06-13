// Apply the persisted theme before first paint to avoid a flash of the wrong theme.
try {
  var t = localStorage.getItem("apod.theme");
  if (
    t === "dark" ||
    (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {
  /* storage unavailable */
}
