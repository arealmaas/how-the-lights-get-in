// src/ui/Banner.jsx — the store-driven banner (design section 5: real click handlers, no data attributes).
// Nothing calls useBanner().show() yet — that starts in Task 6 — so this renders nothing for now.
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
        <span>{text}</span>
        {input && <input readOnly value={input} aria-label="Link" />}
        {actions.map((a, i) => (
          <button key={i} type="button" className={'btn' + (a.primary ? ' primary' : '')} onClick={a.onClick}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}
