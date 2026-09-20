import type { Bridge, ReminderCardBridge } from './shared/types';
declare global { interface Window { daybook?: Bridge; reminderCard?: ReminderCardBridge } }
