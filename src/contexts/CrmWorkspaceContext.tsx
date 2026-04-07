/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext } from 'react';

export type CrmWorkspaceValue = {
  /** owner_id CRM lentelėms (klientai, užsakymai, atmintys, …) */
  dataOwnerId: string;
  /** Prisijungusio naudotojo auth uid */
  authUid: string;
};

const CrmWorkspaceContext = createContext<CrmWorkspaceValue | null>(null);

export function CrmWorkspaceProvider({
  value,
  children,
}: {
  value: CrmWorkspaceValue;
  children: React.ReactNode;
}) {
  return <CrmWorkspaceContext.Provider value={value}>{children}</CrmWorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hookas šalia provider
export function useCrmWorkspace(): CrmWorkspaceValue {
  const v = useContext(CrmWorkspaceContext);
  if (!v) {
    throw new Error('useCrmWorkspace turi būti naudojamas viduje CrmWorkspaceProvider');
  }
  return v;
}
