# WORKFLOW.md

How a person actually uses this app, end to end. Written from the user's
perspective — what they do and see, not how it's implemented.

## 1. Starting a trip

1. User creates a new trip, giving it a name and a rough date range (e.g.
   "Japan, October 2026"). The date range can be adjusted later — it's a
   starting point, not a commitment.
2. The trip opens to an empty timeline with a single prompt: add the first
   checkpoint (usually the outbound flight).

## 2. Building the itinerary before departure

This is the primary planning workflow, done ahead of the trip with time to
think it through.

1. User adds checkpoints one at a time, in roughly chronological order,
   picking a type each time (flight, train, metro, hotel, point of
   interest, other).
2. For a flight: departure/arrival airports and times, and optionally a
   linked booking (confirmation number, airline).
3. For a hotel: the user adds it once as a "base" covering a date range
   (check-in to check-out), rather than as a single point in time — it
   represents where they're sleeping across several nights, not a single
   event.
4. For a layover: added as its own checkpoint between two flight legs, with
   its own duration, so it's visible on the timeline rather than hidden
   inside a flight's details.
5. As the itinerary fills in, the user can reorder checkpoints by dragging,
   or insert a new one directly between two existing ones — inserting
   between is the default, not appending to the end, since plans get
   rearranged constantly while planning.
6. Alongside the committed timeline, the user builds a separate shortlist
   of "alternatives" — points of interest they're interested in but haven't
   committed to a day/time yet. These live outside the timeline entirely
   until promoted onto it.
7. At any point, the user can attach free-form notes to a checkpoint —
   reminders, addresses, confirmation details, things not to forget.

## 3. Reviewing the plan

- The timeline view gives a scrollable, chronological read of the whole
  trip — every flight, hotel stay, and activity in order.
- The map view shows the same checkpoints plotted geographically, useful
  for sanity-checking whether a day's plan makes sense distance-wise (e.g.
  noticing two POIs on the same day are an hour apart).
- Selecting a checkpoint in one view highlights it in the other.

## 4. Sharing with a travel companion

1. User invites a friend to the trip (by email/account).
2. The friend gets full read/edit access to the same trip — they see the
   same timeline and map, not a separate copy.
3. Either person can add, edit, or remove checkpoints and alternatives.
   Changes made by one person appear for the other without either having to
   manually refresh or re-share anything, as long as both are online.
4. If one person edits while offline, their changes sync in once they're
   back online — they don't need to be connected at the moment they make an
   edit.

## 5. During the trip

This is the workflow that matters most, because it happens in the least
convenient conditions: on a phone, one-handed, possibly with no signal.

1. User opens the app to see "what's next" — the timeline naturally
   surfaces the current/upcoming checkpoint rather than requiring them to
   scroll and find today's date.
2. Plans change: a flight delay, a decision to skip a POI, a spontaneous
   addition. The user edits or adds a checkpoint the same way they did
   during planning — there's no separate "trip mode" with reduced
   capability. Anything editable before departure is editable mid-trip.
3. Edits made with no connectivity are saved locally immediately and appear
   to have "worked" right away; they sync to the shared trip once a
   connection is available.
4. If the user has an alternative saved (a POI they shortlisted but didn't
   commit to), they can promote it onto the timeline in the moment — e.g.
   deciding on the spot to visit somewhere they'd bookmarked.

## 6. After the trip

- The timeline remains as a record of what actually happened (as edited
  during travel), doubling as a trip log/journal rather than only being a
  disposable planning tool.

## Workflow this app deliberately does NOT support

- It does not book anything (flights, hotels) — it tracks bookings made
  elsewhere via notes and a linked reference, it isn't a booking engine.
- It does not require the itinerary to be "finished" before it's useful —
  a half-planned trip with gaps is a valid, expected state, not an error
  condition.
