/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSettings, Order, Client } from './types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export function calculateOrderPrice(
  windowCount: number,
  floor: number,
  additionalServices: {
    balkonai: boolean;
    vitrinos: boolean;
    terasa: boolean;
    kiti: boolean;
  },
  settings: AppSettings
): number {
  let total = windowCount * settings.pricePerWindow;
  
  if (floor > 1) {
    total += (floor - 1) * settings.pricePerFloor;
  }
  
  if (additionalServices.balkonai) total += settings.priceBalkonai;
  if (additionalServices.vitrinos) total += settings.priceVitrinos;
  if (additionalServices.terasa) total += settings.priceTerasa;
  if (additionalServices.kiti) total += settings.priceKiti;
  
  return total;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('lt-LT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('lt-LT');
}

export function formatDuration(minutes: number): string {
  if (!minutes) return '';
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} d.`);
  if (hours > 0) parts.push(`${hours} val.`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} min.`);

  return parts.join(' ');
}

export async function geocodeAddress(address: string): Promise<{ lat: number, lng: number } | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Lithuania')}`);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export function generateInvoicePDF(order: Order, client: Client) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(22);
  doc.text('SĄSKAITA FAKTŪRA', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Serija SD Nr. ${order.id.slice(0, 8).toUpperCase()}`, 105, 28, { align: 'center' });
  doc.text(`Data: ${formatDate(new Date().toISOString())}`, 105, 34, { align: 'center' });

  // Vendor Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Paslaugos teikėjas:', 20, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('Švarus Darbas MB', 20, 56);
  doc.text('Įm. kodas: 305678912', 20, 62);
  doc.text('PVM kodas: LT100012345612', 20, 68);
  doc.text('Adresas: Vilniaus g. 10, Vilnius', 20, 74);

  // Client Info
  doc.setFont('helvetica', 'bold');
  doc.text('Pirkėjas:', 120, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(client.name, 120, 56);
  doc.text(client.phone, 120, 62);
  doc.text(client.address, 120, 68);

  // Table
  const tableData = [
    ['Langų valymas', `${order.windowCount} vnt.`, formatCurrency(order.totalPrice / order.windowCount), formatCurrency(order.totalPrice)]
  ];

  if (order.additionalServices.balkonai) tableData.push(['Balkonų valymas', '1 pasl.', '-', '-']);
  if (order.additionalServices.vitrinos) tableData.push(['Vitrinų valymas', '1 pasl.', '-', '-']);
  if (order.additionalServices.terasa) tableData.push(['Terasos valymas', '1 pasl.', '-', '-']);

  (doc as any).autoTable({
    startY: 90,
    head: [['Paslauga', 'Kiekis', 'Kaina', 'Suma']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.text(`Iš viso mokėti: ${formatCurrency(order.totalPrice)}`, 190, finalY + 20, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Ačiū, kad naudojatės mūsų paslaugomis!', 105, 280, { align: 'center' });

  doc.save(`saskaita_${order.clientName.replace(/\s+/g, '_')}_${order.date}.pdf`);
}
