import React, { useEffect, useState } from 'react';
import { getProperty } from '../utils/api';

const propertyFields = [
  { label: 'Title', key: 'title' },
  { label: 'Description', key: 'description' },
  { label: 'Location', key: 'location' },
  { label: 'Latitude', key: 'latitude' },
  { label: 'Longitude', key: 'longitude' },
  { label: 'Price', key: 'price' },
  { label: 'Size (sqft)', key: 'size' },
  { label: 'Bedrooms', key: 'bedrooms' },
  { label: 'Bathrooms', key: 'bathrooms' },
  { label: 'Type', key: 'type' },
  { label: 'Status', key: 'availabilityStatus' },
  { label: 'Owner', key: 'owner', render: (o) => o?.name || '' },
  { label: 'Images', key: 'images', render: (imgs) => imgs && imgs.length ? <img src={imgs[0]} alt="img" className="h-20 w-32 object-cover rounded" /> : '' },
];

export default function Compare() {
  const [compareIds, setCompareIds] = useState([]);
  const [properties, setProperties] = useState([null, null]);

  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem('compareProperties') || '[]');
    setCompareIds(ids.slice(-2));
  }, []);

  useEffect(() => {
    async function fetchProps() {
      if (compareIds.length === 0) return setProperties([null, null]);
      const results = await Promise.all(compareIds.map(async (id) => {
        try {
          const res = await getProperty(id);
          return res.data?.property || null;
        } catch {
          return null;
        }
      }));
      setProperties([results[0] || null, results[1] || null]);
    }
    fetchProps();
  }, [compareIds]);

  const removeFromCompare = (idx) => {
    const ids = JSON.parse(localStorage.getItem('compareProperties') || '[]');
    ids.splice(idx, 1);
    localStorage.setItem('compareProperties', JSON.stringify(ids));
    setCompareIds(ids);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-10">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-center text-neutral-900 dark:text-white">Compare Properties</h1>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg">
            <thead>
              <tr>
                <th className="p-4 border-b border-r border-neutral-300 dark:border-neutral-700 text-left text-neutral-900 dark:text-white">Field</th>
                <th className="p-4 border-b border-r border-neutral-300 dark:border-neutral-700 text-center text-neutral-900 dark:text-white">Property 1 {properties[0] && <button onClick={() => removeFromCompare(0)} className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded">Remove</button>}</th>
                <th className="p-4 border-b border-neutral-300 dark:border-neutral-700 text-center text-neutral-900 dark:text-white">Property 2 {properties[1] && <button onClick={() => removeFromCompare(1)} className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded">Remove</button>}</th>
              </tr>
            </thead>
            <tbody>
              {propertyFields.map(({ label, key, render }) => (
                <tr key={key}>
                  <td className="p-4 border-b border-r border-neutral-200 dark:border-neutral-700 font-medium text-neutral-900 dark:text-white">{label}</td>
                  <td className="p-4 border-b border-r border-neutral-200 dark:border-neutral-700 text-center text-neutral-900 dark:text-white">{properties[0] ? (render ? render(properties[0][key]) : properties[0][key]) : '-'}</td>
                  <td className="p-4 border-b border-neutral-200 dark:border-neutral-700 text-center text-neutral-900 dark:text-white">{properties[1] ? (render ? render(properties[1][key]) : properties[1][key]) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!properties[0] && !properties[1]) && <div className="text-center text-neutral-500 mt-8">No properties selected for comparison.</div>}
      </div>
    </div>
  );
}
