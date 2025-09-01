import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronDown, Filter } from 'lucide-react';
import MapComponent from '../components/MapComponent';
import { getProperties } from '../utils/api';

const MapPage = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const focusedPropertyId = params.get('propertyId');
  const [showFilters, setShowFilters] = useState(true);
  // Applied filters (used to fetch)
  const [filters, setFilters] = useState({
    search: '',
    minPrice: '',
    maxPrice: '',
    availability: 'all',
    sortBy: 'createdAt'
  });
  // UI filters (typing here won't fetch until Search is clicked)
  const [uiFilters, setUiFilters] = useState({
    search: '',
    minPrice: '',
    maxPrice: '',
    availability: 'all',
    sortBy: 'createdAt'
  });
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(null); // [lat, lng]
  const [userMarker, setUserMarker] = useState(null); // {lat, lng} for user-placed marker
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);

  // Handle R key to remove marker
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        setUserMarker(null);
        setShowCoordinates(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Align with backend API which expects availabilityStatus (empty means all)
        const apiParams = {
          search: filters.search || '',
          minPrice: filters.minPrice || '',
          maxPrice: filters.maxPrice || '',
          availabilityStatus: filters.availability === 'all' ? '' : filters.availability,
          sortBy: filters.sortBy || 'createdAt',
        };
        const res = await getProperties(apiParams);
        setProperties(res.data.properties || []);
      } catch (e) {
        setError('Failed to load properties');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters]);

  // Geocode search (Nominatim)
  useEffect(() => {
    let abort = false;
    const fetchGeo = async () => {
      if (!geoQuery || geoQuery.trim().length < 2) { setGeoResults([]); return; }
      try {
        setGeoLoading(true);
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(geoQuery)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        if (!abort) setGeoResults(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!abort) setGeoResults([]);
      } finally {
        if (!abort) setGeoLoading(false);
      }
    };
    const t = setTimeout(fetchGeo, 300);
    return () => { abort = true; clearTimeout(t); };
  }, [geoQuery]);

  const handleFilterChange = (key, value) => {
    setUiFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    const cleared = { search: '', minPrice: '', maxPrice: '', availability: 'all', sortBy: 'createdAt' };
    setUiFilters(cleared);
    setFilters(cleared);
  };

  const applySearch = () => {
    setFilters({ ...uiFilters });
  };

  const getAvailabilityColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Booked': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Under Construction': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Pre-booking Available': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleMapDoubleClick = (latlng) => {
    setUserMarker({ lat: latlng.lat, lng: latlng.lng });
    setShowCoordinates(true);
    // Keep the map centered where the user placed the marker
    setMapCenter([latlng.lat, latlng.lng]);
  };

  const copyCoordinates = () => {
    if (userMarker) {
      const coords = `${userMarker.lat.toFixed(6)}, ${userMarker.lng.toFixed(6)}`;
      navigator.clipboard.writeText(coords).then(() => {
        alert('Coordinates copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy coordinates');
      });
    }
  };

  const onMarkerClick = (id) => {
    if (id) navigate(`/properties/${id}`);
  };

  const handlePropertySelect = (property) => {
    // Try to resolve coordinates from various shapes
    let lat = property.latitude;
    let lng = property.longitude;
    if (property.coordinates?.latitude != null && property.coordinates?.longitude != null) {
      lat = property.coordinates.latitude;
      lng = property.coordinates.longitude;
    }
    if ((lat == null || lng == null) && Array.isArray(property.location?.coordinates) && property.location.coordinates.length === 2) {
      const [glng, glat] = property.location.coordinates;
      lat = typeof glat === 'string' ? parseFloat(glat) : glat;
      lng = typeof glng === 'string' ? parseFloat(glng) : glng;
    }

    if (typeof lat === 'number' && typeof lng === 'number') {
      setMapCenter([lat, lng]);
      setSelectedPropertyId(property._id);
    } else {
      console.warn('Property has no usable coordinates:', property);
      setSelectedPropertyId(property._id);
    }
  };

  // Client-side filtering + sorting to guarantee correctness even if backend is lenient
  const mapProperties = properties
    .filter((p) => {
      // Availability
      if (filters && filters.availability && filters.availability !== 'all') {
        const status = (p.availabilityStatus || p.availability || '').toString();
        if (status !== filters.availability) return false;
      }

      // Price range
      const price = typeof p.price === 'number' ? p.price : parseFloat(p.price);
      if (filters?.minPrice !== '' && !Number.isNaN(Number(filters.minPrice))) {
        if (Number(price) < Number(filters.minPrice)) return false;
      }
      if (filters?.maxPrice !== '' && !Number.isNaN(Number(filters.maxPrice))) {
        if (Number(price) > Number(filters.maxPrice)) return false;
      }

      // Text search in a few common fields
      if (filters?.search && filters.search.trim() !== '') {
        const q = filters.search.trim().toLowerCase();
        const hay = [p.title, p.address, p.location?.address, p.description]
          .filter(Boolean)
          .map((x) => x.toString().toLowerCase())
          .join(' | ');
        if (!hay.includes(q)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const s = filters?.sortBy || 'createdAt';
      if (s === 'price') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (s === '-price') return (Number(b.price) || 0) - (Number(a.price) || 0);
      // Default: createdAt desc (newest first)
      const ad = new Date(a.createdAt || 0).getTime();
      const bd = new Date(b.createdAt || 0).getTime();
      return bd - ad;
    });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Map</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className="flex items-center px-4 py-2 rounded-lg border transition-colors bg-white text-neutral-800 hover:bg-neutral-50 border-neutral-300 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 dark:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <Filter className="h-4 w-4 mr-2 text-current" />
              <span className="text-current">Filters</span>
              <ChevronDown className={`h-4 w-4 ml-2 text-current transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">Tip: Use Area Select with Shift + Drag. Click on the map to get coordinates. User Marker will give you the coords.</p>
        {/* Map-specific controls row */}
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="col-span-2 md:col-span-2">
              <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-1">Search locations using OpenStreetMap</label>
              <div className="relative">
                <input
                  type="text"
                  value={geoQuery}
                  onChange={(e) => setGeoQuery(e.target.value)}
                  className="w-full pl-3 pr-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  placeholder="Search location (e.g., Banani)"
                />
                {geoQuery && geoResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-60 overflow-auto text-neutral-900 dark:text-neutral-100">
                    {geoResults.map((r) => {
                      const lat = parseFloat(r.lat); const lon = parseFloat(r.lon);
                      const label = r.display_name;
                      return (
                        <button
                          key={`${r.place_id}`}
                          type="button"
                          onClick={() => { setMapCenter([lat, lon]); setGeoQuery(label); setGeoResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                        >
                          {label}
                        </button>
                      );
                    })}
                    {geoLoading && <div className="px-3 py-2 text-sm text-neutral-500">Searching...</div>}
                  </div>
                )}
                
                {/* Map interaction tips */}
                <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                  <div>💡 <strong>Ctrl + Left Click</strong> on the map to place a marker (coordinates shown in popup)</div>
                  <div>💡 Press <strong>'R'</strong> to remove the marker</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Property-specific filters row */}
        {showFilters && (
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="col-span-2 md:col-span-2">
                <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-1">Property Search (title, area)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={uiFilters.search} 
                    onChange={(e) => handleFilterChange('search', e.target.value)} 
                    placeholder="Search by title or location" 
                    className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-1">Min Price</label>
                <input type="number" value={uiFilters.minPrice} onChange={(e) => handleFilterChange('minPrice', e.target.value)} placeholder="Min" className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-1">Max Price</label>
                <input type="number" value={uiFilters.maxPrice} onChange={(e) => handleFilterChange('maxPrice', e.target.value)} placeholder="Max" className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-1">Availability</label>
                <select value={uiFilters.availability} onChange={(e) => handleFilterChange('availability', e.target.value)} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600">
                  <option value="all">All</option>
                  <option>Available</option>
                  <option>Booked</option>
                  <option>Under Construction</option>
                  <option>Pre-booking Available</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-700 dark:text-neutral-300 mb-1">Sort By</label>
                <select value={uiFilters.sortBy} onChange={(e) => handleFilterChange('sortBy', e.target.value)} className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-600">
                  <option value="createdAt">Newest</option>
                  <option value="-price">Price: High to Low</option>
                  <option value="price">Price: Low to High</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-3 gap-2">
              <button onClick={clearFilters} className="px-4 py-2 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">Clear</button>
              <button onClick={applySearch} className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors">Search</button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Property List */}
          <div className="lg:col-span-1 h-[480px] overflow-y-auto bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h2 className="text-lg font-semibold mb-2 p-2 text-neutral-800 dark:text-neutral-200">Properties ({mapProperties.length})</h2>
            {loading ? (
              <p className="p-2 text-neutral-600 dark:text-neutral-400">Loading properties...</p>
            ) : mapProperties.length > 0 ? (
              mapProperties.map(p => (
                <div 
                  key={p._id} 
                  onClick={() => handlePropertySelect(p)}
                  className={`p-3 mb-2 rounded-md cursor-pointer transition-all ${selectedPropertyId === p._id ? 'bg-cyan-100 dark:bg-cyan-800 ring-2 ring-cyan-500' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-1">{p.title}</h3>
                    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${getAvailabilityColor(p.availabilityStatus || p.availability)}`}>
                      {p.availabilityStatus || p.availability || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">{p.address}</p>
                  <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 mt-1">${p.price.toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="p-2 text-neutral-600 dark:text-neutral-400">No properties match the current filters.</p>
            )}
          </div>

          {/* Map */}
          <div className="lg:col-span-2 relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700" style={{ height: '480px' }}>
            <MapComponent 
              properties={mapProperties} 
              onMarkerClick={onMarkerClick}
              focusedPropertyId={focusedPropertyId}
              selectedPropertyId={selectedPropertyId}
              center={mapCenter}
              className="absolute inset-0"
              onDoubleClick={handleMapDoubleClick}
              userMarker={userMarker}
            />
            {/* Availability Legend */}
            <div className="absolute top-2 right-2 bg-white/90 dark:bg-neutral-800/90 backdrop-blur rounded-md shadow p-3 text-xs text-neutral-800 dark:text-neutral-200 space-y-2">
              <div className="font-semibold text-neutral-900 dark:text-white">Legend</div>
              {[
                { label: 'Available', color: '#16a34a' },
                { label: 'Booked', color: '#dc2626' },
                { label: 'Under Construction', color: '#f59e0b' },
                { label: 'Pre-booking Available', color: '#2563eb' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="inline-block"
                    dangerouslySetInnerHTML={{ __html: `<?xml version='1.0' encoding='UTF-8'?><svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='${item.color}' stroke='${item.color}' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'><path d='M3 10.5L12 3l9 7.5'/><path d='M5 10v10h14V10'/><path d='M9 20v-6h6v6' fill='#fff' stroke='#fff' /></svg>` }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPage;
