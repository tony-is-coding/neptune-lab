import { z } from 'zod/v4';
export declare const TodoItemSchema: () => z.ZodObject<{
    content: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        pending: "pending";
        in_progress: "in_progress";
    }>;
    activeForm: z.ZodString;
}, z.core.$strip>;
export type TodoItem = z.infer<ReturnType<typeof TodoItemSchema>>;
export declare const TodoListSchema: () => z.ZodArray<z.ZodObject<{
    content: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        pending: "pending";
        in_progress: "in_progress";
    }>;
    activeForm: z.ZodString;
}, z.core.$strip>>;
export type TodoList = z.infer<ReturnType<typeof TodoListSchema>>;
//# sourceMappingURL=types.d.ts.map