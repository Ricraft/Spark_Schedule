export interface Task {
  id: string;
  title: string;
  course: string;
  status: 'todo' | 'doing' | 'done';
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Course {
  id: string;
  name: string;
  instructor: string;
  room: string;
  startTime: string;
  endTime: string;
  day: string;
  color: string;
}

export interface Stat {
  subject: string;
  score: number;
  credits: number;
  semester: string;
}