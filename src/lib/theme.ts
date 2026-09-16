export const themeStorageKey = "routine-theme";

// Apply the saved or system palette before the first paint.
export const themeScript = `(()=>{let t;try{t=localStorage.getItem("${themeStorageKey}")}catch{}document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"})()`;
