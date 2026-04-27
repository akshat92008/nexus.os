export interface MissionArtifact {
  taskId: string;
  data: any;
  createdAt?: number;
}

export class MissionMemory {
  private artifacts: MissionArtifact[] = [];

  append(taskId: string, data: any): void {
    this.artifacts.push({
      taskId,
      data,
      createdAt: Date.now(),
    });
  }

  readAll(): MissionArtifact[] {
    return [...this.artifacts];
  }

  clear(): void {
    this.artifacts = [];
  }
}

