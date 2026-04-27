export async function planMission(goal: string, goalType = 'general') {
  return {
    goal,
    goalType,
    plan: [
      {
        id: 'primary',
        action: 'process_command',
        driver: 'nexus',
        payload: { goal },
      },
    ],
  };
}

