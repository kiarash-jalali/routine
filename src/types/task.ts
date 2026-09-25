export type Task = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  due_has_time: boolean;
  is_done: boolean;
  created_at: string;
  updated_at: string;
};
