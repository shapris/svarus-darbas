/**
 * Adreso laukas: Google Places (jei yra VITE_GOOGLE_MAPS_API_KEY) arba įprastas tekstas + nuoroda į Maps.
 */

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';

const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

let mapsScriptPromise: Promise<void> | null = null;

function loadMapsPlaces(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as unknown as { google?: { maps?: { places?: unknown } } };
  if (w.google?.maps?.places) return Promise.resolve();
  if (!MAPS_KEY) return Promise.reject(new Error('no_key'));

  if (!mapsScriptPromise) {
    mapsScriptPromise = new Promise((resolve, reject) => {
      const id = 'google-maps-places-script';
      if (document.getElementById(id)) {
        const poll = () => {
          const ww = window as unknown as { google?: { maps?: { places?: unknown } } };
          if (ww.google?.maps?.places) resolve();
          else window.setTimeout(poll, 50);
        };
        poll();
        return;
      }
      const s = document.createElement('script');
      s.id = id;
      s.async = true;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&libraries=places&language=lt`;
      s.onload = () => resolve();
      s.onerror = () => {
        mapsScriptPromise = null;
        reject(new Error('load_failed'));
      };
      document.head.appendChild(s);
    });
  }
  return mapsScriptPromise;
}

export function googleMapsSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

interface ClientAddressAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  disabled?: boolean;
  inputClassName?: string;
}

export default function ClientAddressAutocomplete({
  value,
  onChange,
  disabled,
  inputClassName,
}: ClientAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(false);

  useEffect(() => {
    if (!MAPS_KEY || disabled) return;
    let cancelled = false;
    loadMapsPlaces()
      .then(() => {
        if (!cancelled) setMapsReady(true);
      })
      .catch((e) => {
        if (!cancelled && (e as Error)?.message !== 'no_key') setMapsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [disabled]);

  useEffect(() => {
    if (!mapsReady || disabled || !inputRef.current || !MAPS_KEY) return;
    type GAc = {
      addListener: (ev: string, fn: () => void) => void;
      getPlace: () => {
        formatted_address?: string;
        geometry?: { location?: { lat: () => number; lng: () => number } };
      };
    };
    const g = (
      window as unknown as {
        google: {
          maps: {
            places: { Autocomplete: new (el: HTMLInputElement, o: object) => GAc };
            event: { clearInstanceListeners: (x: GAc) => void };
          };
        };
      }
    ).google;
    if (!g?.maps?.places?.Autocomplete) return;

    const ac = new g.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'name'],
      types: ['address'],
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const addr = place.formatted_address?.trim() || '';
      const loc = place.geometry?.location;
      if (addr && loc) {
        onChange(addr, { lat: loc.lat(), lng: loc.lng() });
      } else if (addr) {
        onChange(addr);
      }
    });

    return () => {
      g.maps.event.clearInstanceListeners(ac);
    };
  }, [mapsReady, disabled, onChange]);

  const showLink = value.trim().length > 0;
  const inputCls =
    inputClassName ??
    'w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20';

  return (
    <div className="space-y-2 text-left">
      <input
        ref={inputRef}
        type="text"
        required
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        placeholder={MAPS_KEY && !mapsError ? 'Pradėkite rašyti adresą…' : 'Gatvė, namas, miestas'}
        autoComplete="street-address"
      />
      {!MAPS_KEY && (
        <p className="text-[10px] text-slate-400 leading-snug">
          Google vietos paieškai pridėkite{' '}
          <code className="text-slate-600">VITE_GOOGLE_MAPS_API_KEY</code> (Maps JavaScript API +
          Places API). Vis tiek galite įrašyti adresą ranka.
        </p>
      )}
      {!!MAPS_KEY && mapsError && (
        <p className="text-[10px] text-amber-600 leading-snug">
          Nepavyko įkelti Google Maps. Patikrinkite API raktą ir projekto nustatymus.
        </p>
      )}
      {showLink && (
        <a
          href={googleMapsSearchUrl(value)}
          target="_blank"
          rel="noopener noreferrer"
          title="Atidaryti Google žemėlapyje naujame skirtuke"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          Žiūrėti Google žemėlapyje
          <ExternalLink className="w-3 h-3 opacity-70 shrink-0" aria-hidden />
        </a>
      )}
    </div>
  );
}
