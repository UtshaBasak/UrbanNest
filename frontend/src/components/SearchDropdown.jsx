import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, User, Users } from 'lucide-react';
import { searchProperties } from '../utils/api';
import { searchUsers } from '../utils/userApi';

const SearchDropdown = ({ query, onClose }) => {
  const [results, setResults] = useState({
    properties: [],
    owners: [],
    tenants: [],
    loading: false
  });

  useEffect(() => {
    const searchData = async () => {
      if (query.length < 2) {
        setResults({ properties: [], owners: [], tenants: [], loading: false });
        return;
      }

      setResults(prev => ({ ...prev, loading: true }));

      try {
        const [propertiesRes, usersRes] = await Promise.all([
          searchProperties({ search: query, limit: 5 }),
          searchUsers(query)
        ]);

        const owners = usersRes.data.users.filter(user => user.role === 'owner');
        const tenants = usersRes.data.users.filter(user => user.role === 'tenant');

        setResults({
          properties: propertiesRes.data.properties || [],
          owners,
          tenants,
          loading: false
        });
      } catch (error) {
        console.error('Search error:', error);
        setResults({ properties: [], owners: [], tenants: [], loading: false });
      }
    };

    const timeoutId = setTimeout(searchData, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const hasResults = results.properties.length > 0 || results.owners.length > 0 || results.tenants.length > 0;

  if (!query || query.length < 2) return null;

  return (
    <div className="absolute top-full left-0 w-full mt-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-neutral-700/50 overflow-hidden z-50">
      {results.loading ? (
        <div className="p-4 text-center">
          <div className="spinner mx-auto mb-2"></div>
          <p className="text-sm text-neutral-500">Searching...</p>
        </div>
      ) : hasResults ? (
        <div className="max-h-96 overflow-y-auto">
          {/* Properties */}
          {results.properties.length > 0 && (
            <div className="p-2">
              <div className="flex items-center space-x-2 px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <Building2 className="w-4 h-4" />
                <span>Properties</span>
              </div>
              {results.properties.map((property) => (
                <Link
                  key={property._id}
                  to={`/properties/${property._id}`}
                  onClick={onClose}
                  className="flex items-center space-x-3 px-3 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200"
                >
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {property.title}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
                      {property.location}
                    </p>
                    <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                      ${property.price}/month
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Owners */}
          {results.owners.length > 0 && (
            <div className="p-2 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center space-x-2 px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <User className="w-4 h-4" />
                <span>Property Owners</span>
              </div>
              {results.owners.map((owner) => (
                <Link
                  key={owner._id}
                  to={`/users/${owner._id}`}
                  onClick={onClose}
                  className="flex items-center space-x-3 px-3 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {owner.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {owner.name}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {owner.email}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                    Owner
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Tenants */}
          {results.tenants.length > 0 && (
            <div className="p-2 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center space-x-2 px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <Users className="w-4 h-4" />
                <span>Tenants</span>
              </div>
              {results.tenants.map((tenant) => (
                <Link
                  key={tenant._id}
                  to={`/users/${tenant._id}`}
                  onClick={onClose}
                  className="flex items-center space-x-3 px-3 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-secondary-500 to-accent-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {tenant.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {tenant.name}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {tenant.email}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 text-xs rounded-full">
                    Tenant
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="text-neutral-500">No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;