export type ActionState = {
  status: "idle" | "error" | "success";
  message: string;
  errors?: Record<string, string[]>;
};

export const initialActionState: ActionState = {
  status: "idle",
  message: "",
};
