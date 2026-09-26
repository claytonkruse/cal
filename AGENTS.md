# Agent notes

## Assignment display dates

Moves apply only when the real due date is after today. A due date of today or earlier stays on that day. Course events stay on their real dates, including weekends.

Default moves, applied in this order:

1. If the due time is before 11:59 PM, and the assignment is not all-day, show it on the previous day. 11:59 PM stays on the due date.
2. If that day, or the real due date, is Saturday or Sunday, show the assignment on the previous Friday. A Monday assignment due before 11:59 PM lands on Sunday after step 1, so step 2 shows it on Friday. Do not leave that assignment on Sunday.

The gear menu has one switch for each move. Debug Mode is off by default. When it is on, the date it sets is used everywhere the app means today, including display moves and Yesterday, Today, and Tomorrow. The choice is stored in `localStorage` under `canvas-calendar-display`. Hover cards explain only the moves that changed the day.
