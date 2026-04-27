import { logger } from '../logger.js';

export interface IntegrationDriver {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  execute(action: string, payload: any): Promise<any>;
}

class IntegrationManager {
  private drivers: Map<string, IntegrationDriver> = new Map();

  constructor() {
    this.registerMockDrivers();
  }

  private registerMockDrivers() {
    const defaultDrivers = [
      'slack', 'gmail', 'notion', 'hubspot', 'calendar', 'docs', 'search', 'github', 'email'
    ];

    for (const name of defaultDrivers) {
      this.drivers.set(name, {
        name,
        status: name === 'email' ? 'connected' : 'disconnected',
        execute: async (action: string, payload: any) => {
          logger.info(`[IntegrationManager] Mock executing ${name}.${action}`);
          if (this.drivers.get(name)?.status === 'disconnected') {
            return { success: false, error: `${name} is not connected. Action skipped.` };
          }
          return { success: true, result: `Executed ${action} on ${name} successfully.` };
        }
      });
    }
  }

  getStatus() {
    const status: Record<string, string> = {};
    for (const [name, driver] of this.drivers.entries()) {
      status[name] = driver.status;
    }
    return status;
  }

  async execute(driverName: string, action: string, payload: any): Promise<any> {
    const driver = this.drivers.get(driverName);
    if (!driver) {
      return { success: false, error: `Driver ${driverName} not found.` };
    }
    return driver.execute(action, payload);
  }
}

export const integrationManager = new IntegrationManager();
