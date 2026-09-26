# Agent notes

## Assignment display dates

Course events stay on their real dates, including weekends. Assignments get a display date, and today can pull that date forward.

1. If the due time is before 11:59 PM, and the assignment is not all-day, the display date is the previous day. 11:59 PM stays on the due date.
2. If that day is Saturday or Sunday, the display date is the previous Friday. A Monday assignment due before 11:59 PM lands on Sunday after step 1, so step 2 shows it on Friday.
3. If that display date is before today, and the real due date is still today or later, show the assignment on today. It stays on today until the real due date has passed.
4. Once today is after the real due date, show the assignment on that real date.

The gear menu has one switch for each move. Debug Mode is off by default. When it is on, a date picker sets the day the app treats as today, including display moves and Yesterday, Today, and Tomorrow. The choice is stored in `localStorage` under `canvas-calendar-display`. Hover cards explain only the moves that changed the day.
