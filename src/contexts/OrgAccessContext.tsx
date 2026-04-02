/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext } from 'react';

export type OrgAccessValue = {
  /** Tiksliai `role === 'staff'` — ribojama prieiga prie kainų, integracijų, trynimo ir pan. */
  isRestrictedStaff: boolean;
};

const OrgAccessContext = createContext<OrgAccessValue>({ isRestrictedStaff: false });

export function OrgAccessProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: OrgAccessValue;
}) {
  return <OrgAccessContext.Provider value={value}>{children}</OrgAccessContext.Provider>;
}

export function useOrgAccess(): OrgAccessValue {
  return useContext(OrgAccessContext);
}
