import React, { useEffect, useRef } from 'react';

// MapComponent dynamically loads Leaflet to avoid hard dependency at build time
// Props: properties [{ _id, title, latitude, longitude, availabilityStatus }], onMarkerClick(id), focusedPropertyId, center [lat, lng]
// Basic props: className
const MapComponent = ({
  properties = [],
  onMarkerClick,
  focusedPropertyId,
  selectedPropertyId,
  center,
  className,
  onDoubleClick,
  onCtrlHover,
  userMarker,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const lastCenterRef = useRef(null);
  const userMarkerRef = useRef(null);
  const markersRef = useRef({});
  const resizeObserverRef = useRef(null);
  const hasInitialFocusRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const ensureLeafletCss = () => {
      const id = 'leaflet-css-cdn';
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }
    };

    const init = async () => {
      ensureLeafletCss();
      try {
        const L = (await import('leaflet')).default;

        if (!mapInstanceRef.current) {
          // Ensure the container has a minimum height to prevent collapse
          if (mapRef.current) {
            mapRef.current.style.minHeight = mapRef.current.style.minHeight || '20rem';
          }
          mapInstanceRef.current = L.map(mapRef.current, {
            center: [23.8103, 90.4125],
            zoom: 11,
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(mapInstanceRef.current);
        }

        const map = mapInstanceRef.current;

        // Observe container size changes and invalidate map size to keep it visible
        if (!resizeObserverRef.current && mapRef.current && typeof ResizeObserver !== 'undefined') {
          resizeObserverRef.current = new ResizeObserver(() => {
            try { map.invalidateSize(false); } catch (_) {}
          });
          resizeObserverRef.current.observe(mapRef.current);
        }

        // Clear old markers
        if (map._markersLayer) {
          map.removeLayer(map._markersLayer);
        }
        const markersLayer = L.layerGroup().addTo(map);
        map._markersLayer = markersLayer;

        const getColor = (status) => {
          switch (status) {
            case 'Available': return 'green';
            case 'Booked': return 'red';
            case 'Under Construction': return 'orange';
            case 'Pre-booking Available': return 'blue';
            default: return 'gray';
          }
        };

        const houseSvg = (color) => (
          `<?xml version="1.0" encoding="UTF-8"?>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10.5L12 3l9 7.5"/>
            <path d="M5 10v10h14V10"/>
            <path d="M9 20v-6h6v6" fill="#fff" stroke="#fff" />
          </svg>`
        );

        const bounds = [];
        markersRef.current = {};

        properties.forEach((p) => {
          // Support multiple coordinate shapes
          let lat = p.latitude;
          let lng = p.longitude;
          if (p.coordinates?.latitude != null && p.coordinates?.longitude != null) {
            lat = p.coordinates.latitude;
            lng = p.coordinates.longitude;
          }
          // GeoJSON style: location.coordinates => [lng, lat]
          if (!lat && !lng && Array.isArray(p.location?.coordinates) && p.location.coordinates.length === 2) {
            const [glng, glat] = p.location.coordinates;
            lat = typeof glat === 'string' ? parseFloat(glat) : glat;
            lng = typeof glng === 'string' ? parseFloat(glng) : glng;
          }
          if (typeof lat === 'number' && typeof lng === 'number') {
            const color = getColor(p.availabilityStatus || p.availability);
            const icon = L.icon({
              iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(houseSvg(color)),
              iconSize: [32, 32],
              iconAnchor: [16, 31],
              popupAnchor: [0, -28],
            });

            const marker = L.marker([lat, lng], { icon }).addTo(markersLayer);
            const status = p.availabilityStatus || p.availability || 'Unknown';
            const price = typeof p.price === 'number' ? `$${p.price.toLocaleString()}` : '';
            const address = p.address || p.location || '';
            // Popup with title, availability (colored dot), price, and address
            marker.bindPopup(`
              <div style="font-weight:600; margin-bottom:4px;">${p.title || 'Property'}</div>
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${color};"></span>
                <span style="font-size:12px; color:#374151;">${status}</span>
                ${price ? `<span style="margin-left:auto; font-size:13px; color:#0e7490; font-weight:600;">${price}</span>` : ''}
              </div>
              ${address ? `<div style="font-size:12px; color:#6b7280;">${address}</div>` : ''}
            `);
            marker.on('click', () => onMarkerClick && onMarkerClick(p._id));
            marker.on('mouseover', function () { this.openPopup(); });
            markersRef.current[p._id] = marker;
            bounds.push([lat, lng]);
          }
        });

        // Respect user-provided center or marker and avoid repeated auto-focus
        const hasUserDefinedCenter = Array.isArray(center) && center.length === 2;
        const hasUserMarker = !!userMarker;

        // Focus a specific property only once on initial load (via URL param)
        if (!hasInitialFocusRef.current && focusedPropertyId && markersRef.current[focusedPropertyId]) {
          const m = markersRef.current[focusedPropertyId];
          const latlng = m.getLatLng();
          // Smoothly zooms out then in to the target
          try { map.flyTo(latlng, 18, { animate: true, duration: 1.25 }); } catch (_) { map.setView(latlng, 18, { animate: true }); }
          m.openPopup();
          hasInitialFocusRef.current = true;
          // Remember last center to avoid unexpected recentering by other effects
          lastCenterRef.current = [latlng.lat, latlng.lng];
        } else if (!hasUserDefinedCenter && !hasUserMarker && bounds.length > 0 && !focusedPropertyId) {
          // Only fit bounds when there is no explicit center and no user marker
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      } catch (e) {
        // Leaflet not installed — fail silently, but keep UI
        // console.warn('Leaflet not available:', e);
      }
    };

    if (isMounted) init();
    return () => {
      isMounted = false;
      // Disconnect observer on unmount
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch (_) {}
        resizeObserverRef.current = null;
      }
      // Clean up user marker
      if (userMarkerRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeLayer(userMarkerRef.current);
          userMarkerRef.current = null;
        } catch (_) {}
      }
    };
  }, [properties, onMarkerClick, focusedPropertyId, center, userMarker]);

  // Recenter when center prop changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !center || !Array.isArray(center) || center.length !== 2) return;
    const [lat, lng] = center;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    const prev = lastCenterRef.current;
    if (!prev || prev[0] !== lat || prev[1] !== lng) {
      map.setView([lat, lng], map.getZoom() || 13, { animate: true });
      lastCenterRef.current = [lat, lng];
    }
  }, [center]);

  // Handle opening popup for selected property
  useEffect(() => {
    if (selectedPropertyId && markersRef.current[selectedPropertyId]) {
      const marker = markersRef.current[selectedPropertyId];
      // Ensure map is ready
      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        const latlng = marker.getLatLng();
        const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 13;
        const midZoom = Math.max(12, Math.min(15, currentZoom - 3)); // gentle zoom-out baseline
        try { map.flyTo(map.getCenter(), midZoom, { animate: true, duration: 0.5 }); } catch (_) { try { map.setZoom(midZoom); } catch (_) {} }
        // After brief zoom-out, fly to target and zoom in
        setTimeout(() => {
          try { map.flyTo(latlng, 18, { animate: true, duration: 1.0 }); } catch (_) { map.setView(latlng, 18, { animate: true }); }
          try { marker.openPopup(); } catch (_) {}
        }, 520);
      }
    }
  }, [selectedPropertyId]);

  // Handle user marker placement and interaction
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let L;
    const setup = async () => {
      try {
        L = (await import('leaflet')).default;

        // CTRL+click handler for placing user marker
        const handleClick = (e) => {
          if (e.originalEvent.ctrlKey) {
            const { lat, lng } = e.latlng;
            onDoubleClick && onDoubleClick({ lat, lng });
          }
        };

        map.on('click', handleClick);

        // Clean up on unmount
        return () => {
          map.off('click', handleClick);
        };
      } catch (e) {
        // ignore if leaflet missing
      }
    };

    setup();
  }, [onDoubleClick, onCtrlHover]);

  // Handle user marker display
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const setup = async () => {
      try {
        const L = (await import('leaflet')).default;

        // Remove existing user marker
        if (userMarkerRef.current) {
          map.removeLayer(userMarkerRef.current);
          userMarkerRef.current = null;
        }

        // Add new user marker if provided
        if (userMarker && typeof userMarker.lat === 'number' && typeof userMarker.lng === 'number') {
          const redIcon = L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
                <path fill="#ff4444" stroke="#fff" stroke-width="2" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 6.9 12.5 28.5 12.5 28.5S25 19.4 25 12.5C25 5.6 19.4 0 12.5 0z"/>
                <circle fill="#fff" cx="12.5" cy="12.5" r="6"/>
              </svg>
            `),
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          });

          userMarkerRef.current = L.marker([userMarker.lat, userMarker.lng], { icon: redIcon })
            .addTo(map)
            .bindPopup(`User Marker<br/>Lat: ${userMarker.lat.toFixed(6)}<br/>Lng: ${userMarker.lng.toFixed(6)}`);
        }
      } catch (e) {
        // ignore if leaflet missing
      }
    };

    setup();
  }, [userMarker]);

  return (
    <div
      ref={mapRef}
      className={`${className || 'w-full h-80'} rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700`}
      style={{ minHeight: '20rem', position: 'relative' }}
    />
  );
};

export default MapComponent;
