/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Order } from '../types';
import { formatDate } from '../utils';
import { MapPin, Navigation, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet (Leaflet tipai neeksportuoja _getIconUrl)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet Default icon prototype
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

interface LogisticsViewProps {
  orders: Order[];
}

export default function LogisticsView({ orders }: LogisticsViewProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todaysOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const orderDate = new Date(o.date);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [orders, today]);

  const handleOpenMaps = () => {
    if (todaysOrders.length === 0) return;

    // Construct Google Maps Directions URL
    // Format: https://www.google.com/maps/dir/Origin/Waypoint1/Waypoint2/Destination
    const addresses = todaysOrders.map((o) => encodeURIComponent(o.address));
    const url = `https://www.google.com/maps/dir/${addresses.join('/')}`;
    window.open(url, '_blank');
  };

  // Calculate map center based on orders with coordinates
  const mapCenter = useMemo(() => {
    const ordersWithCoords = todaysOrders.filter((o) => o.lat && o.lng);
    if (ordersWithCoords.length === 0) {
      return [54.6872, 25.2797] as [number, number]; // Default to Vilnius
    }

    const sumLat = ordersWithCoords.reduce((sum, o) => sum + (o.lat || 0), 0);
    const sumLng = ordersWithCoords.reduce((sum, o) => sum + (o.lng || 0), 0);
    return [sumLat / ordersWithCoords.length, sumLng / ordersWithCoords.length] as [number, number];
  }, [todaysOrders]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Logistika</h2>
          <p className="text-sm text-slate-500">{formatDate(new Date().toISOString())}</p>
        </div>
        <button
          onClick={handleOpenMaps}
          disabled={todaysOrders.length === 0}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Navigation size={18} />
          Maršrutas
        </button>
      </div>

      {todaysOrders.length === 0 ? (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">Šiandien užsakymų nėra.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-slate-200" />

            <div className="space-y-6">
              {todaysOrders.map((order, index) => {
                const isCompleted = order.status === 'atlikta';
                const isPending = order.status === 'suplanuota';

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={order.id}
                    className="relative pl-16"
                  >
                    {/* Timeline Dot */}
                    <div
                      className={`absolute left-4 top-4 w-6 h-6 rounded-full border-4 border-slate-50 flex items-center justify-center ${
                        isCompleted ? 'bg-emerald-500' : isPending ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={12} className="text-white" />
                      ) : (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>

                    {/* Order Card */}
                    <div
                      className={`bg-white p-5 rounded-3xl border ${isCompleted ? 'border-emerald-100 opacity-75' : 'border-slate-100 shadow-sm'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Clock
                            size={16}
                            className={isCompleted ? 'text-emerald-500' : 'text-blue-500'}
                          />
                          <span className="font-black text-slate-900">{order.time}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-600'
                              : isPending
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 mb-1">{order.clientName}</h3>

                      <div className="flex items-start gap-2 text-slate-500 text-sm mt-3 bg-slate-50 p-3 rounded-2xl">
                        <MapPin size={16} className="shrink-0 mt-0.5 text-slate-400" />
                        <span className="font-medium leading-snug">{order.address}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="h-[600px] bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-sm sticky top-6 z-0">
            <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
              <ChangeView center={mapCenter} zoom={12} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {todaysOrders
                .filter((o) => o.lat && o.lng)
                .map((order) => (
                  <Marker key={order.id} position={[order.lat!, order.lng!]}>
                    <Popup>
                      <div className="font-sans">
                        <div className="font-bold text-sm mb-1">
                          {order.time} - {order.clientName}
                        </div>
                        <div className="text-xs text-slate-500">{order.address}</div>
                        <div className="text-xs font-semibold mt-1 text-blue-600">
                          {order.status}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}
