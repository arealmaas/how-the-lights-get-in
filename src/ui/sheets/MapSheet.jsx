// The official 2025 area map locates the grounds, not the individual programme tents.
import {useRef, useState} from 'react';

const MAP_SOURCE = 'https://howthelightgetsin.org/assets/HTLGI-Hay-2025-Bulk-Upload-Images/London-25-Area-Map.webp';

export default function MapSheet({venue}){
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const viewport = useRef(null);

  function resetZoom(){
    setZoom(1);
    if (viewport.current) {
      viewport.current.scrollLeft = 0;
      viewport.current.scrollTop = 0;
    }
  }

  return (
    <div className="map-sheet">
      <div className="kicker"><span>Kenwood House · Hampstead Heath</span></div>
      <h2 id="sheet-title" tabIndex={-1}>Festival map</h2>
      {venue && <p className="map-venue">Your event’s venue: <strong>{venue}</strong></p>}
      <p className="map-note"><strong>2025 area map.</strong> Individual tents aren’t marked, and the 2026 layout may differ.</p>
      {!failed ? <>
        <div className="map-controls" role="group" aria-label="Map zoom">
          <button type="button" className="btn" aria-label="Zoom out" aria-controls="festival-map" disabled={zoom === 1} onClick={() => setZoom(value => Math.max(1, value - 0.5))}>−</button>
          <output className="map-zoom" aria-live="polite" aria-label="Map zoom level">{zoom * 100}%</output>
          <button type="button" className="btn" aria-label="Zoom in" aria-controls="festival-map" disabled={zoom === 4} onClick={() => setZoom(value => Math.min(4, value + 0.5))}>+</button>
          <button type="button" className="btn map-reset" aria-controls="festival-map" onClick={resetZoom}>Reset zoom</button>
        </div>
        <p id="map-help" className="map-help">Zoom in, then scroll or swipe to explore. Use the arrow keys when the map is focused.</p>
        <div id="festival-map" className="map-viewport" ref={viewport} role="region" aria-label="Festival area map" aria-describedby="map-help" tabIndex={0}>
          <div className="map-canvas" style={{width: `${zoom * 100}%`}}>
            <img src="img/maps/london-area-2025.webp" width="2835" height="2717" draggable="false" onError={() => setFailed(true)}
              alt="Official 2025 local area map: the festival grounds sit between Kenwood House and Wood Pond, with the box office beside the house. Paths lead towards Highgate, Hampstead and Hampstead Heath stations; bus stops are shown on Hampstead Lane." />
          </div>
        </div>
      </> : <p className="map-error" role="alert">The map couldn’t load. Open the original map below to view it on the festival website.</p>}
      <p className="map-source">Map © Institute of Art and Ideas · <a href={MAP_SOURCE} target="_blank" rel="noopener noreferrer">Open original map ↗</a></p>
    </div>
  );
}
