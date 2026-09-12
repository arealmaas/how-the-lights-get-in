// src/ui/Banner.jsx — the store-driven banner (design section 5: real click handlers, no data attributes).
// One banner at a time: showBanner() replaces whatever is on screen, so two things happening at once —
// a join offer and a sync message, say — cannot stack. Everything the cloud layer has to say arrives
// here, as {text, input?, actions[]}; React escapes the text, which is why the old page's esc() is gone.
import {useEffect, useRef} from 'react';
import {useBanner} from '../store/banner.js';

export default function Banner(){
  const banner = useBanner(s => s.banner);
  const ref = useRef(null);

  useEffect(() => {
    if (banner) ref.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }, [banner]);

  if (!banner) return null;
  const {text, input, actions = []} = banner;

  return (
    <div className="banner" ref={ref}>
      <div className="banner-inner">
        <span role="status" aria-live="polite" aria-atomic="true">{text}</span>
        {input && <input readOnly value={input} aria-label="Link" />}
        {actions.map((a, i) => (
          <button key={i} type="button" className={'btn' + (a.primary ? ' primary' : '')} onClick={a.onClick}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}
