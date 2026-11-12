import { useEffect, useRef, useState } from 'react';
import './GromcalAnnouncement.css';

const DISMISSED = 'gromcal-launch-1.2-dismissed';
export const GROMCAL_URL = 'https://github.com/WizzyAE/GromCAL';
const readDismissed = () => { try { return localStorage.getItem(DISMISSED) === '1'; } catch { return false; } };

/** Shared announcement for Gromify and Gromflix. No audio, tracking, or private data. */
export default function GromcalAnnouncement() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const close = () => { try { localStorage.setItem(DISMISSED, '1'); } catch { /* Optional storage. */ } setOpen(false); };

  useEffect(() => {
    if (readDismissed()) return;
    let stopped = false, timer = 0, attempts = 0;
    const controller = new AbortController();
    const showWhenReady = () => {
      if (stopped || readDismissed()) return;
      if (document.hidden || document.querySelector('[aria-modal="true"], .modal-backdrop, .overlay')) {
        if (++attempts < 60) timer = window.setTimeout(showWhenReady, 1000);
        return;
      }
      setOpen(true);
    };
    timer = window.setTimeout(() => {
      // A local build must not advertise a release that has not been published.
      void fetch('https://api.github.com/repos/WizzyAE/GromCAL/releases/latest', {
        headers: {Accept: 'application/vnd.github+json'}, signal: controller.signal, cache: 'no-store'
      }).then(response => { if (response.ok) showWhenReady(); }).catch(() => { /* Offline: try on the next launch. */ });
    }, 2000);
    return () => {stopped = true; controller.abort(); window.clearTimeout(timer);};
  }, []);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialog.current;
    panel.querySelector<HTMLElement>('[data-gromcal-primary]')?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); event.stopImmediatePropagation(); close();}
      if (event.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>('button, a[href]')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {event.preventDefault(); first?.focus();}
    };
    document.addEventListener('keydown', keys, true);
    return () => {document.removeEventListener('keydown', keys, true); if (previous?.isConnected) previous.focus();};
  }, [open]);

  if (!open) return null;
  return <div className="gromcal-news-backdrop" onMouseDown={event => {if (event.target === event.currentTarget) close();}}>
    <div ref={dialog} className="gromcal-news" role="dialog" aria-modal="true" aria-labelledby="gromcal-news-title" aria-describedby="gromcal-news-description">
      <button type="button" className="gromcal-news-close" aria-label="Zatvori obavijest o GromCAL-u" onClick={close}>×</button>
      <div className="gromcal-news-icon" aria-hidden="true">⚡</div>
      <p className="gromcal-news-eyebrow">Nova Grom aplikacija</p>
      <h2 id="gromcal-news-title">Stigao je GromCAL!</h2>
      <p id="gromcal-news-description">Prati prehranu, treninge i svoj napredak na jednom mjestu. Poveži vlastiti OpenAI ili Gemini API ključ i kreni.</p>
      <div className="gromcal-news-actions">
        <a href={GROMCAL_URL} target="_blank" rel="noopener noreferrer" data-gromcal-primary onClick={close}>Baci oko ↗</a>
        <button type="button" onClick={close}>Kasnije</button>
      </div>
    </div>
  </div>;
}
