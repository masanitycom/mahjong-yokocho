'use client';
import { useEffect } from 'react';

const MARKUP = `<div id="vp"><div id="stage">
  <div id="lobby"></div>
  <div id="room" hidden></div>
  <div id="game" hidden></div>
  <div id="layer"></div>
</div></div>
<input type="file" id="photo" accept="image/*" hidden>`;

export default function Yokocho({ route }) {
  useEffect(() => {
    let alive = true;
    import('../lib/client/app.js').then(m => { if (alive) m.boot(route); });
    return () => { alive = false; };
  }, []);
  return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
