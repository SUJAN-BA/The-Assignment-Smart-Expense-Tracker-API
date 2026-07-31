# AI Notes

This project was built by me and  with AI help for the initial test suite and a first draft of the README.

## 1. Which parts of the code were AI-generated vs. written by you

### Written by me

- package.json: scripts, dependency list, and Jest setup
- src/server.js: server startup
- src/app.js: Express app setup, JSON parsing, and 404 handling
- src/store.js: reading and writing the JSON data file
- src/validation.js: validation rules for required fields and input format
- src/middleware/errorHandler.js: central error handling
- AI_NOTES.md: this file

### AI-generated

- tests/expenses.test.js: test coverage for create, validation, listing, summaries, and error handling
- tests/filter-and-delete.test.js: tests for category filtering and delete behavior
- scripts/smoke-test.ps1: PowerShell smoke test that checks each requirement against a running server
- src/routes/expenses.js: POST, GET, summary, filter, and DELETE behavior 
- README.md: first draft of the project documentation

## 2. What I validated, tested, or changed in the AI's output, and why

I reviewed the AI-generated tests and then verified the behavior myself to make sure the implementation matched the API requirements rather than just the initial draft.

I specifically validated and adjusted the following:

- HTTP status codes and response bodies for invalid requests, including confirming that malformed JSON and invalid expense data return the expected 400 responses
- summary behavior, including correct totals and rounding for floating-point values
- category filtering, including case-insensitive matching for queries such as ?category=food
- delete behavior, including successful deletion, removal from the stored list, and the correct 404 response for unknown ids
- input validation rules, including rejecting empty or invalid fields and preventing invalid numeric values from being stored

I made these changes because the AI-generated tests were a strong starting point, but I wanted to ensure they reflected the real product behavior I intended to support and that the implementation would hold up under actual usage.

I also validated the API directly by exercising the routes with both valid and invalid payloads, checking the list, summary, filter, and delete flows end to end, and confirming that the results were consistent with the requirements.

## 3. Any AI suggestion I decided not to use, and why

I deliberately did not follow one suggestion to make DELETE return 204 No Content. I kept the response at 200 and included the deleted expense in the body because that gives the client clearer confirmation of what was removed and makes the API more practical to use.

I also chose not to add extra business-rule validation that was not part of the requirements, such as rejecting future dates or restricting categories to a fixed list. I kept the validation focused on the core contract: required fields, valid data types, and proper format, which makes the API simpler, more flexible, and closer to the task requirements.
