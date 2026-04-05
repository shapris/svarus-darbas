import type { OrderStatus } from '../../types';

export const ORDER_STATUS_LABEL_LT: Record<OrderStatus, string> = {
  suplanuota: 'Suplanuota',
  vykdoma: 'Vykdoma',
  atlikta: 'Atlikta',
};

/** Nuotraukų data URL ilgio riba (~localStorage / PostgREST praktika). */
export const MAX_PHOTO_DATA_URL_LENGTH = 900_000;
