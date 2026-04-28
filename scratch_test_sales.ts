import { analyticsEngine } from './apps/api/src/sales/analyticsEngine.js';
import { bookingEngine } from './apps/api/src/sales/bookingEngine.js';
import { leadCapture } from './apps/api/src/sales/leadCapture.js';
import { leadScorer } from './apps/api/src/sales/leadScorer.js';
import { salesAgent } from './apps/api/src/sales/salesAgent.js';

console.log('Successfully loaded all sales modules');
console.log('Analytics:', typeof analyticsEngine);
console.log('Booking:', typeof bookingEngine);
console.log('LeadCapture:', typeof leadCapture);
console.log('LeadScorer:', typeof leadScorer);
console.log('SalesAgent:', typeof salesAgent);
