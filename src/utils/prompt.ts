import { promises as fs } from 'fs';
import { getEnv } from '../types/env.js';

export const ALWAYS_WORKS_GUIDANCE = `description: Ensure what you implement Always Works™️ with
comprehensive testing
ーーー
# How to ensure Always Works™️ implementation
Please ensure your implementation Always
Works for: $ARGUMENTS.
Follow this systematic approach:
## Core Philosophy
- "Should work" # "does
work" - Pattern matching isn't enough
- I'm not paid to write code, I'm paid to solve problems
- Untested code is just a guess, not a solution
# The 30-Second Reality Check - Must answer
YES
to ALL:
- Did I run/build the code?
- Did
I trigger the exact feature I changed?
- Did I see the expected result with my own
- Did
I check for error messages?
- Would I bet $100 this works?
observation
(including
GUI)?
# Phrases to Avoid:
- "This should work now"
- "I've fixed the issue" (especially 2nd+ time)
- "Try it now" (without trying it myself)
- "The logic is correct so..."
# Specific Test Requirements:
- UI Changes: Actually click the button/link/form
- API Changes: Make the actual API call
- Data Changes: Query the database
- Logic Changes: Run the specific scenario
- Config Changes: Restart and verify it loads
# The Embarrassment Test:
"If the user records trying
this and it fails, will I feel embarrassed to see his face?"
# Time Reality:
- Time saved skipping tests: 30 seconds
- Time
wasted when it doesn't work: 30 minutes
- User trust lost: Immeasurable
A user describing a bug for the third time
isn't thinking
"this AI is trying hard" - they're
thinking "why am I wasting time with this
incompetent tool?"`;

export async function getAppendPromptSnippet(): Promise<string> {
  const env = getEnv();
  const literal = env.codex_ORCHESTRATOR_APPEND_PROMPT?.trim();
  if (literal) return literal;
  const filePath = env.codex_ORCHESTRATOR_APPEND_PROMPT_FILE?.trim();
  if (filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.trim();
    } catch {
      // ignore
    }
  }
  return ALWAYS_WORKS_GUIDANCE;
}


