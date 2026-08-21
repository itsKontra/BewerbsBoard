import { uiText } from '../../../ui-text';

export type AdminTabId = 'results' | 'participants' | 'broadcast' | 'setup' | 'settings' | 'logs';

export interface AdminTabConfig {
  id: AdminTabId;
  label: string;
  description: string;
  icon: string;
}

export const ADMIN_TABS: AdminTabConfig[] = [
  {
    id: 'results',
    label: uiText.adminTabs.results.label,
    description: uiText.adminTabs.results.description,
    icon: 'Timer',
  },
  {
    id: 'participants',
    label: uiText.adminTabs.participants.label,
    description: uiText.adminTabs.participants.description,
    icon: 'Users',
  },
  {
    id: 'broadcast',
    label: uiText.adminTabs.broadcast.label,
    description: uiText.adminTabs.broadcast.description,
    icon: 'Radio',
  },
  {
    id: 'setup',
    label: uiText.adminTabs.setup.label,
    description: uiText.adminTabs.setup.description,
    icon: 'LayoutGrid',
  },
  {
    id: 'settings',
    label: uiText.adminTabs.settings.label,
    description: uiText.adminTabs.settings.description,
    icon: 'Settings',
  },
  {
    id: 'logs',
    label: uiText.adminTabs.logs.label,
    description: uiText.adminTabs.logs.description,
    icon: 'ScrollText',
  },
];
