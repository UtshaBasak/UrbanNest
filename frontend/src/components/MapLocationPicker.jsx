import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Search, Copy, MapPin, Home } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Haversine distance in km between two [lat, lng]
const distanceKm = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create availability-based house icons
const createHouseIcon = (availability) => {
  const colors = {
    'Available': '#10b981', // green
    'Booked': '#ef4444', // red
    'Under Construction': '#f59e0b', // yellow
    'Pre-booking Available': '#3b82f6', // blue
  };
  
  const color = colors[availability] || '#6b7280'; // gray default
  
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: white; font-size: 14px;">🏠</div></div>`,
    className: 'custom-house-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
};

// Component to handle map clicks based on mode
const MapClickHandler = ({ mode, onLocationSelect, onClickCoordinate }) => {
  useMapEvents({
    click: (e) => {
      if (mode === 'marker') {
        onLocationSelect(e.latlng);
      }
      if (mode === 'coords') {
        onClickCoordinate && onClickCoordinate(e.latlng);
      }
    }
  });
  return null;
};

// Rectangle selection tool (Shift+drag box zoom)
const RectangleTool = ({ enabled, onAreaSelected }) => {
  const map = useMap();
  const rectRef = useRef(null);
  useEffect(() => {
    if (!map) return;
    const handleBoxEnd = (e) => {
      const b = e.boxZoomBounds || e.bounds;
      if (!b) return;
      if (rectRef.current) {
        map.removeLayer(rectRef.current);
        rectRef.current = null;
      }
      const rectangle = L.rectangle(b, { color: '#06b6d4', weight: 2, fillOpacity: 0.1 }).addTo(map);
      rectRef.current = rectangle;
      onAreaSelected && onAreaSelected(b);
    };
    if (enabled) {
      map.boxZoom.enable();
      map.on('boxzoomend', handleBoxEnd);
    }
    return () => {
      map.off('boxzoomend', handleBoxEnd);
      if (rectRef.current) {
        map.removeLayer(rectRef.current);
        rectRef.current = null;
      }
    };
  }, [enabled, map, onAreaSelected]);
  return null;
};

// Auto-resize/invalidate helper to ensure correct sizing when the map mounts or the container changes size
const AutoResize = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const invalidate = () => {
      try { map.invalidateSize(false); } catch (_) {}
    };
    // Double rAF then timeout to be extra safe on first mount
    requestAnimationFrame(() => requestAnimationFrame(invalidate));
    const t = setTimeout(invalidate, 150);

    // Observe container resize
    let ro;
    const container = map.getContainer();
    if (container && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => invalidate());
      ro.observe(container);
    }

    return () => {
      clearTimeout(t);
      if (ro) {
        try { ro.disconnect(); } catch (_) {}
      }
    };
  }, [map]);

  // Recenter triggers size invalidate as well to prevent shrink
  useEffect(() => {
    if (!map || !position) return;
    try {
      map.setView(position, map.getZoom() || 13, { animate: false });
      map.invalidateSize(false);
    } catch (_) {}
  }, [map, position]);
  return null;
};

const MapLocationPicker = ({ 
  initialLat = 23.8103, 
  initialLng = 90.4125, // Dhaka, Bangladesh
  onLocationChange,
  availability = 'Available',
  showSearch = true,
  className = ''
}) => {
  const [position, setPosition] = useState([initialLat, initialLng]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sortBy, setSortBy] = useState('relevance'); // relevance | name | distance
  const [isSearching, setIsSearching] = useState(false);
  const [toolMode, setToolMode] = useState('marker'); // marker | coords | rectangle | none
  const [pickedCoord, setPickedCoord] = useState(null);
  const [areaBounds, setAreaBounds] = useState(null);
  const mapRef = useRef();

  useEffect(() => {
    if (initialLat && initialLng) {
      setPosition([initialLat, initialLng]);
    }
  }, [initialLat, initialLng]);

  // Handle R key to remove marker
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        // Reset to default position (Dhaka center)
        const defaultPos = [23.8103, 90.4125];
        setPosition(defaultPos);
        if (onLocationChange) {
          onLocationChange({
            latitude: defaultPos[0],
            longitude: defaultPos[1]
          });
        }
        if (mapRef.current) {
          mapRef.current.setView(defaultPos, 13);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onLocationChange]);

  const handleLocationSelect = (latlng) => {
    const newPosition = [latlng.lat, latlng.lng];
    setPosition(newPosition);
    // Notify parent component immediately for instant updates
    if (onLocationChange) {
      onLocationChange({
        latitude: latlng.lat,
        longitude: latlng.lng
      });
    }
  };

  const searchLocation = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Using Nominatim (OpenStreetMap) geocoding service
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=bd`
      );
      const results = await response.json();
      setSearchResults(results.map(result => ({
        display_name: result.display_name,
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon)
      })));
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result) => {
    const newPos = [result.lat, result.lon];
    setPosition(newPos);
    setSearchQuery(result.display_name);
    setSearchResults([]);
    
    if (mapRef.current) {
      mapRef.current.setView(newPos, 15);
    }
    
    if (onLocationChange) {
      onLocationChange({
        latitude: result.lat,
        longitude: result.lon
      });
    }
  };

  const copyCoordinates = () => {
    const coords = `${position[0].toFixed(6)}, ${position[1].toFixed(6)}`;
    navigator.clipboard.writeText(coords).then(() => {
      alert('Coordinates copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy coordinates');
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tools row */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-600 dark:text-neutral-300">Map Tools:</span>
        <button type="button" onClick={() => setToolMode('marker')} className={`px-3 py-2 rounded ${toolMode==='marker' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100'}`}>Place Marker</button>
        <button type="button" onClick={() => setToolMode('coords')} className={`px-3 py-2 rounded ${toolMode==='coords' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100'}`}>Get Coords</button>
        <button type="button" onClick={() => setToolMode('rectangle')} className={`px-3 py-2 rounded ${toolMode==='rectangle' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100'}`}>Area Select</button>
        <button type="button" onClick={() => setToolMode('none')} className={`px-3 py-2 rounded ${toolMode==='none' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100'}`}>Browse</button>
      </div>
      {showSearch && (
        <div className="relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search for location..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchLocation(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm text-neutral-900 dark:text-white"
              title="Sort results"
            >
              <option value="relevance">Relevance</option>
              <option value="name">Name</option>
              <option value="distance">Distance</option>
            </select>
            <button
              type="button"
              onClick={copyCoordinates}
              className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors"
              title="Copy coordinates"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {([...searchResults]
                .sort((a, b) => {
                  if (sortBy === 'name') {
                    return (a.display_name || '').localeCompare(b.display_name || '');
                  }
                  if (sortBy === 'distance') {
                    const da = distanceKm(position, [a.lat, a.lon]);
                    const db = distanceKm(position, [b.lat, b.lon]);
                    return da - db;
                  }
                  return 0; // relevance (as returned)
                }))
                .map((result, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectSearchResult(result)}
                  className="w-full text-left px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-sm border-b border-neutral-100 dark:border-neutral-700 last:border-b-0"
                >
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-neutral-400 mr-2 flex-shrink-0" />
                    <span className="truncate">{result.display_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: '400px', width: '100%', position: 'relative', zIndex: 1 }}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700"
          ref={mapRef}
        >
          <AutoResize position={position} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapClickHandler mode={toolMode} onLocationSelect={handleLocationSelect} onClickCoordinate={setPickedCoord} />
          <RectangleTool enabled={toolMode==='rectangle'} onAreaSelected={setAreaBounds} />
          {position && (
            <Marker 
              position={position} 
              icon={createHouseIcon(availability)}
            />
          )}
        </MapContainer>
        
        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700 rounded-full px-3 py-2 text-sm shadow">
          <div className="flex items-center gap-3 text-neutral-800 dark:text-neutral-100">
            <span className="flex items-center gap-2"><Home className="h-4 w-4" /> {position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
            {toolMode==='coords' && pickedCoord && (
              <span>Lat: {pickedCoord.lat.toFixed(6)}, Lng: {pickedCoord.lng.toFixed(6)}</span>
            )}
            {toolMode==='rectangle' && areaBounds && (
              <span>Area selected</span>
            )}
          </div>
        </div>
      </div>

      <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
        <p>Click on the map to set the property location. The marker color indicates availability status.</p>
        <p>💡 Press <strong>'R'</strong> to reset/remove the marker</p>
      </div>
    </div>
  );
};

export default MapLocationPicker;
