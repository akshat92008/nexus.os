import { logger } from '../logger.js';

type EventHandler<T = any> = (event: T) => void | Promise<void>;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  async publish<T = any>(topic: string, event: T): Promise<void> {
    const listeners = Array.from(this.handlers.get(topic) ?? []);

    await Promise.all(
      listeners.map(async (listener) => {
        try {
          await listener(event);
        } catch (err) {
          logger.warn({ err, topic }, '[EventBus] Listener failed');
        }
      }),
    );
  }

  async subscribe<T = any>(topic: string, handler: EventHandler<T>): Promise<() => void> {
    const listeners = this.handlers.get(topic) ?? new Set<EventHandler>();
    listeners.add(handler as EventHandler);
    this.handlers.set(topic, listeners);
    return () => this.unsubscribe(topic, handler as EventHandler);
  }

  unsubscribe(topic: string, handler: EventHandler): void {
    const listeners = this.handlers.get(topic);
    if (!listeners) return;
    listeners.delete(handler);
    if (listeners.size === 0) {
      this.handlers.delete(topic);
    }
  }
}

export const eventBus = new EventBus();

