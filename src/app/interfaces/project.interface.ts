export type ProjectTaskStatus = 'to do' | 'doing' | 'on hold' | 'ready for review' | 'done' | 'discontinued';

export interface IProjectTask {
  id: string;
  name: string;
  description: string;
  status: ProjectTaskStatus;
  picture?: string;
}

export interface IProject {
  id: string;
  name: string;
  image?: string;
  description: string;
  startDate: string;
  tasks: IProjectTask[];
}
