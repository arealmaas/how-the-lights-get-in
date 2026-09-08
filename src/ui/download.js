// src/ui/download.js — trigger a client-side file download from generated text: the .ics calendar exports
// (event sheet, My festival, the crew calendar) and the Markdown ones (notes, the reading list). Ported
// verbatim from the old page's download(); the object URL is revoked once the browser has had it.
export function download(filename, text, mime){
  const blob = new Blob([text], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {href: url, download: filename});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
