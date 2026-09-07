// src/ui/download.js — trigger a client-side file download from generated text: the .ics export and (in a
// later task) the Markdown exports. Ported verbatim from the old page's download().
export function download(filename, text, mime){
  const blob = new Blob([text], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {href: url, download: filename});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
