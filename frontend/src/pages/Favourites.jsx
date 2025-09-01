import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, User as UserIcon, Home as HomeIcon, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMyFavourites, removeFavourite } from '../utils/api';

const Favourites = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [owners, setOwners] = useState([]);
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getMyFavourites();
        const items = res.data?.favourites || [];
        setOwners(items.filter(i => i.itemType === 'owner').map(i => i.details).filter(Boolean));
        setProperties(items.filter(i => i.itemType === 'property').map(i => i.details).filter(Boolean));
      } catch (e) {
        setError(e?.message || 'Failed to load favourites');
      } finally {
        setLoading(false);
      }
    };
    if (user?.role === 'tenant') load();
  }, [user?.role]);

  const onRemove = async (itemType, itemId) => {
    try {
      await removeFavourite({ itemType, itemId });
      if (itemType === 'owner') setOwners(prev => prev.filter(o => String(o._id) !== String(itemId)));
      else setProperties(prev => prev.filter(p => String(p._id) !== String(itemId)));
    } catch (e) {
      alert(e?.message || 'Failed to remove favourite');
    }
  };

  if (!user) return (
    <div className="container mx-auto max-w-5xl p-4">
      <p className="text-neutral-700 dark:text-neutral-300">Please log in to view your favourites.</p>
    </div>
  );
  if (user.role !== 'tenant') return (
    <div className="container mx-auto max-w-5xl p-4">
      <p className="text-neutral-700 dark:text-neutral-300">Favourites are available for tenants only.</p>
    </div>
  );

  return (
    <div className="container mx-auto max-w-6xl p-4">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="w-6 h-6 text-cyan-600" />
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">My Favourites</h1>
      </div>

      {loading && <p className="text-neutral-600 dark:text-neutral-400">Loading...</p>}
      {error && <p className="text-error-600 dark:text-error-400">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-10">
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-neutral-900 dark:text-white"><UserIcon className="w-5 h-5" /> Owners</h2>
            {owners.length === 0 ? (
              <p className="text-neutral-600 dark:text-neutral-400">No favourite owners yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {owners.map(o => (
                  <div key={o._id} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                    <div className="flex items-center gap-3">
                      <img src={o.profileImage || '/api/placeholder/80/80'} alt={o.name} className="w-12 h-12 rounded-full object-cover" onError={(e)=>{e.currentTarget.src='/api/placeholder/80/80';}} />
                      <div>
                        <Link to={`/users/${o._id}`} className="font-medium hover:underline text-neutral-900 dark:text-white">{o.name}</Link>
                        {typeof o.averageRating === 'number' && (
                          <div className="flex items-center gap-1 text-sm text-yellow-500"><Star className="w-4 h-4" /> {o.averageRating.toFixed(1)}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                      <Link to={`/users/${o._id}`} className="text-cyan-600 dark:text-cyan-400 hover:underline">View Profile</Link>
                      <button onClick={() => onRemove('owner', o._id)} className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300" title="Remove">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-neutral-900 dark:text-white"><HomeIcon className="w-5 h-5" /> Properties</h2>
            {properties.length === 0 ? (
              <p className="text-neutral-600 dark:text-neutral-400">No favourite properties yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map(p => (
                  <div key={p._id} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                    <Link to={`/properties/${p._id}`}>
                      <img src={p.images?.[0] || '/api/placeholder/400/240'} alt={p.title} className="w-full h-40 object-cover rounded-md" onError={(e)=>{e.currentTarget.src='/api/placeholder/400/240';}} />
                      <div className="mt-3">
                        <h3 className="font-semibold line-clamp-1 text-neutral-900 dark:text-white">{p.title}</h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-1">{p.location}</p>
                        {typeof p.averageRating === 'number' && (
                          <div className="flex items-center gap-1 text-sm text-yellow-500 mt-1"><Star className="w-4 h-4" /> {p.averageRating.toFixed(1)} ({p.totalReviews || 0})</div>
                        )}
                      </div>
                    </Link>
                    <div className="mt-3 flex justify-between items-center">
                      <Link to={`/properties/${p._id}`} className="text-cyan-600 dark:text-cyan-400 hover:underline">View Details</Link>
                      <button onClick={() => onRemove('property', p._id)} className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300" title="Remove">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default Favourites;
