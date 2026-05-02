export type ProjectWithMembers = {
  id: string;
  name: string;
  description: string | null;
  ai_prompt_context: string | null;
  created_at: string;
  project_members: { user_id: string }[];
};

export type UserRow = {
  id: string;
  username: string;
  role: string;
  created_at: string;
};

export type TokenRow = {
  id: string;
  token: string;
  created_at: string;
};
