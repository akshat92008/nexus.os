type ToolHandler = (params: any, ctx: any) => Promise<any>;

class SkillBus {
  private tools = new Map<string, ToolHandler>();

  register(toolName: string, handler: ToolHandler) {
    this.tools.set(toolName, handler);
  }

  async call(toolName: string, params: any, ctx?: any): Promise<any> {
    const handler = this.tools.get(toolName);
    if (!handler) throw new Error(`SkillBus: tool "${toolName}" not registered`);
    return handler(params, ctx || {});
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}

export const skillBus = new SkillBus();
