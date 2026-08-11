import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Student = {
  id: string;
  name: string;
  hourly_rate: number;
  color: string;
  created_at: string;
};

export type Lesson = {
  id: string;
  student_id: string;
  start_at: string;
  duration_minutes: number;
  settled: boolean;
  note: string;
  created_at: string;
};

export type LessonWithStudent = Lesson & {
  students: Pick<Student, 'id' | 'name' | 'color' | 'hourly_rate'>;
};
