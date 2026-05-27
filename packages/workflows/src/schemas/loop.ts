/**
 * Zod schema for loop node configuration.
 */
import { z } from '@hono/zod-openapi';
import { isValidCommandName } from '../command-validation';

export const loopNodeConfigSchema = z
  .object({
    /** Inline prompt text executed each iteration. Mutually exclusive with `command`. */
    prompt: z.string().min(1, "'loop.prompt' must be a non-empty string").optional(),
    /**
     * Named command file (under `.archon/commands/`) whose body is loaded as the iteration
     * prompt. Resolved with repo → home → bundled precedence, identical to `command:` nodes.
     * Mutually exclusive with `prompt`.
     */
    command: z.string().min(1, "'loop.command' must be a non-empty string").optional(),
    /** Completion signal string detected in AI output (e.g., "COMPLETE"). */
    until: z.string().min(1, "loop node requires 'loop.until' (completion signal string)"),
    /** Maximum iterations allowed; exceeding this fails the node. */
    max_iterations: z.number().int().positive("'loop.max_iterations' must be a positive integer"),
    /** Whether to start fresh session each iteration (default: false). */
    fresh_context: z.boolean().default(false),
    /** Optional bash script run after each iteration; exit 0 = complete. */
    until_bash: z.string().optional(),
    /** When true, pause between iterations for user input via /workflow approve. */
    interactive: z.boolean().optional(),
    /** Message shown to user when paused (required when interactive is true). */
    gate_message: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasPrompt = typeof data.prompt === 'string' && data.prompt.length > 0;
    const hasCommand = typeof data.command === 'string' && data.command.length > 0;

    if (hasPrompt && hasCommand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "loop node accepts exactly one of 'loop.prompt' or 'loop.command' (both were provided)",
        path: ['command'],
      });
    } else if (!hasPrompt && !hasCommand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "loop node requires either 'loop.prompt' (inline) or 'loop.command' (file)",
        path: ['prompt'],
      });
    }

    if (hasCommand && !isValidCommandName((data.command ?? '').trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid command name "${(data.command ?? '').trim()}" — must not contain path separators, '..', or start with '.'`,
        path: ['command'],
      });
    }

    if (data.interactive === true && !data.gate_message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "interactive loop requires 'loop.gate_message' (non-empty string)",
        path: ['gate_message'],
      });
    }
  });

export type LoopNodeConfig = z.infer<typeof loopNodeConfigSchema>;
