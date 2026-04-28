export class SkillRuntime {
  async getToolsForSkills(skills: string[]): Promise<any[]> {
    return skills.map((skill) => ({
      type: 'function',
      function: {
        name: `skill_${skill}`,
        description: `Tool surface for skill ${skill}`,
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    }));
  }
}

export const skillRuntime = new SkillRuntime();

